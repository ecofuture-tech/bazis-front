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
an existing one (`bazis_front add`). `update.py` brings them to a new version.
"""

import os
import re
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


def restamp(text: str, asset: str, version: str) -> str:
    """
    The text of a copy of the asset with its stamp line (where it is, if it is there) of
    another version: the copies of two versions are compared and merged without it.
    """
    return re.sub(
        rf'^// bazis-front \S+ asset {re.escape(asset)}$',
        f'// bazis-front {version} asset {asset}',
        text,
        count=1,
        flags=re.MULTILINE,
    )


def write_file(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def stamped(asset: Asset, name: str, version: str) -> bytes:
    """
    A file of a vendored asset or of a component as it is copied: with the version stamp.
    """
    return stamp(asset.read(name).decode('utf-8'), asset.name, version).encode('utf-8')


def base_dir(frontend: Path, asset: str, version: str) -> Path:
    """
    The pristine copy of an asset in the frontend, `.bazis/base/<asset>@<version>/`.
    """
    return frontend / frontend_lock.BASE_DIR / f'{asset}@{version}'


def hashes(copies: dict[str, bytes]) -> dict[str, str]:
    """
    The hashes of the lock of the copies of an asset, by their path in the frontend.
    """
    return {path: frontend_lock.digest(data) for path, data in copies.items()}


def write_base(asset: Asset, frontend: Path, version: str) -> dict[str, bytes]:
    """
    Writes the pristine copy of a vendored asset or of a component, stamped, in
    `.bazis/base/<asset>@<version>/` (replacing one that is there), and returns its files by
    their path in the frontend.
    """
    base = base_dir(frontend, asset.name, version)
    if base.exists():
        shutil.rmtree(base)
    copies = {}
    for name in asset.files:
        data = stamped(asset, name, version)
        write_file(base / name, data)
        copies[asset.target_path(name)] = data
    return copies


def copy_vendored(asset: Asset, frontend: Path, version: str) -> dict[str, str]:
    """
    Copies the files of a vendored asset or of a component into the frontend with the
    version stamp, and the same pristine copies into `.bazis/base/<asset>@<version>/`.
    Returns their hashes by their path in the frontend.
    """
    copies = write_base(asset, frontend, version)
    for path, data in copies.items():
        write_file(frontend / path, data)
    return hashes(copies)


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


class CopyError(Exception):
    """
    `add` or `update` writes nothing: the messages say why.
    """

    def __init__(self, messages: Sequence[str]):
        super().__init__('\n'.join(messages))
        self.messages = list(messages)


def missing_capabilities(assets: Sequence[Asset], capabilities: Callable[[], set[str]]) -> list[str]:
    """
    The messages of the assets to copy that require capabilities the product does not have;
    `capabilities` (those of the contract) is called only when one of them requires one.
    """
    if not any(it.capabilities for it in assets):
        return []
    available = capabilities()
    return [
        f'{it.name} requires the capabilities {", ".join(it.capabilities)}, which the '
        'contract does not have: install the package, add its app to INSTALLED_APPS and '
        'export the contract again.'
        for it in assets if not it.wanted(available)
    ]


def foreign_files(frontend: Path, asset: Asset, names: Iterable[str], version: str) -> list[str]:
    """
    The messages of the files of the frontend at the paths of these files of an asset to copy
    that are not their copy: written by the product, they are never overwritten. A file that
    is the copy is taken over.
    """
    return [
        f'{asset.target_path(name)} exists and is not the copy of {asset.name}: bazis-front '
        'does not overwrite it. Move it away and run the command again.'
        for name in names
        if (frontend / asset.target_path(name)).is_file()
        and (frontend / asset.target_path(name)).read_bytes() != stamped(asset, name, version)
    ]


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
    there is refused (`update` merges the next versions with the changes), and so is any
    asset of another version of bazis-front, named or required: the copies are of one
    version (`update` brings them to this one). `capabilities` returns those of the
    contract, read only when an asset requires one. Everything is checked before anything
    is written: on a `CopyError` nothing is.
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
        raise CopyError(errors)

    assets = resolve(names, registry)
    present = lock.get('assets', {})
    errors += missing_capabilities([it for it in assets if it.name not in present], capabilities)

    result = Added()
    to_copy = []
    for asset in assets:
        entry = present.get(asset.name)
        if entry is None:
            to_copy.append(asset)
            errors += foreign_files(frontend, asset, asset.files, version)
        elif entry.get('version') != version:
            required = '' if asset.name in names else ' (required by what you add)'
            errors.append(
                f'{asset.name} {entry.get("version")} is in the frontend{required}, bazis-front '
                f'is {version}: `add` does not mix the versions of the copies. Update them all '
                'to this version first with `manage.py bazis_front update`.'
            )
        elif asset.name in names and (changed := modified_files(frontend, entry)):
            errors.append(
                f'{asset.name} was changed in the frontend ({", ".join(changed)}): `add` does '
                'not overwrite it; `bazis_front update` merges the next versions of bazis-front '
                'with the changes.'
            )
        else:
            result.present.append(asset.name)
    if errors:
        raise CopyError(errors)

    for asset in to_copy:
        present[asset.name] = {'version': version, 'files': copy_vendored(asset, frontend, version)}
        result.copied.append(asset.name)
    lock['assets'] = present
    frontend_lock.write(frontend, lock)
    return result
