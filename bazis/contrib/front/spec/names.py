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
The names that the generated code gives the ids of the specs: the checks refuse ids that it
would name alike (P032, S033), `bazis_front screens` names them so.
"""

import re


#: the names of a generated screen beside the constants of its entities: the import of the
#: entities and the filter of a list
SCREEN_CONSTANTS = ('ENTITIES', 'FILTER')

#: a key of the dictionaries of the frontend, as a text of the specs (`tiles.on_hand`), rather
#: than a text in words
TEXT_KEY = re.compile(r'[a-z][a-z0-9_]*(\.[a-z0-9_-]+)+')


def pascal(name: str) -> str:
    """`list-checks`: `ListChecks`; `building-2`: `Building2`."""
    return ''.join(it[:1].upper() + it[1:] for it in re.split(r'[-_]', name) if it)


def camel(name: str) -> str:
    value = pascal(name)
    return value[:1].lower() + value[1:]


def component_name(screen_id: str) -> str:
    """The component of a screen: its id in PascalCase and `Screen` (`loan-list`: `LoanListScreen`)."""
    return pascal(screen_id) + 'Screen'


def session_name(role_id: str) -> str:
    """The session of a role in an end-to-end test (its step `as`): `team-lead`, `asTeamLead`."""
    return 'as' + pascal(role_id)


def constant_name(entity_id: str) -> str:
    """The constant of an entity in a generated screen: `task-step`, `TASK_STEP`."""
    return re.sub(r'[^A-Z0-9]', '_', entity_id.upper())
