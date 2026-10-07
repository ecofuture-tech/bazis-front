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
The data of the sample that its migrations do not create, from one place: the fixture
`workflow` of the tests (tests/conftest.py) and the command `sample_data` (the end-to-end
tests of CI) call these functions. The specs of the sample (`sample/spec/`) reference this
data: the permissions of the roles cover their `access`, the test users are the `test_user`
of their roles.
"""

from django.apps import apps
from django.contrib.auth import get_user_model


#: the permissions of the permission groups, by the slug of the group
GROUPS = {
    'tasks_view': ['tasks.task.item.view.all.all'],
    # shares a permission with tasks_view: the role lists it once; the report is written by
    # the transit `finish`, never in the form of a change (a field permission: read-only in
    # `schema_update`)
    'tasks_change': [
        'tasks.task.item.view.all.all', 'tasks.task.item.add.all.all',
        'tasks.task.item.change.all.draft', 'tasks.task.field.change.all.all.report.readonly',
    ],
    'tasks_transit': [
        'tasks.task.item.transit.all.draft.start',
        'tasks.task.item.transit.all.in_progress.finish',
    ],
    # a field permission: the report is left out of `schema_list`/`schema_retrieve` and of
    # the documents of the items (the scenario `viewer-only-reads` expects it absent)
    'tasks_report_hidden': ['tasks.task.field.view.all.all.report.disable'],
}

#: a permission in no group: no role has it
UNGRANTED = ['tasks.task.item.delete.all.all']

#: the roles: (slug, name, for_anonymous, the slugs of their groups); a role without groups
#: has no permissions
ROLES = [
    ('guest', 'Guest', False, []),
    ('viewer', 'Viewer', True, ['tasks_view', 'tasks_report_hidden']),
    ('manager', 'Manager', False, ['tasks_view', 'tasks_change', 'tasks_transit']),
]

#: the statuses of the tasks: (id, name)
STATUSES = [('draft', 'Draft'), ('in_progress', 'In progress'), ('done', 'Done')]

#: the transits of the tasks: (id, name, source, destination, actions before)
TRANSITS = [
    ('start', 'Start', 'draft', 'in_progress', []),
    ('finish', 'Finish', 'in_progress', 'done', ['before_finish']),
]

#: the test users of the roles of spec/product.yaml (`test_user`): the slug of the role of
#: each, by username
TEST_USERS = {'manager': 'manager', 'viewer': 'viewer'}

#: the title of the task that the scenario of the viewer opens; no scenario creates a task
#: with this title, so that the scenarios do not depend on their order
TASK = 'Review the plan'


def create_workflow() -> None:
    """
    The roles with their permission groups and permissions, and the statuses and transits
    of the tasks (the transits are created in an order other than the sorted one); data that
    exists already is kept.
    """
    from bazis.contrib.statusy.models import Status, StatusyContentType, Transit

    group_model = apps.get_model('permit.GroupPermission')
    role_model = apps.get_model('permit.Role')
    permission_model = apps.get_model('permit.Permission')
    permissions = {
        slug: permission_model.objects.get_or_create(slug=slug)[0]
        for slug in [*dict.fromkeys(it for slugs in GROUPS.values() for it in slugs), *UNGRANTED]
    }
    groups = {}
    for slug, slugs in GROUPS.items():
        groups[slug] = group_model.objects.get_or_create(slug=slug, defaults={'name_en': slug.title()})[0]
        groups[slug].permissions.add(*(permissions[it] for it in slugs))
    for slug, name, for_anonymous, group_slugs in ROLES:
        role = role_model.objects.get_or_create(
            slug=slug, defaults={'name_en': name, 'for_anonymous': for_anonymous}
        )[0]
        role.groups_permission.add(*(groups[it] for it in group_slugs))

    statuses = {
        # the initial status may already exist: it is created with the first task
        pk: Status.objects.update_or_create(id=pk, defaults={'name_en': name})[0]
        for pk, name in STATUSES
    }
    model = StatusyContentType.objects.get_for_model(apps.get_model('tasks.Task'))
    for pk, name, src, dst, actions_before in TRANSITS:
        Transit.objects.update_or_create(
            id=pk,
            defaults={
                'name_en': name, 'model': model, 'status_src': statuses[src],
                'status_dst': statuses[dst], 'actions_before': actions_before,
            },
        )


def create_test_data(password: str) -> None:
    """
    The data of the end-to-end tests: the test user of each role, with the password (set
    again when the user exists, so that the tests log in with the current E2E_PASSWORD), and
    the task that the scenario of the viewer opens.
    """
    role_model = apps.get_model('permit.Role')
    for username, slug in TEST_USERS.items():
        user = get_user_model().objects.get_or_create(username=username)[0]
        user.set_password(password)
        role = role_model.objects.get(slug=slug)
        user.roles.add(role)
        user.role_current = role
        user.save()
    task_model = apps.get_model('tasks.Task')
    if not task_model.objects.filter(title=TASK).exists():
        task_model.objects.create(title=TASK)
