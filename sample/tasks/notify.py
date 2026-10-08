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
The messages of the tasks on the socket of bazis-ws, in the format that the frontend reads
(`@/bazis/react/ws` of bazis-front): `{"resource", "id"}` makes the clients refetch the
item and the lists of the resource; `{"action": "notification", "title", "text",
"resource", "id"}` is a notification of the user. They are published after the commit:
pub/sub keeps nothing, and a client that refetched before the commit would read the old
data.
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
    Every client refetches the task: its id on the common channel, without its data, which
    each client reads with its own permissions.
    """
    message = {'resource': task.get_resource_label(), 'id': str(task.pk)}
    transaction.on_commit(lambda: _publish(COMMON_CHANNEL, message))


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
    transaction.on_commit(lambda: _publish(assignee.user_channel, message))
