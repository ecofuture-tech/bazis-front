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

from pydantic import BaseModel, Field

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


class EscalateRequest(BaseModel):
    """The priority that the task takes: high by default."""

    priority: Task.Priority = Task.Priority.HIGH


class Escalated(BaseModel):
    """The priority of the task after the action."""

    priority: Task.Priority


class SuggestRequest(BaseModel):
    """The title of the task that a guest suggests."""

    title: str = Field(min_length=1, max_length=255)


class Suggested(BaseModel):
    """The task suggested, a draft."""

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

    @http_post('/count/', response_model=CountStarted, kind=RouteKind.OTHER, public=False)
    def action_count(self, data: CountRequest, **kwargs):
        """
        A custom action of the route set (`client.action(path, 'count', body)` of the
        frontend): queues the count of the tasks by their status, a task of bazis-bg that the
        user reads at `/api/v1/bg/task/{id}/` (`TaskProgress`), its author. Any authenticated
        user (`public=False`): bazis-permit answers 403 to a request without a user, also with
        a role for anonymous users; a priority that is not one of the choices is 422 at
        `/priority`.
        """
        from .bg.count import CountTasks

        task = CountTasks.delay(priority=data.priority, author=self.inject.user)
        return CountStarted(task=str(task.pk))

    @http_post('/suggest/', response_model=Suggested, kind=RouteKind.OTHER, public=True)
    def action_suggest(self, data: SuggestRequest, **kwargs):
        """
        A custom action of the route set open to anonymous users (`public=True`, limited by the
        throttle of the core, `BAZIS_THROTTLE_PUBLIC`): a guest suggests a task, created as a
        draft for the team, the action of the public screen of the specs (`public-tasks`). A
        guest creates nothing through the create route: bazis-permit refuses it to anonymous
        users.
        """
        task = Task.objects.create(title=data.title)
        return Suggested(task=str(task.pk))

    @http_post(
        '/{item_id}/escalate/', response_model=Escalated, kind=RouteKind.OTHER,
        access_action=CrudAccessAction.CHANGE,
    )
    def action_escalate(self, item_id: str, data: EscalateRequest, **kwargs):
        """
        A custom action of an item (`client.itemAction(path, id, 'escalate', body)`, the
        action `primitive: custom` of the specs on the card, the rows and the bulk actions of
        the tasks): sets the priority of the task. It requires the change of the item
        (`access_action`): bazis-permit takes the item into `self.item`, locked, and answers
        403 for a task the user may not change (the manager changes the drafts only), and
        lists it in `custom_actions` of the item only when he may.
        """
        self.item.priority = data.priority
        self.item.save()
        return Escalated(priority=self.item.priority)


class StepRouteSet(PermitRouteBase):
    """
    The steps of the tasks: the card of a task lists those of its task (`filter=task=<id>`)
    and creates one with its task fixed.
    """

    model = apps.get_model('tasks.Step')
