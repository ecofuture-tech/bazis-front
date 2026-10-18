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
migrations (the roles, statuses and transits are declared in `tasks/roles.py` and
`tasks/workflow.py`, which `migrate` applies):
the test users of the roles, the `test_user` of the roles of `sample/spec/product.yaml`, and
the task that a scenario opens (the points are written by a scenario, through the API, as a
product writes them). Every run starts the scenarios from the
same data: the tasks of the previous runs (those the scenarios created, with their steps) are
deleted, so that the lists do not grow from run to run and the task of the viewer is a draft
again, and so are the notifications of the test users (bazis-notify): a scenario finds only
the notification it caused.
"""

from django.apps import apps as global_apps
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone


#: the test users of the roles of spec/product.yaml (`test_user`): the slug of the role of
#: each and the first and the last name, by username. The frontend labels a user by his
#: names (`Mary Manager`), the scenarios pick and find him by them
TEST_USERS = {'manager': ('manager', 'Mary', 'Manager'), 'viewer': ('viewer', 'Victor', 'Viewer')}

#: the title of the task that the scenario of the viewer opens; no scenario creates a task
#: with this title, so that the scenarios do not depend on their order
TASK = 'Review the plan'


def create_test_data(password: str) -> None:
    """
    The data of the end-to-end tests on top of the migrations: the test user of each role,
    with his names and the password (set again when the user exists, so that the tests log in
    with the current E2E_PASSWORD, and the language of the profile cleared), and the task that the
    scenario of the viewer opens, created again after the tasks of the previous runs are
    deleted (the database of the end-to-end tests is theirs). A role that `migrate` did not
    apply is an error: this data never creates one.
    """
    role_model = global_apps.get_model('permit', 'Role')
    for username, (slug, first_name, last_name) in TEST_USERS.items():
        try:
            role = role_model.objects.get(slug=slug)
        except ObjectDoesNotExist:
            raise LookupError(
                f'The role {slug!r} of the test user {username!r} does not exist: migrate.'
            ) from None
        user = get_user_model().objects.get_or_create(username=username)[0]
        user.first_name, user.last_name = first_name, last_name
        user.set_password(password)
        user.roles.add(role)
        user.role_current = role
        # the language of the profile (`UserLanguageMixin` of bazis-users 2.7.0): none, as a
        # new user, so that a run does not depend on the language a previous one chose
        if hasattr(user, 'language'):
            user.language = None
        user.save()
    task_model = global_apps.get_model('tasks', 'Task')
    # the tasks of the previous runs: those the scenarios created, and the task of the viewer,
    # which a run may have changed
    task_model.objects.all().delete()
    # due now: on the day of the run in the calendar of the tasks
    task_model.objects.create(title=TASK, due=timezone.now())
    global_apps.get_model('notify', 'Notification').objects.filter(user__username__in=TEST_USERS).delete()
