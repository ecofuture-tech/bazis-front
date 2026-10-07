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
Django system checks of bazis-front (see `manage.py bazis_doctor`).
"""

from pathlib import Path

from django.core.checks import Info, Warning, register


@register()
def check_contract(app_configs, **kwargs):
    """
    The contract in the product root (`contract/`) and the generated files of its frontend
    (`frontend/src/bazis/generated/`, when it has the lock of `bazis_front init`) must be
    those of the backend: the comparison of `bazis_front contract --check`, without Node.
    Runs when the product has either and the application is loaded
    (`manage.py bazis_doctor`); a database that is not migrated skips it with an info.
    """
    from bazis.core.introspect import loaded_app

    from .capabilities import DatabaseNotReadyError
    from .contract import export as contract
    from .vendor import lock as frontend_lock

    hint = 'Export it with `manage.py bazis_front contract`; never edit it by hand.'
    directory, frontend = contract.default_dir(), frontend_lock.frontend_dir()
    try:
        lock = frontend_lock.read(frontend)
    except frontend_lock.LockError as err:
        message = f'The generated files of {frontend} are not checked: {err}'
        return [Warning(message, hint=hint, id='front.W001')]
    if (not directory.is_dir() and lock is None) or (app := loaded_app()) is None:
        return []
    try:
        rendered = contract.render(app)
    except DatabaseNotReadyError as err:
        return [
            Info(
                f'The contract in {directory} is not checked: {err.error.msg}',
                hint=err.error.hint,
                id='front.I001',
            )
        ]
    if problems := contract.stale(directory, rendered, frontend, lock):
        return [Warning(' '.join(problems), hint=hint, id='front.W001')]
    return []


@register()
def check_spec(app_configs, **kwargs):
    """
    The specs of the product (`spec/`, when it exists) are those that `bazis_front check`
    accepts: one `front.W002` for each of its issues, with its code and its severity.
    Errors of the specs are warnings here: the system checks run before every management
    command, and an error would block `migrate` or `bazis_front contract`, which the
    fixes of the specs may need; `bazis_front check` fails on them. Runs without the
    database.
    """
    from .spec import create, validate

    spec = create.spec_dir()
    if not spec.is_dir():
        return []
    return [
        Warning(
            f'{issue.code} ({issue.severity}) {issue.location}: {issue.message}',
            hint=issue.hint,
            id='front.W002',
        )
        for issue in validate.validate(spec.parent).issues
    ]


@register()
def check_e2e(app_configs, **kwargs):
    """
    The end-to-end tests generated in the frontend (when its lock records them: the product
    generates them with `bazis_front e2e`) are those of the specs: the comparison of
    `bazis_front e2e --check`, without Node and without the database. Specs with errors are
    not compared: `front.W002` reports their issues, and the tests are generated only from
    specs without errors.
    """
    from django.conf import settings

    from .spec import e2e, validate
    from .vendor import lock as frontend_lock

    frontend = frontend_lock.frontend_dir()
    try:
        lock = frontend_lock.read(frontend)
    except frontend_lock.LockError:
        # front.W001 reports it
        return []
    if lock is None or 'e2e' not in lock:
        return []
    root = Path(settings.BASE_DIR)
    result = validate.validate(root)
    if result.errors:
        return []
    if problems := e2e.stale(root, frontend, lock, e2e.render(result.specs)):
        return [
            Warning(
                ' '.join(problems),
                hint='Generate them with `manage.py bazis_front e2e`; never edit them, write the '
                'tests of your own in frontend/e2e/custom/.',
                id='front.W003',
            )
        ]
    return []


@register()
def check_update(app_configs, **kwargs):
    """
    The copies of the assets in the frontend (when it has the lock of `bazis_front init`)
    and of the JSON Schemas in `spec/schema/` are those of the installed bazis-front: the
    comparison of `bazis_front update --check`, without Node and without the database.
    """
    from django.conf import settings

    from .vendor import lock as frontend_lock
    from .vendor import update

    frontend = frontend_lock.frontend_dir()
    try:
        lock = frontend_lock.read(frontend)
    except frontend_lock.LockError:
        # front.W001 reports it
        return []
    if lock is None:
        return []
    if problems := update.stale(Path(settings.BASE_DIR), frontend, lock):
        return [
            Warning(
                ' '.join(problems),
                hint='Update them with `manage.py bazis_front update` (`--check` lists the '
                'changes), resolve the conflicts it reports and run the checks of the frontend.',
                id='front.W004',
            )
        ]
    return []


@register()
def check_design(app_configs, **kwargs):
    """
    The theme generated in the frontend (when its lock records it: `bazis_front init` and
    `bazis_front design` write it) is that of the design of the specs: the comparison of
    `bazis_front design --check`, without Node and without the database. A design with
    errors is not compared: `front.W002` reports its issues.
    """
    from django.conf import settings

    from .spec import theme, validate
    from .vendor import lock as frontend_lock

    frontend = frontend_lock.frontend_dir()
    try:
        lock = frontend_lock.read(frontend)
    except frontend_lock.LockError:
        # front.W001 reports it
        return []
    if lock is None or 'design' not in lock:
        return []
    root = Path(settings.BASE_DIR)
    result = validate.validate(root, ('design',))
    if any(it.layer == 'design' for it in result.errors):
        return []
    if problems := theme.stale(root, frontend, lock, theme.render(result.specs)):
        return [
            Warning(
                ' '.join(problems),
                hint='Generate it with `manage.py bazis_front design` after every change of '
                'spec/design/ and after `bazis_front update`; never edit it.',
                id='front.W005',
            )
        ]
    return []
