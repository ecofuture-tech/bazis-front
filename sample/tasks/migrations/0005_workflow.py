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
The roles (with their permission groups and permissions), statuses and transits of the
sample: data of the product, created by a data migration as a product creates them, so that
every migrated database exports the same contract and `e2e_data` only adds the test users.
The data is frozen here, as in any migration: a change is a new migration. The specs of the
sample (`sample/spec/`) reference it: the permissions of the roles cover their `access`
(`tests/test_e2e.py` checks the migrated data against the specs); the fixture `workflow` of
the tests runs `create_workflow` again after a test that flushed the tables.
"""

from django.db import migrations


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


def create_workflow(apps, schema_editor=None) -> None:
    """
    The roles with their permission groups and permissions, and the statuses and transits
    of the tasks (the transits are created in an order other than the sorted one), with the
    models of `apps`: those of the migration, or `django.apps.apps` for the fixture `workflow`
    of the tests; data that exists already is kept.
    """
    group_model = apps.get_model('permit', 'GroupPermission')
    role_model = apps.get_model('permit', 'Role')
    permission_model = apps.get_model('permit', 'Permission')
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

    status_model = apps.get_model('statusy', 'Status')
    statuses = {
        # the initial status may already exist: it is created with the first task
        pk: status_model.objects.update_or_create(id=pk, defaults={'name_en': name})[0]
        for pk, name in STATUSES
    }
    # the content type of the tasks (`StatusyContentType` is its proxy), which a migration
    # runs before the content types are created
    content_types = apps.get_model('contenttypes', 'ContentType').objects
    model = content_types.get_or_create(app_label='tasks', model='task')[0]
    for pk, name, src, dst, actions_before in TRANSITS:
        apps.get_model('statusy', 'Transit').objects.update_or_create(
            id=pk,
            defaults={
                'name_en': name, 'model_id': model.pk, 'status_src': statuses[src],
                'status_dst': statuses[dst], 'actions_before': actions_before,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('permit', '0007_name_en_blank'),
        ('statusy', '0006_transits_related_through'),
        ('tasks', '0004_attachment'),
    ]

    operations = [
        migrations.RunPython(create_workflow, migrations.RunPython.noop),
    ]
