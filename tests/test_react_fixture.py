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

It also holds what the hooks of the packages read: the messages of the socket of bazis-ws
(as the server sends them: the notification and the change of a task of the sample, the
statuses of a background request), the documents of a task of bazis-bg (`bg.task`) and the
answers of bazis-async-request and bazis-async-background. The sample has no Kafka: the
request is queued with the publication to Kafka replaced, and the consumer is the function
of bazis-async-request that it runs (`execute_internal_request`), called here.

The fixture keeps what the hooks read, in a form that does not depend on the versions of
Python, Pydantic or the process: of a JSON Schema only the keywords that the hooks read,
the titles of the fields but no other titles (the title of the body of a transit is the
`__name__` of `dict | None`, which Python 3.14 has and older versions do not), the
definitions renamed in the order of their first reference; the ids and dates of the data
fixed; the messages of the errors replaced (Pydantic writes them).
"""

import asyncio
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


def capture(app, settings, monkeypatch) -> dict:
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
        'schema_list': schema(ok(client.get(f'{TASKS}schema_list/'))),
        'schema_create': schema(ok(client.get(f'{TASKS}schema_create/'))),
        'schema_retrieve': schema(ok(client.get(f'{item}schema_retrieve/'))),
        'schema_update': schema(ok(client.get(f'{item}schema_update/'))),
        'retrieve_draft': actions(ok(client.get(item, params={'meta': 'state_actions,crud_actions'}))),
    }
    ok(client.post(f'{item}transit/', json_data={'transit': 'start'}))
    result['retrieve_in_progress'] = actions(ok(client.get(item, params={'meta': 'state_actions'})))
    result['create_422'] = errors(
        ok(client.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {}}}), 422)
    )
    result.update(notified(app, user, client))
    result.update(bg_task(app, user))
    result.update(background(app, settings, monkeypatch, user))
    return normalize(result)


def subscribed(channel: str) -> None:
    """
    Waits until the socket subscribed to the channel: a message published before is lost.
    """
    from django.conf import settings

    from redis import Redis

    redis = Redis.from_url(settings.CACHES['default']['LOCATION'])
    for _ in range(100):
        if redis.pubsub_numsub(channel)[0][1]:
            return
        asyncio.run(asyncio.sleep(0.05))
    raise AssertionError(f'nobody subscribed to {channel}')


def received(socket, count: int) -> list[dict]:
    """
    The next messages of the socket, their data parsed (the server sends it as a string).
    """
    return [{**it, 'data': json.loads(it['data'])} for it in (socket.receive_json() for _ in range(count))]


def queued(publications: list):
    """
    The publication of a task to Kafka replaced: the task is kept.
    """

    async def publish(topic_name, message, partition_marker=None):
        publications.append(message)

    return publish


def background(app, settings, monkeypatch, user) -> dict:
    """
    A change of a task sent with `X-Async-Background` to the middleware of
    bazis-async-request with Kafka (its publication replaced), the result before and after
    the consumer ran it, and the messages of its statuses on the socket of the user.
    """
    from bazis.contrib.async_background import producer
    from bazis.contrib.async_background.schemas import KafkaTask, TaskStatus
    from bazis.contrib.async_background.utils import set_and_publish_status_async
    from bazis.contrib.async_request.schemas import AsyncRequestPayload

    settings.KAFKA_ENABLED = True
    settings.KAFKA_TOPIC_ASYNC_BG = 'sample'
    publications = []
    monkeypatch.setattr(producer, 'publish_message', queued(publications))
    # the consumer of the requests, which registers on the broker of the consumer
    from bazis.contrib.async_request.tasks import execute_internal_request

    token = user.jwt_build()
    client = get_api_client(app, token)
    # a task in draft, which the manager may change
    created = client.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {'title': 'Draft'}}})
    item_id = created.json()['data']['id']
    with get_api_client(app).client.websocket_connect('/ws') as socket:
        socket.send_json({'token': token})
        subscribed(user.user_channel)
        response = client.patch(
            f'{TASKS}{item_id}/',
            json_data={'data': {'type': 'tasks.task', 'id': item_id, 'attributes': {'title': 'Later'}}},
            headers={'X-Async-Background': 'true'},
        )
        assert response.status_code == 202, response.text
        started = response.json()
        result = f'/api/v1/async_background_response/{started["meta"]["async_request_id"]}/'
        pending = client.get(result, params={'full_response': 'true'}).json()
        before = client.get(result).json()

        task = KafkaTask[AsyncRequestPayload].model_validate(publications[0])

        async def consume():
            await set_and_publish_status_async(
                task_id=task.task_id, channel_name=task.channel_name, status=TaskStatus.PROCESSING
            )
            response = await execute_internal_request(task)
            await set_and_publish_status_async(
                task_id=task.task_id, channel_name=task.channel_name, status=TaskStatus.COMPLETED,
                response=response,
            )

        asyncio.run(consume())
        # the statuses of the task; the change of the task that it replayed comes between them
        messages = []
        while not messages or messages[-1]['data']['status'] != 'completed':
            messages += [it for it in received(socket, 1) if it['data'].get('action') == 'async_bg']
    completed = client.get(result, params={'full_response': 'true'}).json()
    # the replayed response: its headers are those of the server, of no use to the hooks, and
    # of its document only the identifier and the changed title
    replayed = completed['response']
    assert replayed['status'] == 200, replayed
    replayed['headers'] = []
    document = replayed['response']['data']
    replayed['response'] = {'data': {
        'id': document['id'], 'type': document['type'],
        'attributes': {'title': document['attributes']['title']},
    }}
    return {
        'async_request_queued': started,
        'async_result_pending': pending,
        'async_result_not_ready': before,
        'async_result_completed': completed,
        'ws_async_bg': messages,
    }


def notified(app, user, tasks_client) -> dict:
    """
    The messages of the socket of the user while a task assigned to them is finished: the
    first change of a task on the common channel (the resource, never the id of an item: an
    anonymous session receives it too), and the notification of the assignee.
    """
    token = user.jwt_build()
    with get_api_client(app).client.websocket_connect('/ws') as socket:
        socket.send_json({'token': token})
        subscribed(user.user_channel)
        created = tasks_client.post(TASKS, json_data={'data': {
            'type': 'tasks.task', 'attributes': {'title': 'Notify'},
            'relationships': {'assignee': {'data': {'type': 'users.user', 'id': str(user.id)}}},
        }}).json()
        item = f'{TASKS}{created["data"]["id"]}/'
        assert tasks_client.post(f'{item}transit/', json_data={'transit': 'start'}).status_code == 200
        finished = tasks_client.post(f'{item}transit/', json_data={'transit': 'finish', 'payload': {'report': 'Done'}})
        assert finished.status_code == 200, finished.text
        changed, notification = None, None
        while notification is None:
            message, = received(socket, 1)
            if message['data'].get('action') == 'notification':
                notification = message
            elif changed is None:
                changed = message
    assert changed['data'] == {'resource': 'tasks.task'}
    return {'ws_changed': changed, 'ws_notification': notification}


#: the attributes of a task of bazis-bg that the hooks read (the others hold its arguments,
#: its log with the times of its records, the durations of its phases)
BG_ATTRIBUTES = [
    'name', 'state', 'phase', 'expected', 'performed', 'result', 'error', 'interrupt',
    'dt_start', 'dt_finish',
]


def bg_task(app, user) -> dict:
    """
    A task of bazis-bg queued by the user, as they read it: waiting, running (its progress
    set as `progress` saves it) and done (run in this process, as `manage.py bg_task` does).
    """
    from tasks.bg.count import CountTasks

    client = get_api_client(app, user.jwt_build())
    task = CountTasks.delay(author=user)
    item = f'/api/v1/bg/task/{task.pk}/'

    def read():
        response = client.get(item)
        assert response.status_code == 200, response.text
        data = response.json()['data']
        attributes = {name: data['attributes'][name] for name in BG_ATTRIBUTES}
        return {'data': {'id': data['id'], 'type': data['type'], 'attributes': attributes}}

    waiting = read()
    task.state, task.phase, task.expected, task.performed = 'running', 'Count the tasks', 2, 1
    task.save()
    running = read()
    task.state, task.phase, task.expected, task.performed = 'starting', 'starting', None, None
    task.save()
    CountTasks.run(task)
    return {'bg_task_waiting': waiting, 'bg_task_running': running, 'bg_task_done': read()}


@pytest.mark.django_db(transaction=True)
def test_the_fixture_of_the_hooks_is_the_sample(sample_app, workflow, settings, monkeypatch):
    captured = capture(sample_app, settings, monkeypatch)
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        FIXTURE.write_text(json.dumps(captured, indent=2) + '\n', encoding='utf-8')
    assert json.loads(FIXTURE.read_text(encoding='utf-8')) == captured
