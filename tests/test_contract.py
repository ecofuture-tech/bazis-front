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

from django.core.checks import WARNING
from django.core.management import CommandError, call_command
from django.db import models
from django.db.migrations.recorder import MigrationRecorder
from django.test import override_settings
from django.test.utils import isolate_apps
from django.utils import translation

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
    assert data['format'] == 3
    # the languages of the project, in the order of LANGUAGES, and the code of LANGUAGES
    # that LANGUAGE_CODE names
    assert data['project']['language'] == 'en'
    assert data['project']['languages'] == [
        {'code': 'en', 'name': 'English'}, {'code': 'ru', 'name': 'Русский'},
    ]
    assert data['openapi_hash'] == openapi_hash(sample_app.openapi())
    assert {'bazis', 'bazis-front', 'bazis-permit', 'bazis-statusy', 'bazis-users'} <= set(
        data['generated_by']
    )
    # a tool that does not shape the API does not make the contract stale
    assert 'bazis-test-utils' not in data['generated_by']


@pytest.mark.django_db
def test_export_is_deterministic(sample_app, tmp_path):
    first, second = render(sample_app), render(sample_app)
    assert first == second
    # the same bytes whatever the language of the process, also after the OpenAPI was built
    # in another language: the texts are in LANGUAGE_CODE, the names in every language
    for language in ('ru', 'en'):
        with translation.override(language):
            sample_app.openapi()
            assert render(sample_app) == first
    assert '"title": "Title"' in first['openapi.json']

    export(tmp_path)
    call_command('bazis_front', 'contract', '--check', '--out', str(tmp_path))


@pytest.mark.django_db
def test_resources_come_from_x_bazis(sample_app, tmp_path):
    resources = export(tmp_path)['project']['resources']

    assert sorted(resources) == ['bg.task', 'tasks.step', 'tasks.task', 'uploadable.file_upload', 'users.user']
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
    # a field with choices is an attribute: its labels are in the runtime schemas
    assert fields['priority'] == {'type': 'string', 'filter': 'priority', 'order': 'priority'}
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
    assert files['route_set'] == 'bazis.contrib.uploadable.routes.FileUploadRouteSet'
    # bazis-uploadable gives a user his own files: no update and no delete
    assert {'action_create': 'create', 'action_list': 'collection', 'action_retrieve': 'item'}.items() <= files['actions'].items()
    assert not {'action_update', 'action_destroy'} & set(files['actions'])
    assert sorted(files['fields']) == ['extension', 'file', 'name', 'size']
    assert resources['users.user']['fields']['roles']['many'] is True
    # the search fields of the route sets (the pickers search the users by their username);
    # none: the route set answers a search with 400 (bazis 2.9)
    assert task['search'] == ['title']
    assert resources['users.user']['route_set'] == 'users.routes.UserRouteSet'
    assert resources['users.user']['search'] == ['username']
    assert files['search'] == []
    assert resources['bg.task']['search'] == []
    # a write-only attribute can be neither filtered nor sorted
    assert resources['users.user']['fields']['raw_password'] == {'type': 'string'}


def test_a_resource_is_described_by_the_default_route_of_its_model(sample_app):
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
            'search': ['title'],
            'other_routes': [{'path': '/api/v1/archive/task/', 'route_set': 'archive.TaskRouteSet'}],
        },
    }


@pytest.mark.django_db
def test_the_search_is_that_of_the_list_schema(sample_app, monkeypatch):
    from tasks.routes import TaskRouteSet

    # the search fields that the LIST schema of the route set reaches, as declared: with a
    # lookup prefix, through a relation into the LIST schema of the default route of the
    # related model; not a field the schema does not have (bazis.W007), the core leaves it out
    monkeypatch.setattr(
        TaskRouteSet, 'search_fields', ['^title', 'missing', 'assignee__username', 'assignee__password'],
    )
    task = resources(sample_app.openapi())['tasks.task']
    assert task['search'] == ['^title', 'assignee__username']

    monkeypatch.setattr(TaskRouteSet, 'search_fields', [])
    assert resources(sample_app.openapi())['tasks.task']['search'] == []


@pytest.mark.django_db
def test_the_labels_are_those_of_the_list_schema(sample_app, monkeypatch):
    from tasks.routes import TaskRouteSet

    from bazis.core.schemas import CrudApiAction, SchemaFields

    # the core 2.9 filters and sorts by the fields of the LIST schema of the route set only:
    # a field of the item schema that the LIST schema does not have is neither (400)
    monkeypatch.setattr(
        TaskRouteSet, 'fields', {**TaskRouteSet.fields, CrudApiAction.LIST: SchemaFields(exclude={'report': None})},
    )
    monkeypatch.setitem(
        TaskRouteSet.schema_factories, CrudApiAction.LIST, TaskRouteSet.build_schema_factory(CrudApiAction.LIST),
    )
    fields = resources(sample_app.openapi())['tasks.task']['fields']
    assert fields['report'] == {'type': 'string'}
    assert fields['title'] == {'type': 'string', 'filter': 'title', 'order': 'title'}


@pytest.mark.django_db
def test_capabilities_are_read_from_the_database(sample_app, tmp_path):
    sections = export(tmp_path)['capabilities']

    assert sorted(sections) == [
        'async_background', 'async_request', 'authing', 'bg', 'permit', 'statusy', 'uploadable',
        'users', 'ws',
    ]
    # the socket of bazis-ws, the resource of the tasks of bazis-bg, the result of
    # bazis-async-background and the header of bazis-async-request
    assert sections['ws'] == {'path': '/api/v1/ws'}
    assert sections['bg'] == {'resource': 'bg.task'}
    assert sections['async_background'] == {
        'result_path': '/api/v1/async_background_response/{task_id}/'
    }
    assert sections['async_request'] == {'header': 'X-Async-Background'}
    # the user has a language of his own with bazis-users 2.7.0 (tests/test_profile_language.py)
    from django.contrib.auth import get_user_model

    from bazis.contrib.front.capabilities.users import profile_language

    assert sections['users'] == {
        'token_url': '/api/openapi-token/', 'user_resource': 'users.user',
        'profile_language': profile_language(get_user_model()),
    }
    # the login actions of BAZIS_AUTH_KINDS (the password only by default), as GET /auth/
    # lists them
    assert sections['authing'] == {
        'auth_url': '/api/v1/authing/auth/',
        'actions': [
            {'code': 'password', 'name': 'Login/Password', 'method': 'POST', 'url': '/api/v1/authing/password/'},
        ],
        # the logout endpoint of bazis-authing 2.6.0, which the frontend calls at a sign-out
        'logout_url': '/api/v1/authing/logout/',
        'token_param': 'bazis_auth',
    }
    # the resources of the route sets of FileUploadRouteSet; no size limit by default
    assert sections['uploadable'] == {'max_size': None, 'resources': ['uploadable.file_upload']}
    # the effective permissions of a role: the union of those of its groups, sorted
    # the names in every language of the project (translated fields)
    assert sections['permit']['roles'] == [
        {
            'slug': 'guest', 'name': {'en': 'Guest', 'ru': 'Гость'}, 'for_anonymous': False,
            'groups': [], 'permissions': [],
        },
        {
            'slug': 'manager', 'name': {'en': 'Manager', 'ru': 'Менеджер'}, 'for_anonymous': False,
            'groups': ['tasks_change', 'tasks_transit', 'tasks_view'],
            'permissions': [
                'tasks.step.item.add.all',
                'tasks.step.item.view.all',
                'tasks.task.field.change.all.all.report.readonly',
                'tasks.task.item.add.all.all',
                'tasks.task.item.change.all.draft',
                'tasks.task.item.transit.all.draft.start',
                'tasks.task.item.transit.all.in_progress.finish',
                'tasks.task.item.view.all.all',
            ],
        },
        {
            'slug': 'viewer', 'name': {'en': 'Viewer', 'ru': 'Наблюдатель'}, 'for_anonymous': True,
            'groups': ['tasks_report_hidden', 'tasks_view'],
            'permissions': [
                'tasks.step.item.view.all', 'tasks.task.field.view.all.all.report.disable',
                'tasks.task.item.view.all.all',
            ],
        },
    ]
    # the selectors of the permission models, as bazis-permit resolves them: the relations
    # to a selector source (the user), also the status author that statusy keeps; none of
    # the steps
    assert sections['permit']['selectors'] == {
        'tasks.step': {},
        'tasks.task': {'assignee': 'users.user', 'status_author': 'users.user'},
    }

    task = sections['statusy']['models']['tasks.task']
    assert task['initial'] == 'draft'
    assert task['statuses'] == [
        {'id': 'done', 'name': {'en': 'Done', 'ru': 'Готово'}},
        {'id': 'draft', 'name': {'en': 'Draft', 'ru': 'Черновик'}},
        {'id': 'in_progress', 'name': {'en': 'In progress', 'ru': 'В работе'}},
    ]
    finish, start = task['transits']
    assert start == {
        'id': 'start', 'name': {'en': 'Start', 'ru': 'Начать'}, 'src': 'draft', 'dst': 'in_progress',
        'payload': None,
    }
    assert (finish['id'], finish['src'], finish['dst']) == ('finish', 'in_progress', 'done')
    assert finish['payload']['required'] is True
    schema = finish['payload']['schema']
    assert schema['properties']['report']['type'] == 'string'
    assert schema['required'] == ['report']
    # the combined payload type is named after the ids of its classes
    assert 'title' not in schema


@pytest.mark.django_db
@pytest.mark.django_db
def test_the_lazy_titles_of_a_payload_are_in_the_language_of_the_export(sample_app, monkeypatch):
    """
    A payload whose fields have translated titles (`Field(title=_('…'))`, which `TransitBar`
    shows in the language of the request) is exported with the titles of LANGUAGE_CODE,
    whatever the language of the process.
    """
    from django.apps import apps
    from django.utils.translation import gettext_lazy

    from pydantic import BaseModel, Field

    class Payload(BaseModel):
        # translated in the sample: Отчёт
        report: str = Field(title=gettext_lazy('Report'))

    task = apps.get_model('tasks.Task')
    monkeypatch.setattr(task, 'transit_payload_type', lambda model, transit: Payload)
    with translation.override('ru'):
        assert str(gettext_lazy('Report')) != 'Report'
        contract = json.loads(render(sample_app)['contract.json'])
    finish = contract['capabilities']['statusy']['models']['tasks.task']['transits'][0]
    assert finish['payload']['schema']['properties']['report']['title'] == 'Report'


def test_the_selectors_are_those_of_bazis_permit(sample_app, db, monkeypatch):
    from django.apps import apps
    from django.contrib.auth import get_user_model

    from bazis.contrib.front.capabilities import permit
    from bazis.contrib.permit.schemas import SelectorField

    task = apps.get_model('tasks.Task')
    user = get_user_model()
    # a reverse relation of the user (by its accessor), which the route set does not show
    fields = {
        **task.get_selector_fields(),
        'members': SelectorField(name='members', label='members', model=user),
    }
    monkeypatch.setattr(task, 'get_selector_fields', classmethod(lambda cls: fields))
    assert permit.selectors()['tasks.task'] == {
        'assignee': 'users.user', 'members': 'users.user', 'status_author': 'users.user',
    }
    # a permission model that is a selector source itself has `self`
    monkeypatch.setattr(permit, 'PermitSelectorMixin', task)
    assert permit.selectors()['tasks.task']['self'] == 'tasks.task'


@pytest.mark.django_db
def test_check_detects_a_stale_contract(sample_app, tmp_path):
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
def test_system_check_reports_a_stale_contract(sample_app, tmp_path):
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
    unapply('tasks', '0008_priority_step')

    with pytest.raises(CommandError, match=r'not migrated: 1 migrations .*tasks.0008_priority_step.*front.E002'):
        call_command('bazis_front', 'contract', '--out', str(tmp_path))
    assert not list(tmp_path.iterdir())

    with override_settings(BASE_DIR=str(tmp_path)):
        (tmp_path / 'contract').mkdir()
        messages = check_contract(None)
    assert [it.id for it in messages] == ['front.I001']
    assert 'tasks.0008_priority_step' in messages[0].msg


@pytest.mark.django_db
def test_the_database_is_not_needed_without_permit_and_statusy(sample_app, monkeypatch):
    unapply('tasks', '0008_priority_step')
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
    from bazis.contrib.front.capabilities import authing, uploadable
    from bazis.contrib.uploadable.routes import FileUploadRouteSet

    settings.BAZIS_FILE_UPLOAD_MAX_SIZE = 1024
    assert uploadable.section()['max_size'] == 1024
    # a route set of the uploaded files without its create takes no file
    monkeypatch.setattr(uploadable, 'route_sets', lambda app: {FileUploadRouteSet: [{'action': 'action_retrieve'}]})
    assert uploadable.section()['resources'] == []
    # a service that does not import, one without a login action, and the password
    settings.BAZIS_AUTH_KINDS = [
        'not.a.service', 'bazis.contrib.authing.services', 'bazis.contrib.authing.services.password',
    ]
    assert [it['code'] for it in authing.section()['actions']] == ['password']
    # the route of a service that is not registered (Google) is left out
    settings.BAZIS_AUTH_KINDS = ['bazis.contrib.authing.services.google', 'bazis.contrib.authing.services.password']
    assert [it['code'] for it in authing.section()['actions']] == ['password']
    # an endpoint that is not routed is null: the logout (an older bazis-authing), the auth
    # endpoint (no login actions then)
    routed = authing.url_path
    monkeypatch.setattr(authing, 'url_path', lambda app, name: None if name == 'auth_logout' else routed(app, name))
    assert authing.section()['logout_url'] is None
    assert authing.section()['auth_url'] == '/api/v1/authing/auth/'
    monkeypatch.setattr(authing, 'url_path', lambda app, name: None if name == 'auth' else routed(app, name))
    assert authing.section() == {
        'auth_url': None, 'actions': [], 'logout_url': '/api/v1/authing/logout/', 'token_param': 'bazis_auth',
    }


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


def test_the_socket_is_found_however_the_router_module_mounts_it(monkeypatch):
    """
    The path of the socket is read from the routes of the application, whichever way the
    router module mounts it: the router of bazis-ws registered under the prefix of the router
    module (`router.register('bazis.contrib.ws.router')`, `/api/v1/ws`, as the sample does) or
    `ws_route` appended as it is (`/ws`, the way before bazis-ws 2.6, which still works).
    """
    from fastapi import FastAPI

    import bazis.core.app
    from bazis.contrib.front.capabilities import ws
    from bazis.contrib.ws.ws import ws_route
    from bazis.core.routing import BazisRouter

    def application(router):
        app = FastAPI()
        app.include_router(router)
        return app

    appended = BazisRouter(prefix='/api/v1')
    appended.routes.append(ws_route)
    monkeypatch.setattr(bazis.core.app, 'app', application(appended))
    assert ws.section() == {'path': '/ws'}

    registered = BazisRouter(prefix='/api/v1')
    registered.register('bazis.contrib.ws.router')
    monkeypatch.setattr(bazis.core.app, 'app', application(registered))
    assert ws.section() == {'path': '/api/v1/ws'}


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


@isolate_apps('users')
def test_the_users_have_a_language_of_their_own_with_a_text_field_language():
    from bazis.contrib.front.capabilities.users import profile_language
    from bazis.core.models_abstract import JsonApiMixin

    class Speaker(JsonApiMixin, models.Model):
        language = models.CharField(max_length=15, blank=True, null=True)

        class Meta:
            app_label = 'users'

    class Polyglot(JsonApiMixin, models.Model):
        language = models.JSONField(default=list)

        class Meta:
            app_label = 'users'

    class Plain(models.Model):
        language = models.CharField(max_length=15)

        class Meta:
            app_label = 'users'

    assert profile_language(Speaker) is True
    # another field `language`, or a model that is no resource
    assert profile_language(Polyglot) is False
    assert profile_language(Plain) is False


def test_the_packages_are_not_older_than_the_protocol_of_the_assets(monkeypatch):
    from importlib import metadata

    from bazis.contrib.front.checks import check_packages

    assert capabilities.release('2.5.0.post1.dev3') == (2, 5, 0)
    assert capabilities.release('2.10.1') > capabilities.release('2.9')
    # a version without its last numbers is that of zeros
    assert capabilities.release('2.6') == capabilities.release('2.6.0') == (2, 6, 0)
    assert capabilities.release('3') > capabilities.release('2.9.9')
    # the packages of the sample are recent enough
    assert check_packages(None) == []

    real = metadata.version
    # a pre-release of the version counts as the version
    versions = {'bazis-ws': '2.4.0', 'bazis-authing': '2.6.0rc1', 'bazis-uploadable': '2.4.9'}
    monkeypatch.setattr(metadata, 'version', lambda name: versions.get(name) or real(name))
    warnings = check_packages(None)
    # warnings: an outdated package never blocks migrate or runserver (C004 of check fails)
    assert [(it.id, it.level) for it in warnings] == [('front.W006', WARNING), ('front.W006', WARNING)]
    assert 'bazis-uploadable 2.4.9 is installed' in warnings[0].msg
    assert 'bazis-ws>=2.5.0' in warnings[1].msg and 'subscribed' in warnings[1].msg
    assert [name for name, _, _ in capabilities.outdated(['ws', 'statusy', 'unknown'])] == ['ws']
    # bazis-uploadable `2.6` is its minimum 2.6.0
    versions['bazis-uploadable'] = '2.6'
    assert [name for name, _, _ in capabilities.outdated(['uploadable', 'ws'])] == ['ws']
    # bazis-permit: the selectors of the contract (2.6) and the query scope of its routes (2.7)
    versions['bazis-permit'] = '2.6.0'
    assert [name for name, _, _ in capabilities.outdated(['permit', 'statusy'])] == ['permit']
    assert 'bazis-permit>=2.7.0' in check_packages(None)[0].msg


def test_the_default_language_is_a_code_of_the_languages():
    from bazis.contrib.front.contract.export import default_language

    languages = [('en', 'English'), ('pt-br', 'Português'), ('pt', 'Português (Portugal)')]
    cases = [
        # the same code, whatever its case and separator; else the first of the same base code
        ('pt-BR', 'pt-br'), ('pt_br', 'pt-br'), ('pt', 'pt'), ('en-EN', 'en'), ('EN', 'en'),
        # a LANGUAGE_CODE out of LANGUAGES: its base code
        ('de-DE', 'de'),
    ]
    for code, expected in cases:
        with override_settings(LANGUAGES=languages, LANGUAGE_CODE=code):
            assert default_language() == expected, code
    with override_settings(LANGUAGES=[('pt-br', 'Português')], LANGUAGE_CODE='pt'):
        assert default_language() == 'pt-br'
