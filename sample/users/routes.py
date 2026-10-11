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

from bazis.contrib.users.routes import UserRouteSet as UserRouteSetBase


class UserRouteSet(UserRouteSetBase):
    """
    The users of bazis-users, searched by their username and their names: the frontend picks
    the assignee and the watchers of a task with a search of their labels, the first and the
    last name of a user who has them (the core 2.9 answers a search of a route set without
    `search_fields` with 400; every word of a search is in one of the fields). Declared after
    the bundled route set, it is the default route of the user model.
    """

    search_fields = ['username', 'first_name', 'last_name']
