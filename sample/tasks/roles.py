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
The permission groups and the roles of the sample, declared in the code (bazis-permit 2.9):
`migrate` applies them, so that every migrated database exports the same contract and
`e2e_data` only adds the test users. The specs of the sample (`sample/spec/`) reference them:
the permissions of the roles cover their `access` (`tests/test_e2e.py` checks the contract of
the migrated database against the specs). The names are English msgids, translated in
`locale/ru/LC_MESSAGES/django.po`. They replace the data migrations `0005_workflow` and
`0006_workflow_ru`, kept as history without effect.
"""

from django.utils.translation import gettext_lazy as _

from bazis.contrib.permit.declare import Group, Role


VIEW = Group('tasks_view', _('View the tasks'), ['tasks.task.item.view.all.all'])

# shares a permission with VIEW: the role has it once; the report is written by the transit
# `finish`, never in the form of a change (a field permission: read-only in `schema_update`)
CHANGE = Group('tasks_change', _('Change the tasks'), [
    'tasks.task.item.view.all.all',
    'tasks.task.item.add.all.all',
    'tasks.task.item.change.all.draft',
    'tasks.task.field.change.all.all.report.readonly',
])

TRANSIT = Group('tasks_transit', _('Start and finish the tasks'), [
    'tasks.task.item.transit.all.draft.start',
    'tasks.task.item.transit.all.in_progress.finish',
])

# a field permission: the report is left out of `schema_list`/`schema_retrieve` and of the
# documents of the items (the scenario `viewer-only-reads` expects it absent)
REPORT_HIDDEN = Group('tasks_report_hidden', _('The report of a task hidden'), [
    'tasks.task.field.view.all.all.report.disable',
])

GROUPS = [VIEW, CHANGE, TRANSIT, REPORT_HIDDEN]

# a role without groups has no permissions; the viewer is also the role of the anonymous users
ROLES = [
    Role('guest', _('Guest'), []),
    Role('viewer', _('Viewer'), [VIEW, REPORT_HIDDEN], for_anonymous=True),
    Role('manager', _('Manager'), [VIEW, CHANGE, TRANSIT]),
]
