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
The frontend of a product and its lock, `frontend/bazis-front.lock.json`: the versions and
hashes of what bazis-front wrote there.

```json
{"lock": 1,
 "contract": {"openapi.json": "sha256:…"},
 "generated": {"src/bazis/generated/contract.ts": "sha256:…",
               "src/bazis/generated/schema.d.ts": "sha256:…"},
 "assets": {"client": {"version": "0.1.0", "files": {"src/bazis/client/client.ts": "sha256:…"}},
            "template": {"version": "0.1.0", "files": {"package.json": "sha256:…"}}},
 "e2e": {"spec": {"spec/product.yaml": "sha256:…"},
         "generated": {"e2e/generated/product.ts": "sha256:…"}}}
```

`contract` has the hash of the OpenAPI from which `schema.d.ts` of `generated` was made (the
other generated files are compared with what the contract renders); a generated file that
could not be made is `"missing"`. The hashes of the files of
an asset are those of its pristine copy in `.bazis/base/<asset>@<version>/`. An asset that set npm
dependencies in `package.json` (the map) has them in `npm`, `{section: {package: version}}`. `e2e`
(written by `bazis_front e2e`, `spec/e2e.py`) has the hashes of the specs from which the
end-to-end tests were generated and of the tests. `conflicts` (written by `bazis_front
update`, absent without them) lists the files that its last run wrote with conflict markers.

The files generated from the contract and the specs are compared with their rendered text
byte for byte, written and recorded with the helpers below (`stale_files`, `write_files`,
`generation`, `generation_changes`), the same for the contract, the theme and the tests.
"""

import hashlib
import json
from collections.abc import Iterable
from pathlib import Path

from django.conf import settings

from ..contract.openapi import dumps


#: the version of the format of the lock; a change of it is a minor release
LOCK_FORMAT = 1

#: the directory of the frontend in the product root
FRONTEND_DIR = 'frontend'

LOCK_FILE = 'bazis-front.lock.json'

#: the pristine copies of the vendored assets, `<asset>@<version>/` in the frontend
BASE_DIR = '.bazis/base'


class LockError(Exception):
    """
    The lock cannot be read.
    """


def frontend_dir() -> Path:
    """
    `frontend/` in the product root (BASE_DIR, the directory of `manage.py`).
    """
    return Path(settings.BASE_DIR) / FRONTEND_DIR


def digest(data: bytes) -> str:
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def read(frontend: Path) -> dict | None:
    """
    The lock of the frontend; None when there is none, i.e. the directory is not a frontend
    made by `bazis_front init`.
    """
    path = frontend / LOCK_FILE
    if not path.is_file():
        return None
    try:
        lock = json.loads(path.read_text(encoding='utf-8'))
    except ValueError as err:
        raise LockError(f'{path} is not valid JSON: {err}') from err
    if not isinstance(lock, dict) or lock.get('lock') != LOCK_FORMAT:
        raise LockError(
            f'{path} is not a lock of format {LOCK_FORMAT}: it was written by another '
            'version of bazis-front.'
        )
    return lock


def write(frontend: Path, lock: dict) -> None:
    (frontend / LOCK_FILE).write_text(dumps(lock), encoding='utf-8', newline='\n')


def file_hashes(root: Path, paths: Iterable[str]) -> dict[str, str]:
    """
    The hashes of the files of these paths in the directory, by path; a missing file has none.
    """
    return {path: digest((root / path).read_bytes()) for path in paths if (root / path).is_file()}


def stale_files(directory: Path, rendered: dict[str, str]) -> list[str]:
    """
    The paths of the rendered files that are missing in the directory or differ from their
    text, byte for byte (also in their line endings).
    """
    return [
        path for path, text in rendered.items()
        if not (target := directory / path).is_file() or target.read_bytes() != text.encode('utf-8')
    ]


def write_files(directory: Path, rendered: dict[str, str]) -> None:
    """
    Writes the rendered files in the directory, UTF-8 with `\\n`.
    """
    for path, text in rendered.items():
        target = directory / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding='utf-8', newline='\n')


def generation(spec: dict[str, str], rendered: dict[str, str]) -> dict:
    """
    The record of the files generated from specs (`design`, `e2e`): the hashes of the specs
    and of the files.
    """
    return {
        'spec': spec,
        'generated': {path: digest(text.encode('utf-8')) for path, text in rendered.items()},
    }


def generation_changes(
    recorded: dict, spec: dict[str, str], frontend: Path, names: list[str]
) -> tuple[list[str], list[str]]:
    """
    Why the stale generated files `names` of a record of `generation` differ: the specs whose
    hashes changed since, and the files of `names` edited after they were generated.
    """
    previous, generated = recorded.get('spec', {}), recorded.get('generated', {})
    changed = sorted(it for it in {*previous, *spec} if previous.get(it) != spec.get(it))
    edited = [
        it for it in names
        if it in generated and (frontend / it).is_file()
        and digest((frontend / it).read_bytes()) != generated[it]
    ]
    return changed, edited
