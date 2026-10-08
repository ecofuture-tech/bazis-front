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
bazis-async-request: the header that asks for the background execution of a request of the
API (its presence is enough). With Kafka, the request is answered 202
`{"data": null, "meta": {"async_request_id": <task id>}}` and its response is the result of
bazis-async-background; without Kafka (`async_request.W001`) it runs at once and is
answered as usual. `AsyncRequestMiddleware` is added in the main module of the project,
which the export does not import: the frontend takes both answers.
"""

#: the header that `AsyncRequestMiddleware` reads
HEADER = 'X-Async-Background'


def section() -> dict:
    return {'header': HEADER}
