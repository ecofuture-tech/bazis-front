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
The watchers of a task, a many-to-many field to the users that the forms of the frontend edit
(`RelationListPicker`) and send with all the items of the relationship: the backend sets the
relationship to them in the create and the update. The users of the team pick each other
(`users.routes.UserRouteSet`: a signed-in user views and links every active user), an
inactive user is hidden from those who are not staff: they do not link him (403
`ERR_RELATION_ACCESS`), but the identifiers of the relationship in a document are all its
items, also those hidden from the user, so the form sends them back as they are and an update
keeps them. Who changes a user is still the rule of bazis-users.
"""

import pytest

from tests.test_can import client_of


TASKS = '/api/v1/tasks/task/'
USERS = '/api/v1/users/user/'


def watchers(*ids: str) -> dict:
    return {'watchers': {'data': [{'type': 'users.user', 'id': it} for it in ids]}}


def watcher_ids(document: dict) -> list[str]:
    return sorted(it['id'] for it in document['data']['relationships']['watchers']['data'])


@pytest.mark.django_db(transaction=True)
def test_the_form_sets_the_watchers_and_keeps_those_the_user_may_not_view(sample_app):
    from bazis.contrib.users import get_user_model

    manager = client_of(sample_app, 'manager')
    users = get_user_model().objects
    me = str(users.get(username='manager').pk)
    mate = str(users.create_user('mate', password='p', first_name='Ann', last_name='Lee').pk)
    gone = users.create_user('gone', password='p', is_active=False)

    # the team: the pickers list the active users, the labels read them
    listed = manager.get(USERS, params={'search': 'Ann Lee'})
    assert [it['id'] for it in listed.json()['data']] == [mate]
    assert str(gone.pk) not in {it['id'] for it in manager.get(USERS).json()['data']}

    created = manager.post(TASKS, json_data={'data': {
        'type': 'tasks.task', 'attributes': {'title': 'Watch'}, 'relationships': watchers(me, mate),
    }})
    assert created.status_code == 201, created.text
    task = created.json()['data']['id']
    assert watcher_ids(created.json()) == sorted([me, mate])
    # a user hidden from the manager is not linked by him
    refused = manager.patch(f'{TASKS}{task}/', json_data={'data': {
        'type': 'tasks.task', 'id': task, 'relationships': watchers(me, mate, str(gone.pk)),
    }})
    assert refused.status_code == 403, refused.text
    assert refused.json()['errors'][0]['code'] == 'ERR_RELATION_ACCESS'

    # linked by someone else: the document of the manager has its identifier all the same
    from django.apps import apps
    apps.get_model('tasks.Task').objects.get(pk=task).watchers.add(gone)
    hidden = sorted([me, mate, str(gone.pk)])
    assert watcher_ids(manager.get(f'{TASKS}{task}/').json()) == hidden

    # a change of another field does not send the relationship: it stays
    changed = manager.patch(f'{TASKS}{task}/', json_data={'data': {
        'type': 'tasks.task', 'id': task, 'attributes': {'title': 'Watch it'},
    }})
    assert changed.status_code == 200, changed.text
    assert watcher_ids(manager.get(f'{TASKS}{task}/').json()) == hidden
    # the relationship sent back with all its items (the form, an item removed): the user
    # hidden from the manager is kept
    kept = manager.patch(f'{TASKS}{task}/', json_data={'data': {
        'type': 'tasks.task', 'id': task, 'relationships': watchers(mate, str(gone.pk)),
    }})
    assert kept.status_code == 200, kept.text
    assert watcher_ids(manager.get(f'{TASKS}{task}/').json()) == sorted([mate, str(gone.pk)])
    # none: every item removed
    cleared = manager.patch(f'{TASKS}{task}/', json_data={'data': {
        'type': 'tasks.task', 'id': task, 'relationships': watchers(),
    }})
    assert cleared.status_code == 200, cleared.text
    assert watcher_ids(manager.get(f'{TASKS}{task}/').json()) == []


@pytest.mark.django_db(transaction=True)
def test_a_user_who_is_not_staff_changes_only_himself(sample_app):
    from bazis.contrib.users import get_user_model

    manager = client_of(sample_app, 'manager')
    mate = str(get_user_model().objects.create_user('mate', password='p').pk)
    # he sees the user of the team, never changes nor deletes him
    assert manager.get(f'{USERS}{mate}/').status_code == 200
    body = {'data': {'type': 'users.user', 'id': mate, 'attributes': {'first_name': 'X'}}}
    assert manager.patch(f'{USERS}{mate}/', json_data=body).status_code in (403, 404)
    assert manager.delete(f'{USERS}{mate}/').status_code in (403, 404)
    assert get_user_model().objects.get(pk=mate).first_name == ''
