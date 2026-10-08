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
The `capabilities` sections of the contract: what the Bazis packages of the project give
the frontend. A section is made by the module `capabilities/<name>.py`, imported only when
the package is installed and its app is in INSTALLED_APPS (bazis-ws, which is not a Django
app: when it is installed): the modules import the models of their packages. Bazis imports
this package while it configures the settings: nothing here imports a model or the
database at the module level.
"""

import re
from dataclasses import dataclass
from importlib import import_module, metadata

from django.apps import apps
from django.conf import settings
from django.core.checks import Error
from django.utils import translation


@dataclass(frozen=True)
class Capability:
    #: the distribution of the package
    distribution: str
    #: the module of the package, the name of its app
    module: str
    #: the section reads the database (roles, statuses, transits)
    needs_db: bool = False
    #: the package is a Django app, which the project installs; else it is enough that the
    #: distribution is installed (bazis-ws)
    app: bool = True
    #: the oldest version of the package whose protocol the assets follow, with what they
    #: rely on in it; None for any version
    minimum: str | None = None
    needs: str = ''


CAPABILITIES = {
    'users': Capability('bazis-users', 'bazis.contrib.users'),
    'authing': Capability(
        'bazis-authing', 'bazis.contrib.authing', minimum='2.6.0',
        needs='its logout endpoint, a store that gives its session once',
    ),
    'permit': Capability(
        'bazis-permit', 'bazis.contrib.permit', needs_db=True, minimum='2.7.0',
        needs='the selectors of the contract (many-to-many and reverse relations, 2.6) and the '
        'filter of a route restricted to the fields the user sees (2.7)',
    ),
    'statusy': Capability('bazis-statusy', 'bazis.contrib.statusy', needs_db=True),
    'uploadable': Capability(
        'bazis-uploadable', 'bazis.contrib.uploadable', minimum='2.6.0',
        needs='the files of their author for every route: no route links or includes the file of another user',
    ),
    'ws': Capability(
        'bazis-ws', 'bazis.contrib.ws', app=False, minimum='2.5.0',
        needs='`{"type": "subscribed"}`, without which the socket of the frontend is never open',
    ),
    'bg': Capability('bazis-bg', 'bazis.contrib.bg'),
    'async_background': Capability('bazis-async-background', 'bazis.contrib.async_background'),
    'async_request': Capability('bazis-async-request', 'bazis.contrib.async_request'),
}


def translated(name) -> dict[str, str]:
    """
    A name in every language of the project, `{code: name}`: `name()` read under each
    language (a translated field of the database, a lazy text).
    """
    result = {}
    for code, _name in settings.LANGUAGES:
        with translation.override(code):
            result[code] = str(name())
    return result


class DatabaseNotReadyError(Exception):
    """
    A section needs the database, and it is not available or not migrated.
    """

    def __init__(self, error: Error):
        super().__init__(error.msg)
        self.error = error


def app_enabled(module: str) -> bool:
    """
    Whether the app of a package is installed: an app config of the package or a subclass
    of it (a project app such as `users` that extends `bazis.contrib.users.apps.UsersConfig`).
    """
    return any(
        config.name == module
        or any(cls.__module__ == f'{module}.apps' for cls in type(config).__mro__)
        for config in apps.get_app_configs()
    )


def enabled() -> list[str]:
    """
    The names of the capabilities of the project, sorted.
    """
    result = []
    for name, capability in sorted(CAPABILITIES.items()):
        try:
            metadata.version(capability.distribution)
        except metadata.PackageNotFoundError:
            continue
        if not capability.app or app_enabled(capability.module):
            result.append(name)
    return result


#: the numbers of a release that `release` compares (`2.6` is `2.6.0`)
RELEASE_PARTS = 3


def release(version: str) -> tuple[int, ...]:
    """
    The release numbers of a version (`2.5.0` of `2.5.0.post1.dev3`), padded with zeros
    (`2.6` is `2.6.0`), for a comparison.
    """
    match = re.match(r'\d+(?:\.\d+)*', version)
    numbers = tuple(int(it) for it in match.group().split('.')) if match else ()
    return numbers + (0,) * (RELEASE_PARTS - len(numbers))


def outdated(names: list[str] | None = None) -> list[tuple[str, Capability, str]]:
    """
    The capabilities (of `names`, those of the project by default) whose installed package
    is older than its `minimum`: `(name, capability, the installed version)`. A package that
    is not installed is left out.
    """
    result = []
    for name in enabled() if names is None else names:
        capability = CAPABILITIES.get(name)
        if capability is None or capability.minimum is None:
            continue
        try:
            version = metadata.version(capability.distribution)
        except metadata.PackageNotFoundError:
            continue
        if release(version) < release(capability.minimum):
            result.append((name, capability, version))
    return result


def sections() -> dict:
    """
    `{name: section}` of the enabled capabilities. Raises DatabaseNotReadyError when a section
    needs the database and it is not migrated.
    """
    names = enabled()
    if any(CAPABILITIES[name].needs_db for name in names):
        if error := database_error():
            raise DatabaseNotReadyError(error)
    return {
        name: import_module(f'{__name__}.{name}').section()
        for name in names
    }


def database_error() -> Error | None:
    """
    The error `front.E002` if the database cannot be read or has unapplied migrations.
    """
    from django.db import DEFAULT_DB_ALIAS, DatabaseError, connections
    from django.db.migrations.executor import MigrationExecutor

    hint = (
        'The roles of bazis-permit and the transits of bazis-statusy are read from the '
        'database: run `manage.py migrate`, load the data of the project (roles, statuses, '
        'transits) and export again.'
    )
    try:
        executor = MigrationExecutor(connections[DEFAULT_DB_ALIAS])
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
    except DatabaseError as err:
        return Error(f'The database is not available: {err}'.strip(), hint=hint, id='front.E002')
    if plan:
        names = sorted(f'{migration.app_label}.{migration.name}' for migration, _ in plan)
        listed = ', '.join(names[:5]) + (', ...' if len(names) > 5 else '')
        return Error(
            f'The database is not migrated: {len(names)} migrations are not applied ({listed}).',
            hint=hint,
            id='front.E002',
        )
    return None
