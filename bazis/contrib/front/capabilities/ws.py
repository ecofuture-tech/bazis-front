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
bazis-ws: the path of the socket. bazis-ws is not a Django app: the capability is there
when the package is installed. The path is that of the route of `WsEndpoint` (or a subclass)
that the application registers, when `bazis.core.app` has it (a route of the router
module); bazis-ws registers `ws_route` in the main module of the project
(`app.router.routes.append(ws_route)`), which the export does not import: then it is the
path of `ws_route`, `/ws`. The messages are not in the contract: the server sends
`{"type": "data", "data": <the published JSON as a string>}`, and the frontend reads the
formats of bazis-front (`@/bazis/react/ws`).
"""

from starlette.routing import WebSocketRoute


def section() -> dict:
    from bazis.contrib.ws.ws import WsEndpoint, ws_route
    from bazis.core.app import app

    paths = [
        route.path
        for route in app.routes
        if isinstance(route, WebSocketRoute)
        and isinstance(route.endpoint, type)
        and issubclass(route.endpoint, WsEndpoint)
    ]
    return {'path': paths[0] if paths else ws_route.path}
