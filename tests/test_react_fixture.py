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

It holds the errors that the forms and `useRelationship` read (bazis 2.11: the pointers into
the request document, and into the body of the relationships endpoints). It also holds what
the hooks of the packages read: the messages of the socket of bazis-ws
(as the server sends them: the change of a task of the sample, the messages of bazis-notify
about the notification of its assignee, a notification of bazis-ws, the statuses of a
background request), the inbox of bazis-notify (the list and the unread count), the custom
action of the sample that queues a task of
bazis-bg and the documents of that task (`bg.task`), and the
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
    # `Z` of the API, `+00:00` of the messages of bazis-notify (`isoformat`)
    (re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)'), '2026-01-01T00:00:00Z'),
]


#: the keywords of a JSON Schema that the hooks read (`src/schema.ts`, `src/statusy/`):
#: `enumDict` (the labels of the choices, by value) is kept as it is
SCHEMA_KEYWORDS = {
    '$defs', '$ref', 'anyOf', 'default', 'enum', 'enumDict', 'format', 'items', 'maxLength',
    'nullable', 'properties', 'readOnly', 'required', 'title', 'type',
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
        elif key == 'enumDict':
            result[key] = value
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
    # the custom actions of the collection that the user may call (bazis-permit 2.11): `count`
    # needs a user
    result['list_custom_actions'] = {'meta': ok(client.get(TASKS, params=CUSTOM_ACTIONS))['meta']}
    result['list_custom_actions_anonymous'] = {
        'meta': ok(get_api_client(app).get(TASKS, params=CUSTOM_ACTIONS))['meta']
    }
    ok(client.post(f'{item}transit/', json_data={'transit': 'start'}))
    result['retrieve_in_progress'] = actions(ok(client.get(item, params={'meta': 'state_actions'})))
    result['create_422'] = errors(
        ok(client.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {}}}), 422)
    )
    result.update(notified(app, user, client))
    result.update(bg_task(app, user))
    result.update(background(app, settings, monkeypatch, user))
    # after the task of bazis-bg, which counts the tasks
    result.update(refused(app, client))
    return normalize(result)


FILES = '/api/v1/uploadable/file_upload/'
#: the list that tells the custom actions of the collection (`useCan(path, 'action_<name>')`)
CUSTOM_ACTIONS = {'meta': 'custom_actions', 'page[limit]': 1}


def refused(app, client) -> dict:
    """
    The errors of bazis 2.11 that `ApiError.fieldErrors()` and `formErrors()` read, beside
    those of a create: they point into the request document. An update that the schema
    refuses (`/data/attributes/<field>`, with the id and type of the item), and on the
    relationships endpoint, whose errors point into its body: a file of another user (403
    `ERR_RELATION_ACCESS`, `/data`) and an id that cannot be a key (422 `ERR_VALIDATE`,
    `/data/id`).
    """
    from bazis.contrib.users import get_user_model

    def ok(response, status):
        assert response.status_code == status, response.text
        return response.json()

    stranger = get_user_model().objects.create_user('stranger', password='p')
    uploaded = get_api_client(app, stranger.jwt_build()).post(
        FILES, files={'file': ('secret.txt', b'Not yours.', 'text/plain')},
    )
    theirs = str(ok(uploaded, 201)['data']['id'])
    task_id = ok(client.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {'title': 'Draft'}}}), 201)['data']['id']
    item = f'{TASKS}{task_id}/'
    return {
        'update_422': errors(ok(client.patch(item, json_data={'data': {
            'type': 'tasks.task', 'id': task_id, 'attributes': {'title': ''},
        }}), 422)),
        'relationship_403': errors(ok(client.patch(
            f'{item}relationships/attachment',
            json_data={'data': {'type': 'uploadable.file_upload', 'id': theirs}},
        ), 403)),
        'relationship_422': errors(ok(client.patch(
            f'{item}relationships/assignee', json_data={'data': {'type': 'users.user', 'id': 'nope'}},
        ), 422)),
    }


def subscribed(socket) -> None:
    """
    Waits until the server subscribed the session of the socket (bazis-ws sends
    `{"type": "subscribed"}`, which the hooks wait for): a message published before is lost.
    """
    assert socket.receive_json() == {'type': 'subscribed'}


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
    with get_api_client(app).client.websocket_connect('/api/v1/ws') as socket:
        socket.send_json({'token': token})
        subscribed(socket)
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


NOTIFICATIONS = '/api/v1/notify/notification/'


def next_action(socket, action: str) -> dict:
    """
    The next message of the socket with this action (the changes of the tasks between).
    """
    while True:
        message, = received(socket, 1)
        if message['data'].get('action') == action:
            return message


def notified(app, user, tasks_client) -> dict:
    """
    The messages of the socket of the user while a task assigned to them is finished: the
    first change of a task on the common channel (the resource, never the id of an item: every
    user session receives it), the stored notification of the assignee (bazis-notify:
    `notification_created`, its list and its unread count, then `notifications_changed` once
    it is read), and a notification of bazis-ws (`notify` with `notification` of
    `bazis.contrib.ws.messages`, the format of `useNotifications`, which the sample does not
    send).
    """
    from django.apps import apps

    from bazis.contrib.ws.messages import notification, notify

    token = user.jwt_build()
    client = get_api_client(app, token)
    with get_api_client(app).client.websocket_connect('/api/v1/ws') as socket:
        socket.send_json({'token': token})
        subscribed(socket)
        created = tasks_client.post(TASKS, json_data={'data': {
            'type': 'tasks.task', 'attributes': {'title': 'Notify'},
            'relationships': {'assignee': {'data': {'type': 'users.user', 'id': str(user.id)}}},
        }}).json()
        item = f'{TASKS}{created["data"]["id"]}/'
        assert tasks_client.post(f'{item}transit/', json_data={'transit': 'start'}).status_code == 200
        finished = tasks_client.post(f'{item}transit/', json_data={'transit': 'finish', 'payload': {'report': 'Done'}})
        assert finished.status_code == 200, finished.text
        changed, = received(socket, 1)
        created_message = next_action(socket, 'notification_created')
        listed = client.get(NOTIFICATIONS)
        assert listed.status_code == 200, listed.text
        unread = client.get(f'{NOTIFICATIONS}unread_count/')
        assert unread.status_code == 200, unread.text
        stored, = listed.json()['data']
        read = client.patch(f'{NOTIFICATIONS}{stored["id"]}/', json_data={'data': {
            'id': stored['id'], 'type': stored['type'], 'attributes': {'read_at': '2026-01-01T00:00:00Z'},
        }})
        assert read.status_code == 200, read.text
        changed_message = next_action(socket, 'notifications_changed')
        task = apps.get_model('tasks.Task').objects.get(pk=created['data']['id'])
        notify(user, lambda recipient: notification('Task finished', task.title, task))
        ws_message = next_action(socket, 'notification')
    assert changed['data'] == {'resource': 'tasks.task'}
    return {
        'ws_changed': changed,
        'ws_notification': ws_message,
        'ws_notification_created': created_message,
        'ws_notifications_changed': changed_message,
        # what the hooks read of the list
        'notify_list': {'data': [{key: stored[key] for key in ('id', 'type', 'attributes')}]},
        'notify_unread_count': unread.json(),
    }


#: the attributes of a task of bazis-bg that the hooks read (the others hold its arguments,
#: its log with the times of its records, the durations of its phases)
BG_ATTRIBUTES = [
    'name', 'state', 'phase', 'expected', 'performed', 'result', 'error', 'interrupt', 'file',
    'dt_start', 'dt_finish',
]


def bg_task(app, user) -> dict:
    """
    A task of bazis-bg queued by the user with the custom action `count` of the route set of
    the tasks (`client.action`: its JSON response, and the errors of its body, `/priority`,
    and of an anonymous request), as they read it: waiting, running (its progress set as
    `progress` saves it) and done (run in this process, as `manage.py bg_task` does).
    """
    from django.apps import apps

    from tasks.bg.count import CountTasks

    client = get_api_client(app, user.jwt_build())
    count = f'{TASKS}count/'
    refused = client.post(count, json_data={'priority': 'urgent'})
    assert refused.status_code == 422, refused.text
    anonymous = get_api_client(app).post(count, json_data={})
    assert anonymous.status_code == 403, anonymous.text
    started = client.post(count, json_data={'priority': 'normal'})
    assert started.status_code == 200, started.text
    task = apps.get_model('bg.Task').objects.get(pk=started.json()['task'])
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
    CountTasks.run(task, *task.args, **task.kwargs)
    return {
        'action_count': started.json(),
        'action_count_422': errors(refused.json()),
        'action_count_403': errors(anonymous.json()),
        'bg_task_waiting': waiting,
        'bg_task_running': running,
        'bg_task_done': read(),
    }


@pytest.mark.django_db(transaction=True)
def test_the_fixture_of_the_hooks_is_the_sample(sample_app, settings, monkeypatch):
    captured = capture(sample_app, settings, monkeypatch)
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        FIXTURE.write_text(json.dumps(captured, indent=2) + '\n', encoding='utf-8')
    assert json.loads(FIXTURE.read_text(encoding='utf-8')) == captured


def labels_of(node, name: str):
    """
    The labels of the choices (`enumDict`) of the property of a runtime schema, wherever the
    schema defines it.
    """
    if isinstance(node, list):
        return next((it for it in (labels_of(child, name) for child in node) if it is not None), None)
    if not isinstance(node, dict):
        return None
    found = node.get('properties', {}).get(name, {}).get('enumDict')
    if found is not None:
        return found
    return next((it for it in (labels_of(child, name) for child in node.values()) if it is not None), None)


@pytest.mark.django_db
def test_the_labels_of_the_choices_are_in_the_language_of_the_request(sample_app):
    # the hooks show a choice by its label (`labels` of a field): the backend gives them in
    # the language of the request, the language of the interface
    client = get_api_client(sample_app)
    for language, expected in (
        ('en', {'low': 'Low', 'normal': 'Normal', 'high': 'High'}),
        ('ru', {'low': 'Низкий', 'normal': 'Обычный', 'high': 'Высокий'}),
    ):
        response = client.get(f'{TASKS}schema_list/', headers={'Accept-Language': language})
        assert response.status_code == 200, response.text
        assert labels_of(response.json(), 'priority') == expected
