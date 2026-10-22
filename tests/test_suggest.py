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
The public screen of the sample, `public-tasks` of the anonymous role `visitor`: a user without
a session reads the tasks (the permit role `viewer`, `for_anonymous`) and suggests one through
the custom action `suggest` declared `public=True`, while bazis-permit refuses him the create
route of the tasks, which is why a public screen has no form (S044) and its custom actions are
public ones (S046).
"""

import base64

import pytest
from bazis_test_utils.utils import get_api_client

from .test_related import FILES, manager_client


TASKS = '/api/v1/tasks/task/'
#: a photo of one pixel, a PNG: the guests upload images only (bazis-uploadable 2.8)
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')


def uploaded(client, name: str = 'photo.png', content: bytes = PNG):
    return client.post(FILES, files={'file': (name, content, 'image/png')})


@pytest.mark.django_db(transaction=True)
def test_a_guest_reads_the_tasks_and_suggests_one(sample_app):
    guest = get_api_client(sample_app)
    assert guest.get(TASKS).status_code == 200

    suggested = guest.post(f'{TASKS}suggest/', json_data={'title': 'Suggested by a guest'})
    assert suggested.status_code == 200, suggested.text
    task = suggested.json()['task']
    # the title of the guest with the reference of the task, the start of its id
    assert suggested.json()['title'] == f'Suggested by a guest ({task[:8]})'
    assert guest.get(f'{TASKS}{task}/').json()['data']['attributes']['title'] == suggested.json()['title']

    # an empty title: its field
    invalid = guest.post(f'{TASKS}suggest/', json_data={'title': ''})
    assert invalid.status_code == 422, invalid.text
    assert [it['source']['pointer'] for it in invalid.json()['errors']] == ['/title']
    # a title leaves room for the reference
    long = guest.post(f'{TASKS}suggest/', json_data={'title': 'x' * 245})
    assert long.status_code == 422, long.text
    assert guest.post(f'{TASKS}suggest/', json_data={'title': 'x' * 244}).json()['title'].startswith('x' * 244 + ' (')


@pytest.mark.django_db(transaction=True)
def test_a_guest_creates_nothing_through_the_create_route(sample_app):
    created = get_api_client(sample_app).post(
        TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {'title': 'Plan'}}},
    )
    assert created.status_code == 403, created.text


@pytest.mark.django_db(transaction=True)
def test_a_guest_attaches_the_photos_he_uploaded(sample_app):
    """
    The project turns the anonymous uploads of bazis-uploadable 2.8 on (`project.env`, with a
    size limit): a guest uploads an image without a session, reads back a token as its id
    and not the file, and suggests a task with it; the team reads the photos of the task
    (`files_visible`). A bare id, a forged token and a file of a user are not his uploads (422
    `ERR_PHOTO` at `/photos`); a token sent twice attaches its photo once, and within the TTL
    to another task too; a text is not an image (422).
    """
    guest = get_api_client(sample_app)
    photo = uploaded(guest)
    assert photo.status_code == 201, photo.text
    token = photo.json()['data']['id']
    assert photo.json()['data']['attributes'] == {'name': 'photo.png', 'extension': 'png', 'size': len(PNG)}
    assert not token.isdigit()
    assert guest.get(f'{FILES}{token}/').status_code == 401
    text = guest.post(FILES, files={'file': ('a.txt', b'a', 'text/plain')})
    assert (text.status_code, text.json()['errors'][0]['code']) == (422, 'ERR_FILE_TYPE')

    suggested = guest.post(f'{TASKS}suggest/', json_data={'title': 'With a photo', 'photos': [token]})
    assert suggested.status_code == 200, suggested.text
    _, manager = manager_client(sample_app)
    task = manager.get(f'{TASKS}{suggested.json()["task"]}/').json()['data']
    [linked] = task['relationships']['photos']['data']
    assert manager.get(f'{FILES}{linked["id"]}/').json()['data']['attributes']['name'] == 'photo.png'

    user, _ = manager_client(sample_app, 'other')
    theirs = uploaded(get_api_client(sample_app, user.jwt_build())).json()['data']['id']
    other = uploaded(guest).json()['data']['id']
    for photos in ([str(linked['id'])], [token[:-1] + 'x'], [str(theirs)], [other, 'nope']):
        refused = guest.post(f'{TASKS}suggest/', json_data={'title': 'Not his', 'photos': photos})
        assert refused.status_code == 422, (photos, refused.text)
        assert [(it['code'], it['source']['pointer']) for it in refused.json()['errors']] == [('ERR_PHOTO', '/photos')]

    def photos_of(answer):
        assert answer.status_code == 200, answer.text
        task = manager.get(f'{TASKS}{answer.json()["task"]}/').json()['data']
        return [it['id'] for it in task['relationships']['photos']['data']]

    twice = photos_of(guest.post(f'{TASKS}suggest/', json_data={'title': 'Twice', 'photos': [other, other]}))
    assert len(twice) == 1 and twice != [linked['id']]
    # The residual risk of bazis-uploadable 2.8: a token attaches its upload until
    # `BAZIS_FILE_UPLOAD_ANONYMOUS_TTL`, also to another object; the signature keeps it to the
    # guest who read it back, not to one use (the same photo, not a copy).
    again = guest.post(f'{TASKS}suggest/', json_data={'title': 'The same photo', 'photos': [token]})
    assert photos_of(again) == [linked['id']]


@pytest.mark.django_db(transaction=True)
def test_a_user_attaches_only_his_own_files(sample_app):
    # a user who suggests a task attaches the files he uploaded, by their ids: not a token
    user, client = manager_client(sample_app)
    mine = str(uploaded(client).json()['data']['id'])
    token = uploaded(get_api_client(sample_app)).json()['data']['id']
    suggested = client.post(f'{TASKS}suggest/', json_data={'title': 'Mine', 'photos': [mine]})
    assert suggested.status_code == 200, suggested.text
    task = client.get(f'{TASKS}{suggested.json()["task"]}/').json()['data']
    assert [str(it['id']) for it in task['relationships']['photos']['data']] == [mine]
    refused = client.post(f'{TASKS}suggest/', json_data={'title': 'A guest one', 'photos': [token]})
    assert refused.status_code == 422, refused.text


@pytest.mark.django_db(transaction=True)
def test_the_photos_of_a_finished_task_are_those_its_user_uploaded(sample_app):
    """
    The payload of `finish` takes the photos of the work (`list[UploadedFileId]`, uploaded in
    the dialog of the transit): the task links those the user uploaded, never the file of
    another user nor a token of a guest.
    """
    user, client = manager_client(sample_app)
    mine = str(uploaded(client).json()['data']['id'])
    _, other = manager_client(sample_app, 'other')
    theirs = str(uploaded(other).json()['data']['id'])
    token = uploaded(get_api_client(sample_app)).json()['data']['id']
    created = client.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {'title': 'With photos'}}})
    assert created.status_code == 201, created.text
    item = f'{TASKS}{created.json()["data"]["id"]}/'
    assert client.post(f'{item}transit/', json_data={'transit': 'start'}).status_code == 200
    finished = client.post(
        f'{item}transit/', json_data={'transit': 'finish', 'payload': {'report': 'Done', 'photos': [mine, theirs, token]}},
    )
    assert finished.status_code == 200, finished.text
    task = client.get(item).json()['data']
    assert [str(it['id']) for it in task['relationships']['photos']['data']] == [mine]
