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

from django.apps import apps

from bazis.contrib.permit.routes_abstract import PermitRouteBase
from bazis.contrib.statusy.routes_abstract import StatusyRouteSetBase


class TaskRouteSet(StatusyRouteSetBase):
    """
    The tasks. The files are routed by bazis-uploadable itself
    (`bazis.contrib.uploadable.router`): its route set gives a user only his own files, also
    to the other routes (bazis-uploadable 2.6 with the core 2.7), so a task links as its
    attachment only a file the user uploaded (another one is 403 `ERR_RELATION_ACCESS`) and
    `include=attachment` leaves out the files of the other users.
    """

    model = apps.get_model('tasks.Task')
    # the search of the list of the tasks (the core 2.9 answers a search of a route set
    # without search fields with 400)
    search_fields = ['title']


class StepRouteSet(PermitRouteBase):
    """
    The steps of the tasks: the card of a task lists those of its task (`filter=task=<id>`)
    and creates one with its task fixed.
    """

    model = apps.get_model('tasks.Step')
