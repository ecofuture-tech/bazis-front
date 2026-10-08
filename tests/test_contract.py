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
from types import SimpleNamespace

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

    assert sorted(resources) == ['bg.task', 'tasks.task', 'uploadable.file_upload', 'users.user']
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
    # a file of bazis-uploadable: a relationship to its uploaded files
    assert fields['attachment'] == {
        'relation': 'uploadable.file_upload', 'many': False, 'filter': 'attachment', 'order': 'attachment'
    }
    files = resources['uploadable.file_upload']
    assert files['route_set'] == 'tasks.routes.FileRouteSet'
    # the sample protects the files: no list, update or delete of the files of the others
    assert files['actions'] == {
        'action_create': 'create', 'action_list': 'collection', 'action_retrieve': 'item'
    }
    assert sorted(files['fields']) == ['extension', 'file', 'name', 'size']
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

    assert sorted(sections) == [
        'async_background', 'async_request', 'authing', 'bg', 'permit', 'statusy', 'uploadable',
        'users', 'ws',
    ]
    # the socket of bazis-ws, the resource of the tasks of bazis-bg, the result of
    # bazis-async-background and the header of bazis-async-request
    assert sections['ws'] == {'path': '/ws'}
    assert sections['bg'] == {'resource': 'bg.task'}
    assert sections['async_background'] == {
        'result_path': '/api/v1/async_background_response/{task_id}/'
    }
    assert sections['async_request'] == {'header': 'X-Async-Background'}
    assert sections['users'] == {'token_url': '/api/openapi-token/', 'user_resource': 'users.user'}
    # the login actions of BAZIS_AUTH_KINDS (the password only by default), as GET /auth/
    # lists them
    assert sections['authing'] == {
        'auth_url': '/api/v1/authing/auth/',
        'actions': [
            {'code': 'password', 'name': 'Login/Password', 'method': 'POST', 'url': '/api/v1/authing/password/'},
        ],
        'token_param': 'bazis_auth',
    }
    # the resources of the route sets of FileUploadRouteSet; no size limit by default
    assert sections['uploadable'] == {'max_size': None, 'resources': ['uploadable.file_upload']}
    # the effective permissions of a role: the union of those of its groups, sorted
    assert sections['permit']['roles'] == [
        {'slug': 'guest', 'name': 'Guest', 'for_anonymous': False, 'groups': [], 'permissions': []},
        {
            'slug': 'manager', 'name': 'Manager', 'for_anonymous': False,
            'groups': ['tasks_change', 'tasks_transit', 'tasks_view'],
            'permissions': [
                'tasks.task.field.change.all.all.report.readonly',
                'tasks.task.item.add.all.all',
                'tasks.task.item.change.all.draft',
                'tasks.task.item.transit.all.draft.start',
                'tasks.task.item.transit.all.in_progress.finish',
                'tasks.task.item.view.all.all',
            ],
        },
        {
            'slug': 'viewer', 'name': 'Viewer', 'for_anonymous': True,
            'groups': ['tasks_report_hidden', 'tasks_view'],
            'permissions': [
                'tasks.task.field.view.all.all.report.disable', 'tasks.task.item.view.all.all',
            ],
        },
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
    group = apps.get_model('permit.GroupPermission').objects.get(slug='tasks_view')
    group.permissions.create(slug='tasks.task.item.delete.all.draft')
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
    unapply('tasks', '0004_attachment')

    with pytest.raises(CommandError, match=r'not migrated: 1 migrations .*tasks.0004_attachment.*front.E002'):
        call_command('bazis_front', 'contract', '--out', str(tmp_path))
    assert not list(tmp_path.iterdir())

    with override_settings(BASE_DIR=str(tmp_path)):
        (tmp_path / 'contract').mkdir()
        messages = check_contract(None)
    assert [it.id for it in messages] == ['front.I001']
    assert 'tasks.0004_attachment' in messages[0].msg


@pytest.mark.django_db
def test_the_database_is_not_needed_without_permit_and_statusy(sample_app, monkeypatch):
    unapply('tasks', '0004_attachment')
    monkeypatch.setitem(
        capabilities.CAPABILITIES, 'permit', capabilities.Capability('bazis-permit', 'not.installed')
    )
    monkeypatch.setitem(
        capabilities.CAPABILITIES, 'statusy', capabilities.Capability('bazis-not-installed', 'x')
    )

    # the other sections are read from the settings and the routes
    names = ['async_background', 'async_request', 'authing', 'bg', 'uploadable', 'users', 'ws']
    assert capabilities.enabled() == names
    assert list(capabilities.sections()) == names


def test_capabilities_follow_the_installed_apps():
    # the project app users extends the app config of bazis-users
    assert capabilities.app_enabled('bazis.contrib.users')
    assert capabilities.app_enabled('bazis.contrib.permit')
    # bazis-ws is not a Django app: its capability is the installed package
    assert not capabilities.app_enabled('bazis.contrib.ws')
    assert capabilities.enabled() == [
        'async_background', 'async_request', 'authing', 'bg', 'permit', 'statusy', 'uploadable',
        'users', 'ws',
    ]


def test_a_capability_needs_its_app_or_its_package(monkeypatch):
    monkeypatch.setitem(
        capabilities.CAPABILITIES, 'bg', capabilities.Capability('bazis-bg', 'not.installed')
    )
    monkeypatch.setitem(
        capabilities.CAPABILITIES, 'ws',
        capabilities.Capability('bazis-not-installed', 'bazis.contrib.ws', app=False),
    )
    assert 'bg' not in capabilities.enabled()
    assert 'ws' not in capabilities.enabled()


@pytest.mark.django_db
def test_the_sections_follow_the_routes_and_the_settings(sample_app, settings, monkeypatch):
    from tasks.routes import FileRouteSet

    from bazis.contrib.front.capabilities import authing, uploadable

    settings.BAZIS_FILE_UPLOAD_MAX_SIZE = 1024
    assert uploadable.section()['max_size'] == 1024
    # a route set of the uploaded files without its create takes no file
    monkeypatch.setattr(uploadable, 'route_sets', lambda app: {FileRouteSet: [{'action': 'action_retrieve'}]})
    assert uploadable.section()['resources'] == []
    # a service that does not import, one without a login action, and the password
    settings.BAZIS_AUTH_KINDS = [
        'not.a.service', 'bazis.contrib.authing.services', 'bazis.contrib.authing.services.password',
    ]
    assert [it['code'] for it in authing.section()['actions']] == ['password']
    # the route of a service that is not registered (Google) is left out
    settings.BAZIS_AUTH_KINDS = ['bazis.contrib.authing.services.google', 'bazis.contrib.authing.services.password']
    assert [it['code'] for it in authing.section()['actions']] == ['password']


@pytest.mark.django_db
def test_the_sections_of_the_background_and_the_socket_follow_the_application(sample_app, monkeypatch):
    from fastapi import APIRouter, FastAPI

    from starlette.endpoints import WebSocketEndpoint
    from starlette.routing import NoMatchFound, WebSocketRoute

    import bazis.core.app
    from bazis.contrib.bg.routes import BgRoute
    from bazis.contrib.front.capabilities import async_background, bg, ws
    from bazis.contrib.ws.ws import WsEndpoint

    class Socket(WsEndpoint):
        pass

    def unrouted(name, **params):
        raise NoMatchFound(name, params)

    # a socket of the application, a subclass of WsEndpoint at its own path, in an included
    # router with a prefix
    socket = APIRouter()
    socket.routes.append(WebSocketRoute('/socket/', Socket))
    application = FastAPI()
    application.include_router(socket, prefix='/api/v1')
    application.router.routes.append(WebSocketRoute('/other/', WebSocketEndpoint))
    monkeypatch.setattr(bazis.core.app, 'app', application)
    assert ws.section() == {'path': '/api/v1/socket/'}
    # registered only in the main module, which the export does not import: no socket
    monkeypatch.setattr(bazis.core.app, 'app', SimpleNamespace(routes=[], url_path_for=unrouted))
    assert ws.section() == {'path': None}
    # the result of the background tasks is not routed
    assert async_background.section() == {'result_path': None}
    # the tasks of bazis-bg are not routed, or without their retrieve
    monkeypatch.setattr(bg, 'route_sets', lambda app: {})
    assert bg.section() == {'resource': None}
    monkeypatch.setattr(bg, 'route_sets', lambda app: {BgRoute: [{'action': 'action_list'}]})
    assert bg.section() == {'resource': None}


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
