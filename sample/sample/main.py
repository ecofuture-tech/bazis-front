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

import os


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sample.settings')

# the application first: it sets Django up, which the modules below need (they read the
# user model)
from bazis.core.app import app


# isort: split
from bazis.contrib.async_request.middleware import AsyncRequestMiddleware
from bazis.contrib.ws.ws import ws_route


# the socket of bazis-ws (`/ws`, without the prefix of the API) and the requests of
# bazis-async-request run in the background (`X-Async-Background`; at once without Kafka)
app.router.routes.append(ws_route)
app.add_middleware(AsyncRequestMiddleware)

