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
import shutil
import subprocess
from io import StringIO
from pathlib import Path

from django.apps import apps
from django.core.management import CommandError, call_command
from django.test import override_settings

import pytest

from bazis.contrib.front import capabilities
from bazis.contrib.front.checks import check_contract
from bazis.contrib.front.contract import typescript
from bazis.contrib.front.contract.generated import CONTRACT_TS, SCHEMA_TS
from bazis.contrib.front.vendor.lock import digest


pytestmark = pytest.mark.django_db

SCHEMA = 'export interface paths {}\n'


@pytest.fixture
def frontend(sample_app, workflow, tmp_path):
    """
    A product with a frontend made by `init`.
    """
    with override_settings(BASE_DIR=str(tmp_path)):
        call_command('bazis_front', 'init', '--no-node', stdout=StringIO())
        yield tmp_path / 'frontend'


@pytest.fixture
def npx(monkeypatch):
    """
    Node on the PATH with openapi-typescript, which writes SCHEMA; the calls are recorded.
    """
    calls = []

    def run(args, cwd, **kwargs):
        calls.append((args, cwd))
        if getattr(run, 'returncode', 0):
            return subprocess.CompletedProcess(args, run.returncode, '', 'invalid OpenAPI')
        (Path(cwd) / args[args.index('-o') + 1]).write_text(SCHEMA, encoding='utf-8')
        return subprocess.CompletedProcess(args, 0, '', '')

    monkeypatch.setattr(shutil, 'which', lambda name: f'/node/bin/{name}')
    monkeypatch.setattr(subprocess, 'run', run)
    run.calls = calls
    return run


def install_openapi_typescript(frontend):
    package = frontend / 'node_modules' / 'openapi-typescript' / 'package.json'
    package.parent.mkdir(parents=True)
    package.write_text('{}', encoding='utf-8')


def contract(*args):
    out, err = StringIO(), StringIO()
    call_command('bazis_front', 'contract', *args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


def read_lock(frontend):
    return json.loads((frontend / 'bazis-front.lock.json').read_text(encoding='utf-8'))


def test_contract_ts_is_rendered_from_the_contract():
    contract_json = {
        'format': 1,
        'project': {'resources': {
            'shop.order': {'path': '/api/v1/shop/order/', 'fields': {'total-sum': {'type': 'number'}}},
            'shop.item': {'path': '/api/v1/shop/item/', 'fields': {}},
        }},
        'capabilities': {
            'users': {'user_resource': 'users.user', 'token_url': '/api/openapi-token/'},
            'permit': {'roles': [{'slug': 'manager', 'for_anonymous': False}]},
        },
    }
    text = typescript.render(contract_json)

    assert text == '\n'.join([
        typescript.HEADER,
        '/** The path of the route set of each resource, by its JSON:API type. */',
        'export const ROUTES = {',
        '  "shop.item": "/api/v1/shop/item/",',
        '  "shop.order": "/api/v1/shop/order/",',
        '} as const;',
        '',
        '/** The JSON:API type of a resource. */',
        'export type ResourceType = keyof typeof ROUTES;',
        '',
        '/** The resources: model, route set, path, actions and fields (type, relation, '
        'filter and order labels). */',
        'export const RESOURCES = {',
        '  "shop.item": {',
        '    fields: {},',
        '    path: "/api/v1/shop/item/",',
        '  },',
        '  "shop.order": {',
        '    fields: {',
        '      "total-sum": {',
        '        type: "number",',
        '      },',
        '    },',
        '    path: "/api/v1/shop/order/",',
        '  },',
        '} as const;',
        '',
        '/** The roles of bazis-permit with their effective permissions; empty without it. */',
        'export const ROLES = [',
        '  {',
        '    for_anonymous: false,',
        '    slug: "manager",',
        '  },',
        '] as const;',
        '',
        '/** The statusy models of bazis-statusy with their initial status, statuses and '
        'transits; empty without it. */',
        'export const TRANSITS = {} as const;',
        '',
        '/** The sections of the capability packages, as in contract.json; null without the '
        'package. */',
        'export interface Capabilities {',
        '  readonly permit: { readonly roles: typeof ROLES } | null;',
        '  readonly statusy: { readonly models: typeof TRANSITS } | null;',
        '  readonly users: { readonly token_url: string; readonly user_resource: string } | null;',
        '}',
        '',
        'export const CAPABILITIES: Capabilities = {',
        '  permit: {',
        '    roles: ROLES,',
        '  },',
        '  statusy: null,',
        '  users: {',
        '    token_url: "/api/openapi-token/",',
        '    user_resource: "users.user",',
        '  },',
        '};',
        '',
    ])
    # the order of the keys does not matter
    reordered = json.loads(json.dumps(contract_json, sort_keys=True))
    reordered['project']['resources'] = dict(reversed(reordered['project']['resources'].items()))
    assert typescript.render(reordered) == text


def test_a_capability_that_is_not_installed_is_null():
    text = typescript.render({'project': {'resources': {}}, 'capabilities': {}})

    assert 'export const ROLES = [] as const;\n' in text
    assert 'export const TRANSITS = {} as const;\n' in text
    # the type keeps the section: the frontend compiles with and without the package
    assert '  readonly users: { readonly token_url: string; readonly user_resource: string } | null;\n' in text
    assert (
        'export const CAPABILITIES: Capabilities = {\n'
        '  permit: null,\n  statusy: null,\n  users: null,\n};\n'
    ) in text


def test_every_capability_has_a_type():
    assert sorted(typescript.SECTION_TYPES) == sorted(capabilities.CAPABILITIES)
    with pytest.raises(ValueError, match=r"no type for the capabilities \['ws'\]"):
        typescript.render({'project': {'resources': {}}, 'capabilities': {'ws': {}}})


def test_contract_generates_the_frontend(frontend):
    product = frontend.parent
    assets = read_lock(frontend)['assets']

    out, err = contract('--no-node')

    contract_ts = (frontend / CONTRACT_TS).read_text(encoding='utf-8')
    data = json.loads((product / 'contract' / 'contract.json').read_text(encoding='utf-8'))
    assert contract_ts == typescript.render(data)
    assert '  "tasks.task": "/api/v1/tasks/task/",\n' in contract_ts
    assert 'roles: ROLES,' in contract_ts and 'models: TRANSITS,' in contract_ts
    assert '    slug: "manager",\n' in contract_ts
    assert '        id: "finish",\n' in contract_ts
    assert f'Generated src/bazis/generated of {frontend}' in out

    lock = read_lock(frontend)
    assert lock['contract'] == {
        name: digest((product / 'contract' / name).read_bytes())
        for name in ('contract.json', 'openapi.json')
    }
    assert lock['generated'] == {
        CONTRACT_TS: digest(contract_ts.encode('utf-8')), SCHEMA_TS: 'missing'
    }
    assert lock['assets'] == assets
    assert f'{SCHEMA_TS} is not generated: the option --no-node is given' in err

    # the same backend gives the same files
    contract('--no-node')
    assert (frontend / CONTRACT_TS).read_text(encoding='utf-8') == contract_ts
    # a missing schema.d.ts is stale
    with pytest.raises(CommandError, match=rf'generated files of .* are stale: {SCHEMA_TS}\.'):
        contract('--check')


def test_schema_is_generated_by_openapi_typescript(frontend, npx):
    install_openapi_typescript(frontend)

    contract()

    assert npx.calls == [(
        [
            '/node/bin/npx', '--no-install', 'openapi-typescript', '../contract/openapi.json',
            '-o', SCHEMA_TS, '--default-non-nullable=false',
        ],
        frontend,
    )]
    assert read_lock(frontend)['generated'][SCHEMA_TS] == digest(SCHEMA.encode('utf-8'))
    out, _ = contract('--check')
    assert 'and the generated files of' in out

    # without Node, an unchanged OpenAPI keeps the schema current
    _, err = contract('--no-node')
    assert err == ''
    assert read_lock(frontend)['generated'][SCHEMA_TS] == digest(SCHEMA.encode('utf-8'))

    # an edited schema.d.ts is stale, and without Node it is missing
    (frontend / SCHEMA_TS).write_text('export interface paths { edited: true }\n', encoding='utf-8')
    with pytest.raises(CommandError, match=rf'are stale: {SCHEMA_TS}\.'):
        contract('--check')
    contract('--no-node')
    assert read_lock(frontend)['generated'][SCHEMA_TS] == 'missing'


def test_schema_is_missing_without_openapi_typescript(frontend, npx):
    _, err = contract()

    assert npx.calls == []
    assert 'openapi-typescript is not installed: run `npm install`' in err
    assert read_lock(frontend)['generated'][SCHEMA_TS] == 'missing'


def test_a_failure_of_openapi_typescript_fails_the_command(frontend, npx):
    install_openapi_typescript(frontend)
    npx.returncode = 1

    with pytest.raises(CommandError, match='openapi-typescript failed with code 1:\ninvalid OpenAPI'):
        contract()
    assert read_lock(frontend)['generated'][SCHEMA_TS] == 'missing'


def test_check_catches_stale_generated_files(frontend, npx):
    install_openapi_typescript(frontend)
    contract()

    path = frontend / CONTRACT_TS
    path.write_text(path.read_text(encoding='utf-8').replace('Draft', 'Edited'), encoding='utf-8')
    with pytest.raises(CommandError, match=rf'generated files of .* are stale: {CONTRACT_TS}\.'):
        contract('--check')

    # a change of the backend makes the contract and contract.ts stale
    contract()
    apps.get_model('permit.Role').objects.create(slug='auditor', name_en='Auditor')
    with pytest.raises(
        CommandError,
        match=rf'contract.json differ from the backend.\nThe generated files of .* are stale: '
        rf'{CONTRACT_TS}\.',
    ):
        contract('--check')

    # a schema.d.ts generated from another OpenAPI is stale
    contract()
    lock = read_lock(frontend)
    lock['contract']['openapi.json'] = digest(b'another')
    (frontend / 'bazis-front.lock.json').write_text(json.dumps(lock), encoding='utf-8')
    with pytest.raises(CommandError, match=rf'are stale: {SCHEMA_TS}\.'):
        contract('--check')


def test_a_frontend_without_a_lock_is_not_generated(sample_app, tmp_path):
    with override_settings(BASE_DIR=str(tmp_path)):
        (tmp_path / 'frontend').mkdir()
        _, err = contract('--no-node')

    assert 'has no bazis-front.lock.json' in err
    assert list((tmp_path / 'frontend').iterdir()) == []
    assert (tmp_path / 'contract' / 'contract.json').is_file()


def test_an_invalid_lock_fails_the_command(frontend):
    (frontend / 'bazis-front.lock.json').write_text('{"lock": 2}', encoding='utf-8')
    with pytest.raises(CommandError, match='not a lock of format 1'):
        contract('--no-node')


def test_the_contract_may_be_exported_elsewhere(frontend, npx):
    install_openapi_typescript(frontend)
    out = frontend.parent / 'api' / 'contract'

    contract('--out', str(out))

    assert npx.calls[0][0][3] == '../api/contract/openapi.json'
    assert read_lock(frontend)['contract'] == {
        name: digest((out / name).read_bytes()) for name in ('contract.json', 'openapi.json')
    }
    assert not (frontend.parent / 'contract').exists()
    contract('--check', '--out', str(out))


def test_system_check_reports_stale_generated_files(frontend, npx):
    install_openapi_typescript(frontend)
    contract()
    assert check_contract(None) == []

    path = frontend / CONTRACT_TS
    path.write_text(path.read_text(encoding='utf-8') + '// edited\n', encoding='utf-8')
    (frontend / SCHEMA_TS).write_text('export interface paths { edited: true }\n', encoding='utf-8')
    messages = check_contract(None)
    assert [it.id for it in messages] == ['front.W001']
    assert messages[0].msg == (
        f'The generated files of {frontend} are stale: {CONTRACT_TS}, {SCHEMA_TS}.'
    )
    assert 'bazis_front contract' in messages[0].hint

    # the generated files are checked without contract/
    contract()
    shutil.rmtree(frontend.parent / 'contract')
    messages = check_contract(None)
    assert [it.id for it in messages] == ['front.W001']
    assert messages[0].msg.startswith(f'The contract in {frontend.parent / "contract"} is stale')
    assert 'generated files' not in messages[0].msg

    (frontend / 'bazis-front.lock.json').write_text('{', encoding='utf-8')
    messages = check_contract(None)
    assert [it.id for it in messages] == ['front.W001']
    assert 'is not valid JSON' in messages[0].msg
