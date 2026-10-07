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
the API (normalized: ids, dates and the names that change in every process) and compares
them with the fixture; with `BAZIS_FRONT_WRITE_FIXTURES=1` it writes the fixture instead.
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
    # the payload type of a transit is named after the ids of its classes
    (re.compile(r'PayloadType_\d+'), 'PayloadType'),
]


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
        'schema_create': ok(client.get(f'{TASKS}schema_create/')),
        'schema_update': ok(client.get(f'{item}schema_update/')),
        'retrieve_draft': ok(client.get(item, params={'meta': 'state_actions,crud_actions'})),
    }
    ok(client.post(f'{item}transit/', json_data={'transit': 'start'}))
    result['retrieve_in_progress'] = ok(client.get(item, params={'meta': 'state_actions'}))
    result['create_422'] = ok(client.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {}}}), 422)
    return normalize(result)


@pytest.mark.django_db(transaction=True)
def test_the_fixture_of_the_hooks_is_the_sample(sample_app, workflow):
    captured = capture(sample_app)
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        FIXTURE.write_text(json.dumps(captured, indent=2) + '\n', encoding='utf-8')
    assert json.loads(FIXTURE.read_text(encoding='utf-8')) == captured
