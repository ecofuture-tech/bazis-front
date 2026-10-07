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

import json
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import override_settings

import pytest

from bazis.contrib.front import __version__, capabilities
from bazis.contrib.front.contract.export import CONTRACT_FORMAT
from bazis.contrib.front.vendor import registry
from bazis.contrib.front.vendor.copy import stamped
from bazis.contrib.front.vendor.lock import digest


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


def add(*names):
    out = StringIO()
    call_command('bazis_front', 'add', *names, stdout=out, stderr=StringIO())
    return out.getvalue()


def read_lock(root):
    return json.loads((root / 'frontend' / 'bazis-front.lock.json').read_text(encoding='utf-8'))


def test_add_copies_a_component_with_what_it_requires(product):
    before = read_lock(product)
    out = add('resource-list')

    frontend = product / 'frontend'
    assets = registry.load()
    # the components it requires that init did not copy, after them the component
    added = ['native-select', 'resource', 'table', 'resource-list']
    assert [line.split()[1] for line in out.splitlines() if line.startswith('Added ')] == added
    assert 'npm test' in out
    lock = read_lock(product)
    assert sorted(lock['assets']) == sorted([*before['assets'], *added])
    # what was there is kept as it is
    assert {name: lock['assets'][name] for name in before['assets']} == before['assets']
    for asset in (assets[name] for name in added):
        assert lock['assets'][asset.name]['version'] == __version__
        assert sorted(lock['assets'][asset.name]['files']) == sorted(
            asset.target_path(it) for it in asset.files
        )
        for name in asset.files:
            copied = (frontend / asset.target_path(name)).read_bytes()
            assert copied == stamped(asset, name, __version__)
            assert f'// bazis-front {__version__} asset {asset.name}\n'.encode() in copied
            base = frontend / '.bazis' / 'base' / f'{asset.name}@{__version__}' / name
            assert base.read_bytes() == copied
            assert lock['assets'][asset.name]['files'][asset.target_path(name)] == digest(copied)
    assert (frontend / 'src' / 'bazis' / 'ui' / 'resource-list' / 'resource-list.contract.test.tsx').is_file()
    assert (frontend / 'src' / 'components' / 'ui' / 'table.tsx').is_file()


def test_add_is_idempotent(product):
    add('resource-card')
    lock = read_lock(product)
    files = {
        it: it.read_bytes() for it in (product / 'frontend').rglob('*') if it.is_file()
    }

    out = add('resource-card', 'state-panel')
    assert out.splitlines() == [
        'state-panel is already in the frontend.', 'resource-card is already in the frontend.',
    ]
    assert read_lock(product) == lock
    assert {it: it.read_bytes() for it in (product / 'frontend').rglob('*') if it.is_file()} == files


def test_add_refuses_a_changed_component(product):
    add('resource-form')
    form = product / 'frontend' / 'src' / 'bazis' / 'ui' / 'resource-form' / 'resource-form.tsx'
    form.write_text(form.read_text(encoding='utf-8') + '// changed\n', encoding='utf-8')
    lock = read_lock(product)

    with pytest.raises(CommandError, match=r'resource-form was changed in the frontend \(src/bazis/ui/resource-form/resource-form.tsx\)'):
        add('resource-form')
    # required by another component, it is kept as it is
    add('resource-card')
    assert form.read_text(encoding='utf-8').endswith('// changed\n')
    assert read_lock(product)['assets']['resource-form'] == lock['assets']['resource-form']


def test_add_refuses_a_deleted_file_and_another_version(product):
    add('resource-form')
    (product / 'frontend' / 'src' / 'bazis' / 'ui' / 'resource-form' / 'index.ts').unlink()
    with pytest.raises(CommandError, match='resource-form was changed in the frontend'):
        add('resource-form')

    lock = read_lock(product)
    lock['assets']['state-panel']['version'] = '0.0.1'
    (product / 'frontend' / 'bazis-front.lock.json').write_text(json.dumps(lock), encoding='utf-8')
    with pytest.raises(CommandError, match=f'state-panel 0.0.1 is in the frontend, bazis-front is {__version__}'):
        add('state-panel')


def test_add_refuses_a_required_asset_of_another_version(product):
    # the hooks were copied by another version of bazis-front: a component that requires
    # them is not added next to them
    lock = read_lock(product)
    lock['assets']['react']['version'] = '0.0.1'
    (product / 'frontend' / 'bazis-front.lock.json').write_text(json.dumps(lock), encoding='utf-8')

    with pytest.raises(CommandError, match=(
        f'react 0.0.1 is in the frontend \\(required by what you add\\), bazis-front is '
        f'{__version__}: `add` does not mix the versions'
    )):
        add('resource-form')
    assert read_lock(product) == lock
    assert not (product / 'frontend' / 'src' / 'bazis' / 'ui' / 'resource-form').exists()


def test_add_never_overwrites_a_file_of_the_product(product):
    # a component of shadcn/ui that the product added itself
    table = product / 'frontend' / 'src' / 'components' / 'ui' / 'table.tsx'
    table.parent.mkdir(parents=True, exist_ok=True)
    table.write_text('mine', encoding='utf-8')
    lock = read_lock(product)

    with pytest.raises(CommandError, match='src/components/ui/table.tsx exists and is not the copy of table'):
        add('resource-list')
    # nothing was written
    assert read_lock(product) == lock
    assert not (product / 'frontend' / 'src' / 'bazis' / 'ui' / 'resource-list').exists()
    assert table.read_text(encoding='utf-8') == 'mine'

    # the same file as the copy is taken over
    table.write_bytes(stamped(registry.load()['table'], 'table.tsx', __version__))
    add('resource-list')
    assert 'table' in read_lock(product)['assets']


def test_add_needs_the_capabilities_of_the_contract(product):
    with pytest.raises(CommandError, match='transit-bar requires the capabilities statusy, which the contract does not have'):
        add('transit-bar')
    assert 'transit-bar' not in read_lock(product)['assets']

    (product / 'contract' / 'contract.json').unlink()
    with pytest.raises(CommandError, match='contract/contract.json is missing'):
        add('status-badge')
    # a component without capabilities needs no contract
    add('resource-form')

    (product / 'contract' / 'contract.json').write_text('{"format": 0}', encoding='utf-8')
    with pytest.raises(CommandError, match='is not a contract of format'):
        add('status-badge')


def test_add_copies_the_hooks_of_a_package_installed_after_init(tmp_path, monkeypatch):
    with override_settings(BASE_DIR=str(tmp_path)):
        # the frontend was made without bazis-statusy
        monkeypatch.setattr(capabilities, 'enabled', lambda: ['permit', 'users'])
        call_command('bazis_front', 'init', '--no-node', stdout=StringIO())
        contract(tmp_path, 'permit', 'statusy', 'users')

        out = add('transit-bar')
        assert [line.split()[1] for line in out.splitlines() if line.startswith('Added ')] == [
            'react-statusy', 'native-select', 'resource', 'badge', 'status-badge', 'dialog', 'transit-bar',
        ]
        assert (tmp_path / 'frontend' / 'src' / 'bazis' / 'react' / 'statusy' / 'index.ts').is_file()
        # the hooks alone
        assert add('react-statusy') == 'react-statusy is already in the frontend.\n'


def test_add_rejects_what_it_does_not_copy(product):
    with pytest.raises(CommandError, match='There is no asset nope. The components: app-shell, badge,'):
        add('nope')
    with pytest.raises(CommandError, match='template is copied by `bazis_front init` only'):
        add('template')


def test_add_needs_a_frontend(tmp_path):
    with override_settings(BASE_DIR=str(tmp_path)):
        with pytest.raises(CommandError, match='has no bazis-front.lock.json: create the frontend'):
            add('state-panel')
