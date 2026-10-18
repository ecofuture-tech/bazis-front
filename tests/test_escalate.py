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
The custom action of an item of the sample, `escalate` of the tasks (the action `primitive:
custom` of the card, the rows and the bulk actions of the specs): it requires the change of
the task (`access_action`), so that bazis-permit lists it in `custom_actions` of the items the
user may change, a draft for the manager, and refuses it on the others.
"""

import pytest

from tests.test_can import client_of


TASKS = '/api/v1/tasks/task/'


@pytest.mark.django_db(transaction=True)
def test_the_manager_escalates_a_draft_only(sample_app):
    manager = client_of(sample_app, 'manager')
    created = manager.post(TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {'title': 'Plan'}}})
    assert created.status_code == 201, created.text
    task = created.json()['data']['id']

    meta = manager.get(f'{TASKS}{task}/', params={'meta': 'custom_actions'}).json()['meta']
    assert 'action_escalate' in meta['custom_actions']
    # the body by default: high
    escalated = manager.post(f'{TASKS}{task}/escalate/', json_data={})
    assert escalated.status_code == 200, escalated.text
    assert escalated.json() == {'priority': 'high'}
    assert manager.get(f'{TASKS}{task}/').json()['data']['attributes']['priority'] == 'high'
    assert manager.post(f'{TASKS}{task}/escalate/', json_data={'priority': 'low'}).json() == {'priority': 'low'}
    # a priority that is not a choice: its field
    invalid = manager.post(f'{TASKS}{task}/escalate/', json_data={'priority': 'urgent'})
    assert invalid.status_code == 422, invalid.text
    assert [it['source']['pointer'] for it in invalid.json()['errors']] == ['/priority']

    # started, the task is no longer a draft that the manager may change
    assert manager.post(f'{TASKS}{task}/transit/', json_data={'transit': 'start'}).status_code == 200
    meta = manager.get(f'{TASKS}{task}/', params={'meta': 'custom_actions'}).json()['meta']
    assert 'action_escalate' not in meta['custom_actions']
    assert manager.post(f'{TASKS}{task}/escalate/', json_data={}).status_code == 403


@pytest.mark.django_db(transaction=True)
def test_the_viewer_escalates_nothing(sample_app):
    manager = client_of(sample_app, 'manager')
    task = manager.post(
        TASKS, json_data={'data': {'type': 'tasks.task', 'attributes': {'title': 'Plan'}}},
    ).json()['data']['id']
    viewer = client_of(sample_app, 'viewer')
    meta = viewer.get(f'{TASKS}{task}/', params={'meta': 'custom_actions'}).json()['meta']
    assert 'action_escalate' not in meta['custom_actions']
    assert viewer.post(f'{TASKS}{task}/escalate/', json_data={}).status_code == 403
    assert manager.get(f'{TASKS}{task}/').json()['data']['attributes']['priority'] == 'normal'
