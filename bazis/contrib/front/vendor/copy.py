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
The copies of the assets in a new frontend (`bazis_front init`).
"""

import os
import shutil
from collections.abc import Iterable
from pathlib import Path

from .. import __version__
from . import lock as frontend_lock
from .registry import TEMPLATE, VENDORED, Asset, load


def stamp(text: str, asset: str, version: str) -> str:
    """
    The text of a vendored file with the line `// bazis-front <version> asset <asset>` after
    its license header (the comment lines it starts with).
    """
    lines = text.splitlines(keepends=True)
    end = 0
    while end < len(lines) and lines[end].startswith('//'):
        end += 1
    return ''.join([*lines[:end], f'// bazis-front {version} asset {asset}\n', *lines[end:]])


def write_file(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def copy_vendored(asset: Asset, frontend: Path, version: str) -> dict[str, str]:
    """
    Copies the files of a vendored asset into the frontend with the version stamp, and the
    same pristine copies into `.bazis/base/<asset>@<version>/`. Returns their hashes by
    their path in the frontend.
    """
    base = frontend / frontend_lock.BASE_DIR / f'{asset.name}@{version}'
    hashes = {}
    for name in asset.files:
        data = stamp(asset.read(name).decode('utf-8'), asset.name, version).encode('utf-8')
        write_file(frontend / asset.target_path(name), data)
        write_file(base / name, data)
        hashes[asset.target_path(name)] = frontend_lock.digest(data)
    return hashes


def create_frontend(frontend: Path, capabilities: Iterable[str]) -> None:
    """
    Creates the frontend from the template and the vendored assets of the registry that the
    capabilities of the product allow, with its lock. The frontend must not exist: it is
    built in a temporary directory next to it and renamed, so that a failure leaves nothing
    behind.
    """
    version = __version__
    capabilities = set(capabilities)
    temporary = frontend.with_name(f'.{frontend.name}.init-{os.getpid()}')
    temporary.mkdir()
    try:
        assets = {}
        for asset in load().values():
            if not asset.wanted(capabilities):
                continue
            if asset.kind == TEMPLATE:
                for name in asset.files:
                    write_file(temporary / asset.target_path(name), asset.read(name))
                assets[asset.name] = {'version': version}
            elif asset.kind == VENDORED:
                files = copy_vendored(asset, temporary, version)
                assets[asset.name] = {'version': version, 'files': files}
            else:
                raise ValueError(f'unknown kind of the asset {asset.name}: {asset.kind}')
        lock = {
            'lock': frontend_lock.LOCK_FORMAT,
            'bazis_front': version,
            'contract': {},
            'generated': {},
            'assets': assets,
        }
        frontend_lock.write(temporary, lock)
        os.rename(temporary, frontend)
    except BaseException:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
