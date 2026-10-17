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
def check_packages(app_configs, **kwargs):
    """
    The installed packages of the capabilities of the project are not older than the
    versions whose protocol the assets of the frontend follow (`minimum` of
    `capabilities.CAPABILITIES`): with an older one a part of the frontend does not work
    (the socket of bazis-ws before 2.5.0 is never open). A warning here, so that it never
    blocks `migrate` or `runserver` (the system checks run before every management
    command); `bazis_front check` fails on it (`C004`), which gates the generation and CI.
    It is the only report of the system checks: `front.W002` leaves out `C004`.
    Runs without the database.
    """
    from .capabilities import outdated

    return [
        Warning(
            f'{capability.distribution} {version} is installed; the frontend of bazis-front '
            f'needs {capability.distribution}>={capability.minimum}: {capability.needs}.',
            hint=f"Upgrade it: `pip install -U '{capability.distribution}>={capability.minimum}'`.",
            id='front.W006',
        )
        for _name, capability, version in outdated()
    ]


#: the issues of the specs that another system check reports: an outdated package (front.W006)
PACKAGE_CODES = {'C004'}


@register()
def check_spec(app_configs, **kwargs):
    """
    The specs of the product (`spec/`, when it exists) are those that `bazis_front check`
    accepts: one `front.W002` for each of its issues, with its code and its severity.
    Errors of the specs are warnings here: the system checks run before every management
    command, and an error would block `migrate` or `bazis_front contract`, which the
    fixes of the specs may need; `bazis_front check` fails on them. `C004` (an outdated
    package) is left out: `front.W006` reports it. Runs without the database.
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
        if issue.code not in PACKAGE_CODES
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
    lock = frontend_lock.read_valid(frontend)
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
    lock = frontend_lock.read_valid(frontend)
    if lock is None:
        return []
    if problems := update.stale(Path(settings.BASE_DIR), frontend, lock):
        return [
            Warning(
                ' '.join(problems),
                hint='Update them with `manage.py bazis_front update` (`--check` lists the '
                'changes), resolve the conflicts it reports and run the checks of the frontend. '
                'A line that only looks like a conflict marker: remove the path of its file from '
                '`conflicts` of frontend/bazis-front.lock.json.',
                id='front.W004',
            )
        ]
    return []


@register()
def check_changed_copies(app_configs, **kwargs):
    """
    The copies of the vendored assets and of the components in the frontend are those its
    lock records: a copy changed in the frontend is merged with every new version by
    `bazis_front update`, and a change of the same lines by both is a conflict. Reported
    before the update, without Node and the database (the template is the product's).
    """
    from .vendor import lock as frontend_lock
    from .vendor import update

    frontend = frontend_lock.frontend_dir()
    lock = frontend_lock.read_valid(frontend)
    if lock is None:
        return []
    if copies := update.changed(frontend, lock):
        files = '; '.join(f'{name}: {", ".join(paths)}' for name, paths in copies.items())
        return [
            Warning(
                f'Copies of bazis-front were changed in the frontend (they differ from '
                f'{frontend_lock.LOCK_FILE}): {files}.',
                hint='The client, the hooks, the i18n and the helpers are never edited: wrap them '
                'in the code of the product. A component is the product\'s, but `bazis_front '
                'update` merges its changes with every new version (a change of the same lines '
                'by both is a conflict): prefer its props, or a component of the product that '
                'composes it, and propose the change to bazis-front.',
                id='front.W007',
            )
        ]
    return []


@register()
def check_design(app_configs, **kwargs):
    """
    The theme generated in the frontend (when its lock records it: `bazis_front init` and
    `bazis_front design` write it) is that of the design of the specs: the comparison of
    `bazis_front design --check`, without Node and without the database. A design with
    errors is not compared: `front.W002` reports its issues. A frontend with components and no
    theme in its lock (made by an `init` whose design had errors) is reported too: its
    components import the theme.
    """
    from django.conf import settings

    from .spec import theme, validate
    from .vendor import lock as frontend_lock
    from .vendor import registry

    frontend = frontend_lock.frontend_dir()
    lock = frontend_lock.read_valid(frontend)
    if lock is None:
        return []
    if 'design' not in lock:
        assets = registry.load()
        if not any(name in assets and assets[name].kind == registry.UI for name in lock.get('assets', {})):
            return []
        # components that read the theme, and no theme: an `init` whose design had errors
        return [
            Warning(
                f'The frontend {frontend} has no theme ({theme.THEME_CSS}, {theme.THEME_TS}): its '
                'components need it.',
                hint='Generate it with `manage.py bazis_front design`.',
                id='front.W005',
            )
        ]
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


@register()
def check_shots(app_configs, **kwargs):
    """
    The screenshots of the frontend (when its lock records them: the product takes them with
    `bazis_front shots`): `shots.ts` is that of the specs (the comparison of `shots --check`,
    without Node and without the database; specs with errors are not compared, `front.W002`
    reports them: `front.W008`), and the report of the last screenshots has no error
    (`front.W009`: not stale, what the screens render, which no command brings up to date; also
    when there is no report that can be read: the screenshots were not taken).
    """
    from django.conf import settings

    from .spec import shots, validate
    from .vendor import lock as frontend_lock

    frontend = frontend_lock.frontend_dir()
    lock = frontend_lock.read_valid(frontend)
    if lock is None or 'shots' not in lock:
        return []
    root = Path(settings.BASE_DIR)
    result = validate.validate(root)
    if result.errors:
        return []
    issues = []
    if problems := shots.stale(root, frontend, lock, shots.render(result.specs)):
        issues.append(
            Warning(
                ' '.join(problems),
                hint='Take them again with `manage.py bazis_front shots`; never edit shots.ts.',
                id='front.W008',
            )
        )
    report = shots.read_report(frontend)
    if report is None:
        issues.append(
            Warning(
                'The screenshots were not taken: run `manage.py bazis_front shots`.',
                hint='Run it with the backend and the frontend of the end-to-end tests and look at the '
                'screenshots (AGENTS.md, "The visual check").',
                id='front.W009',
            )
        )
    elif report.get('errors'):
        issues.append(
            Warning(
                f'The report of the last screenshots, {frontend / shots.OUTPUT_DIR / shots.REPORT}, has '
                f'{report["errors"]} errors.',
                hint='Fix them in the specs, the screens or the backend and take the screenshots '
                'again with `manage.py bazis_front shots` (AGENTS.md, "The visual check").',
                id='front.W009',
            )
        )
    return issues


#: the subcommand of `bazis_front` that brings up to date what a check reports stale (its
#: `--check` makes the same comparison): `command` of the issues of `bazis_front status`
COMMANDS = {
    'front.W001': 'contract',
    'front.W003': 'e2e',
    'front.W004': 'update',
    'front.W005': 'design',
    'front.W008': 'shots',
}

#: the checks of the state of the frontend, in the order of `bazis_front status`
STATUS = (
    check_packages,
    check_contract,
    check_spec,
    check_update,
    check_changed_copies,
    check_design,
    check_e2e,
    check_shots,
)
