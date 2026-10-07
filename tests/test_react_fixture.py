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
The responses of the sample in `assets/react/test/fixtures/sample.json`, which the tests of
the hooks read: they must stay those of the backend. This test captures them again through
the API and compares them with the fixture; with `BAZIS_FRONT_WRITE_FIXTURES=1` it writes
the fixture instead.

The fixture keeps what the hooks read, in a form that does not depend on the versions of
Python, Pydantic or the process: of a JSON Schema only the keywords that the hooks read,
the titles of the fields but no other titles (the title of the body of a transit is the
`__name__` of `dict | None`, which Python 3.14 has and older versions do not), the
definitions renamed in the order of their first reference; the ids and dates of the data
fixed; the messages of the errors replaced (Pydantic writes them).
"""

import json
import os
import re
from pathlib import Path

import pytest
from bazis_test_utils.utils import get_api_client


FIXTURE = (
    Path(__file__).resolve().parent.parent
    / 'bazis' / 'contrib' / 'front' / 'assets' / 'react' / 'test' / 'fixtures' / 'sample.json'
)
TASKS = '/api/v1/tasks/task/'

NORMAL = [
    (re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'), '00000000-0000-0000-0000-000000000000'),
    (re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z'), '2026-01-01T00:00:00Z'),
]


#: the keywords of a JSON Schema that the hooks read (`src/schema.ts`, `src/statusy/`)
SCHEMA_KEYWORDS = {
    '$defs', '$ref', 'anyOf', 'default', 'enum', 'format', 'items', 'maxLength', 'nullable',
    'properties', 'readOnly', 'required', 'title', 'type',
}
DEFS = '#/$defs/'
DETAIL = '<detail>'


def keywords(node, field=False):
    """
    The keywords of a schema that the hooks read; `title` only on a field (a property).
    """
    if isinstance(node, list):
        return [keywords(it) for it in node]
    if not isinstance(node, dict):
        return node
    result = {}
    for key, value in node.items():
        if key not in SCHEMA_KEYWORDS or (key == 'title' and not field):
            continue
        if key == 'properties':
            result[key] = {name: keywords(it, field=True) for name, it in value.items()}
        elif key == '$defs':
            result[key] = {name: keywords(it) for name, it in value.items()}
        else:
            result[key] = keywords(value)
    return result


def renamed(schema: dict) -> dict:
    """
    The schema with its definitions named `Def1`, `Def2`... in the order of their first
    reference: the names of Pydantic carry hashes of the schemas.
    """
    definitions = schema.get('$defs', {})
    order = []

    def visit(node):
        if isinstance(node, list):
            for it in node:
                visit(it)
        elif isinstance(node, dict):
            ref = node.get('$ref')
            if isinstance(ref, str) and ref.startswith(DEFS) and ref[len(DEFS):] not in order:
                order.append(ref[len(DEFS):])
                visit(definitions.get(ref[len(DEFS):]))
            for key, value in node.items():
                if key != '$defs':
                    visit(value)

    visit(schema)
    names = {name: f'Def{index}' for index, name in enumerate(order, 1)}

    def rename(node):
        if isinstance(node, list):
            return [rename(it) for it in node]
        if not isinstance(node, dict):
            return node
        result = {}
        for key, value in node.items():
            if key == '$ref' and isinstance(value, str) and value.startswith(DEFS):
                result[key] = DEFS + names[value[len(DEFS):]]
            elif key == '$defs':
                # in the order of the names; a definition that nothing references is not read
                result[key] = {names[name]: rename(value[name]) for name in order}
            else:
                result[key] = rename(value)
        return result

    return rename(schema)


def schema(node: dict) -> dict:
    return renamed(keywords(node))


def actions(document: dict) -> dict:
    """
    A retrieve with the bodies of its `state_actions` reduced to what the hooks read.
    """
    for entry in document.get('meta', {}).get('state_actions', []):
        for action in entry if isinstance(entry, list) else [entry]:
            action['endpoint']['body'] = schema(action['endpoint']['body'])
    return document


def errors(document: dict) -> dict:
    return {'errors': [{**it, 'detail': DETAIL} for it in document['errors']]}


def normalize(value):
    if isinstance(value, dict):
        return {normalize(key): normalize(it) for key, it in value.items()}
    if isinstance(value, list):
        return [normalize(it) for it in value]
    if isinstance(value, str):
        for pattern, replacement in NORMAL:
            value = pattern.sub(replacement, value)
    return value


def capture(app) -> dict:
    from django.apps import apps

    from bazis.contrib.users import get_user_model

    user_model = get_user_model()
    role = apps.get_model('permit.Role').objects.get(slug='manager')
    user = user_model.objects.create_user('manager', email='manager@example.com', password='p')
    user.roles.add(role)
    user.role_current = role
    user.save()
    assignee = user_model.objects.create_user('assignee', email='assignee@example.com', password='p')
    client = get_api_client(app, user.jwt_build())

    def ok(response, status=200):
        assert response.status_code == status, response.text
        return response.json()

    created = ok(client.post(TASKS, json_data={'data': {
        'type': 'tasks.task', 'attributes': {'title': 'T'},
        'relationships': {'assignee': {'data': {'type': 'users.user', 'id': str(assignee.id)}}},
    }}), 201)
    item = f'{TASKS}{created["data"]["id"]}/'
    result = {
        'schema_create': schema(ok(client.get(f'{TASKS}schema_create/'))),
        'schema_update': schema(ok(client.get(f'{item}schema_update/'))),
        'retrieve_draft': actions(ok(client.get(item, params={'meta': 'state_actions,crud_actions'}))),
    }
    ok(client.post(f'{item}transit/', json_data={'transit': 'start'}))
    result['retrieve_in_progress'] = actions(ok(client.get(item, params={'meta': 'state_actions'})))
    result['create_422'] = errors(
        ok(client.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {}}}), 422)
    )
    return normalize(result)


@pytest.mark.django_db(transaction=True)
def test_the_fixture_of_the_hooks_is_the_sample(sample_app, workflow):
    captured = capture(sample_app)
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        FIXTURE.write_text(json.dumps(captured, indent=2) + '\n', encoding='utf-8')
    assert json.loads(FIXTURE.read_text(encoding='utf-8')) == captured
