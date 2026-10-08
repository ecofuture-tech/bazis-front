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

from dataclasses import dataclass
from importlib import import_module, metadata

from django.apps import apps
from django.core.checks import Error


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


CAPABILITIES = {
    'users': Capability('bazis-users', 'bazis.contrib.users'),
    'authing': Capability('bazis-authing', 'bazis.contrib.authing'),
    'permit': Capability('bazis-permit', 'bazis.contrib.permit', needs_db=True),
    'statusy': Capability('bazis-statusy', 'bazis.contrib.statusy', needs_db=True),
    'uploadable': Capability('bazis-uploadable', 'bazis.contrib.uploadable'),
    'ws': Capability('bazis-ws', 'bazis.contrib.ws', app=False),
    'bg': Capability('bazis-bg', 'bazis.contrib.bg'),
    'async_background': Capability('bazis-async-background', 'bazis.contrib.async_background'),
    'async_request': Capability('bazis-async-request', 'bazis.contrib.async_request'),
}


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
