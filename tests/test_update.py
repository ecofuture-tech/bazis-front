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
`bazis_front update`. The frontend of an older version of bazis-front is simulated in a
frontend made by `init`: the copies of an asset, its pristine copy and its lock entry are
written again as those of the version `OLD`, whose files may differ from those of the
installed package (`downgrade`).
"""

import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import override_settings

import pytest

from bazis.contrib.front import __version__, checks
from bazis.contrib.front.spec import screens, validate
from bazis.contrib.front.spec.lint import schema_files
from bazis.contrib.front.vendor import registry
from bazis.contrib.front.vendor import update as vendor_update
from bazis.contrib.front.vendor.copy import base_dir, copied, lock_entry, restamp
from bazis.contrib.front.vendor.lock import digest
from bazis.contrib.front.vendor.npm import with_dependencies

from .support import read_lock, write_contract, write_lock


OLD = '0.0.1'
CLIENT = 'src/bazis/client/client.ts'
MARKERS = ('<<<<<<< frontend\n', '=======\n', f'>>>>>>> bazis-front {__version__}\n')


def update(*args):
    out = StringIO()
    call_command('bazis_front', 'update', *args, stdout=out, stderr=StringIO())
    return out.getvalue()


def files(root):
    return {it: it.read_bytes() for it in root.rglob('*') if it.is_file()}


def downgrade(root, name, edit=lambda path, text: text):
    """
    Makes the copy of an asset that of the version OLD, unchanged in the frontend: `edit`
    returns the text of a file in that version (with its stamp; the data of a binary file, an
    image of the template), None when the version did not have it.
    """
    frontend = root / 'frontend'
    asset = registry.load()[name]
    lock = read_lock(root)
    entry = {}
    for relative in asset.files:
        path = asset.target_path(relative)
        data = (frontend / path).read_bytes()
        try:
            old = restamp(data.decode('utf-8'), name, OLD)
        except UnicodeDecodeError:
            old = data
        old = edit(path, old)
        if old is None:
            (frontend / path).unlink()
            continue
        data = old if isinstance(old, bytes) else old.encode('utf-8')
        (frontend / path).write_bytes(data)
        (base_dir(frontend, name, OLD) / relative).parent.mkdir(parents=True, exist_ok=True)
        (base_dir(frontend, name, OLD) / relative).write_bytes(data)
        entry[path] = digest(data)
    shutil.rmtree(base_dir(frontend, name, __version__))
    lock['assets'][name] = {'version': OLD, 'files': entry}
    write_lock(root, lock)


def add_old_file(root, name, relative, text):
    """
    A file of the version OLD of an asset that the installed version no longer has.
    """
    frontend = root / 'frontend'
    asset = registry.load()[name]
    data = text.encode('utf-8')
    for path in (frontend / asset.target_path(relative), base_dir(frontend, name, OLD) / relative):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    lock = read_lock(root)
    lock['assets'][name]['files'][asset.target_path(relative)] = digest(data)
    write_lock(root, lock)


def change_line(text, index, line):
    lines = text.splitlines(keepends=True)
    lines[index] = line
    return ''.join(lines)


#: the lines of client.ts that the tests change: one after the stamp, one near the end
def early(text):
    return next(i for i, it in enumerate(text.splitlines()) if it.startswith('// bazis-front ')) + 2


def late(text):
    return len(text.splitlines()) - 2


def upstream(path):
    asset, relative = next(
        (it, name) for it in registry.load().values() for name in it.files if it.target_path(name) == path
    )
    return copied(asset, relative, __version__).decode('utf-8')


def assert_updated(root, name):
    """
    The asset is that of the installed version in the lock and in `.bazis/base/`.
    """
    frontend = root / 'frontend'
    asset = registry.load()[name]
    assert read_lock(root)['assets'][name] == lock_entry(
        asset, __version__, {asset.target_path(it): digest(copied(asset, it, __version__)) for it in asset.files},
    )
    for relative in asset.files:
        assert (base_dir(frontend, name, __version__) / relative).read_bytes() == copied(
            asset, relative, __version__,
        )
    assert not base_dir(frontend, name, OLD).exists()


def w004():
    return [it for it in checks.check_update(None) if it.id == 'front.W004']


def test_the_copies_changed_in_the_frontend_are_reported(product):
    """
    front.W007: a file of a vendored asset or of a component changed or deleted in the
    frontend (it differs from the hash of the lock), before an update merges it; never the
    template, which is the product's. The copies stay those of the installed version.
    """
    frontend = product / 'frontend'
    assert checks.check_changed_copies(None) == []
    router = frontend / 'src' / 'app' / 'router.tsx'
    router.write_text(router.read_text(encoding='utf-8') + '// the screens of the product\n', encoding='utf-8')
    assert checks.check_changed_copies(None) == []

    client = frontend / CLIENT
    client.write_text(client.read_text(encoding='utf-8') + '// a fix of the product\n', encoding='utf-8')
    (frontend / 'src' / 'bazis' / 'ui' / 'app-shell' / 'list-card.tsx').unlink()
    [warning] = checks.check_changed_copies(None)
    assert warning.id == 'front.W007'
    assert warning.msg == (
        'Copies of bazis-front were changed in the frontend (they differ from '
        'bazis-front.lock.json): app-shell: src/bazis/ui/app-shell/list-card.tsx; '
        f'client: {CLIENT}.'
    )
    # not stale: the update has nothing to do, and the check of its versions is silent
    assert w004() == []
    assert update('--check').endswith(f'are those of bazis-front {__version__}.\n')


def test_update_replaces_unchanged_copies(product):
    frontend = product / 'frontend'
    downgrade(product, 'client')
    downgrade(product, 'react')
    assert f'// bazis-front {OLD} asset client\n' in (frontend / CLIENT).read_text(encoding='utf-8')
    before = files(product)

    # the check lists the changes and writes nothing
    out = StringIO()
    with pytest.raises(CommandError, match=f'The copies are not those of bazis-front {__version__}'):
        call_command('bazis_front', 'update', '--check', stdout=out)
    assert f'client: {OLD} -> {__version__} (9 files unchanged in the frontend replaced)\n' in out.getvalue()
    assert CLIENT not in out.getvalue()
    assert files(product) == before
    [warning] = w004()
    assert warning.msg == (
        f'The copies of client {OLD}, react {OLD} in the frontend are not those of bazis-front '
        f'{__version__}.'
    )

    out = update()
    assert f'react: {OLD} -> {__version__} (11 files unchanged in the frontend replaced)\n' in out
    assert f'Updated the copies to bazis-front {__version__}.' in out
    assert 'Run `npx tsc --noEmit`, `npm run lint` and `npm test` in frontend/.' in out
    for name in ('client', 'react'):
        assert_updated(product, name)
        asset = registry.load()[name]
        for relative in asset.files:
            assert (frontend / asset.target_path(relative)).read_bytes() == copied(
                asset, relative, __version__,
            )
    assert w004() == []
    assert update('--check').endswith(f'are those of bazis-front {__version__}.\n')
    lock = read_lock(product)
    update()
    assert read_lock(product) == lock


def test_update_keeps_a_change_of_the_frontend_only(product):
    path = product / 'frontend' / CLIENT
    downgrade(product, 'client')
    mine = path.read_text(encoding='utf-8') + '// mine\n'
    path.write_text(mine, encoding='utf-8')

    out = update()
    assert f'  {CLIENT}: kept (changed in the frontend only)\n' in out
    # with the stamp of the new version
    assert path.read_text(encoding='utf-8') == upstream(CLIENT) + '// mine\n'
    assert_updated(product, 'client')


def test_update_applies_a_change_of_bazis_front(product):
    path = product / 'frontend' / CLIENT
    downgrade(
        product, 'client',
        lambda name, text: change_line(text, late(text), '// old\n') if name == CLIENT else text,
    )

    out = update()
    assert f'client: {OLD} -> {__version__} (9 files unchanged in the frontend replaced)\n' in out
    assert path.read_text(encoding='utf-8') == upstream(CLIENT)
    assert_updated(product, 'client')


def test_update_merges_the_changes_of_both(product):
    path = product / 'frontend' / CLIENT
    downgrade(
        product, 'client',
        lambda name, text: change_line(text, late(text), '// old\n') if name == CLIENT else text,
    )
    text = path.read_text(encoding='utf-8')
    path.write_text(change_line(text, early(text), '// mine\n'), encoding='utf-8')

    out = update()
    assert f'  {CLIENT}: merged with the changes of the frontend\n' in out
    new = upstream(CLIENT)
    assert path.read_text(encoding='utf-8') == change_line(new, early(new), '// mine\n')
    assert_updated(product, 'client')
    # the merged file is a change of the frontend from now on
    assert update('--check').endswith(f'are those of bazis-front {__version__}.\n')


def test_update_writes_the_conflicts_and_fails(product):
    path = product / 'frontend' / CLIENT
    downgrade(
        product, 'client',
        lambda name, text: change_line(text, late(text), '// old\n') if name == CLIENT else text,
    )
    text = path.read_text(encoding='utf-8')
    path.write_text(change_line(text, late(text), '// mine\n'), encoding='utf-8')

    out = StringIO()
    with pytest.raises(CommandError, match=f'with conflicts in 1 files: {CLIENT}. Resolve the conflict markers'):
        call_command('bazis_front', 'update', stdout=out)
    assert f'  {CLIENT}: CONFLICT' in out.getvalue()
    new = upstream(CLIENT)
    # the file of bazis-front, whole: its pristine copy of the new version
    whole = f'.bazis/base/client@{__version__}/client.ts'
    assert f'\n{CLIENT}: the file of bazis-front: {whole}\n' in out.getvalue()
    assert (product / 'frontend' / whole).read_text(encoding='utf-8') == new
    theirs = new.splitlines(keepends=True)[late(new)]
    conflict = f'{MARKERS[0]}// mine\n{MARKERS[1]}{theirs}{MARKERS[2]}'
    assert path.read_text(encoding='utf-8') == change_line(new, late(new), conflict)
    # the update is done: the markers are resolved in the frontend
    assert_updated(product, 'client')
    assert read_lock(product)['conflicts'] == [CLIENT]

    # until then, the check and the system check report them, and no update runs
    message = f'The conflicts of the last update are not resolved in {CLIENT}'
    assert w004()[0].msg.startswith(message)
    assert 'remove its path from `conflicts` of bazis-front.lock.json' in w004()[0].msg
    assert '`conflicts` of frontend/bazis-front.lock.json' in w004()[0].hint
    with pytest.raises(CommandError, match=message):
        update('--check')
    with pytest.raises(CommandError, match=message):
        update()
    # a marker on purpose: released by removing the file from the conflicts of the lock
    lock = read_lock(product)
    write_lock(product, {**lock, 'conflicts': []})
    assert w004() == []
    write_lock(product, lock)
    path.write_text(change_line(new, late(new), '// mine\n'), encoding='utf-8')
    assert w004() == []
    assert update('--check').endswith(f'are those of bazis-front {__version__}.\n')


def test_update_adds_and_removes_files(product):
    frontend = product / 'frontend'
    # the version OLD had no pagination.ts, and two files that the installed one has not
    downgrade(
        product, 'client',
        lambda name, text: None if name == 'src/bazis/client/pagination.ts' else text,
    )
    add_old_file(product, 'client', 'legacy.ts', '// legacy\n')
    add_old_file(product, 'client', 'old/mine.ts', '// old\n')
    (frontend / 'src/bazis/client/old/mine.ts').write_text('// changed\n', encoding='utf-8')
    # deleted in the frontend
    (frontend / 'src/bazis/client/filter.ts').unlink()

    out = update()
    assert '  src/bazis/client/pagination.ts: added\n' in out
    assert '  src/bazis/client/legacy.ts: removed (no longer in bazis-front)\n' in out
    assert '  src/bazis/client/old/mine.ts: kept: no longer in bazis-front (the product\'s now)\n' in out
    assert '  src/bazis/client/filter.ts: not restored (deleted in the frontend)\n' in out
    assert (frontend / 'src/bazis/client/pagination.ts').read_text(encoding='utf-8') == upstream(
        'src/bazis/client/pagination.ts'
    )
    assert not (frontend / 'src/bazis/client/legacy.ts').exists()
    assert (frontend / 'src/bazis/client/old/mine.ts').read_text(encoding='utf-8') == '// changed\n'
    assert not (frontend / 'src/bazis/client/filter.ts').exists()
    assert_updated(product, 'client')


def test_update_removes_an_asset_no_longer_in_bazis_front(product):
    frontend = product / 'frontend'
    lock = read_lock(product)
    lock['assets']['gone'] = {'version': OLD, 'files': {}}
    write_lock(product, lock)
    for relative, text in (('a.ts', '// a\n'), ('b.ts', '// b\n')):
        data = text.encode()
        for path in (frontend / 'src/bazis/gone' / relative, base_dir(frontend, 'gone', OLD) / relative):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        lock['assets']['gone']['files'][f'src/bazis/gone/{relative}'] = digest(data)
    write_lock(product, lock)
    assert w004()[0].msg == f'bazis-front {__version__} no longer has gone {OLD}.'

    (frontend / 'src/bazis/gone/b.ts').write_text('// mine\n', encoding='utf-8')
    out = update()
    assert f'gone {OLD}: no longer in bazis-front {__version__}.\n' in out
    assert not (frontend / 'src/bazis/gone/a.ts').exists()
    assert (frontend / 'src/bazis/gone/b.ts').read_text(encoding='utf-8') == '// mine\n'
    assert 'gone' not in read_lock(product)['assets']
    assert not base_dir(frontend, 'gone', OLD).exists()

    # a directory that the removed files leave empty is deleted
    lock = read_lock(product)
    lock['assets']['gone'] = {'version': OLD, 'files': {'src/bazis/gone/b.ts': digest(b'// mine\n')}}
    write_lock(product, lock)
    update()
    assert not (frontend / 'src/bazis/gone').exists()
    assert (frontend / 'src/bazis').is_dir()


#: the photo of the template that the scenarios upload (`upload: {file: photo.png}`)
PHOTO = 'e2e/fixtures/photo.png'


def test_update_adds_the_photo_of_the_template(product):
    """A frontend made before the photo gets it, as it is (a binary file)."""
    downgrade(product, 'template', lambda path, data: None if path == PHOTO else data)
    assert not (product / 'frontend' / PHOTO).exists()

    assert f'  {PHOTO}: added\n' in update()
    assert (product / 'frontend' / PHOTO).read_bytes() == registry.load()['template'].read(PHOTO)
    assert_updated(product, 'template')


def test_update_never_overwrites_the_photo_of_the_product(product):
    """
    A frontend made before the photo of the template, with a photo of its own at its path:
    `update` writes nothing and names the file, which the product moves away.
    """
    downgrade(product, 'template', lambda path, data: None if path == PHOTO else data)
    (product / 'frontend' / PHOTO).write_bytes(b'\x89PNG mine')
    before = files(product)

    with pytest.raises(CommandError, match=f'{PHOTO} exists and is not the copy of template'):
        update()
    assert files(product) == before


def test_update_never_overwrites_a_file_of_the_product(product):
    frontend = product / 'frontend'
    downgrade(
        product, 'client',
        lambda name, text: None if name == 'src/bazis/client/pagination.ts' else text,
    )
    (frontend / 'src/bazis/client/pagination.ts').write_text('mine', encoding='utf-8')
    before = files(product)

    with pytest.raises(CommandError, match='src/bazis/client/pagination.ts exists and is not the copy of client'):
        update()
    assert files(product) == before


def remove_asset(root, name):
    """The frontend without the copy of an asset, as one made before the asset was."""
    frontend = root / 'frontend'
    lock = read_lock(root)
    for path in lock['assets'].pop(name)['files']:
        (frontend / path).unlink()
    shutil.rmtree(base_dir(frontend, name, __version__))
    write_lock(root, lock)


def test_update_copies_what_a_new_version_requires(product):
    frontend = product / 'frontend'
    # the version OLD of state-panel did not require testing
    remove_asset(product, 'testing')
    downgrade(product, 'state-panel')
    assert w004()[0].msg.endswith(f'The frontend lacks testing, required by bazis-front {__version__}.')

    out = update('state-panel')
    assert f'testing: copied ({__version__}), required by a new version.\n' in out
    assert_updated(product, 'testing')
    assert_updated(product, 'state-panel')
    testing = registry.load()['testing']
    for relative in testing.files:
        assert (frontend / testing.target_path(relative)).read_bytes() == copied(
            testing, relative, __version__,
        )


def login_components(root):
    """The components of the frontend that only the login of the template (`LoginForm`) requires."""
    assets = registry.load()
    login = [it.name for it in registry.resolve(['login-form'], assets)]
    others = {
        it.name for it in registry.resolve(
            [*(name for name in assets['template'].assets if name != 'login-form'),
             *(name for name in read_lock(root)['assets'] if name not in [*login, 'template'])],
            assets,
        )
    }
    return [name for name in login if name not in others]


def lacks(warning) -> list[str]:
    """The components that W004 says the frontend lacks."""
    return sorted(warning.msg.rsplit('The frontend lacks ', 1)[1].split(', required by')[0].split(', '))


LOGIN = 'src/screens/login/index.tsx'
OLD_LOGIN = 'export function LoginScreen() {\n  return null;\n}\n'


def test_update_copies_the_components_that_a_new_template_requires(product):
    """
    A frontend of a version whose login was not a `LoginForm` gets `login-form` (and what it
    requires) with the new login.
    """
    frontend = product / 'frontend'
    added = login_components(product)
    assert added[-1] == 'login-form'
    for name in added:
        remove_asset(product, name)
    downgrade(product, 'template', lambda path, text: OLD_LOGIN if path == LOGIN else text)
    assert lacks(w004()[0]) == sorted(added)

    out = update()
    for name in added:
        assert f'{name}: copied ({__version__}), required by a new version.\n' in out
        assert_updated(product, name)
    assert (frontend / LOGIN).read_text(encoding='utf-8') == upstream(LOGIN)
    assert_updated(product, 'template')
    assert w004() == []


def test_update_of_a_frontend_made_before_the_screens(product):
    """
    A frontend made before `bazis_front screens` has no generated screens: its router is its
    own until the update, and `front.W010` says nothing (generated then, they would be refused
    beside its own screens, S029); the router of its updated template imports them, and the
    update and `front.W010` say to generate them.
    """
    lock = read_lock(product)
    del lock['screens']
    write_lock(product, lock)
    shutil.rmtree(product / 'frontend' / screens.GENERATED_DIR)

    def own_router(path, text):
        if path != validate.ROUTER_TSX:
            return text
        return ''.join(it for it in text.splitlines(keepends=True) if "from '@/screens/generated/" not in it)

    downgrade(product, 'template', own_router)
    assert checks.check_screens(None) == []

    out = update()
    assert out.index(screens.NEEDS_SCREENS) < out.index('Updated the copies')
    # `tsc` and the tests are red until the screens are generated: the update never asks for them
    assert '`npx tsc --noEmit` and `npm test` stay red until `bazis_front screens`' in out
    assert '"Migrating the code of the product", step 8' in out
    assert 'docs/releases' not in out
    assert 'Run `npx tsc --noEmit`' not in out
    assert [it.msg for it in checks.check_screens(None)] == [screens.NEEDS_SCREENS]


def test_update_asks_for_the_contract_of_another_format(product):
    """
    A contract exported by an older version (C002) is exported again after the update, which
    says so; a contract of the format of the installed version is not mentioned.
    """
    downgrade(product, 'client')
    assert validate.CONTRACT_OUTDATED not in update()

    contract = product / 'contract' / 'contract.json'
    contract.write_text(json.dumps({**json.loads(contract.read_text(encoding='utf-8')), 'format': 5}), encoding='utf-8')
    downgrade(product, 'client')
    out = update()
    assert out.index(validate.CONTRACT_OUTDATED) < out.index('Updated the copies')


def test_update_copies_no_component_for_a_frontend_without_the_template(product):
    """A lock without the template (the product's frontend) is never given its components."""
    for name in login_components(product):
        remove_asset(product, name)
    lock = read_lock(product)
    del lock['assets']['template']
    write_lock(product, lock)
    assert w004() == []

    out = update()
    assert 'login-form' not in out
    assert 'login-form' not in read_lock(product)['assets']


def test_update_needs_the_capabilities_of_a_new_requirement(product):
    frontend = product / 'frontend'
    write_contract(product, 'permit', 'statusy', 'users')
    call_command('bazis_front', 'add', 'transit-bar', stdout=StringIO())
    lock = read_lock(product)
    for path in lock['assets'].pop('react-statusy')['files']:
        (frontend / path).unlink()
    shutil.rmtree(base_dir(frontend, 'react-statusy', __version__))
    write_lock(product, lock)
    downgrade(product, 'transit-bar')
    write_contract(product, 'permit', 'users')
    before = files(product)

    with pytest.raises(CommandError, match='react-statusy requires the capabilities statusy, which the contract does not have'):
        update()
    assert files(product) == before

    write_contract(product, 'permit', 'statusy', 'users')
    update()
    assert_updated(product, 'react-statusy')
    assert_updated(product, 'transit-bar')


def test_update_refreshes_the_json_schemas_of_the_specs(product):
    schema = product / 'spec' / 'schema' / 'product.schema.json'
    schema.write_text('{}', encoding='utf-8')
    assert w004()[0].msg == (
        'The copies of the JSON Schemas spec/schema/product.schema.json are not those of '
        f'bazis-front {__version__}.'
    )

    out = StringIO()
    with pytest.raises(CommandError):
        call_command('bazis_front', 'update', '--check', stdout=out)
    assert 'spec/schema/product.schema.json: replaced by the copy of bazis-front' in out.getvalue()
    assert schema.read_text(encoding='utf-8') == '{}'

    update()
    assert schema.read_bytes() == schema_files()['product.schema.json'].read_bytes()
    assert w004() == []

    # a product without the copies is left without them
    shutil.rmtree(product / 'spec' / 'schema')
    assert update('--check').endswith(f'are those of bazis-front {__version__}.\n')


def test_update_writes_nothing_without_the_pristine_copy(product):
    frontend = product / 'frontend'
    downgrade(product, 'client')
    downgrade(product, 'react')
    path = frontend / 'src/bazis/react/keys.ts'
    path.write_text(path.read_text(encoding='utf-8') + '// mine\n', encoding='utf-8')

    base = base_dir(frontend, 'react', OLD) / 'keys.ts'
    base.write_text('edited', encoding='utf-8')
    before = files(product)
    with pytest.raises(CommandError, match=r'\.bazis/base/react@0\.0\.1/keys\.ts is not the pristine copy of the lock'):
        update()
    assert files(product) == before

    shutil.rmtree(base_dir(frontend, 'react', OLD))
    before = files(product)
    with pytest.raises(CommandError, match=r'\.bazis/base/react@0\.0\.1/keys\.ts is missing: the pristine copy of react 0\.0\.1 is needed'):
        update()
    # the client, which could be updated, is not either
    assert files(product) == before


def test_update_of_named_assets(product):
    downgrade(product, 'client')
    downgrade(product, 'react')
    downgrade(product, 'state-panel')

    out = update('react')
    # with the client that it requires
    assert out.startswith(f'client: {OLD} -> {__version__} (')
    assert f'react: {OLD} -> {__version__} (' in out
    assert 'state-panel' not in out
    assert read_lock(product)['assets']['state-panel']['version'] == OLD
    assert_updated(product, 'react')

    with pytest.raises(CommandError, match='There is no asset nope in the frontend'):
        update('nope')
    with pytest.raises(CommandError, match='resource-list is not in the frontend: copy it with `manage.py bazis_front add resource-list`'):
        update('resource-list')


PLAYWRIGHT_CONFIG = 'playwright.config.ts'
VITE_CONFIG = 'vite.config.ts'
PACKAGE_JSON = 'package.json'
ROUTER = 'src/app/router.tsx'


def test_update_merges_the_template(product):
    """
    The template is the product's and updated like the copies, from its pristine copy: a
    file that the product did not change is replaced (a fix of playwright.config.ts reaches
    the frontends made before it), a change of the product is kept, both are merged (the cache
    of the dev server of the tests, `cacheDir`, comes into vite.config.ts with the plugins of the
    product), a file deleted in the frontend stays deleted; a new package.json asks for
    `npm install`.
    """
    frontend = product / 'frontend'
    cache = re.compile(r'    // the cache of the optimized dependencies:.*\n.*\n    cacheDir: .*\n')
    plugins = ('plugins: [react(), tailwindcss()],', 'plugins: [react(), tailwindcss(), mine()],')

    def old(path, text):
        if path == PLAYWRIGHT_CONFIG:
            return change_line(text, late(text), '// old\n')
        if path == VITE_CONFIG:
            return cache.sub('', text)
        if path == PACKAGE_JSON:
            return text.replace('"react": "', '"react": "0.0.')
        if path == 'AGENTS.md':
            return change_line(text, 0, '# old\n')
        return text

    downgrade(product, 'template', old)
    package = frontend / PACKAGE_JSON
    package.write_text(
        package.read_text(encoding='utf-8').replace('"private": true,', '"private": true,\n  "description": "mine",'),
        encoding='utf-8',
    )
    router = frontend / ROUTER
    router.write_text(router.read_text(encoding='utf-8') + '// mine\n', encoding='utf-8')
    vite = frontend / VITE_CONFIG
    vite.write_text(vite.read_text(encoding='utf-8').replace(*plugins), encoding='utf-8')
    (frontend / 'AGENTS.md').unlink()
    assert w004()[0].msg == (
        f'The copies of template {OLD} in the frontend are not those of bazis-front {__version__}.'
    )

    out = update()
    assert f'template: {OLD} -> {__version__} (1 files unchanged in the frontend replaced)\n' in out
    assert f'  {PACKAGE_JSON}: merged with the changes of the frontend\n' in out
    assert f'  {ROUTER}: kept (changed in the frontend only)\n' in out
    assert f'  {VITE_CONFIG}: merged with the changes of the frontend\n' in out
    assert '  AGENTS.md: not restored (deleted in the frontend)\n' in out
    assert 'Run `npm install` (its package.json changed). Run `npx tsc --noEmit`' in out
    assert (frontend / PLAYWRIGHT_CONFIG).read_text(encoding='utf-8') == upstream(PLAYWRIGHT_CONFIG)
    assert package.read_text(encoding='utf-8') == upstream(PACKAGE_JSON).replace(
        '"private": true,', '"private": true,\n  "description": "mine",'
    )
    assert router.read_text(encoding='utf-8') == upstream(ROUTER) + '// mine\n'
    assert cache.search(upstream(VITE_CONFIG))
    assert vite.read_text(encoding='utf-8') == upstream(VITE_CONFIG).replace(*plugins)
    assert not (frontend / 'AGENTS.md').exists()
    assert_updated(product, 'template')
    assert w004() == []
    # the deleted file stays deleted, and nothing asks for npm install
    out = update('template')
    assert out.endswith(f'are those of bazis-front {__version__}.\n')


def test_a_conflict_of_the_template_names_its_file_of_bazis_front(product):
    """
    A router that the product changed where the template changed it too conflicts; the lines
    merged without markers stay (a constant of the product that the template now imports
    beside them): `update` names the file of the template to take whole, once it wrote it;
    `--check` writes nothing, and names none.
    """
    downgrade(product, 'template', lambda path, text: change_line(text, late(text), '// old\n') if path == ROUTER else text)
    router = product / 'frontend' / ROUTER
    router.write_text(change_line(router.read_text(encoding='utf-8'), late(upstream(ROUTER)), '// mine\n'), encoding='utf-8')
    whole = f'.bazis/base/template@{__version__}/{ROUTER}'

    out = StringIO()
    with pytest.raises(CommandError, match='are not those of bazis-front'):
        call_command('bazis_front', 'update', '--check', stdout=out)
    assert f'  {ROUTER}: CONFLICT' in out.getvalue()
    assert 'the file of bazis-front' not in out.getvalue()
    assert not (product / 'frontend' / whole).exists()

    out = StringIO()
    with pytest.raises(CommandError, match=r'or take the file of bazis-front listed for one .* fails `tsc` \(TS2440\)'):
        call_command('bazis_front', 'update', stdout=out)
    assert f'\n{ROUTER}: the file of bazis-front: {whole}\n' in out.getvalue()
    assert (product / 'frontend' / whole).read_text(encoding='utf-8') == upstream(ROUTER)


def test_a_conflict_of_package_json_names_no_file_of_bazis_front(product):
    """
    The side of bazis-front of package.json is the template with the npm dependencies of the
    assets, which its pristine copy has not: its conflict is resolved by its markers, never by
    taking that copy.
    """
    old_map(product)
    downgrade(
        product, 'template',
        lambda path, text: text.replace('"private": true,', '"private": false,') if path == PACKAGE_JSON else text,
    )
    package = product / 'frontend' / PACKAGE_JSON
    package.write_text(
        with_dependencies(package.read_text(encoding='utf-8'), OLD_MAP).replace('"private": false,', '"private": null,'),
        encoding='utf-8',
    )

    out = StringIO()
    with pytest.raises(CommandError, match=f'with conflicts in 1 files: {PACKAGE_JSON}') as error:
        call_command('bazis_front', 'update', stdout=out)
    # nor does the error offer one
    assert 'take the file of bazis-front' not in str(error.value)
    assert (
        f'\n{PACKAGE_JSON}: resolve its markers, keeping the npm dependencies on the side of bazis-front '
        '(those of the assets, which no file of bazis-front has), then run `npm install`.\n'
    ) in out.getvalue()
    assert 'the file of bazis-front:' not in out.getvalue()
    assert 'leaflet' not in (base_dir(product / 'frontend', 'template', __version__) / PACKAGE_JSON).read_text(encoding='utf-8')
    assert '"leaflet": "' in package.read_text(encoding='utf-8')


def test_update_asks_for_npm_install_only_for_a_new_package_json(product):
    frontend = product / 'frontend'
    downgrade(
        product, 'template',
        lambda path, text: change_line(text, late(text), '// old\n') if path == PLAYWRIGHT_CONFIG else text,
    )
    # changed in the frontend only: kept, nothing new to install
    package = frontend / PACKAGE_JSON
    package.write_text(
        package.read_text(encoding='utf-8').replace('"private": true,', '"private": true,\n  "description": "mine",'),
        encoding='utf-8',
    )
    out = update()
    assert f'  {PACKAGE_JSON}: kept (changed in the frontend only)\n' in out
    assert 'npm install' not in out
    assert (frontend / PLAYWRIGHT_CONFIG).read_text(encoding='utf-8') == upstream(PLAYWRIGHT_CONFIG)


#: the npm dependencies of the map in the version OLD
OLD_MAP = {'dependencies': {'leaflet': '1.9.3'}, 'devDependencies': {'@types/leaflet': '1.9.20'}}


def old_map(root):
    """The map copied by the version OLD: its files, its lock entry and its npm dependencies."""
    call_command('bazis_front', 'add', 'map', stdout=StringIO())
    downgrade(root, 'map')
    lock = read_lock(root)
    lock['assets']['map']['npm'] = OLD_MAP
    write_lock(root, lock)


def test_update_merges_the_npm_dependencies_of_the_assets_with_the_template(product):
    """
    The npm dependencies that the map set in package.json are part of the base and of the
    upstream of its merge: the new versions replace the old ones, without a conflict with the
    changes of the product or with a change of the template on the next line.
    """
    frontend = product / 'frontend'
    old_map(product)
    downgrade(
        product, 'template',
        lambda path, text: upstream(PACKAGE_JSON).replace('"lucide-react": "', '"lucide-react": "0.') if path == PACKAGE_JSON else text,
    )
    base = (base_dir(frontend, 'template', OLD) / PACKAGE_JSON).read_text(encoding='utf-8')
    assert 'leaflet' not in base
    package = frontend / PACKAGE_JSON
    # as the map of the version OLD set them, with a change of the product
    package.write_text(
        with_dependencies(base, OLD_MAP).replace('"private": true,', '"private": true,\n  "description": "mine",'),
        encoding='utf-8',
    )

    out = update()
    assert f'  {PACKAGE_JSON}: merged with the changes of the frontend\n' in out
    assert 'Run `npm install` (its package.json changed)' in out
    expected = with_dependencies(upstream(PACKAGE_JSON), registry.load()['map'].npm)
    assert package.read_text(encoding='utf-8') == expected.replace('"private": true,', '"private": true,\n  "description": "mine",')
    assert_updated(product, 'map')
    assert_updated(product, 'template')
    assert read_lock(product)['assets']['map']['npm'] == registry.load()['map'].npm
    assert w004() == []


def test_update_sets_the_npm_dependencies_of_an_asset_without_the_template(product):
    frontend = product / 'frontend'
    old_map(product)
    package = frontend / PACKAGE_JSON
    package.write_text(with_dependencies(upstream(PACKAGE_JSON), OLD_MAP), encoding='utf-8')
    assert w004()[0].msg == f'The copies of map {OLD} in the frontend are not those of bazis-front {__version__}.'

    out = update()
    assert f'{PACKAGE_JSON}: the npm dependencies of the assets set\n' in out
    assert 'Run `npm install` (its package.json changed)' in out
    assert package.read_text(encoding='utf-8') == with_dependencies(upstream(PACKAGE_JSON), registry.load()['map'].npm)
    assert_updated(product, 'map')
    assert w004() == []
    # the same dependencies: nothing to install
    assert update().endswith(f'are those of bazis-front {__version__}.\n')


def test_update_keeps_a_version_that_the_product_set(product):
    """
    A dependency of an asset that the product set to another version than the one the asset
    set last is the product's: kept, in the merge of the template (without a conflict) and
    without it, and reported.
    """
    frontend = product / 'frontend'
    old_map(product)
    pinned = {'dependencies': {'leaflet': '1.9.2'}, 'devDependencies': {'@types/leaflet': '1.9.20'}}
    package = frontend / PACKAGE_JSON
    package.write_text(with_dependencies(upstream(PACKAGE_JSON), pinned), encoding='utf-8')

    out = update()
    assert 'package.json keeps the versions of the product: leaflet 1.9.2 (bazis-front sets 1.9.4).' in out
    data = json.loads(package.read_text(encoding='utf-8'))
    assert (data['dependencies']['leaflet'], data['devDependencies']['@types/leaflet']) == ('1.9.2', '1.9.22')
    assert_updated(product, 'map')

    # in the merge of the template, with a change of the template on the next line
    old_map(product)
    downgrade(
        product, 'template',
        lambda path, text: upstream(PACKAGE_JSON).replace('"lucide-react": "', '"lucide-react": "0.') if path == PACKAGE_JSON else text,
    )
    base = (base_dir(frontend, 'template', OLD) / PACKAGE_JSON).read_text(encoding='utf-8')
    package.write_text(with_dependencies(base, pinned), encoding='utf-8')
    out = update()
    assert f'  {PACKAGE_JSON}: merged with the changes of the frontend\n' in out
    assert 'keeps the versions of the product: leaflet 1.9.2' in out
    assert package.read_text(encoding='utf-8') == with_dependencies(
        upstream(PACKAGE_JSON), {'dependencies': {'leaflet': '1.9.2'}, 'devDependencies': {'@types/leaflet': '1.9.22'}},
    )


def test_a_dependency_that_an_asset_no_longer_has_is_removed_unless_the_product_changed_it():
    old = {'dependencies': {'leaflet': '1.9.3', 'gone': '1.0.0', 'kept': '2.0.0'}}
    text = json.dumps({'name': 'frontend', 'dependencies': {'gone': '1.0.0', 'kept': '2.1.0', 'leaflet': '1.9.3', 'react': '19.3.0'}})
    assert json.loads(with_dependencies(text, {'dependencies': {'leaflet': '1.9.4'}}, old)) == {
        'name': 'frontend', 'dependencies': {'kept': '2.1.0', 'leaflet': '1.9.4', 'react': '19.3.0'},
    }
    with pytest.raises(ValueError):
        with_dependencies('<<<<<<< frontend\n', {})


def test_the_markers_left_in_a_file_that_tsc_does_not_read(product):
    # package.json: the compiler of the frontend never sees its markers
    frontend = product / 'frontend'
    downgrade(
        product, 'template',
        lambda path, text: text.replace('"private": true,', '"private": false,') if path == PACKAGE_JSON else text,
    )
    package = frontend / PACKAGE_JSON
    package.write_text(package.read_text(encoding='utf-8').replace('"private": false,', '"private": null,'), encoding='utf-8')
    with pytest.raises(CommandError, match=f'with conflicts in 1 files: {PACKAGE_JSON}'):
        update()
    assert MARKERS[0] in package.read_text(encoding='utf-8')
    assert w004()[0].msg.startswith(f'The conflicts of the last update are not resolved in {PACKAGE_JSON}')
    package.write_text(upstream(PACKAGE_JSON), encoding='utf-8')
    assert w004() == []


def test_update_never_deletes_a_file_of_the_template(product):
    """
    A file of the template that bazis-front removed (or renamed) is the product's: kept and
    reported, even unchanged; a file of a vendored asset is deleted then.
    """
    frontend = product / 'frontend'
    downgrade(product, 'template')
    add_old_file(product, 'template', 'src/app/legacy.ts', '// legacy\n')

    out = update()
    assert "  src/app/legacy.ts: kept: no longer in bazis-front (the product's now)\n" in out
    assert (frontend / 'src/app/legacy.ts').read_text(encoding='utf-8') == '// legacy\n'
    assert_updated(product, 'template')
    assert 'src/app/legacy.ts' not in read_lock(product)['assets']['template']['files']


def test_update_says_what_replaces_a_file_that_the_template_removed(product):
    """
    The files of the template of 0.1.0 that the screens of the specs replace are kept, with
    what replaces them: the name of the product, the home.
    """
    downgrade(product, 'template')
    add_old_file(product, 'template', 'src/app/product.ts', "export const PRODUCT_NAME = 'Library';\n")

    out = update()
    assert (
        "  src/app/product.ts: kept: no longer in bazis-front (the product's now)\n"
        f"    {vendor_update.REPLACED_BY['src/app/product.ts']}\n"
    ) in out


@dataclass(frozen=True)
class Images(registry.Asset):
    """An asset with a binary file, an image of the template."""

    data: bytes = b''

    def read(self, name: str) -> bytes:
        return self.data


def test_update_keeps_a_binary_file_changed_in_the_frontend(tmp_path):
    """
    A file that is not text (an image of the template) is never merged and never fails the
    update: changed in the frontend, it is kept, and reported when bazis-front changed it too.
    """
    old, mine, new = b'\x89PNG\x00old', b'\x89PNG\x00mine\xff', b'\x89PNG\x00new\xfe'
    frontend = tmp_path
    (base_dir(frontend, 'images', OLD)).mkdir(parents=True)
    (base_dir(frontend, 'images', OLD) / 'logo.png').write_bytes(old)
    (frontend / 'logo.png').write_bytes(mine)
    entry = {'version': OLD, 'files': {'logo.png': digest(old)}}

    def updated(data):
        asset = Images('images', registry.TEMPLATE, 'images', '', ('logo.png',), data=data)
        return vendor_update.update_files(frontend, 'images', entry, asset, __version__)

    [changed] = updated(new)
    assert (changed.status, changed.data) == (vendor_update.BINARY, None)
    assert vendor_update.DESCRIPTIONS[changed.status].startswith('KEPT: changed in the frontend and in bazis-front, not text')
    [kept] = updated(old)
    assert (kept.status, kept.data) == (vendor_update.KEPT, None)
    # the frontend has the new version already: nothing to merge or report
    (frontend / 'logo.png').write_bytes(new)
    assert updated(new) == []
    (frontend / 'logo.png').write_bytes(mine)
    # unchanged in the frontend: replaced, as any file
    (frontend / 'logo.png').write_bytes(old)
    [replaced] = updated(new)
    assert (replaced.status, replaced.data) == (vendor_update.REPLACED, new)


def test_add_after_an_update(product):
    downgrade(product, 'react')
    with pytest.raises(CommandError, match='Update them all to this version first with `manage.py bazis_front update`'):
        call_command('bazis_front', 'add', 'resource-form', stdout=StringIO())
    update()
    call_command('bazis_front', 'add', 'resource-form', stdout=StringIO())
    assert 'resource-form' in read_lock(product)['assets']


def test_update_needs_a_frontend(tmp_path):
    with override_settings(BASE_DIR=str(tmp_path)):
        with pytest.raises(CommandError, match='has no bazis-front.lock.json: create the frontend'):
            update()
        assert checks.check_update(None) == []


def merge(base, local, upstream, asset='client'):
    """
    `update.merge` of three texts, the base and the local file stamped with OLD.
    """
    stamp = f'// header\n// bazis-front {OLD} asset {asset}\n'
    new = f'// header\n// bazis-front {__version__} asset {asset}\n'
    result = vendor_update.merge(
        'a.ts', asset, (stamp + base).encode(), (stamp + local).encode(), (new + upstream).encode(),
        __version__,
    )
    assert result.data.startswith(new.encode()), result.data
    return result.status, result.data.decode()[len(new):]


def test_merge_of_a_file():
    base = ''.join(f'line {it}\n' for it in range(1, 11))
    local = base.replace('line 2\n', 'mine\n')
    upstream = base.replace('line 8\n', 'theirs\n')
    # the stamps of the old version are not a change
    assert merge(base, local, upstream) == (
        vendor_update.MERGED, base.replace('line 2\n', 'mine\n').replace('line 8\n', 'theirs\n'),
    )
    status, text = merge(base, base.replace('line 5\n', 'mine\n'), base.replace('line 5\n', 'theirs\n'))
    assert status == vendor_update.CONFLICT
    assert text == base.replace(
        'line 5\n', f'{MARKERS[0]}mine\n{MARKERS[1]}theirs\n{MARKERS[2]}',
    )
    # unchanged by bazis-front: the local file, with the new stamp, without Git
    assert merge(base, local, base) == (vendor_update.KEPT, local)
    # the end of the last line added by one side, a line by the other
    assert merge('a\nb', 'a\nb\n', 'z\na\nb') == (vendor_update.MERGED, 'z\na\nb\n')


def test_merge_of_repeated_lines_conflicts():
    # aligned in runs of the same line, the change of one side must not lose a line
    status, text = merge('a\na\na\n}\n', 'a\na\nX\n', 'a\na\n}\n')
    assert status == vendor_update.CONFLICT
    assert text == f'a\na\n{MARKERS[0]}X\n{MARKERS[1]}}}\n{MARKERS[2]}'


def test_merge_ignores_the_configuration_of_git(tmp_path, monkeypatch):
    config = tmp_path / 'gitconfig'
    config.write_text('[merge]\n\tconflictStyle = zdiff3\n[diff]\n\talgorithm = patience\n')
    monkeypatch.setenv('GIT_CONFIG_GLOBAL', str(config))
    status, text = merge('x\n', 'mine\n', 'theirs\n')
    assert (status, text) == (vendor_update.CONFLICT, f'{MARKERS[0]}mine\n{MARKERS[1]}theirs\n{MARKERS[2]}')


def test_merge_ignores_the_configuration_of_a_repository(tmp_path, monkeypatch):
    # a hook or `git rebase -x` passes GIT_DIR of the repository of the product
    repository = tmp_path / 'repository'
    subprocess.run(['git', 'init', '-q', str(repository)], check=True)
    subprocess.run(
        ['git', '-C', str(repository), 'config', 'merge.conflictStyle', 'diff3'], check=True
    )
    monkeypatch.setenv('GIT_DIR', str(repository / '.git'))
    status, text = merge('x\n', 'mine\n', 'theirs\n')
    assert (status, text) == (vendor_update.CONFLICT, f'{MARKERS[0]}mine\n{MARKERS[1]}theirs\n{MARKERS[2]}')


def test_update_needs_git_only_to_merge(product, monkeypatch):
    path = product / 'frontend' / CLIENT
    downgrade(
        product, 'client',
        lambda name, text: change_line(text, late(text), '// old\n') if name == CLIENT else text,
    )
    downgrade(product, 'playwright')
    text = path.read_text(encoding='utf-8')
    path.write_text(change_line(text, early(text), '// mine\n'), encoding='utf-8')
    monkeypatch.setattr(vendor_update.shutil, 'which', lambda name: None)
    before = files(product)

    with pytest.raises(CommandError, match=r'^Git is not found: `update` merges the files changed in the frontend and in bazis-front with `git merge-file`'):
        update()
    assert files(product) == before

    # the helpers are not changed in the frontend: replaced without Git
    update('playwright')
    assert_updated(product, 'playwright')
