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
The messages of the tasks on the socket of bazis-ws, in the formats that the frontend reads
(`@/bazis/react/ws` of bazis-front). The common channel reaches every session, anonymous
ones too: it carries only `{"resource": "<type>"}` (the clients refetch the lists and the
items of the resource, with their own permissions), never an id. A message about an item,
here the notification `{"action": "notification", "title", "text", "resource", "id"}`, goes
only to a user who may see it (`user.ws_publish`, the channel of the user): the assignee.

They are published after the commit: pub/sub keeps nothing, and a client that refetched
before the commit would read the old data. The publication is robust: Redis down does not
fail a change that is committed (the error is logged), it only loses the message.
"""

import json
from functools import cache

from django.conf import settings
from django.db import transaction

from redis import Redis

from bazis.contrib.ws import COMMON_CHANNEL


@cache
def _redis() -> Redis:
    return Redis.from_url(settings.CACHES['default']['LOCATION'])


def _publish(channel: str, message: dict) -> None:
    _redis().publish(channel, json.dumps(message))


def changed(task) -> None:
    """
    Every client refetches the tasks: the resource on the common channel, without the id.
    """
    message = {'resource': task.get_resource_label()}
    transaction.on_commit(lambda: _publish(COMMON_CHANNEL, message), robust=True)


def finished(task) -> None:
    """
    The assignee of a finished task is notified on the channel of the user.
    """
    assignee = task.assignee
    if assignee is None:
        return
    message = {
        'action': 'notification',
        'title': 'Task finished',
        'text': task.title,
        'resource': task.get_resource_label(),
        'id': str(task.pk),
    }
    transaction.on_commit(lambda: _publish(assignee.user_channel, message), robust=True)
