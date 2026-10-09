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
installed package as it is copied: stamped with its version, but a file of the template)
and the local file of the product:

- unchanged in the frontend: replaced by the upstream;
- changed in the frontend only: kept;
- changed in both: merged by `git merge-file` (Git is needed then), with conflict markers
  where the two change the same or adjacent lines;
- added upstream: added (never over a file of the product: the update fails);
- removed upstream: deleted when unchanged in the frontend, otherwise kept (the product's);
- deleted in the frontend: not restored;
- not text (an image) and changed on both sides: kept, reported, to be merged by hand.

The template (the frontend itself: `package.json`, the configs, `src/app/`, its guide) is
updated the same way: the product changes it, and the new version is merged with the
changes; but a file of the template is never deleted: removed (or renamed) upstream, it is
kept and reported, the product's from now on. A template copied by a version that kept no
pristine copy of it (its lock entry has no files) is adopted: the template of this version
is recorded as its base without a merge, and the files that differ from it are reported,
for the developer to review against the pristine copy.

The conflicts of an update are recorded in the lock (`conflicts`): until their markers are
resolved, `update --check` and `front.W004` report them, and `update` refuses to run. The
copies changed in the frontend (`changed`: a file of a vendored asset or a component that
differs from the hash of the lock) are what the next update merges: `front.W007` reports
them, before a conflict does.

The stamp lines are compared and merged at the new version, so that they never conflict;
every written file of a vendored asset or a component has the new stamp. The assets that a
new version requires and the frontend does not have are copied as `add` copies them, and
the copies of the JSON Schemas in `spec/schema/` are made those of the package. Everything
is read and merged before anything is written (`plan`): on a `CopyError` nothing is
written; the conflicts are written, and reported. Then the pristine copies of the new
version replace the old ones and the lock records them (`apply`).
"""

import os
import re
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
    copied,
    copy_asset,
    foreign_files,
    hashes,
    missing_capabilities,
    modified_files,
    restamp,
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
#: not text, changed in the frontend and in bazis-front: kept, merged by hand
BINARY = 'binary'
#: of a template adopted without a pristine copy, different from this version: kept, reviewed by hand
DIFFERS = 'differs'
#: of a template adopted without a pristine copy, not in the frontend: not added
MISSING = 'missing'

DESCRIPTIONS = {
    REPLACED: 'replaced (unchanged in the frontend)',
    MERGED: 'merged with the changes of the frontend',
    CONFLICT: 'CONFLICT: changed in the frontend and in bazis-front, resolve the markers',
    KEPT: 'kept (changed in the frontend only)',
    ADDED: 'added',
    REMOVED: 'removed (no longer in bazis-front)',
    ORPHANED: 'kept: no longer in bazis-front (the product\'s now)',
    DELETED: 'not restored (deleted in the frontend)',
    BINARY: 'KEPT: changed in the frontend and in bazis-front, not text: merge it by hand '
    'with its pristine copy in .bazis/base/',
    DIFFERS: 'kept: differs from the template of bazis-front, review it against its pristine '
    'copy in .bazis/base/',
    MISSING: 'missing: new in this version or removed by the product; add it from its pristine '
    'copy in .bazis/base/ if the product needs it',
}

#: the statuses that write a new version of a file of bazis-front
UPSTREAM = (REPLACED, MERGED, CONFLICT, ADDED)

#: the names of the two sides in the conflict markers
LOCAL_NAME = 'frontend'
#: a line of the conflict markers that `update` writes (the first or the last of a conflict)
MARKER = re.compile(rf'^(?:<<<<<<< {LOCAL_NAME}|>>>>>>> bazis-front \S+)$', re.MULTILINE)

#: the npm manifest of the template: `npm install` after a change of it
PACKAGE_JSON = 'package.json'

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
    #: copied by a version that kept no pristine copy of it (the template): adopted, no merge
    untracked: bool = False


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

    @property
    def dependencies_changed(self) -> bool:
        """Whether the update brings a new `package.json` of the template (not one kept)."""
        return any(
            it.path == PACKAGE_JSON and it.status in UPSTREAM
            for asset in self.assets if asset.asset is not None and asset.asset.kind == TEMPLATE
            for it in asset.files
        )


def copies(asset: Asset, version: str) -> dict[str, tuple[str, bytes]]:
    """
    The files of an asset as this version copies them: their name in the asset and their
    contents (`copied`), by their path in the frontend.
    """
    return {asset.target_path(name): (name, copied(asset, name, version)) for name in asset.files}


def is_stale(entry: dict, asset: Asset, version: str) -> bool:
    """
    Whether the copy of the lock is not the one this version makes.
    """
    return entry != {
        'version': version,
        'files': hashes({path: data for path, (_, data) in copies(asset, version).items()}),
    }


def unresolved(frontend: Path, lock: dict) -> list[str]:
    """
    The files of the conflicts of the last update (`conflicts` of the lock) that still have
    its markers (`<<<<<<< frontend`, `>>>>>>> bazis-front <version>` lines): in any file,
    whatever the compiler of its type checks.
    """
    result = []
    for path in lock.get('conflicts', []):
        target = frontend / path
        text = target.read_bytes().decode('utf-8', 'replace') if target.is_file() else ''
        if MARKER.search(text):
            result.append(path)
    return result


def unresolved_message(paths: list[str]) -> str:
    return (
        f'The conflicts of the last update are not resolved in {", ".join(paths)}: resolve '
        f'their markers (<<<<<<< {LOCAL_NAME}, =======, >>>>>>> bazis-front <version>). A line '
        'of the file that only looks like a marker: remove its path from `conflicts` of '
        f'{frontend_lock.LOCK_FILE}.'
    )


def stale(root: Path, frontend: Path, lock: dict) -> list[str]:
    """
    What `update` would change, without reading the pristine copies or merging: the
    comparison of `update --check` and of the system check `front.W004`.
    """
    version = __version__
    registry = load()
    present = lock.get('assets', {})
    names = list(present)
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
    if conflicts := unresolved(frontend, lock):
        problems.append(unresolved_message(conflicts))
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


def changed(frontend: Path, lock: dict) -> dict[str, list[str]]:
    """
    The files of the copies of the vendored assets and of the components that differ from
    the hash of the lock (changed or deleted in the frontend), by asset: what the next update
    merges with the new version. The template is the product's (changed by design), and an
    asset that bazis-front no longer has is reported by `stale`.
    """
    registry = load()
    result = {}
    for name, entry in sorted(lock.get('assets', {}).items()):
        if name not in registry or registry[name].kind == TEMPLATE:
            continue
        if paths := modified_files(frontend, entry):
            result[name] = paths
    return result


def merge(path: str, asset: str, base: bytes, local: bytes, upstream: bytes, version: str) -> FileUpdate:
    """
    A file changed in the frontend, updated from its pristine copy of the old version (the
    stamp lines of the three made those of the new version first). A file that is not UTF-8
    text (an image) is kept as it is: it is reported when bazis-front changed it too.
    """
    try:
        base_text, local_text, upstream_text = (it.decode('utf-8') for it in (base, local, upstream))
    except UnicodeDecodeError:
        return FileUpdate(path, KEPT if base == upstream else BINARY)
    base_text, local_text = (restamp(it, asset, version) for it in (base_text, local_text))
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
    bazis-front (all its files are removed upstream). A file of the template is never
    deleted: removed upstream, it is the product's.
    """
    template = asset is not None and asset.kind == TEMPLATE
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
                updates.append(FileUpdate(path, ORPHANED if template else REMOVED))
            elif new != local:
                updates.append(FileUpdate(path, REPLACED, new))
        elif new is None:
            updates.append(FileUpdate(path, ORPHANED))
        elif new == local:
            # the frontend has the new version already (a binary file too): nothing to do
            continue
        else:
            try:
                base = pristine(frontend, name, entry, path, relative)
                updates.append(merge(path, name, base, local, new, version))
            except CopyError as err:
                errors += err.messages
    if errors:
        raise CopyError(errors)
    return updates


def untracked_files(frontend: Path, asset: Asset, version: str) -> list[FileUpdate]:
    """
    The files of an asset copied without a pristine copy (the template of a development
    version that kept none, its lock entry without files), adopted: nothing is written, the
    files of this version become its base, and those that differ are reported for the
    developer to review against it (they are the product's changes from then on), those
    that are missing too (new in this version, or removed by the product: not added).
    """
    updates = []
    for path, (_, new) in copies(asset, version).items():
        target = frontend / path
        if not target.is_file():
            updates.append(FileUpdate(path, MISSING))
        elif target.read_bytes() != new:
            updates.append(FileUpdate(path, DIFFERS))
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
        if name not in present:
            errors.append(
                f'{name} is not in the frontend: copy it with `manage.py bazis_front add {name}`.'
                if name in registry else f'There is no asset {name} in the frontend.'
            )
    if conflicts := unresolved(frontend, lock):
        errors.append(unresolved_message(conflicts) + ' Then update again.')
    if errors:
        raise CopyError(errors)

    selected = list(names) or list(present)
    order = resolve([it for it in selected if it in registry], registry)
    errors += missing_capabilities([it for it in order if it.name not in present], capabilities)
    result = Plan(version)
    for asset in order:
        entry = present.get(asset.name)
        if entry is None:
            errors += foreign_files(frontend, asset, asset.files, version)
            result.assets.append(AssetUpdate(asset.name, None, asset))
        elif is_stale(entry, asset, version):
            untracked = 'files' not in entry
            try:
                files = (
                    untracked_files(frontend, asset, version) if untracked
                    else update_files(frontend, asset.name, entry, asset, version)
                )
            except CopyError as err:
                errors += err.messages
            else:
                result.assets.append(
                    AssetUpdate(asset.name, entry.get('version'), asset, files, untracked)
                )
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
                'version': version, 'files': copy_asset(update.asset, frontend, version),
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
    # the files with markers, which `update --check` and front.W004 report until resolved
    lock.pop('conflicts', None)
    if plan.conflicts:
        lock['conflicts'] = sorted(plan.conflicts)
    frontend_lock.write(frontend, lock)

