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
The query of `useRelatedItem` of the hooks (`assets/react/src/related.ts`) against the
sample: the items of a resource by their primary keys are `filter=pk=<a>|pk=<b>`, one
request for the labels of a page of rows. The core has no `pk__in`, and `pk=<a>,<b>` is one
value; the list returns only the items the user may view.
"""

import pytest
from bazis_test_utils.utils import get_api_client


TASKS = '/api/v1/tasks/task/'
USERS = '/api/v1/users/user/'


def manager_client(app, username: str = 'manager'):
    """
    A user with the role manager, and a client of the API with his token.
    """
    from django.apps import apps

    from bazis.contrib.users import get_user_model

    role = apps.get_model('permit.Role').objects.get(slug='manager')
    user = get_user_model().objects.create_user(username, password='p')
    user.roles.add(role)
    user.role_current = role
    user.save()
    return user, get_api_client(app, user.jwt_build())


def ids(response) -> list[str]:
    assert response.status_code == 200, response.text
    return sorted(it['id'] for it in response.json()['data'])


@pytest.mark.django_db(transaction=True)
def test_the_items_of_a_resource_by_their_primary_keys(sample_app, workflow):
    from django.apps import apps

    from bazis.contrib.users import get_user_model

    user, client = manager_client(sample_app)
    task = apps.get_model('tasks.Task')
    first, second, other = (str(task.objects.create(title=title).id) for title in ('A', 'B', 'C'))

    response = client.get(TASKS, params={'filter': f'pk={first}|pk={second}', 'page[limit]': 2})
    assert ids(response) == sorted([first, second])
    # a comma is no list of ids: one value, an invalid UUID
    response = client.get(TASKS, params={'filter': f'pk={first},{second}'})
    assert response.status_code == 400
    assert response.json()['errors'][0]['code'] == 'ERR_FILTER'
    assert other not in ids(client.get(TASKS, params={'filter': f'pk={first}|pk={second}'}))

    # the user that the manager may not view (bazis-users: a user who is not staff sees
    # himself) is not in the list: its label is its id
    stranger = get_user_model().objects.create_user('stranger', password='p')
    response = client.get(USERS, params={'filter': f'pk={user.id}|pk={stranger.id}', 'page[limit]': 2})
    assert ids(response) == [str(user.id)]


FILES = '/api/v1/uploadable/file_upload/'


def upload(client, name: str) -> str:
    response = client.post(FILES, files={'file': (name, b'The brief.', 'text/plain')})
    assert response.status_code == 201, response.text
    return str(response.json()['data']['id'])


@pytest.mark.django_db(transaction=True)
def test_a_user_reads_only_the_files_he_uploaded(sample_app, workflow):
    """
    The route set of the uploaded files (bazis-uploadable 2.5.0, routed as it is): a user
    uploads a file, lists and reads his own files; the file of another user is a 404 (which
    `FileValue` shows as not available); no file is changed or deleted; the filter fields of
    the tasks name its list.
    """
    _, client = manager_client(sample_app)
    _, other = manager_client(sample_app, 'other')
    mine, theirs = upload(client, 'brief.txt'), upload(other, 'secret.txt')

    assert client.get(f'{FILES}{mine}/').json()['data']['attributes']['size'] == 10
    # the ids of the files are integers (JSON numbers in their documents)
    assert [str(it['id']) for it in client.get(FILES).json()['data']] == [mine]
    assert client.get(f'{FILES}{theirs}/').status_code == 404
    assert client.patch(f'{FILES}{mine}/', json_data={}).status_code == 405
    assert client.delete(f'{FILES}{mine}/').status_code == 405
    filters = client.get(f'{TASKS}route_filter_fields/').json()['fields']
    assert {'name': 'attachment', 'py_type': FILES} in filters
    # an anonymous user uploads nothing
    assert get_api_client(sample_app).post(FILES, files={'file': ('a.txt', b'a', 'text/plain')}).status_code == 401


@pytest.mark.django_db(transaction=True)
def test_a_task_takes_only_a_file_that_the_user_uploaded(sample_app, workflow):
    """
    The core does not check yet that a relationship targets an item the user may see: the
    route set of the tasks refuses the file of another user (403 `ERR_ATTACHMENT_NOT_OWN`) on
    a create, an update and the relationships endpoint, as bazis-uploadable recommends;
    otherwise a user would link it by its id and read it with `include=attachment`.
    """
    from django.apps import apps

    _, client = manager_client(sample_app)
    _, other = manager_client(sample_app, 'other')
    mine, theirs = upload(client, 'brief.txt'), upload(other, 'secret.txt')

    def document(file_id, task_id=None):
        data = {
            'type': 'tasks.task',
            'attributes': {'title': 'Attached'},
            'relationships': {'attachment': {'data': {'type': 'uploadable.file_upload', 'id': file_id}}},
        }
        return {'data': {**data, 'id': task_id} if task_id else data}

    refused = client.post(TASKS, json_data=document(theirs))
    assert refused.status_code == 403, refused.text
    assert refused.json()['errors'][0]['code'] == 'ERR_ATTACHMENT_NOT_OWN'
    assert not apps.get_model('tasks.Task').objects.filter(attachment_id=theirs).exists()

    created = client.post(TASKS, json_data=document(mine))
    assert created.status_code == 201, created.text
    task_id = created.json()['data']['id']
    item = f'{TASKS}{task_id}/'

    # an update that keeps the attachment, or changes it to a file of another user
    assert client.patch(item, json_data={'data': {'type': 'tasks.task', 'id': task_id, 'attributes': {'title': 'Kept'}}}).status_code == 200
    assert client.patch(item, json_data=document(theirs, task_id)).status_code == 403
    response = client.patch(
        f'{item}relationships/attachment',
        json_data={'data': {'type': 'uploadable.file_upload', 'id': theirs}},
    )
    assert response.status_code == 403, response.text
    assert str(apps.get_model('tasks.Task').objects.get(pk=task_id).attachment_id) == mine
    # no attachment is always allowed
    response = client.patch(item, json_data={'data': {
        'type': 'tasks.task', 'id': task_id, 'relationships': {'attachment': {'data': None}},
    }})
    assert response.status_code == 200, response.text
