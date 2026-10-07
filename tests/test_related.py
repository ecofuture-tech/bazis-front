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


def manager_client(app):
    from django.apps import apps

    from bazis.contrib.users import get_user_model

    role = apps.get_model('permit.Role').objects.get(slug='manager')
    user = get_user_model().objects.create_user('manager', password='p')
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
