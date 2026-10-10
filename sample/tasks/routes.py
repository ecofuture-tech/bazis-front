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

from pydantic import BaseModel

from bazis.contrib.permit.routes_abstract import PermitRouteBase
from bazis.contrib.statusy.routes_abstract import StatusyRouteSetBase
from bazis.core.routes_abstract.initial import http_post
from bazis.core.schemas.enums import CrudAccessAction, RouteKind

from .models import Task


class CountRequest(BaseModel):
    """The tasks to count: those of a priority, all without one."""

    priority: Task.Priority | None = None


class CountStarted(BaseModel):
    """The task of bazis-bg that counts them (the resource `bg.task`)."""

    task: str


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

    @http_post(
        '/count/',
        response_model=CountStarted,
        kind=RouteKind.OTHER,
        access_action=CrudAccessAction.VIEW,
    )
    def action_count(self, data: CountRequest, **kwargs):
        """
        A custom action of the route set (`client.action(path, 'count', body)` of the
        frontend): queues the count of the tasks by their status, a task of bazis-bg that the
        user reads at `/api/v1/bg/task/{id}/` (`TaskProgress`). It requires the view of the
        tasks (`access_action`); bazis-permit answers 403 to a request without a user (an
        action that is not public); a priority that is not one of the choices is 422 at
        `/priority`.
        """
        from .bg.count import CountTasks

        task = CountTasks.delay(priority=data.priority, author=self.inject.user)
        return CountStarted(task=str(task.pk))


class StepRouteSet(PermitRouteBase):
    """
    The steps of the tasks: the card of a task lists those of its task (`filter=task=<id>`)
    and creates one with its task fixed.
    """

    model = apps.get_model('tasks.Step')
