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

from bazis.contrib.ws.ws import ws_route
from bazis.core.routing import BazisRouter


router = BazisRouter(prefix='/api/v1')
# the socket of bazis-ws, `/ws` (a route appended as it is, without the prefix): routed here,
# the contract export finds its path (`bazis_front contract` does not import sample.main)
router.routes.append(ws_route)

router.register('tasks.router')
router.register('bazis.contrib.users.router')
# bazis-authing: GET /auth/ and the login by password (BAZIS_AUTH_KINDS)
router.register('/authing', 'bazis.contrib.authing.router')
router.register('/authing', 'bazis.contrib.authing.services.password.router')
# the background tasks of the user (bazis-bg) and the results of bazis-async-background
router.register('bazis.contrib.bg.router')
router.register('bazis.contrib.async_background.router')
