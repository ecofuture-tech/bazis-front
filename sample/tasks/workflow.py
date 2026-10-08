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
The data of the end-to-end tests of the sample, created by `manage.py e2e_data` on top of the
migrations (the roles, statuses and transits are the data migration `tasks.0005_workflow`):
the test users of the roles, the `test_user` of the roles of `sample/spec/product.yaml`, and
the task that a scenario opens.
"""

from django.apps import apps as global_apps
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist


#: the test users of the roles of spec/product.yaml (`test_user`): the slug of the role of
#: each, by username
TEST_USERS = {'manager': 'manager', 'viewer': 'viewer'}

#: the title of the task that the scenario of the viewer opens; no scenario creates a task
#: with this title, so that the scenarios do not depend on their order
TASK = 'Review the plan'


def create_test_data(password: str) -> None:
    """
    The data of the end-to-end tests on top of the migrations: the test user of each role,
    with the password (set again when the user exists, so that the tests log in with the
    current E2E_PASSWORD), and the task that the scenario of the viewer opens. A role that
    the migrations did not create is an error: this data never creates one.
    """
    role_model = global_apps.get_model('permit', 'Role')
    for username, slug in TEST_USERS.items():
        try:
            role = role_model.objects.get(slug=slug)
        except ObjectDoesNotExist:
            raise LookupError(
                f'The role {slug!r} of the test user {username!r} does not exist: migrate.'
            ) from None
        user = get_user_model().objects.get_or_create(username=username)[0]
        user.set_password(password)
        user.roles.add(role)
        user.role_current = role
        user.save()
    task_model = global_apps.get_model('tasks', 'Task')
    if not task_model.objects.filter(title=TASK).exists():
        task_model.objects.create(title=TASK)
