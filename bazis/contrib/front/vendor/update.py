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
The update of the copies of the assets in the frontend of a product to the installed
version of bazis-front (`bazis_front update`).

A copy is stale when its entry in the lock is not the one a copy of the installed package
would have (another version, other files or other contents), when its asset is no longer in
the registry, or when an asset it requires is not in the frontend. Each file of a stale
copy is updated from three versions: the base (the pristine copy of the old version in
`.bazis/base/<asset>@<old>/`, whose hash is in the lock), the upstream (the file of the
installed package, stamped with its version) and the local file of the product:

- unchanged in the frontend: replaced by the upstream;
- changed in the frontend only: kept;
- changed in both: merged by `git merge-file` (Git is needed then), with conflict markers
  where the two change the same or adjacent lines;
- added upstream: added (never over a file of the product: the update fails);
- removed upstream: deleted when unchanged in the frontend, otherwise kept (the product's);
- deleted in the frontend: not restored.

The stamp lines are compared and merged at the new version, so that they never conflict;
every written file has the new stamp. The assets that a new version requires and the
frontend does not have are copied as `add` copies them, and the copies of the JSON Schemas
in `spec/schema/` are made those of the package. Everything is read and merged before
anything is written (`plan`): on a `CopyError` nothing is written; the conflicts are
written, and reported. Then the pristine copies of the new version replace the old ones and
the lock records them (`apply`). The template is the product's and never updated: the
versions of the npm dependencies of its `package.json` are reported (`dependency_changes`).
"""

import json
import os
import shutil
import subprocess
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path

from .. import __version__
from ..spec.create import schema_updates
from ..spec.validate import SCHEMA_DIR, SPEC_DIR
from . import lock as frontend_lock
from .copy import (
    CopyError,
    base_dir,
    copy_vendored,
    foreign_files,
    hashes,
    missing_capabilities,
    restamp,
    stamped,
    write_base,
    write_file,
)
from .registry import TEMPLATE, Asset, load, resolve


#: unchanged in the frontend: replaced by the new version
REPLACED = 'replaced'
#: changed in the frontend and in bazis-front, merged without conflicts
MERGED = 'merged'
#: changed in the frontend and in bazis-front on the same or adjacent lines: with the markers
CONFLICT = 'conflict'
#: changed in the frontend only: kept (with the new stamp)
KEPT = 'kept'
#: new in bazis-front
ADDED = 'added'
#: no longer in bazis-front and unchanged in the frontend: deleted
REMOVED = 'removed'
#: no longer in bazis-front and changed in the frontend: kept, the product's from now on
ORPHANED = 'orphaned'
#: deleted in the frontend: not restored
DELETED = 'deleted'

DESCRIPTIONS = {
    REPLACED: 'replaced (unchanged in the frontend)',
    MERGED: 'merged with the changes of the frontend',
    CONFLICT: 'CONFLICT: changed in the frontend and in bazis-front, resolve the markers',
    KEPT: 'kept (changed in the frontend only)',
    ADDED: 'added',
    REMOVED: 'removed (no longer in bazis-front)',
    ORPHANED: 'kept: no longer in bazis-front, changed in the frontend (the product\'s now)',
    DELETED: 'not restored (deleted in the frontend)',
}

#: the names of the two sides in the conflict markers
LOCAL_NAME = 'frontend'

#: `git merge-file` without the configuration of the system, of the user or of a repository
#: (a hook or `git rebase -x` passes GIT_DIR): the same markers everywhere; the conflict style
#: is also set on the command line, which wins over any configuration
GIT_ENV = {'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': os.devnull}
GIT_REPOSITORY_ENV = ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT')


@dataclass
class FileUpdate:
    #: the path in the frontend
    path: str
    status: str
    #: the new contents; None when the file is not written
    data: bytes | None = None


@dataclass
class AssetUpdate:
    name: str
    #: the version in the lock; None for an asset that the update copies (required by another)
    old: str | None
    #: the asset of the registry; None when it is no longer in bazis-front
    asset: Asset | None
    files: list[FileUpdate] = field(default_factory=list)


@dataclass
class Plan:
    version: str
    #: in the order of their requirements, the assets no longer in bazis-front last
    assets: list[AssetUpdate] = field(default_factory=list)
    #: the copies of the JSON Schemas to write, by their path in the product root
    schemas: dict[str, bytes] = field(default_factory=dict)

    def __bool__(self) -> bool:
        return bool(self.assets or self.schemas)

    @property
    def conflicts(self) -> list[str]:
        return [it.path for asset in self.assets for it in asset.files if it.status == CONFLICT]


def copies(asset: Asset, version: str) -> dict[str, tuple[str, bytes]]:
    """
    The files of an asset as this version copies them: their name in the asset and their
    stamped contents, by their path in the frontend.
    """
    return {asset.target_path(name): (name, stamped(asset, name, version)) for name in asset.files}


def is_stale(entry: dict, asset: Asset, version: str) -> bool:
    """
    Whether the copy of the lock is not the one this version makes.
    """
    return entry != {
        'version': version,
        'files': hashes({path: data for path, (_, data) in copies(asset, version).items()}),
    }


def updatable(lock: dict, registry: dict[str, Asset]) -> list[str]:
    """
    The copied assets that `update` brings to the installed version: all of the lock but the
    template, which the product owns.
    """
    return [
        name for name in lock.get('assets', {})
        if name not in registry or registry[name].kind != TEMPLATE
    ]


def stale(root: Path, frontend: Path, lock: dict) -> list[str]:
    """
    What `update` would change, without reading the pristine copies or merging: the
    comparison of `update --check` and of the system check `front.W004`.
    """
    version = __version__
    registry = load()
    present = lock.get('assets', {})
    names = updatable(lock, registry)
    gone = [f'{it} {present[it].get("version")}' for it in names if it not in registry]
    old = [
        f'{it} {present[it].get("version")}' for it in names
        if it in registry and is_stale(present[it], registry[it], version)
    ]
    missing = [
        it.name for it in resolve([it for it in names if it in registry], registry)
        if it.name not in present
    ]
    schemas = [f'{SPEC_DIR}/{SCHEMA_DIR}/{it}' for it in schema_updates(root / SPEC_DIR)]
    problems = []
    if old:
        problems.append(
            f'The copies of {", ".join(old)} in the frontend are not those of bazis-front '
            f'{version}.'
        )
    if gone:
        problems.append(f'bazis-front {version} no longer has {", ".join(gone)}.')
    if missing:
        problems.append(f'The frontend lacks {", ".join(missing)}, required by bazis-front {version}.')
    if schemas:
        problems.append(
            f'The copies of the JSON Schemas {", ".join(schemas)} are not those of bazis-front '
            f'{version}.'
        )
    return problems


def merge(path: str, asset: str, base: bytes, local: bytes, upstream: bytes, version: str) -> FileUpdate:
    """
    A file changed in the frontend, updated from its pristine copy of the old version (the
    stamp lines of the three made those of the new version first).
    """
    try:
        base_text, local_text = (restamp(it.decode('utf-8'), asset, version) for it in (base, local))
    except UnicodeDecodeError as err:
        raise CopyError([f'{path} is not UTF-8 text: it cannot be merged ({err}).']) from err
    upstream_text = upstream.decode('utf-8')
    if base_text == upstream_text:
        return FileUpdate(path, KEPT, local_text.encode('utf-8'))
    merged, conflicts = merge_file(path, base_text, local_text, upstream_text, version)
    return FileUpdate(path, CONFLICT if conflicts else MERGED, merged)


def merge_file(path: str, base: str, local: str, upstream: str, version: str) -> tuple[bytes, int]:
    """
    The three-way merge of `git merge-file` (the markers `<<<<<<< frontend`, `=======`,
    `>>>>>>> bazis-front <version>`) and the number of its conflicts. Git is needed only
    here, for a file changed in the frontend and in bazis-front.
    """
    if (git := shutil.which('git')) is None:
        raise CopyError([
            'Git is not found: `update` merges the files changed in the frontend and in '
            'bazis-front with `git merge-file`. Install Git and run it again.'
        ])
    with tempfile.TemporaryDirectory() as directory:
        for name, text in (('local', local), ('base', base), ('upstream', upstream)):
            (Path(directory) / name).write_bytes(text.encode('utf-8'))
        result = subprocess.run(
            [
                git, '-c', 'merge.conflictStyle=merge', 'merge-file', '-p',
                '-L', LOCAL_NAME, '-L', 'base',
                '-L', f'bazis-front {version}', 'local', 'base', 'upstream',
            ],
            cwd=directory,
            env={
                **{key: value for key, value in os.environ.items() if key not in GIT_REPOSITORY_ENV},
                **GIT_ENV,
            },
            capture_output=True,
            check=False,
        )
    # the number of the conflicts (at most 127), or an error
    if not 0 <= result.returncode <= 127:
        raise CopyError([
            f'{path} cannot be merged: `git merge-file` failed '
            f'({result.stderr.decode("utf-8", "replace").strip()}).'
        ])
    return result.stdout, result.returncode


def pristine(frontend: Path, name: str, entry: dict, path: str, relative: str) -> bytes:
    """
    The pristine copy of a file of the old version: in `.bazis/base/`, with the hash of the
    lock.
    """
    base = base_dir(frontend, name, entry.get('version')) / relative
    shown = base.relative_to(frontend).as_posix()
    if not base.is_file():
        raise CopyError([
            f'{shown} is missing: the pristine copy of {name} {entry.get("version")} is needed '
            f'to merge the changes of {path}. Restore it from Git (commit '
            f'{frontend_lock.BASE_DIR}/ with the frontend).'
        ])
    data = base.read_bytes()
    if frontend_lock.digest(data) != entry['files'][path]:
        raise CopyError([
            f'{shown} is not the pristine copy of the lock: the files of '
            f'{frontend_lock.BASE_DIR}/ are never edited. Restore it from Git.'
        ])
    return data


def update_files(frontend: Path, name: str, entry: dict, asset: Asset | None, version: str) -> list[FileUpdate]:
    """
    The updates of the files of a copied asset; `asset` is None when it is no longer in
    bazis-front (all its files are removed upstream).
    """
    locked = entry.get('files', {})
    upstream = copies(asset, version) if asset else {}
    errors = []
    if asset:
        errors += foreign_files(
            frontend, asset, [it for path, (it, _) in upstream.items() if path not in locked], version,
        )
    updates = []
    for path in sorted(locked.keys() | upstream.keys()):
        target = frontend / path
        local = target.read_bytes() if target.is_file() else None
        relative, new = upstream.get(path, (None, None))
        if path not in locked:
            updates.append(FileUpdate(path, ADDED, new))
        elif local is None:
            if new is not None:
                updates.append(FileUpdate(path, DELETED))
        elif frontend_lock.digest(local) == locked[path]:
            if new is None:
                updates.append(FileUpdate(path, REMOVED))
            elif new != local:
                updates.append(FileUpdate(path, REPLACED, new))
        elif new is None:
            updates.append(FileUpdate(path, ORPHANED))
        else:
            try:
                base = pristine(frontend, name, entry, path, relative)
                updates.append(merge(path, name, base, local, new, version))
            except CopyError as err:
                errors += err.messages
    if errors:
        raise CopyError(errors)
    return updates


def plan(
    root: Path,
    frontend: Path,
    lock: dict,
    names: Sequence[str],
    capabilities: Callable[[], set[str]],
) -> Plan:
    """
    The update of the copied assets of the names (all when there are none) and of those they
    require to the installed version, read and merged in memory. An asset whose copy is the
    one of this version is left as it is. Raises a `CopyError` with every problem found.
    """
    version = __version__
    registry = load()
    present = lock.get('assets', {})
    errors = []
    for name in names:
        if name in registry and registry[name].kind == TEMPLATE:
            errors.append(
                f'{name} is the product\'s: `update` does not change it (see the npm '
                'dependencies it reports).'
            )
        elif name not in present:
            errors.append(
                f'{name} is not in the frontend: copy it with `manage.py bazis_front add {name}`.'
                if name in registry else f'There is no asset {name} in the frontend.'
            )
    if errors:
        raise CopyError(errors)

    selected = list(names) or updatable(lock, registry)
    order = resolve([it for it in selected if it in registry], registry)
    errors += missing_capabilities([it for it in order if it.name not in present], capabilities)
    result = Plan(version)
    for asset in order:
        entry = present.get(asset.name)
        if entry is None:
            errors += foreign_files(frontend, asset, asset.files, version)
            result.assets.append(AssetUpdate(asset.name, None, asset))
        elif is_stale(entry, asset, version):
            try:
                files = update_files(frontend, asset.name, entry, asset, version)
            except CopyError as err:
                errors += err.messages
            else:
                result.assets.append(AssetUpdate(asset.name, entry.get('version'), asset, files))
    for name in selected:
        if name not in registry:
            entry = present[name]
            files = update_files(frontend, name, entry, None, version)
            result.assets.append(AssetUpdate(name, entry.get('version'), None, files))
    if errors:
        raise CopyError(list(dict.fromkeys(errors)))
    result.schemas = {
        f'{SPEC_DIR}/{SCHEMA_DIR}/{name}': data
        for name, data in schema_updates(root / SPEC_DIR).items()
    }
    return result


def remove_file(frontend: Path, path: str) -> None:
    """
    Deletes a file of the frontend and the directories it leaves empty.
    """
    target = frontend / path
    target.unlink()
    for parent in target.parents:
        if parent == frontend or any(parent.iterdir()):
            break
        parent.rmdir()


def apply(root: Path, frontend: Path, lock: dict, plan: Plan) -> None:
    """
    Writes the update: the files, the pristine copies of the new version in place of the old
    ones, the copies of the JSON Schemas, and the lock last.
    """
    version = plan.version
    present = lock.setdefault('assets', {})
    for update in plan.assets:
        if update.old is None:
            present[update.name] = {
                'version': version, 'files': copy_vendored(update.asset, frontend, version),
            }
            continue
        for it in update.files:
            if it.status == REMOVED:
                remove_file(frontend, it.path)
            elif it.data is not None:
                write_file(frontend / it.path, it.data)
        old = base_dir(frontend, update.name, update.old)
        if update.asset is None:
            del present[update.name]
        else:
            # replaces the pristine copy of this version when the old one is of it too
            present[update.name] = {
                'version': version, 'files': hashes(write_base(update.asset, frontend, version)),
            }
        if (update.asset is None or update.old != version) and old.exists():
            shutil.rmtree(old)
    for path, data in plan.schemas.items():
        write_file(root / path, data)
    frontend_lock.write(frontend, lock)


def dependency_changes(frontend: Path) -> list[str]:
    """
    The npm dependencies of the `package.json` of the template whose versions the
    `package.json` of the frontend does not have: the template is the product's, `update`
    reports them and never changes them.
    """
    template = json.loads(load()['template'].read('package.json'))
    try:
        product = json.loads((frontend / 'package.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as err:
        return [f'package.json of the frontend cannot be read: {err}']
    declared = {**product.get('devDependencies', {}), **product.get('dependencies', {})}
    return [
        f'{section} {name}: {declared.get(name, "(none)")} -> {wanted}'
        for section in ('dependencies', 'devDependencies')
        for name, wanted in sorted(template.get(section, {}).items())
        if declared.get(name) != wanted
    ]
