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

from django.core.management import CommandError, call_command
from django.db.migrations.recorder import MigrationRecorder
from django.test import override_settings

import pytest

from bazis.contrib.front import capabilities
from bazis.contrib.front.checks import check_contract
from bazis.contrib.front.contract.export import render
from bazis.contrib.front.contract.openapi import dumps, openapi_hash
from bazis.contrib.front.contract.resources import resources


def export(directory, *args):
    call_command('bazis_front', 'contract', '--out', str(directory), *args)
    return json.loads((directory / 'contract.json').read_text(encoding='utf-8'))


@pytest.mark.django_db
def test_export_writes_the_openapi_and_the_contract(sample_app, tmp_path):
    out = tmp_path / 'contract'
    data = export(out)

    openapi = (out / 'openapi.json').read_text(encoding='utf-8')
    assert openapi == dumps(sample_app.openapi())
    assert openapi.endswith('}\n')
    assert data['format'] == 1
    assert data['openapi_hash'] == openapi_hash(sample_app.openapi())
    assert {'bazis', 'bazis-front', 'bazis-permit', 'bazis-statusy', 'bazis-users'} <= set(
        data['generated_by']
    )
    # a tool that does not shape the API does not make the contract stale
    assert 'bazis-test-utils' not in data['generated_by']


@pytest.mark.django_db
def test_export_is_deterministic(sample_app, workflow, tmp_path):
    first, second = render(sample_app), render(sample_app)
    assert first == second

    export(tmp_path)
    call_command('bazis_front', 'contract', '--check', '--out', str(tmp_path))


@pytest.mark.django_db
def test_resources_come_from_x_bazis(sample_app, tmp_path):
    resources = export(tmp_path)['project']['resources']

    assert sorted(resources) == ['tasks.task', 'users.user']
    task = resources['tasks.task']
    assert task['model'] == 'tasks.Task'
    assert task['route_set'] == 'tasks.routes.TaskRouteSet'
    assert task['path'] == '/api/v1/tasks/task/'
    assert task['actions']['action_list'] == 'collection'
    assert task['actions']['action_retrieve'] == 'item'
    assert task['actions']['action_transit'] == 'other'
    assert 'other_routes' not in task

    fields = task['fields']
    assert fields['title'] == {'type': 'string', 'filter': 'title', 'order': 'title'}
    assert fields['dt_created']['format'] == 'date-time'
    assert fields['assignee'] == {
        'relation': 'users.user', 'many': False, 'filter': 'assignee', 'order': 'assignee'
    }
    assert fields['status']['relation'] == 'statusy.status'
    assert resources['users.user']['fields']['roles']['many'] is True
    # a write-only attribute can be neither filtered nor sorted
    assert resources['users.user']['fields']['raw_password'] == {'type': 'string'}


def test_a_resource_is_described_by_the_default_route_of_its_model():
    def operation(route_set, action, kind):
        meta = {'resource': 'tasks.task', 'route_set': route_set, 'action': action, 'kind': kind}
        return {'x-bazis': meta, 'responses': {}}

    openapi = {
        'paths': {
            '/api/v1/archive/task/': {'get': operation('archive.TaskRouteSet', 'action_list', 'collection')},
            '/api/v1/tasks/task/{item_id}/': {
                'get': operation('tasks.routes.TaskRouteSet', 'action_retrieve', 'item'),
            },
            '/api/healthcheck': {'get': {'responses': {}}},
        },
    }
    assert resources(openapi) == {
        'tasks.task': {
            'model': 'tasks.Task',
            'route_set': 'tasks.routes.TaskRouteSet',
            'path': '/api/v1/tasks/task/',
            'actions': {'action_retrieve': 'item'},
            'fields': {},
            'other_routes': [{'path': '/api/v1/archive/task/', 'route_set': 'archive.TaskRouteSet'}],
        },
    }


@pytest.mark.django_db
def test_capabilities_are_read_from_the_database(sample_app, workflow, tmp_path):
    sections = export(tmp_path)['capabilities']

    assert sorted(sections) == ['permit', 'statusy', 'users']
    assert sections['users'] == {'token_url': '/api/openapi-token/', 'user_resource': 'users.user'}
    assert sections['permit']['roles'] == [
        {
            'slug': 'manager', 'name': 'Manager', 'for_anonymous': False,
            'groups': ['tasks_change', 'tasks_transit', 'tasks_view'],
        },
        {'slug': 'viewer', 'name': 'Viewer', 'for_anonymous': True, 'groups': ['tasks_view']},
    ]

    task = sections['statusy']['models']['tasks.task']
    assert task['initial'] == 'draft'
    assert task['statuses'] == [
        {'id': 'done', 'name': 'Done'},
        {'id': 'draft', 'name': 'Draft'},
        {'id': 'in_progress', 'name': 'In progress'},
    ]
    finish, start = task['transits']
    assert start == {
        'id': 'start', 'name': 'Start', 'src': 'draft', 'dst': 'in_progress', 'payload': None
    }
    assert (finish['id'], finish['src'], finish['dst']) == ('finish', 'in_progress', 'done')
    assert finish['payload']['required'] is True
    schema = finish['payload']['schema']
    assert schema['properties']['report']['type'] == 'string'
    assert schema['required'] == ['report']
    # the combined payload type is named after the ids of its classes
    assert 'title' not in schema


@pytest.mark.django_db
def test_check_detects_a_stale_contract(sample_app, workflow, tmp_path):
    with pytest.raises(CommandError, match='openapi.json, contract.json differ'):
        call_command('bazis_front', 'contract', '--check', '--out', str(tmp_path))
    assert not list(tmp_path.iterdir())

    export(tmp_path)
    from django.apps import apps

    apps.get_model('permit.Role').objects.create(slug='auditor', name_en='Auditor')
    with pytest.raises(CommandError, match=r'is stale: contract.json differ'):
        call_command('bazis_front', 'contract', '--check', '--out', str(tmp_path))

    export(tmp_path)
    path = tmp_path / 'openapi.json'
    path.write_text(path.read_text(encoding='utf-8').replace('\n', '\r\n'), encoding='utf-8')
    with pytest.raises(CommandError, match=r'is stale: openapi.json differ'):
        call_command('bazis_front', 'contract', '--check', '--out', str(tmp_path))


@pytest.mark.django_db
def test_system_check_reports_a_stale_contract(sample_app, workflow, tmp_path):
    with override_settings(BASE_DIR=str(tmp_path)):
        # a product without a contract
        assert check_contract(None) == []

        (tmp_path / 'contract').mkdir()
        messages = check_contract(None)
        assert [it.id for it in messages] == ['front.W001']
        assert 'bazis_front contract' in messages[0].hint

        call_command('bazis_front', 'contract')
        assert (tmp_path / 'contract' / 'contract.json').is_file()
        assert check_contract(None) == []


def unapply(app_label, name):
    MigrationRecorder.Migration.objects.filter(app=app_label, name=name).delete()


@pytest.mark.django_db
def test_export_needs_a_migrated_database(sample_app, tmp_path):
    unapply('tasks', '0002_initial')

    with pytest.raises(CommandError, match=r'not migrated: 1 migrations .*tasks.0002_initial.*front.E002'):
        call_command('bazis_front', 'contract', '--out', str(tmp_path))
    assert not list(tmp_path.iterdir())

    with override_settings(BASE_DIR=str(tmp_path)):
        (tmp_path / 'contract').mkdir()
        messages = check_contract(None)
    assert [it.id for it in messages] == ['front.I001']
    assert 'tasks.0002_initial' in messages[0].msg


@pytest.mark.django_db
def test_the_database_is_not_needed_without_permit_and_statusy(sample_app, monkeypatch):
    unapply('tasks', '0002_initial')
    monkeypatch.setitem(
        capabilities.CAPABILITIES, 'permit', capabilities.Capability('bazis-permit', 'not.installed')
    )
    monkeypatch.setitem(
        capabilities.CAPABILITIES, 'statusy', capabilities.Capability('bazis-not-installed', 'x')
    )

    assert capabilities.enabled() == ['users']
    assert list(capabilities.sections()) == ['users']


def test_capabilities_follow_the_installed_apps():
    # the project app users extends the app config of bazis-users
    assert capabilities.app_enabled('bazis.contrib.users')
    assert capabilities.app_enabled('bazis.contrib.permit')
    assert not capabilities.app_enabled('bazis.contrib.ws')
    assert capabilities.enabled() == ['permit', 'statusy', 'users']


def test_openapi_hash_covers_the_operation_surface():
    openapi = {
        'info': {'title': 'API', 'version': '1'},
        'paths': {
            '/a/': {
                'get': {
                    'summary': 'A', 'operationId': 'a',
                    'parameters': [{'name': 'x', 'in': 'query'}],
                    'responses': {'200': {}},
                    'x-bazis': {'kind': 'collection'},
                },
            },
        },
        'components': {'schemas': {}},
    }
    base = openapi_hash(openapi)
    assert base.startswith('sha256:') and len(base) == 7 + 64

    openapi['info']['version'] = '2'
    openapi['paths']['/a/']['get']['summary'] = 'B'
    openapi['paths']['/a/']['get']['operationId'] = 'b'
    assert openapi_hash(openapi) == base

    openapi['paths']['/a/']['get']['parameters'][0]['name'] = 'y'
    assert openapi_hash(openapi) != base


def test_the_subcommand_is_required():
    with pytest.raises(CommandError, match='subcommand'):
        call_command('bazis_front')
