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
import shutil
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import override_settings

import pytest

from bazis.contrib.front import __version__, checks
from bazis.contrib.front.contract.export import CONTRACT_FORMAT
from bazis.contrib.front.spec.validate import schema_files
from bazis.contrib.front.vendor import registry
from bazis.contrib.front.vendor.copy import base_dir, restamp, stamped
from bazis.contrib.front.vendor.lock import digest


OLD = '0.0.1'
CLIENT = 'src/bazis/client/client.ts'
MARKERS = ('<<<<<<< frontend\n', '=======\n', f'>>>>>>> bazis-front {__version__}\n')


@pytest.fixture
def product(tmp_path):
    """
    A product with a frontend made by `init` (with bazis-statusy) and a contract that has
    the capabilities `users` and `permit`.
    """
    with override_settings(BASE_DIR=str(tmp_path)):
        call_command('bazis_front', 'init', '--no-node', stdout=StringIO())
        contract(tmp_path, 'permit', 'users')
        yield tmp_path


def contract(root, *names):
    (root / 'contract').mkdir(exist_ok=True)
    (root / 'contract' / 'contract.json').write_text(
        json.dumps({'format': CONTRACT_FORMAT, 'capabilities': dict.fromkeys(names, {})}),
        encoding='utf-8',
    )


def update(*args):
    out = StringIO()
    call_command('bazis_front', 'update', *args, stdout=out, stderr=StringIO())
    return out.getvalue()


def read_lock(root):
    return json.loads((root / 'frontend' / 'bazis-front.lock.json').read_text(encoding='utf-8'))


def write_lock(root, lock):
    (root / 'frontend' / 'bazis-front.lock.json').write_text(json.dumps(lock), encoding='utf-8')


def files(root):
    return {it: it.read_bytes() for it in root.rglob('*') if it.is_file()}


def downgrade(root, name, edit=lambda path, text: text):
    """
    Makes the copy of an asset that of the version OLD, unchanged in the frontend: `edit`
    returns the text of a file in that version (with its stamp), None when the version did
    not have it.
    """
    frontend = root / 'frontend'
    asset = registry.load()[name]
    lock = read_lock(root)
    entry = {}
    for relative in asset.files:
        path = asset.target_path(relative)
        text = edit(path, restamp((frontend / path).read_text(encoding='utf-8'), name, OLD))
        if text is None:
            (frontend / path).unlink()
            continue
        data = text.encode('utf-8')
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
    asset = next(it for it in registry.load().values() if path.startswith(f'{it.target}/') and
                 path[len(it.target) + 1:] in it.files)
    return stamped(asset, path[len(asset.target) + 1:], __version__).decode('utf-8')


def assert_updated(root, name):
    """
    The asset is that of the installed version in the lock and in `.bazis/base/`.
    """
    frontend = root / 'frontend'
    asset = registry.load()[name]
    assert read_lock(root)['assets'][name] == {
        'version': __version__,
        'files': {
            asset.target_path(it): digest(stamped(asset, it, __version__)) for it in asset.files
        },
    }
    for relative in asset.files:
        assert (base_dir(frontend, name, __version__) / relative).read_bytes() == stamped(
            asset, relative, __version__,
        )
    assert not base_dir(frontend, name, OLD).exists()


def w004():
    return [it for it in checks.check_update(None) if it.id == 'front.W004']


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
    assert f'client: {OLD} -> {__version__} (7 files unchanged in the frontend replaced)\n' in out.getvalue()
    assert CLIENT not in out.getvalue()
    assert files(product) == before
    [warning] = w004()
    assert warning.msg == (
        f'The copies of client {OLD}, react {OLD} in the frontend are not those of bazis-front '
        f'{__version__}.'
    )

    out = update()
    assert f'react: {OLD} -> {__version__} (8 files unchanged in the frontend replaced)\n' in out
    assert f'Updated the copies to bazis-front {__version__}.' in out
    for name in ('client', 'react'):
        assert_updated(product, name)
        asset = registry.load()[name]
        for relative in asset.files:
            assert (frontend / asset.target_path(relative)).read_bytes() == stamped(
                asset, relative, __version__,
            )
    assert w004() == []
    assert update('--check').endswith(f'are those of bazis-front {__version__}.\n')
    lock = read_lock(product)
    assert update() == update('--all')
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
    assert f'client: {OLD} -> {__version__} (7 files unchanged in the frontend replaced)\n' in out
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
    theirs = new.splitlines(keepends=True)[late(new)]
    conflict = f'{MARKERS[0]}// mine\n{MARKERS[1]}{theirs}{MARKERS[2]}'
    assert path.read_text(encoding='utf-8') == change_line(new, late(new), conflict)
    # the update is done: the markers are resolved in the frontend
    assert_updated(product, 'client')
    assert w004() == []


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
    assert '  src/bazis/client/old/mine.ts: kept: no longer in bazis-front' in out
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


def test_update_copies_what_a_new_version_requires(product):
    frontend = product / 'frontend'
    # the version OLD of state-panel did not require testing
    lock = read_lock(product)
    for path in lock['assets'].pop('testing')['files']:
        (frontend / path).unlink()
    shutil.rmtree(base_dir(frontend, 'testing', __version__))
    write_lock(product, lock)
    downgrade(product, 'state-panel')
    assert w004()[0].msg.endswith(f'The frontend lacks testing, required by bazis-front {__version__}.')

    out = update('state-panel')
    assert f'testing: copied ({__version__}), required by a new version.\n' in out
    assert_updated(product, 'testing')
    assert_updated(product, 'state-panel')
    testing = registry.load()['testing']
    for relative in testing.files:
        assert (frontend / testing.target_path(relative)).read_bytes() == stamped(
            testing, relative, __version__,
        )


def test_update_needs_the_capabilities_of_a_new_requirement(product):
    frontend = product / 'frontend'
    contract(product, 'permit', 'statusy', 'users')
    call_command('bazis_front', 'add', 'transit-bar', stdout=StringIO())
    lock = read_lock(product)
    for path in lock['assets'].pop('react-statusy')['files']:
        (frontend / path).unlink()
    shutil.rmtree(base_dir(frontend, 'react-statusy', __version__))
    write_lock(product, lock)
    downgrade(product, 'transit-bar')
    contract(product, 'permit', 'users')
    before = files(product)

    with pytest.raises(CommandError, match='react-statusy requires the capabilities statusy, which the contract does not have'):
        update()
    assert files(product) == before

    contract(product, 'permit', 'statusy', 'users')
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

    with pytest.raises(CommandError, match="template is the product's: `update` does not change it"):
        update('template')
    with pytest.raises(CommandError, match='There is no asset nope in the frontend'):
        update('nope')
    with pytest.raises(CommandError, match='resource-list is not in the frontend: copy it with `manage.py bazis_front add resource-list`'):
        update('resource-list')
    with pytest.raises(CommandError, match='Name the assets or pass --all, not both'):
        update('react', '--all')


def test_update_reports_the_npm_dependencies_of_the_template(product):
    package = product / 'frontend' / 'package.json'
    data = json.loads(package.read_text(encoding='utf-8'))
    template = data['dependencies']['react']
    data['dependencies']['react'] = '19.0.0'
    del data['dependencies']['clsx']
    package.write_text(json.dumps(data), encoding='utf-8')
    before = package.read_bytes()

    out = update()
    assert 'has other versions of npm dependencies than frontend/package.json' in out
    assert f'  dependencies react: 19.0.0 -> {template}\n' in out
    assert '  dependencies clsx: (none) -> ' in out
    # the template is the product's
    assert package.read_bytes() == before
    assert read_lock(product)['assets']['template'] == {'version': __version__}


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
