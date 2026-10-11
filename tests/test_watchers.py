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
relationship to them in the create and the update. The identifiers of the relationship in a
document are all its items, also those the user may not view (a manager who is not staff
sees only himself among the users of bazis-users): the form sends them back as they are, so an
update keeps them (the items it links are checked by `restrict_queryset` of the route of the
users, which bazis-users does not restrict: it restricts its own `get_queryset`).
"""

import pytest

from tests.test_can import client_of


TASKS = '/api/v1/tasks/task/'


def watchers(*ids: str) -> dict:
    return {'watchers': {'data': [{'type': 'users.user', 'id': it} for it in ids]}}


def watcher_ids(document: dict) -> list[str]:
    return sorted(it['id'] for it in document['data']['relationships']['watchers']['data'])


@pytest.mark.django_db(transaction=True)
def test_the_form_sets_the_watchers_and_keeps_those_the_user_may_not_view(sample_app):
    from bazis.contrib.users import get_user_model

    manager = client_of(sample_app, 'manager')
    me = str(get_user_model().objects.get(username='manager').pk)
    other = get_user_model().objects.create_user('other', password='p')

    created = manager.post(TASKS, json_data={'data': {
        'type': 'tasks.task', 'attributes': {'title': 'Watch'}, 'relationships': watchers(me),
    }})
    assert created.status_code == 201, created.text
    task = created.json()['data']['id']
    assert watcher_ids(created.json()) == [me]
    # linked by someone else: the document of the manager has its identifier all the same
    from django.apps import apps
    apps.get_model('tasks.Task').objects.get(pk=task).watchers.add(other)
    read = manager.get(f'{TASKS}{task}/')
    assert watcher_ids(read.json()) == sorted([me, str(other.pk)])

    # a change of another field does not send the relationship: it stays
    changed = manager.patch(f'{TASKS}{task}/', json_data={'data': {
        'type': 'tasks.task', 'id': task, 'attributes': {'title': 'Watch it'},
    }})
    assert changed.status_code == 200, changed.text
    assert watcher_ids(manager.get(f'{TASKS}{task}/').json()) == sorted([me, str(other.pk)])
    # the relationship sent back with all its items (the form, another item removed): the
    # item the manager may not view is kept
    kept = manager.patch(f'{TASKS}{task}/', json_data={'data': {
        'type': 'tasks.task', 'id': task, 'relationships': watchers(str(other.pk)),
    }})
    assert kept.status_code == 200, kept.text
    assert watcher_ids(manager.get(f'{TASKS}{task}/').json()) == [str(other.pk)]
    # none: every item removed
    cleared = manager.patch(f'{TASKS}{task}/', json_data={'data': {
        'type': 'tasks.task', 'id': task, 'relationships': watchers(),
    }})
    assert cleared.status_code == 200, cleared.text
    assert watcher_ids(manager.get(f'{TASKS}{task}/').json()) == []
