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

import pytest
from bazis_test_utils.utils import get_api_client


TASKS = '/api/v1/tasks/task/'


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
