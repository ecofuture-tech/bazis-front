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
The copies of the assets: in a new frontend (`bazis_front init`), and of the components in
an existing one (`bazis_front add`).
"""

import os
import shutil
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from pathlib import Path

from .. import __version__
from . import lock as frontend_lock
from .registry import TEMPLATE, UI, VENDORED, Asset, load, resolve


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


def stamped(asset: Asset, name: str, version: str) -> bytes:
    """
    A file of a vendored asset or of a component as it is copied: with the version stamp.
    """
    return stamp(asset.read(name).decode('utf-8'), asset.name, version).encode('utf-8')


def copy_vendored(asset: Asset, frontend: Path, version: str) -> dict[str, str]:
    """
    Copies the files of a vendored asset or of a component into the frontend with the
    version stamp, and the same pristine copies into `.bazis/base/<asset>@<version>/`.
    Returns their hashes by their path in the frontend.
    """
    base = frontend / frontend_lock.BASE_DIR / f'{asset.name}@{version}'
    hashes = {}
    for name in asset.files:
        data = stamped(asset, name, version)
        write_file(frontend / asset.target_path(name), data)
        write_file(base / name, data)
        hashes[asset.target_path(name)] = frontend_lock.digest(data)
    return hashes


def create_frontend(frontend: Path, capabilities: Iterable[str]) -> None:
    """
    Creates the frontend from the template, the vendored assets of the registry that the
    capabilities of the product allow and the components marked `init` (with the assets they
    require), with its lock. The frontend must not exist: it is built in a temporary
    directory next to it and renamed, so that a failure leaves nothing behind.
    """
    version = __version__
    capabilities = set(capabilities)
    registry = load()
    if unknown := [it.name for it in registry.values() if it.kind not in (TEMPLATE, VENDORED, UI)]:
        raise ValueError(f'unknown kind of the assets {unknown}')
    copied = resolve(
        [it.name for it in registry.values() if it.kind == VENDORED or (it.kind == UI and it.init)],
        registry,
    )
    temporary = frontend.with_name(f'.{frontend.name}.init-{os.getpid()}')
    temporary.mkdir()
    try:
        template = registry['template']
        for name in template.files:
            write_file(temporary / template.target_path(name), template.read(name))
        assets = {template.name: {'version': version}}
        for asset in copied:
            if asset.wanted(capabilities):
                files = copy_vendored(asset, temporary, version)
                assets[asset.name] = {'version': version, 'files': files}
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


class AddError(Exception):
    """
    `add` copies nothing: the messages say why.
    """

    def __init__(self, messages: Sequence[str]):
        super().__init__('\n'.join(messages))
        self.messages = list(messages)


@dataclass
class Added:
    #: the assets copied, in their order
    copied: list[str] = field(default_factory=list)
    #: the assets already in the frontend, kept as they are
    present: list[str] = field(default_factory=list)


def modified_files(frontend: Path, entry: dict) -> list[str]:
    """
    The files of a copied asset that differ from their pristine copy (its hash in the lock),
    or are missing.
    """
    return sorted(
        path for path, digest in entry.get('files', {}).items()
        if not (frontend / path).is_file()
        or frontend_lock.digest((frontend / path).read_bytes()) != digest
    )


def add_assets(
    frontend: Path,
    lock: dict,
    names: Sequence[str],
    capabilities: Callable[[], set[str]],
) -> Added:
    """
    Copies the components (or other assets but the template) of the names into the frontend
    with the assets they require, as `init` copies the vendored assets: stamped, with their
    pristine copies in `.bazis/base/` and their hashes in the lock, which is written last.
    An asset already in the frontend is kept; a component named again that was changed
    there is refused (`update` will merge it). `capabilities` returns those of the contract,
    read only when an asset requires one. Everything is checked before anything is written:
    on an `AddError` nothing is.
    """
    version = __version__
    registry = load()
    errors = []
    for name in names:
        if name not in registry:
            addable = ', '.join(sorted(it.name for it in registry.values() if it.kind == UI))
            errors.append(f'There is no asset {name}. The components: {addable}.')
        elif registry[name].kind == TEMPLATE:
            errors.append(f'{name} is copied by `bazis_front init` only.')
    if errors:
        raise AddError(errors)

    assets = resolve(names, registry)
    present = lock.get('assets', {})
    missing = [it for it in assets if it.name not in present]
    if any(it.capabilities for it in missing):
        available = capabilities()
        errors += [
            f'{it.name} requires the capabilities {", ".join(it.capabilities)}, which the '
            f'contract does not have: install the package, add its app to INSTALLED_APPS and '
            f'export the contract again.'
            for it in missing if not it.wanted(available)
        ]

    result = Added()
    to_copy = []
    for asset in assets:
        entry = present.get(asset.name)
        if entry is None:
            to_copy.append(asset)
            # a file of the frontend that this asset would replace: written by the product
            errors += [
                f'{asset.target_path(name)} exists and is not the copy of {asset.name}: '
                f'`add` does not overwrite it. Move it away and add {asset.name} again.'
                for name in asset.files
                if (frontend / asset.target_path(name)).is_file()
                and (frontend / asset.target_path(name)).read_bytes() != stamped(asset, name, version)
            ]
        elif asset.name in names and entry.get('version') != version:
            errors.append(
                f'{asset.name} {entry.get("version")} is in the frontend, bazis-front is '
                f'{version}: `add` does not replace it; `bazis_front update` will.'
            )
        elif asset.name in names and (changed := modified_files(frontend, entry)):
            errors.append(
                f'{asset.name} was changed in the frontend ({", ".join(changed)}): `add` does '
                f'not overwrite it; `bazis_front update` will merge the new versions.'
            )
        else:
            result.present.append(asset.name)
    if errors:
        raise AddError(errors)

    for asset in to_copy:
        present[asset.name] = {'version': version, 'files': copy_vendored(asset, frontend, version)}
        result.copied.append(asset.name)
    lock['assets'] = present
    frontend_lock.write(frontend, lock)
    return result
