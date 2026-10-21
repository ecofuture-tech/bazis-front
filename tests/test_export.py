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
The custom action of the sample that answers a file, `export` of the tasks (the form
`export-tasks` saves it): CSV of the tasks the user views, of a priority or all, for a role
that views the tasks (`access_action`).
"""

import pytest

from tests.test_can import client_of


EXPORT = '/api/v1/tasks/task/export/'


@pytest.mark.django_db(transaction=True)
def test_the_viewer_exports_the_tasks_as_csv(sample_app):
    from tasks.models import Task

    Task.objects.create(title='Plan', priority='high')
    Task.objects.create(title='Ship', priority='low')
    viewer = client_of(sample_app, 'viewer')

    exported = viewer.post(EXPORT, json_data={})
    assert exported.status_code == 200, exported.text
    assert exported.headers['content-type'].startswith('text/csv')
    assert exported.headers['content-disposition'] == 'attachment; filename="tasks.csv"'
    assert exported.text.splitlines() == ['title,status,priority', 'Plan,draft,high', 'Ship,draft,low']
    high = viewer.post(EXPORT, json_data={'priority': 'high'})
    assert high.text.splitlines() == ['title,status,priority', 'Plan,draft,high']


@pytest.mark.django_db(transaction=True)
def test_a_role_that_views_no_tasks_exports_nothing(sample_app):
    assert client_of(sample_app, 'guest').post(EXPORT, json_data={}).status_code == 403
