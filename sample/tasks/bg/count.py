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
A background task of bazis-bg (run by `manage.py bg_scheduler`): the tasks counted by their
status, with its progress, its result the counts. The frontend reads it as the resource
`bg.task` (`@/bazis/react/bg`, the component `task-progress`); the tests of bazis-front
read its documents from the sample.
"""

from collections import Counter

from django.apps import apps

from bazis.contrib.bg.basic.base import BgBase


class CountTasks(BgBase):
    name = 'Count the tasks'

    def handle(self) -> None:
        tasks = apps.get_model('tasks.Task').objects.order_by('pk')
        self.next_phase('Count the tasks', expected=tasks.count())
        counts = Counter()
        for task in tasks:
            counts[task.status_id] += 1
            self.progress()
        self.set_result(dict(sorted(counts.items())))
