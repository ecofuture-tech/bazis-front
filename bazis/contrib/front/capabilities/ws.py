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
bazis-ws: the path of the socket, that of a route of `WsEndpoint` (or a subclass) that the
application of `bazis.core.app` has: `ws_route` appended to the routes of the router module
(`router.routes.append(ws_route)`, `/ws`: a route appended as it is keeps its path) or to the
application of BAZIS_APP_MODULE. Null when it has none: bazis-ws is not a Django app, its
capability is the installed package, which bazis-async-background installs too, and a socket
registered only in the main module of the project (which the export does not import) is not
known to the contract. The frontend opens no socket without a path. The messages are not in
the contract: the server sends `{"type": "data", "data": <the published JSON as a string>}`,
and the frontend reads the formats of bazis-front (`@/bazis/react/ws`).
"""

from collections.abc import Iterator, Sequence

from starlette.routing import BaseRoute, WebSocketRoute


def socket_paths(routes: Sequence[BaseRoute], endpoint: type, prefix: str = '') -> Iterator[str]:
    """
    The full paths of the WebSocket routes of the endpoint (or of a subclass), with the
    prefixes of the included routers.
    """
    for route in routes:
        if isinstance(route, WebSocketRoute):
            if isinstance(route.endpoint, type) and issubclass(route.endpoint, endpoint):
                yield prefix + route.path
        elif (router := getattr(route, 'original_router', None)) is not None:
            context = getattr(route, 'include_context', None)
            yield from socket_paths(router.routes, endpoint, prefix + (getattr(context, 'prefix', '') or ''))


def section() -> dict:
    from bazis.contrib.ws.ws import WsEndpoint
    from bazis.core.app import app

    return {'path': next(socket_paths(app.routes, WsEndpoint), None)}
