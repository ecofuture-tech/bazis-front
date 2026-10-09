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
The steps of a task, the related section of the card of a task (`card.related` of
`sample/spec/screens/task-card.yaml`): the card offers "add here" only while the task may be
changed, a draft, and the backend refuses a step of another task itself (`Step.validate_item`,
422 `ERR_ITEM_INVALID` at the relationship to the task), whatever the frontend shows.
"""

import pytest

from tests.test_can import client_of


TASKS = '/api/v1/tasks/task/'
STEPS = '/api/v1/tasks/step/'


def step(task_id: str, title: str = 'Book the room') -> dict:
    return {'data': {
        'type': 'tasks.step', 'attributes': {'title': title},
        'relationships': {'task': {'data': {'type': 'tasks.task', 'id': task_id}}},
    }}


@pytest.mark.django_db(transaction=True)
def test_a_step_is_added_to_a_draft_task_only(sample_app):
    manager = client_of(sample_app, 'manager')
    created = manager.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {'title': 'Plan'}}})
    assert created.status_code == 201, created.text
    task = created.json()['data']['id']

    added = manager.post(STEPS, json_data=step(task))
    assert added.status_code == 201, added.text
    # the list of the related section: the steps of the task
    listed = manager.get(STEPS, params={'filter': f'task={task}'})
    assert [it['attributes']['title'] for it in listed.json()['data']] == ['Book the room']

    assert manager.post(f'{TASKS}{task}/transit/', json_data={'transit': 'start'}).status_code == 200
    refused = manager.post(STEPS, json_data=step(task, 'Too late'))
    assert refused.status_code == 422, refused.text
    [error] = refused.json()['errors']
    assert error['code'] == 'ERR_ITEM_INVALID'
    assert error['source'] == {'pointer': '/data/relationships/task'}
    # nothing is written
    listed = manager.get(STEPS, params={'filter': f'task={task}'})
    assert [it['attributes']['title'] for it in listed.json()['data']] == ['Book the room']
