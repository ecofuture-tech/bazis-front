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
from bazis.contrib.front.contract.openapi import dumps
from bazis.contrib.front.contract.resources import resources
from bazis.core.utils import fastapi_monkey_patch, query_complex


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
    assert data['format'] == 12
    # the languages of the project, in the order of LANGUAGES, and the code of LANGUAGES
    # that LANGUAGE_CODE names
    assert data['project']['language'] == 'en'
    assert data['project']['languages'] == [
        {'code': 'en', 'name': 'English'}, {'code': 'ru', 'name': 'Русский'},
    ]
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

    assert sorted(resources) == [
        'bg.task', 'notify.notification', 'tasks.step', 'tasks.task', 'uploadable.file_upload', 'users.user',
    ]
    task = resources['tasks.task']
    assert task['model'] == 'tasks.Task'
    assert task['route_set'] == 'tasks.routes.TaskRouteSet'
    assert task['path'] == '/api/v1/tasks/task/'
    assert task['actions']['action_list'] == 'collection'
    assert task['actions']['action_retrieve'] == 'item'
    assert task['actions']['action_transit'] == 'other'
    # a custom action of the route set (`client.action(path, 'count', body)`)
    assert task['actions']['action_count'] == 'other'
    assert 'other_routes' not in task
    # the fields that the create takes: never a date that the backend sets (`dt_created`)
    assert task['create'] == [
        'assignee', 'attachment', 'due', 'hours', 'location', 'photos', 'priority', 'report', 'status', 'title',
        'watchers',
    ]
    # those that it requires, without a default (S063 of a boolean that a form leaves out)
    assert task['create_required'] == ['title']
    # the custom actions with the standalone schema of their body, what the buttons of the specs
    # need: of the collection and of an item (which requires the change of the item); not the
    # ids of the list of the core or the transits of bazis-statusy and their history
    # (`NOT_CUSTOM`); whether anonymous users may call them (`public=True`: `suggest`, the
    # action of the guests); the standalone schema of their JSON answer, whose properties the
    # result of a form shows, or whether they answer a file
    custom = task['custom_actions']
    assert sorted(custom) == ['action_count', 'action_escalate', 'action_export', 'action_suggest']
    assert resources['users.user']['custom_actions'] == {}
    priority = {'enum': ['low', 'normal', 'high'], 'title': 'Priority', 'type': 'string'}
    if hasattr(fastapi_monkey_patch, 'ChoicesJsonSchema'):
        # the labels of a type of Django choices (bazis 2.21), which the form shows
        priority['enumDict'] = {'low': 'Low', 'normal': 'Normal', 'high': 'High'}
    count = custom['action_count']
    assert set(count) == {'name', 'item', 'method', 'access_action', 'public', 'body', 'response', 'file', 'file_meta'}
    assert count['file'] is False and count['file_meta'] is None
    assert {key: count[key] for key in ('name', 'item', 'method', 'access_action', 'public')} == {
        'name': 'count', 'item': False, 'method': 'post', 'access_action': None, 'public': False,
    }
    assert count['body']['properties'] == {'priority': {'anyOf': [{'$ref': '#/$defs/Priority'}, {'type': 'null'}]}}
    assert count['body']['$defs'] == {'Priority': priority}
    escalate = custom['action_escalate']
    assert {key: escalate[key] for key in ('name', 'item', 'method', 'access_action', 'public')} == {
        'name': 'escalate', 'item': True, 'method': 'post', 'access_action': 'change', 'public': False,
    }
    assert escalate['body']['properties'] == {'priority': {'$ref': '#/$defs/Priority', 'default': 'high'}}
    suggest = custom['action_suggest']
    assert {key: suggest[key] for key in ('name', 'item', 'method', 'access_action', 'public')} == {
        'name': 'suggest', 'item': False, 'method': 'post', 'access_action': None, 'public': True,
    }
    # the ids of uploaded files: `x-relation` of `UploadedFileId` (bazis-uploadable 2.8)
    assert suggest['body']['properties']['photos'] == {
        'default': [], 'items': {'type': 'string', 'x-relation': 'uploadable.file_upload'}, 'title': 'Photos',
        'type': 'array',
    }
    assert suggest['response']['properties'] == {
        'task': {'title': 'Task', 'type': 'string'}, 'title': {'title': 'Title', 'type': 'string'},
    }
    assert escalate['response']['properties'] == {'priority': {'$ref': '#/$defs/Priority'}}
    assert escalate['response']['$defs'] == {'Priority': priority}
    # an action that answers a file (`response_class` of CSV): no JSON answer
    export_ = custom['action_export']
    assert {key: export_[key] for key in ('name', 'item', 'method', 'access_action', 'response', 'file')} == {
        'name': 'export', 'item': False, 'method': 'post', 'access_action': 'view', 'response': None, 'file': True,
    }
    # the meta of its file, the header `X-Bazis-Meta` that its answer declares (the result of
    # its form shows `{count}`)
    assert export_['file_meta'] == {
        'description': 'The meta of the exported file, the header `X-Bazis-Meta` of its answer: the number of its tasks.',
        'properties': {'count': {'title': 'Tasks', 'type': 'integer'}}, 'required': ['count'], 'title': 'ExportMeta',
        'type': 'object',
    }
    assert export_['body']['properties'] == {
        **count['body']['properties'],
        'created_from': {'anyOf': [{'type': 'string', 'format': 'date'}, {'type': 'null'}], 'title': 'Created From'},
    }
    # an action without a body (a GET) and without a JSON answer (a file)
    download = resources['bg.task']['custom_actions']['action_download']
    assert download == {
        'name': 'download', 'item': True, 'method': 'get', 'access_action': None, 'public': False, 'body': None,
        'response': None, 'file': True, 'file_meta': None,
    }

    fields = task['fields']
    assert fields['title'] == {'title': 'Title', 'type': 'string', 'filter': 'title', 'order': 'title'}
    # a field with choices is an attribute: its labels are in the runtime schemas
    assert fields['priority'] == {'title': 'Priority', 'type': 'string', 'filter': 'priority', 'order': 'priority'}
    assert fields['dt_created']['format'] == 'date-time'
    assert fields['assignee'] == {
        'title': 'Assignee', 'relation': 'users.user', 'many': False, 'filter': 'assignee', 'order': 'assignee'
    }
    assert fields['status']['relation'] == 'statusy.status'
    assert fields['status']['title'] == 'Current status'
    # a PointField: the GeoJSON object of every geometry, a point by its model field
    assert fields['location'] == {
        'title': 'Location', 'type': 'object', 'format': 'point', 'filter': 'location', 'order': 'location'
    }
    # a DecimalField: its digits as a string, a decimal by its model field, with its decimal places
    assert fields['hours'] == {
        'title': 'Hours', 'type': 'string', 'format': 'decimal', 'places': 1, 'filter': 'hours', 'order': 'hours',
    }
    # another object (a JSONField) has no format
    assert 'format' not in resources['bg.task']['fields']['kwargs']
    # a file of bazis-uploadable: a relationship to its uploaded files
    assert fields['attachment'] == {
        'title': 'Attachment', 'relation': 'uploadable.file_upload', 'many': False, 'filter': 'attachment',
        'order': 'attachment',
    }
    files = resources['uploadable.file_upload']
    assert files['route_set'] == 'bazis.contrib.uploadable.routes.FileUploadRouteSet'
    # bazis-uploadable gives a user his own files: no update and no delete
    assert {'action_create': 'create', 'action_list': 'collection', 'action_retrieve': 'item'}.items() <= files['actions'].items()
    assert not {'action_update', 'action_destroy'} & set(files['actions'])
    assert sorted(files['fields']) == ['extension', 'file', 'name', 'size']
    assert resources['users.user']['fields']['roles']['many'] is True
    # the search fields of the route sets (the pickers search the users by their username
    # and the names of their labels): its `search_fields`, or, without them, the text fields
    # of its LIST schema (bazis 2.20; before, none); none: a search is 400 (bazis 2.9)
    default_search = hasattr(query_complex, 'default_search_fields')
    assert task['search'] == ['title']
    assert resources['users.user']['route_set'] == 'users.routes.UserRouteSet'
    assert resources['users.user']['search'] == ['username', 'first_name', 'last_name']
    # a to-many relationship of the model (a many-to-many field)
    assert fields['watchers'] == {
        'title': 'Watchers', 'relation': 'users.user', 'many': True, 'filter': 'watchers', 'order': 'watchers'
    }
    assert files['search'] == (['name', 'extension'] if default_search else [])
    assert bool(resources['bg.task']['search']) is default_search
    # a write-only attribute can be neither filtered nor sorted; without a title of its route
    # set, a calculated field is titled by its name
    assert resources['users.user']['fields']['raw_password'] == {'title': 'raw_password', 'type': 'string'}
    assert resources['notify.notification']['fields']['is_read']['title'] == 'is_read'
    # the title that the route set gives a field of the model (the username of Django)
    assert resources['users.user']['fields']['username']['title'] == 'Username'

    # the attributes that label the items: the first group of `LABEL_FIELDS` that the
    # resource has (the first and the last name of a user before his username); none
    assert task['label'] == ['title']
    assert resources['users.user']['label'] == ['first_name', 'last_name']
    assert files['label'] == ['name']
    assert resources['bg.task']['label'] == ['name']
    assert resources['notify.notification']['label'] == ['title']


def test_the_label_is_the_first_group_of_label_fields_that_the_resource_has():
    from bazis.contrib.front.contract.resources import label

    text = {'type': 'string'}
    assert label({'code': text, 'title': text}) == ['title']
    # a part of a group, an attribute only (a relationship named `name` labels nothing)
    assert label({'last_name': text, 'email': text}) == ['last_name']
    assert label({'name': {'relation': 'users.user', 'many': False}, 'slug': text}) == ['slug']
    assert label({'book': {'relation': 'library.book', 'many': False}}) == []


def test_the_routes_of_every_statusy_route_set_are_not_custom_actions():
    """
    The transits and the history of the transits of an item (bazis-statusy 2.15), routes of
    the kind `other` of every statusy route set, are not custom actions of the product,
    whatever version of bazis-statusy is installed; a GET of the product is one, which the
    code reads and no button of the specs runs (S032).
    """
    from bazis.contrib.front.contract.resources import _custom_actions

    def route(action, access_action=None):
        return {'x-bazis': {'kind': 'other', 'action': action, 'public': False, 'access_action': access_action}}

    paths = {
        '/t/{item_id}/transit/': {'post': route('action_transit')},
        '/t/{item_id}/status_history/': {'get': route('action_status_history', 'history')},
        '/t/{item_id}/report/': {'get': route('action_report')},
    }
    operations = [it for item in paths.values() for it in item.values()]
    assert _custom_actions({'paths': paths}, '/t/', operations) == {
        'action_report': {
            'name': 'report', 'item': True, 'method': 'get', 'access_action': None, 'public': False, 'body': None,
            'response': None, 'file': False, 'file_meta': None,
        },
    }


def test_a_custom_action_answers_a_file_when_its_answer_is_not_json():
    """
    `file` of a custom action: its answer (200) has content of another type than JSON (a
    `response_class` with a `media_type`, also HTML); an answer with JSON among its types (a
    type with the suffix `+json` too: `JsonApiResponse` of the core), or without content, is
    not a file.
    """
    from fastapi import FastAPI

    from bazis.contrib.front.contract.resources import _custom_actions
    from bazis.core.routes_abstract.jsonapi.callbacks import JsonApiResponse

    api = FastAPI()
    api.post('/t/jsonapi/', response_class=JsonApiResponse)(lambda: {})
    jsonapi = api.openapi()['paths']['/t/jsonapi/']['post']['responses']['200']['content']
    assert list(jsonapi) == ['application/vnd.api+json']

    def route(name, content):
        answer = {} if content is None else {'200': {'description': 'OK', 'content': content}}
        meta = {'kind': 'other', 'action': f'action_{name}', 'public': False, 'access_action': None}
        return {'post': {'x-bazis': meta, 'responses': answer}}

    paths = {
        '/t/csv/': route('csv', {'text/csv': {'schema': {'type': 'string'}}}),
        '/t/both/': route('both', {'application/json': {'schema': {}}, 'text/csv': {}}),
        '/t/none/': route('none', None),
        '/t/jsonapi/': route('jsonapi', jsonapi),
        '/t/problem/': route('problem', {'application/problem+json; charset=utf-8': {'schema': {'type': 'object'}}}),
        '/t/html/': route('html', {'text/html': {'schema': {'type': 'string'}}}),
    }
    operations = [it for item in paths.values() for it in item.values()]
    found = _custom_actions({'paths': paths}, '/t/', operations)
    assert {name: it['file'] for name, it in found.items()} == {
        'action_csv': True, 'action_both': False, 'action_none': False, 'action_jsonapi': False,
        'action_problem': False, 'action_html': True,
    }
    # the schema of a JSON answer of another JSON type is the answer
    assert found['action_problem']['response'] == {'type': 'object'}


def test_a_point_and_a_decimal_are_fields_of_the_model():
    from django.contrib.gis.db.models import PointField
    from django.db.models import DecimalField

    from bazis.contrib.front.contract.resources import _model_field

    assert _model_field('tasks.Task', 'location', PointField).name == 'location'
    assert _model_field('tasks.Task', 'hours', DecimalField).decimal_places == 1
    # another field, a calculated one (none of the model), a path, no model
    assert _model_field('tasks.Task', 'title', PointField) is None
    assert _model_field('tasks.Task', 'title', DecimalField) is None
    assert _model_field('tasks.Task', 'distance', PointField) is None
    assert _model_field('tasks.Task', 'assignee__username', PointField) is None
    assert _model_field(None, 'location', PointField) is None


def test_a_nested_union_is_flattened():
    """
    The attribute of a `URLField` with a `max_length` (bazis 2.16): the union of the URL and
    the empty string under the `maxLength` of the field, nullable. It is a string with the
    format `uri`, and the alternatives take the keywords around them.
    """
    from bazis.contrib.front.contract.resources import _fields, _not_null

    url = {
        'anyOf': [
            {'anyOf': [{'type': 'string', 'format': 'uri', 'minLength': 1}, {'type': 'string', 'maxLength': 0}],
             'maxLength': 200},
            {'type': 'null'},
        ],
        'title': 'Site',
    }
    assert _not_null({}, url) == {'type': 'string', 'format': 'uri', 'minLength': 1, 'maxLength': 200, 'title': 'Site'}
    # the flat union of bazis 2.16: the URL first
    flat = {'anyOf': [{'type': 'string', 'format': 'uri', 'minLength': 1, 'maxLength': 200},
                      {'type': 'string', 'maxLength': 0}, {'type': 'null'}]}
    assert _not_null({}, flat) == {'type': 'string', 'format': 'uri', 'minLength': 1, 'maxLength': 200}
    # an alternative keeps its own keyword over the one around it, a nested `null` is left out
    nested = {'oneOf': [{'anyOf': [{'type': 'null'}, {'$ref': '#/components/schemas/Empty'}], 'maxLength': 5}]}
    openapi = {'components': {'schemas': {'Empty': {'type': 'string', 'maxLength': 0}}}}
    assert _not_null(openapi, nested) == {'type': 'string', 'maxLength': 0}

    resource = {'properties': {'attributes': {'properties': {'site': url, 'name': {'type': 'string', 'title': 'Name'}}}}}
    openapi = {'components': {'schemas': {}}}
    operation = {
        'x-bazis': {'kind': 'item'},
        'responses': {'200': {'content': {'application/vnd.api+json': {'schema': {'properties': {'data': resource}}}}}},
    }
    assert _fields(openapi, [operation], None, None) == {
        'site': {'title': 'Site', 'type': 'string', 'format': 'uri'}, 'name': {'title': 'Name', 'type': 'string'},
    }


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
            'label': [],
            'search': ['title'],
            # no create route: no field to create
            'create': [],
            'create_required': [],
            'custom_actions': {},
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
    assert fields['report'] == {'title': 'Report', 'type': 'string'}
    assert fields['title'] == {'title': 'Title', 'type': 'string', 'filter': 'title', 'order': 'title'}


@pytest.mark.django_db
def test_capabilities_are_read_from_the_database(sample_app, tmp_path):
    sections = export(tmp_path)['capabilities']

    assert sorted(sections) == [
        'async_background', 'async_request', 'authing', 'bg', 'notify', 'permit', 'statusy',
        'uploadable', 'users', 'ws',
    ]
    # the socket of bazis-ws, the resources of the tasks of bazis-bg and of the notifications
    # of bazis-notify, the result of bazis-async-background and the header of
    # bazis-async-request
    assert sections['ws'] == {'path': '/api/v1/ws'}
    assert sections['bg'] == {'resource': 'bg.task'}
    assert sections['notify'] == {'resource': 'notify.notification'}
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
    }
    # the resources of the route sets of FileUploadRouteSet; the size limit and the anonymous
    # uploads of the project (`project.env`: the guests attach photos to a suggested task), the
    # types of the guests those of bazis-uploadable by default; the guests read the photos of
    # the tasks with bazis-uploadable 2.9 (`files_visible` of the route set of the tasks, which
    # serves them the tasks of the anonymous role `viewer`), none before
    from bazis.contrib.uploadable import routes

    assert sections['uploadable'] == {
        'max_size': 5242880, 'resources': ['uploadable.file_upload'], 'anonymous': True,
        'anonymous_types': ['image/jpeg', 'image/png', 'image/webp'],
        'anonymous_files': hasattr(routes, 'anonymous_files'),
    }
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
                'tasks.task.item.transit.all.done.reopen',
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
        'tasks.task': {'assignee': 'users.user', 'status_author': 'users.user', 'watchers': 'users.user'},
    }

    task = sections['statusy']['models']['tasks.task']
    assert task['initial'] == 'draft'
    assert task['statuses'] == [
        {'id': 'done', 'name': {'en': 'Done', 'ru': 'Готово'}},
        {'id': 'draft', 'name': {'en': 'Draft', 'ru': 'Черновик'}},
        {'id': 'in_progress', 'name': {'en': 'In progress', 'ru': 'В работе'}},
    ]
    finish, reopen, start = task['transits']
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
    # the id of a user, the relationship of the task of the same name (`relation` of the specs)
    assert (reopen['id'], reopen['src'], reopen['dst']) == ('reopen', 'done', 'in_progress')
    assert reopen['payload']['schema']['properties']['assignee'] == {'format': 'uuid', 'title': 'Assignee', 'type': 'string'}


@pytest.mark.django_db
def test_the_initial_status_is_that_of_the_model(monkeypatch):
    """
    The initial status of a model is the one its workflow declares (`Workflow(initial=...)`
    of bazis-statusy 2.12, what a new object gets), else the global BAZIS_STATUS_INITIAL,
    which is then a status of the model (its name from the settings until its row exists).
    """
    from bazis.contrib.front.capabilities import statusy

    names = {'en': 'Waiting', 'ru': 'Waiting'}
    with override_settings(BAZIS_STATUS_INITIAL=['waiting', 'Waiting']):
        monkeypatch.setattr(statusy, 'initial_status', lambda model: 'in_progress')
        task = statusy.section()['models']['tasks.task']
        assert task['initial'] == 'in_progress'
        # no phantom status: the global initial status is not one of the model
        assert [it['id'] for it in task['statuses']] == ['done', 'draft', 'in_progress']

        monkeypatch.setattr(statusy, 'initial_status', lambda model: None)
        task = statusy.section()['models']['tasks.task']
        assert task['initial'] == 'waiting'
        assert {'id': 'waiting', 'name': names} in task['statuses']


@pytest.mark.django_db
@pytest.mark.django_db
def test_the_lazy_titles_of_a_payload_are_in_the_language_of_the_export(sample_app, monkeypatch):
    """
    A payload whose fields have translated titles (`Field(title=_('…'))`, which `TransitBar`
    shows in the language of the request) is exported with the titles of LANGUAGE_CODE,
    whatever the language of the process: the payload type that bazis-statusy builds gives
    them as texts of the active language.
    """
    from django.apps import apps
    from django.utils.translation import gettext_lazy

    from pydantic import BaseModel, Field

    class Payload(BaseModel):
        # translated in the sample: Отчёт
        report: str = Field(title=gettext_lazy('Report'))

    def before_finish(self, statusy_transit, payload: Payload):
        self.report = payload.report

    task = apps.get_model('tasks.Task')
    # the action of the transit `finish` takes the payload: the type of bazis-statusy
    monkeypatch.setattr(task, 'before_finish', before_finish)
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
        'watchers': 'users.user',
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
    unapply('tasks', '0014_photos')

    with pytest.raises(CommandError, match=r'not migrated: 1 migrations .*tasks.0014_photos.*front.E002'):
        call_command('bazis_front', 'contract', '--out', str(tmp_path))
    assert not list(tmp_path.iterdir())

    with override_settings(BASE_DIR=str(tmp_path)):
        (tmp_path / 'contract').mkdir()
        messages = check_contract(None)
    assert [it.id for it in messages] == ['front.I001']
    assert 'tasks.0014_photos' in messages[0].msg


@pytest.mark.django_db
def test_the_database_is_not_needed_without_permit_and_statusy(sample_app, monkeypatch):
    unapply('tasks', '0013_hours')
    monkeypatch.setitem(
        capabilities.CAPABILITIES, 'permit', capabilities.Capability('bazis-permit', 'not.installed')
    )
    monkeypatch.setitem(
        capabilities.CAPABILITIES, 'statusy', capabilities.Capability('bazis-not-installed', 'x')
    )

    # the other sections are read from the settings and the routes
    names = ['async_background', 'async_request', 'authing', 'bg', 'notify', 'uploadable', 'users', 'ws']
    assert capabilities.enabled() == names
    assert list(capabilities.sections()) == names


def test_capabilities_follow_the_installed_apps():
    # the project app users extends the app config of bazis-users
    assert capabilities.app_enabled('bazis.contrib.users')
    assert capabilities.app_enabled('bazis.contrib.permit')
    # bazis-ws is not a Django app: its capability is the installed package
    assert not capabilities.app_enabled('bazis.contrib.ws')
    assert capabilities.enabled() == [
        'async_background', 'async_request', 'authing', 'bg', 'notify', 'permit', 'statusy',
        'uploadable', 'users', 'ws',
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
    assert authing.section() == {'auth_url': None, 'actions': [], 'logout_url': '/api/v1/authing/logout/'}


@pytest.mark.django_db
def test_the_guests_upload_files_with_bazis_uploadable_2_8(sample_app, settings, monkeypatch):
    """
    `anonymous` and `anonymous_types` of the section `uploadable`: `anonymous_uploads()` of
    bazis-uploadable 2.8 (its setting with a size limit) and the types of the guests; none with
    an older version, which has no anonymous uploads.
    """
    from bazis.contrib.front.capabilities import uploadable
    from bazis.contrib.uploadable import routes

    def guests():
        section = uploadable.section()
        return section['anonymous'], section['anonymous_types']

    monkeypatch.delattr(routes, 'anonymous_uploads', raising=False)
    assert guests() == (False, [])
    settings.BAZIS_FILE_UPLOAD_ANONYMOUS_TYPES = ['image/png', 'image/webp']
    monkeypatch.setattr(routes, 'anonymous_uploads', lambda: True, raising=False)
    assert guests() == (True, ['image/png', 'image/webp'])
    monkeypatch.setattr(routes, 'anonymous_uploads', lambda: False)
    assert guests() == (False, [])


@pytest.mark.django_db
def test_the_guests_read_files_with_bazis_uploadable_2_9(sample_app, monkeypatch):
    """
    `anonymous_files` of the section `uploadable`: `anonymous_files()` of bazis-uploadable 2.9
    (a route set that serves the guests declares `files_visible`); never with an older version,
    whose files require a user.
    """
    from bazis.contrib.front.capabilities import uploadable
    from bazis.contrib.uploadable import routes

    monkeypatch.delattr(routes, 'anonymous_files', raising=False)
    assert uploadable.section()['anonymous_files'] is False
    monkeypatch.setattr(routes, 'anonymous_files', lambda: True, raising=False)
    assert uploadable.section()['anonymous_files'] is True
    monkeypatch.setattr(routes, 'anonymous_files', lambda: False)
    assert uploadable.section()['anonymous_files'] is False


def test_the_meta_of_a_file_is_the_header_of_its_answer():
    """
    `file_meta` of a custom action: the JSON Schema of the header `X-Bazis-Meta` of its answer
    (that of its status, 200 or another 2xx: `file_meta=` of bazis 2.25 declares it on the
    `status_code` of the route), whatever the case of its name (or `responses` declared by
    hand), standalone; null without it.
    """
    from bazis.contrib.front.contract.resources import _custom_actions

    def route(name, headers, status='200'):
        meta = {'kind': 'other', 'action': f'action_{name}', 'public': False, 'access_action': None}
        answer = {'description': 'OK', 'content': {'text/csv': {}}, **({'headers': headers} if headers else {})}
        # the errors of the route come first in the OpenAPI of FastAPI
        return {'post': {'x-bazis': meta, 'responses': {'422': {'description': 'Invalid'}, status: answer}}}

    schema = {'$ref': '#/components/schemas/Meta'}
    openapi = {
        'paths': {
            '/t/sugar/': route('sugar', {'X-Bazis-Meta': {'description': 'The meta', 'schema': schema}}),
            '/t/hand/': route('hand', {'x-bazis-meta': {'schema': {'type': 'object', 'properties': {'n': {'type': 'integer'}}}}}),
            '/t/other/': route('other', {'X-Total': {'schema': {'type': 'integer'}}}),
            '/t/none/': route('none', None),
            '/t/created/': route('created', {'X-Bazis-Meta': {'schema': {'type': 'object', 'properties': {'n': {'type': 'integer'}}}}}, '201'),
        },
        'components': {'schemas': {
            'Meta': {'type': 'object', 'properties': {'kind': {'$ref': '#/components/schemas/Kind'}}},
            'Kind': {'enum': ['a', 'b']},
        }},
    }
    operations = [it for item in openapi['paths'].values() for it in item.values()]
    actions = _custom_actions(openapi, '/t/', operations)
    assert all(it['file'] for it in actions.values())
    found = {name: it['file_meta'] for name, it in actions.items()}
    assert found == {
        'action_sugar': {
            'type': 'object', 'properties': {'kind': {'$ref': '#/$defs/Kind'}}, '$defs': {'Kind': {'enum': ['a', 'b']}},
        },
        'action_hand': {'type': 'object', 'properties': {'n': {'type': 'integer'}}},
        'action_other': None,
        'action_none': None,
        'action_created': {'type': 'object', 'properties': {'n': {'type': 'integer'}}},
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
    versions = {'bazis-ws': '2.4.0', 'bazis-authing': '2.6.0rc1', 'bazis-uploadable': '2.6.3'}
    monkeypatch.setattr(metadata, 'version', lambda name: versions.get(name) or real(name))
    warnings = check_packages(None)
    # warnings: an outdated package never blocks migrate or runserver (C004 of check fails)
    assert [(it.id, it.level) for it in warnings] == [('front.W006', WARNING), ('front.W006', WARNING)]
    assert 'bazis-uploadable 2.6.3 is installed' in warnings[0].msg
    assert 'download' in warnings[0].msg
    assert 'bazis-ws>=2.5.0' in warnings[1].msg and 'subscribed' in warnings[1].msg
    assert [name for name, _, _ in capabilities.outdated(['ws', 'statusy', 'unknown'])] == ['ws']
    # bazis-uploadable `2.7` is its minimum 2.7.0 (the download route)
    versions['bazis-uploadable'] = '2.7'
    assert [name for name, _, _ in capabilities.outdated(['uploadable', 'ws'])] == ['ws']
    # bazis-bg: the download route of the file of a task (2.6)
    versions['bazis-bg'] = '2.5.1'
    assert [name for name, _, _ in capabilities.outdated(['bg'])] == ['bg']
    versions['bazis-bg'] = '2.6.0'
    # bazis-permit: the selectors of the contract (2.6) and the query scope of its routes (2.7)
    versions['bazis-permit'] = '2.6.0'
    assert [name for name, _, _ in capabilities.outdated(['permit', 'statusy'])] == ['permit']
    assert 'bazis-permit>=2.7.0' in check_packages(None)[0].msg
    # bazis-statusy: the JSON Schemas of the payloads with their titles translated (2.8), the
    # initial status of each model (2.12), the transits of the items of a list (2.13)
    versions['bazis-statusy'] = '2.12.0'
    assert [name for name, _, _ in capabilities.outdated(['statusy'])] == ['statusy']
    assert 'bazis-statusy>=2.13.0' in check_packages(None)[1].msg
    assert 'for_transit' in check_packages(None)[1].msg


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


def test_a_reverse_relation_is_marked():
    """
    `reverse` of a relationship whose foreign key or many-to-many field is on the related
    model: the reverse side of a foreign key (the steps of a task) and of a many-to-many field
    (the tasks a user watches); never a field of the model itself.
    """
    from bazis.contrib.front.contract.resources import _is_reverse

    assert _is_reverse('tasks.Task', 'steps') is True
    assert _is_reverse('users.User', 'watched_tasks') is True
    assert _is_reverse('tasks.Task', 'watchers') is False
    assert _is_reverse('tasks.Task', 'assignee') is False
    assert _is_reverse('tasks.Task', 'no_such_field') is False
    assert _is_reverse(None, 'steps') is False


@isolate_apps('tasks')
def test_a_reverse_relation_is_found_by_its_accessor():
    """
    The core names a reverse relation by its accessor (`related_name`, else `<model>_set`),
    which `_meta.get_field` does not know (it takes the `related_query_name`): a foreign key
    without `related_name`, and one whose `related_query_name` differs, are reverse all the
    same; the source of the relationship (its filter label) is tried after its name.
    """
    from bazis.contrib.front.contract.resources import is_reverse_relation

    class Parent(models.Model):
        class Meta:
            app_label = 'tasks'

    class Child(models.Model):
        parent = models.ForeignKey(Parent, on_delete=models.CASCADE)

        class Meta:
            app_label = 'tasks'

    class Note(models.Model):
        parent = models.ForeignKey(Parent, on_delete=models.CASCADE, related_name='notes', related_query_name='note')

        class Meta:
            app_label = 'tasks'

    assert is_reverse_relation(Parent, 'child_set') is True
    assert is_reverse_relation(Parent, 'notes') is True
    assert is_reverse_relation(Parent, 'note', 'notes') is True
    assert is_reverse_relation(Child, 'parent') is False
    assert is_reverse_relation(Parent, 'note') is False
