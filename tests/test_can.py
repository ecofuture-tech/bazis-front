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
What the frontend reads of what a user may do on a route set, against the sample: `useCan`
of the hooks (`assets/react/src/queries.ts`) and `requires` of the links of `AppShell` read
the runtime schema of the list (`view`) and of the create (`add`), which bazis-permit
refuses with 403 without a permission of the model for the action, and the filter fields
of the user (`route_filter_fields/`), which leave out a field hidden from him (the filters
of `ResourceList` have no control for it: its filter is 400).
"""

import pytest
from bazis_test_utils.utils import get_api_client


TASKS = '/api/v1/tasks/task/'


def client_of(app, slug: str):
    """
    A client of the API with the token of a user of the role.
    """
    from django.apps import apps

    from bazis.contrib.users import get_user_model

    role = apps.get_model('permit.Role').objects.get(slug=slug)
    user = get_user_model().objects.create_user(slug, password='p')
    user.roles.add(role)
    user.role_current = role
    user.save()
    return get_api_client(app, user.jwt_build())


def status(client, path: str) -> int:
    return client.get(f'{TASKS}{path}').status_code


@pytest.mark.django_db(transaction=True)
def test_the_runtime_schemas_say_what_the_user_may_do(sample_app):
    # the guest has no permission, the viewer views the tasks, the manager adds them too
    allowed = {
        slug: (status(client, 'schema_list/'), status(client, 'schema_create/'))
        for slug, client in ((it, client_of(sample_app, it)) for it in ('guest', 'viewer', 'manager'))
    }
    assert allowed == {'guest': (403, 403), 'viewer': (200, 403), 'manager': (200, 200)}


@pytest.mark.django_db(transaction=True)
def test_the_filter_fields_are_those_of_the_user(sample_app):
    def fields(client):
        response = client.get(f'{TASKS}route_filter_fields/')
        assert response.status_code == 200, response.text
        return {it['name'] for it in response.json()['fields']}

    manager, viewer = client_of(sample_app, 'manager'), client_of(sample_app, 'viewer')
    # the report is hidden from the viewer (`field.view.all.all.report.disable`)
    assert 'report' in fields(manager)
    assert 'report' not in fields(viewer) and 'title' in fields(viewer)
    assert viewer.get(TASKS, params={'filter': 'report=x'}).status_code == 400
