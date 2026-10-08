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

from bazis.contrib.statusy.routes_abstract import StatusyRouteSetBase
from bazis.contrib.uploadable.routes import FileUploadRouteSet
from bazis.contrib.users.routes_abstract import UserRequiredRouteBase


class TaskRouteSet(StatusyRouteSetBase):
    model = apps.get_model('tasks.Task')


class FileRouteSet(FileUploadRouteSet, UserRequiredRouteBase):
    """
    The files attached to the tasks (bazis-uploadable): a user who is logged in uploads a
    file and reads one by its id. `FileUpload` has no owner, so a list, an update or a
    delete would give every user the files of the others: no update and no delete, and a
    list without files. The list exists because the core names it in the filter fields of
    the tasks (`route_filter_fields/` gives the list of the route set of a related model).
    `FileUploadRouteSet` comes first: its create reads the multipart form.
    """

    actions = ['action_create', 'action_retrieve', 'action_list']

    def get_queryset_for_list(self):
        return super().get_queryset_for_list().none()
