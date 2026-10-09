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
The statuses and the transits of the tasks, declared in the code (bazis-statusy 2.9):
`migrate` applies them. The action is a method of `Task`. The names are English msgids,
translated in `locale/ru/LC_MESSAGES/django.po`. They replace the data migrations
`0005_workflow` and `0006_workflow_ru`, kept as history without effect.
"""

from django.utils.translation import gettext_lazy as _

from bazis.contrib.statusy.declare import Status, Transit, Workflow


DRAFT = Status('draft', _('Draft'))
IN_PROGRESS = Status('in_progress', _('In progress'))
DONE = Status('done', _('Done'))

WORKFLOWS = [
    Workflow('tasks.Task', [DRAFT, IN_PROGRESS, DONE], [
        Transit('start', _('Start'), DRAFT, IN_PROGRESS),
        # the payload of the action is the report (`FinishPayload`)
        Transit('finish', _('Finish'), IN_PROGRESS, DONE, actions_before=['before_finish']),
    ]),
]
