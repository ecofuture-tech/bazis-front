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
bazis-bg: the resource of the background tasks (`bg.task`), the route set of `BgRoute` (or a
subclass of it) that the application registers, null when it is not routed. A user reads
only the tasks they queued (`author`); the frontend polls an item until its `state` is
`done` (`@/bazis/react/bg`).
"""

from bazis.core.introspect import route_sets


def section() -> dict:
    from bazis.contrib.bg.routes import BgRoute
    from bazis.core.app import app

    resources = sorted(
        route_set.model.get_resource_label()
        for route_set, routes in route_sets(app).items()
        if issubclass(route_set, BgRoute)
        and any(it.get('action') == 'action_retrieve' for it in routes)
    )
    return {'resource': resources[0] if resources else None}
