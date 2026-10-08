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
bazis-async-background: the path of the result of a background task, with `{task_id}`
(`GET`, the token of the request that queued the task; `?full_response=true` gives its
status), null when the application does not route it
(`router.register('bazis.contrib.async_background.router')`). The statuses also come on the
socket of bazis-ws, as `{"action": "async_bg", "task_id", "status"}`.
"""

from starlette.routing import NoMatchFound


#: the name of the route of the result in bazis-async-background
RESULT_ROUTE = 'get_async_background_response'

#: the parameter of the path, kept as a placeholder
TASK_ID = '{task_id}'


def section() -> dict:
    from bazis.core.app import app

    try:
        result_path = str(app.url_path_for(RESULT_ROUTE, task_id=TASK_ID))
    except NoMatchFound:
        result_path = None
    return {'result_path': result_path}
