# Copyright 2026 EcoFuture Technology Services LLC and contributors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
The generated files of the frontend of a product (layer 0), in `src/bazis/generated/`:
`contract.ts`, rendered from contract.json (`typescript`), and `schema.d.ts`, the types of
the API generated from openapi.json by openapi-typescript (it needs Node and the
`npm install` of the frontend). The lock of the frontend records the hashes of the
contract they were made from and their own.
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

from .. import __version__
from ..vendor import lock as frontend_lock
from . import typescript


GENERATED_DIR = 'src/bazis/generated'
CONTRACT_TS = f'{GENERATED_DIR}/contract.ts'
SCHEMA_TS = f'{GENERATED_DIR}/schema.d.ts'

#: the lock value of a generated file that could not be made
MISSING = 'missing'


class SchemaError(Exception):
    """
    openapi-typescript failed.
    """


def render_contract_ts(rendered: dict[str, str]) -> str:
    return typescript.render(json.loads(rendered['contract.json']))


def contract_hashes(rendered: dict[str, str]) -> dict[str, str]:
    return {name: frontend_lock.digest(text.encode('utf-8')) for name, text in rendered.items()}


def file_hash(path: Path) -> str | None:
    return frontend_lock.digest(path.read_bytes()) if path.is_file() else None


def stale_files(frontend: Path, lock: dict, rendered: dict[str, str]) -> list[str]:
    """
    The generated files that differ from what the rendered contract gives: `contract.ts`
    is compared byte for byte; `schema.d.ts` (made by Node) by the lock, which must have
    its hash and the hash of the current openapi.json.
    """
    stale = []
    path = frontend / CONTRACT_TS
    if not path.is_file() or path.read_bytes() != render_contract_ts(rendered).encode('utf-8'):
        stale.append(CONTRACT_TS)
    if not schema_is_current(frontend, lock, rendered):
        stale.append(SCHEMA_TS)
    return stale


def schema_is_current(frontend: Path, lock: dict, rendered: dict[str, str]) -> bool:
    recorded = lock.get('generated', {}).get(SCHEMA_TS)
    openapi = contract_hashes(rendered)['openapi.json']
    return (
        recorded not in (None, MISSING)
        and file_hash(frontend / SCHEMA_TS) == recorded
        and lock.get('contract', {}).get('openapi.json') == openapi
    )


def node_unavailable(frontend: Path) -> str | None:
    """
    Why openapi-typescript cannot run in the frontend, None when it can.
    """
    if shutil.which('npx') is None:
        return 'Node (npx) is not found'
    if not (frontend / 'node_modules' / 'openapi-typescript' / 'package.json').is_file():
        return f'openapi-typescript is not installed: run `npm install` in {frontend}'
    return None


def generate_schema(frontend: Path, openapi: Path) -> None:
    """
    `npx --no-install openapi-typescript` of the frontend; `--default-non-nullable=false`
    keeps the fields with a server default optional in the bodies of create.
    """
    result = subprocess.run(
        [
            shutil.which('npx'), '--no-install', 'openapi-typescript',
            Path(os.path.relpath(openapi, frontend)).as_posix(),
            '-o', SCHEMA_TS, '--default-non-nullable=false',
        ],
        cwd=frontend, capture_output=True, text=True, check=False,
    )
    if result.returncode:
        raise SchemaError(
            f'openapi-typescript failed with code {result.returncode}:\n'
            f'{(result.stderr or result.stdout).strip()}'
        )


def write(
    frontend: Path, lock: dict, contract_dir: Path, rendered: dict[str, str], node: bool = True
) -> str | None:
    """
    Writes the generated files from the contract written to `contract_dir` and updates the
    lock. Returns why `schema.d.ts` is missing, None when it is current. A `schema.d.ts`
    that cannot be generated stays recorded when the OpenAPI did not change; otherwise it is
    `missing` in the lock. Raises SchemaError when openapi-typescript fails.
    """
    path = frontend / CONTRACT_TS
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_contract_ts(rendered), encoding='utf-8', newline='\n')
    generated = {CONTRACT_TS: file_hash(path)}

    error = None
    reason = 'the option --no-node is given' if not node else node_unavailable(frontend)
    if reason is None:
        try:
            generate_schema(frontend, contract_dir / 'openapi.json')
        except SchemaError as err:
            error = reason = err
    if reason is None:
        generated[SCHEMA_TS] = file_hash(frontend / SCHEMA_TS)
    elif schema_is_current(frontend, lock, rendered):
        generated[SCHEMA_TS] = lock['generated'][SCHEMA_TS]
        reason = None
    else:
        generated[SCHEMA_TS] = MISSING

    lock.update(bazis_front=__version__, contract=contract_hashes(rendered), generated=generated)
    frontend_lock.write(frontend, lock)
    if error is not None:
        raise error
    return reason
