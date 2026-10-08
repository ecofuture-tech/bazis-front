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
The messages of the sample on the socket of bazis-ws (`sample/tasks/notify.py`): the
common channel, which every session receives (anonymous ones too), carries only the
resource that changed, never the id of an item; the notification of an item goes to the
channel of its assignee; a publication that fails does not fail a change that is committed.
"""

import json

import pytest
from bazis_test_utils.utils import get_api_client

from bazis.contrib.ws import COMMON_CHANNEL


TASKS = '/api/v1/tasks/task/'


class Published:
    """
    Redis for the publications: records them, or fails them.
    """

    def __init__(self, fail: bool = False):
        self.messages: list[tuple[str, dict]] = []
        self.fail = fail

    def publish(self, channel, payload):
        if self.fail:
            raise ConnectionError('Redis is down')
        self.messages.append((channel, json.loads(payload)))
        return 1


@pytest.fixture
def manager(workflow):
    from django.apps import apps

    from bazis.contrib.users import get_user_model

    role = apps.get_model('permit.Role').objects.get(slug='manager')
    user = get_user_model().objects.create_user('manager', email='manager@example.com', password='p')
    user.roles.add(role)
    user.role_current = role
    user.save()
    return user


def publications(monkeypatch, fail=False) -> Published:
    from tasks import notify

    published = Published(fail)
    monkeypatch.setattr(notify, '_redis', lambda: published)
    return published


@pytest.mark.django_db(transaction=True)
def test_the_common_channel_has_no_id_and_the_notification_goes_to_the_assignee(sample_app, manager, monkeypatch):
    published = publications(monkeypatch)
    client = get_api_client(sample_app, manager.jwt_build())
    created = client.post(TASKS, json_data={'data': {
        'type': 'tasks.task', 'attributes': {'title': 'Notify'},
        'relationships': {'assignee': {'data': {'type': 'users.user', 'id': str(manager.id)}}},
    }})
    assert created.status_code == 201, created.text
    item = f'{TASKS}{created.json()["data"]["id"]}/'
    assert client.post(f'{item}transit/', json_data={'transit': 'start'}).status_code == 200
    finished = client.post(f'{item}transit/', json_data={'transit': 'finish', 'payload': {'report': 'Done'}})
    assert finished.status_code == 200, finished.text

    common = [message for channel, message in published.messages if channel == COMMON_CHANNEL]
    assert common and all(message == {'resource': 'tasks.task'} for message in common)
    personal = [(channel, message) for channel, message in published.messages if channel != COMMON_CHANNEL]
    assert personal == [(manager.user_channel, {
        'action': 'notification', 'title': 'Task finished', 'text': 'Notify', 'resource': 'tasks.task',
        'id': created.json()['data']['id'],
    })]


@pytest.mark.django_db(transaction=True)
def test_a_failing_publication_does_not_fail_a_committed_change(sample_app, manager, monkeypatch, caplog):
    from django.apps import apps

    publications(monkeypatch, fail=True)
    client = get_api_client(sample_app, manager.jwt_build())
    created = client.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {'title': 'Kept'}}})
    assert created.status_code == 201, created.text
    assert apps.get_model('tasks.Task').objects.filter(title='Kept').exists()
    assert 'Redis is down' in caplog.text
