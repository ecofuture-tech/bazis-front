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

import logging
import shutil
import subprocess
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from bazis.contrib.front import __version__, capabilities, checks
from bazis.contrib.front.capabilities import DatabaseNotReadyError
from bazis.contrib.front.contract import export as contract
from bazis.contrib.front.contract import generated
from bazis.contrib.front.contract.openapi import dumps
from bazis.contrib.front.spec import create as spec_create
from bazis.contrib.front.spec import e2e
from bazis.contrib.front.spec import screens as spec_screens
from bazis.contrib.front.spec import shots as spec_shots
from bazis.contrib.front.spec import theme as design_theme
from bazis.contrib.front.spec import validate as spec_validate
from bazis.contrib.front.spec.issues import Issues
from bazis.contrib.front.vendor import copy, update
from bazis.contrib.front.vendor import lock as frontend_lock
from bazis.contrib.front.vendor.npm import kept_message
from bazis.contrib.front.vendor.registry import load as load_registry


def contract_capabilities() -> set[str]:
    """
    The capabilities of contract/contract.json, for the components of the packages.
    """
    issues = Issues()
    contract_data = spec_validate.load_contract(Path(settings.BASE_DIR), issues)
    if issues.items:
        raise copy.CopyError([it.message for it in issues.items])
    if contract_data is None:
        raise copy.CopyError([
            f'{spec_validate.CONTRACT_FILE} is missing: the components of a package need its '
            'capability in the contract. Export it with `manage.py bazis_front contract`.'
        ])
    return set(contract_data.get('capabilities', {}))


def require_lock(frontend: Path) -> dict:
    """
    The lock of the frontend made by `init`; fails when it has none or it cannot be read.
    """
    try:
        lock = frontend_lock.read(frontend)
    except frontend_lock.LockError as err:
        raise CommandError(str(err)) from err
    if lock is None:
        raise CommandError(
            f'{frontend} has no {frontend_lock.LOCK_FILE}: create the frontend with '
            '`manage.py bazis_front init`.'
        )
    return lock


#: the generated files of a frontend, by the key of their hashes in the lock: the TypeScript
#: of the contract (`contract`), the theme (`design`), the screens (`screens`), the
#: end-to-end tests (`e2e`), the screenshots (`shots`)
GENERATED = {'contract': 'generated', 'design': 'design', 'screens': 'screens', 'e2e': 'e2e', 'shots': 'shots'}


class Command(BaseCommand):
    help = 'The frontend layer of a Bazis product.'
    # every subcommand reports the state it checks itself (`status` all of it), and the
    # warnings of the system checks of other packages would mix with its output (the JSON of
    # `check --json` and `status --json`): `manage.py check` and `bazis_doctor` run them
    requires_system_checks = []

    def add_arguments(self, parser):
        # every option of a subcommand by its full name: `--forc` is no `--force`
        subcommands = parser.add_subparsers(dest='subcommand', metavar='subcommand', required=True)

        init = subcommands.add_parser(
            'init',
            allow_abbrev=False,
            help='Create the frontend of the product: frontend/ in BASE_DIR.',
            description=(
                'Create frontend/ from the template of bazis-front (React, TypeScript, Vite), '
                'with copies of the protocol client in src/bazis/client/ and of the React hooks '
                'in src/bazis/react/ (with those of the installed packages, such as '
                'bazis-statusy), their pristine copies in .bazis/base/ and the lock '
                'bazis-front.lock.json, its theme (`design`) in src/bazis/generated/ and its '
                'screens (`screens`) in src/screens/generated/, then run `npm install` in it. '
                'Also create spec/ (the JSON Schemas of the specs in spec/schema/, starters of '
                'product.yaml and of the design of the preset) when the product has none. An '
                'existing frontend/ or spec/ is never overwritten.'
            ),
        )
        init.add_argument('--no-node', action='store_true', help='Do not run `npm install`.')
        init.add_argument(
            '--preset',
            choices=spec_create.PRESETS,
            default=spec_create.PRESETS[0],
            help='The preset of the starters of spec/design/ (default: %(default)s).',
        )

        export = subcommands.add_parser(
            'contract',
            allow_abbrev=False,
            help='Export the contract and generate the TypeScript of the frontend.',
            description=(
                'Export the OpenAPI of the backend and contract.json (the resources and the '
                'sections of the installed packages: users, permit roles, statusy transits) '
                'to contract/. When the product has a frontend made by `init`, also generate '
                'frontend/src/bazis/generated/contract.ts and, with Node, schema.d.ts, and '
                'update the lock of the frontend. The permit and statusy sections are read '
                'from the database, which must be migrated. The contract and the generated '
                'files are never edited.'
            ),
        )
        export.add_argument(
            '--check',
            action='store_true',
            help='Write nothing; exit with 1 if the contract or the generated files are stale.',
        )
        export.add_argument(
            '--out',
            type=Path,
            help='The directory of the contract (default: contract/ in BASE_DIR).',
        )
        export.add_argument(
            '--no-node',
            action='store_true',
            help='Do not run openapi-typescript: schema.d.ts is not generated.',
        )

        add = subcommands.add_parser(
            'add',
            allow_abbrev=False,
            help='Copy components (and the assets they require) into the frontend.',
            description=(
                'Copy the components of bazis-front into frontend/src/bazis/ui/<name>/ (the '
                'shadcn/ui components they use into src/components/ui/), with the assets they '
                'require, their contract tests, their pristine copies in .bazis/base/ and their '
                'hashes in the lock. A component of a package (such as transit-bar of '
                'bazis-statusy) needs its capability in contract/contract.json. The product '
                'owns the copies: an asset already there is kept, a component named again '
                'that was changed there is refused, and so is an asset of another version '
                '(`update` brings them to this one).'
            ),
        )
        add.add_argument('assets', nargs='+', metavar='asset', help='The components to add.')

        update_parser = subcommands.add_parser(
            'update',
            allow_abbrev=False,
            help='Update the copied assets to the installed bazis-front, merging the changes.',
            description=(
                'Bring the copies of the assets in frontend/ (the template: package.json, the '
                'configs, src/app/, AGENTS.md; the client, the hooks, the components, the '
                'helpers of the end-to-end tests) to the installed version of bazis-front: a '
                'file unchanged in the frontend is replaced, a file changed only there is kept, '
                'a file changed in both is merged with its pristine copy in .bazis/base/ '
                '(conflicts are written with markers and fail the command); files added to an '
                'asset are added, files removed from it are deleted unless changed (never a file '
                'of the template), files deleted in the frontend stay deleted. Until the conflict '
                'markers of the last update are resolved, --check reports them and an update is '
                'refused. The assets that a new version requires '
                'are copied, the pristine copies and the lock are updated, and so are the JSON '
                'Schemas in spec/schema/. Nothing is written when an asset cannot be updated.'
            ),
        )
        update_parser.add_argument(
            'assets', nargs='*', metavar='asset',
            help='The assets to update, with those they require (default: every copied asset).',
        )
        update_parser.add_argument(
            '--check',
            action='store_true',
            help='Write nothing; list the changes and exit with 1 if a copy is not up to date.',
        )

        check = subcommands.add_parser(
            'check',
            allow_abbrev=False,
            help='Validate the specs (spec/) against each other and the contract.',
            description=(
                'Validate spec/product.yaml, spec/screens/*.yaml and spec/design/ against their '
                'JSON Schemas, against each other and against contract/contract.json (without '
                'it, only their shape and their references to each other). Exit with 1 if '
                'there are errors; warnings do not fail.'
            ),
        )
        check.add_argument('--json', action='store_true', help='Print the result as JSON.')
        check.add_argument(
            '--layer',
            choices=spec_validate.LAYERS,
            help='Report the issues of one layer only (all the layers are read).',
        )

        screens_parser = subcommands.add_parser(
            'screens',
            allow_abbrev=False,
            help='Generate the screens of the frontend from the specs.',
            description=(
                'Generate frontend/src/screens/generated/ from spec/: a component per screen of '
                'spec/screens/ that is not `custom` (<id>.tsx), the routes of every screen '
                '(routes.tsx), the navigation of spec/product.yaml (navigation.ts), the texts of '
                'the specs in the languages of the product (messages.ts), the name of the product '
                '(product.ts), the entities (entities.ts), the routes by screen (screens.ts), and '
                'the providers and the tools of the layout that the packages and the fields need '
                '(providers.tsx, tools.tsx). The components that they import are copied into the '
                'frontend when it lacks them. The files of a screen that is no longer generated are '
                'deleted; the lock records the hashes of the specs and of the files. The specs must '
                'have no errors (`bazis_front check`). The generated files are never edited: a file '
                'edited since it was generated is not overwritten without `--force`.'
            ),
        )
        screens_parser.add_argument(
            '--check',
            action='store_true',
            help='Write nothing; exit with 1 if the generated screens differ from the specs.',
        )
        screens_parser.add_argument(
            '--force', action='store_true', help='Overwrite the generated files edited since they were generated.'
        )

        e2e_parser = subcommands.add_parser(
            'e2e',
            allow_abbrev=False,
            help='Generate the end-to-end tests of the scenarios of the specs.',
            description=(
                'Generate a Playwright test per scenario of spec/product.yaml in '
                'frontend/e2e/generated/<scenario>.spec.ts, and e2e/generated/product.ts (the '
                'test users of the roles and the routes of the screens), run by `npm run e2e` '
                'of the frontend with the helpers of e2e/bazis/. The tests of a removed '
                'scenario are deleted; the lock records the hashes of the specs and of the '
                'tests. The specs must have no errors (`bazis_front check`). The generated '
                'tests are never edited: tests of your own go to frontend/e2e/custom/.'
            ),
        )
        e2e_parser.add_argument(
            '--check',
            action='store_true',
            help='Write nothing; exit with 1 if the generated tests differ from the specs.',
        )

        design_parser = subcommands.add_parser(
            'design',
            allow_abbrev=False,
            help='Generate the theme of the frontend from spec/design/.',
            description=(
                'Compile spec/design/theme.yaml (with the starters of the tokens it names: the '
                'palette, the fonts, the shape, the surface) and spec/design/tokens.json into '
                'frontend/src/bazis/generated/fonts.css (the imports of the fonts), theme.css '
                '(the tokens as CSS variables of the light and the dark mode, the spacing of the '
                'density, the Tailwind theme and the base styles of the preset) and theme.ts '
                '(THEME: the navigation, the density, the composition, the tones of the statuses, '
                'the icons, read by the components); the lock records the hashes of the design '
                'and of the files. Without spec/design/, the '
                'theme of the starter of the preset workspace. The design must have no errors '
                '(`bazis_front check --layer design`). `init` runs it; the generated files are '
                'never edited.'
            ),
        )
        design_parser.add_argument(
            '--check',
            action='store_true',
            help='Write nothing; exit with 1 if the theme differs from the design.',
        )

        shots_parser = subcommands.add_parser(
            'shots',
            allow_abbrev=False,
            help='Take the screenshots of the screens and check what they render.',
            description=(
                'Generate frontend/e2e/generated/shots.ts from the specs (every screen as '
                'each of its roles: as the first one in each color mode of the theme, as the others in '
                'the first mode only; the screen of an item through '
                'the first item of a screen that opens it), then run it with Playwright '
                '(playwright.shots.config.ts: the widths of a desktop and a phone, against the '
                'frontend and the backend of the end-to-end tests, E2E_PASSWORD set) and gather the '
                'checks of what each screen renders into frontend/.scratch/shots/report.json, next to '
                'the screenshots: the codes V0xx of AGENTS.md. Exit with 1 if the report has errors, '
                'with 2 if no screen could be shot (no Node, no browser, no frontend or backend '
                'running). The specs must have no errors (`bazis_front check`).'
            ),
        )
        shots_parser.add_argument(
            '--check',
            action='store_true',
            help='Write nothing and take no screenshot; exit with 1 if shots.ts differs from the specs.',
        )
        shots_parser.add_argument(
            '--no-run', action='store_true', help='Generate shots.ts only: take no screenshot.'
        )

        status = subcommands.add_parser(
            'status',
            allow_abbrev=False,
            help='Show the state of the frontend: its copies and what is generated or stale.',
            description=(
                'Show the installed bazis-front, the assets copied into frontend/ with their '
                'versions (its lock), which generated files it has (the TypeScript of the '
                'contract, the theme, the screens, the end-to-end tests), and every issue of the '
                'checks of bazis-front: an outdated package (front.W006), a stale contract or '
                'generated file (front.W001; the database must be migrated), the issues of the '
                'specs (front.W002), stale or changed copies (front.W004, front.W007), a stale '
                'theme (front.W005), stale generated screens (front.W010), stale end-to-end tests '
                '(front.W003), a stale test of the screenshots (front.W008), a report of the '
                'screenshots with errors or none, the screenshots not taken (front.W009). '
                'Writes nothing and exits '
                'with 0: the `--check` of each subcommand fails on its own state.'
            ),
        )
        status.add_argument('--json', action='store_true', help='Print the state as JSON.')

    def handle(self, *args, subcommand, **options):
        return getattr(self, f'handle_{subcommand}')(**options)

    def handle_init(self, no_node=False, preset=spec_create.PRESETS[0], **options):
        frontend = frontend_lock.frontend_dir()
        if frontend.exists():
            raise CommandError(
                f'{frontend} already exists: `bazis_front init` creates a new frontend and '
                'never overwrites one.'
            )
        spec = spec_create.spec_dir()
        if spec.exists():
            self.stdout.write(f'{spec} exists: it is kept as it is.')
        else:
            spec_create.create_spec(spec, preset)
            self.stdout.write(
                f'Created the specs in {spec}: write the product and its screens there and '
                'check them with `manage.py bazis_front check`.'
            )
        copy.create_frontend(frontend, capabilities.enabled())
        self.stdout.write(f'Created the frontend in {frontend} (bazis-front {__version__}).')
        try:
            self.generate_theme(frontend, frontend_lock.read(frontend))
        except CommandError as err:
            self.stderr.write(f'{err} Then generate the theme with `manage.py bazis_front design`.')
        try:
            # the contract is not exported yet: the components of the packages of the project
            self.generate_screens(
                frontend, frontend_lock.read(frontend), self.render_screens(), lambda: set(capabilities.enabled())
            )
        except CommandError as err:
            self.stderr.write(f'{err} Then generate the screens with `manage.py bazis_front screens`.')
        self.stdout.flush()
        if no_node:
            self.stdout.write(f'Run `npm install` in {frontend}.')
        elif (npm := shutil.which('npm')) is None:
            self.stderr.write(
                f'Node (npm) is not found: install it and run `npm install` in {frontend}.'
            )
        elif subprocess.run([npm, 'install'], cwd=frontend, check=False).returncode:
            raise CommandError(f'`npm install` failed in {frontend}; run it again there.')
        self.stdout.write(
            'Generate its contract with `manage.py bazis_front contract` (from a migrated '
            'database), then build it with `npm run build` in frontend/.'
        )

    def handle_add(self, assets, **options):
        frontend = frontend_lock.frontend_dir()
        lock = require_lock(frontend)
        try:
            added = copy.add_assets(frontend, lock, assets, contract_capabilities)
        except copy.CopyError as err:
            raise CommandError('\n'.join(err.messages)) from err
        registry = load_registry()
        for name in added.copied:
            self.stdout.write(f'Added {name} to {registry[name].target}/.')
        for name in added.present:
            if name in assets:
                self.stdout.write(f'{name} is already in the frontend.')
        if added.dependencies:
            packages = ', '.join(sorted(name for it in added.dependencies.values() for name in it))
            self.stdout.write(
                f'Set their npm dependencies ({packages}) in package.json: run `npm install` in '
                'frontend/.'
            )
        if added.kept:
            self.stdout.write(kept_message(added.kept, added.dependencies))
        if added.copied:
            self.stdout.write(
                'Run their contract tests with `npm test` in frontend/; the product owns the '
                'copies and keeps the tests passing when it changes them.'
            )

    def handle_update(self, assets, check=False, **options):
        frontend = frontend_lock.frontend_dir()
        lock = require_lock(frontend)
        root = Path(settings.BASE_DIR)
        try:
            plan = update.plan(root, frontend, lock, assets, contract_capabilities)
        except copy.CopyError as err:
            raise CommandError('\n'.join(err.messages)) from err

        self.write_plan(plan)
        if not plan:
            self.stdout.write(f'The copies in {frontend} are those of bazis-front {plan.version}.')
            return
        if check:
            raise CommandError(
                f'The copies are not those of bazis-front {plan.version}: update them with '
                '`manage.py bazis_front update`.'
            )
        update.apply(root, frontend, lock, plan)
        if spec_validate.contract_outdated(root):
            self.stdout.write(spec_validate.CONTRACT_OUTDATED)
        needs_screens = spec_validate.needs_screens(frontend, lock)
        if needs_screens:
            self.stdout.write(spec_screens.NEEDS_SCREENS)
        install = 'Run `npm install` (its package.json changed). ' if plan.dependencies_changed else ''
        # `tsc` and the tests import the screens that `screens` writes: red until then
        verify = (
            '`npx tsc --noEmit` and `npm test` stay red until `bazis_front screens` generates the '
            'screens (the reference of the package, "Migrating the code of the product", step 8).'
            if needs_screens
            else 'Run `npx tsc --noEmit`, `npm run lint` and `npm test` in frontend/.'
        )
        if plan.conflicts:
            self.write_conflicts(plan)
            raise CommandError(
                f'Updated to bazis-front {plan.version} with conflicts in {len(plan.conflicts)} '
                f'files: {", ".join(plan.conflicts)}. Resolve the conflict markers (<<<<<<< '
                f'{update.LOCAL_NAME}, =======, >>>>>>> bazis-front {plan.version}) in them, or '
                'take the file of bazis-front listed for one and apply the changes of the product '
                'to it again: the lines changed away from the conflicts are merged without markers, '
                'so a change of the product that the new version now makes itself (a declaration of '
                'a name that it imports) stays beside it and fails `tsc` (TS2440). '
                f'{install}{verify}'
            )
        self.stdout.write(
            f'Updated the copies to bazis-front {plan.version}. {install}{verify} Commit the '
            f'frontend with {frontend_lock.BASE_DIR}/ and the lock.'
        )

    def write_conflicts(self, plan):
        """The files of bazis-front of the conflicts, their pristine copies written by `apply`."""
        for asset in plan.assets:
            for it in asset.files:
                if it.status != update.CONFLICT:
                    continue
                whole = update.upstream_copy(asset.asset, it.path, plan.version)
                self.stdout.write(
                    f'{it.path}: the file of bazis-front: {whole}' if whole is not None else
                    f'{it.path}: resolve its markers, keeping the npm dependencies on the side of '
                    'bazis-front (those of the assets, which no file of bazis-front has), then run '
                    '`npm install`.'
                )

    def write_plan(self, plan):
        for asset in plan.assets:
            if asset.old is None:
                self.stdout.write(f'{asset.name}: copied ({plan.version}), required by a new version.')
                continue
            if asset.asset is None:
                self.stdout.write(f'{asset.name} {asset.old}: no longer in bazis-front {plan.version}.')
            else:
                replaced = sum(it.status == update.REPLACED for it in asset.files)
                self.stdout.write(
                    f'{asset.name}: {asset.old} -> {plan.version}'
                    + (f' ({replaced} files unchanged in the frontend replaced)' if replaced else '')
                )
            for it in asset.files:
                if it.status != update.REPLACED:
                    self.stdout.write(f'  {it.path}: {update.DESCRIPTIONS[it.status]}')
                if it.status == update.ORPHANED and it.path in update.REPLACED_BY:
                    self.stdout.write(f'    {update.REPLACED_BY[it.path]}')
        if plan.package is not None:
            self.stdout.write(f'{plan.package.path}: {update.DESCRIPTIONS[plan.package.status]}')
        if plan.kept:
            self.stdout.write(kept_message(plan.kept, plan.dependencies))
        for path in plan.schemas:
            self.stdout.write(f'{path}: replaced by the copy of bazis-front {plan.version}.')

    def handle_contract(self, check=False, out=None, no_node=False, **options):
        from bazis.core.app import app

        directory = Path(out) if out else contract.default_dir()
        try:
            rendered = contract.render(app)
        except DatabaseNotReadyError as err:
            raise CommandError(f'{err.error.msg} ({err.error.id})\n{err.error.hint}') from err

        frontend = frontend_lock.frontend_dir()
        try:
            lock = frontend_lock.read(frontend)
        except frontend_lock.LockError as err:
            raise CommandError(str(err)) from err
        if lock is None and frontend.is_dir():
            self.stderr.write(
                f'{frontend} has no {frontend_lock.LOCK_FILE}: it is not a frontend made by '
                '`bazis_front init`, its TypeScript is not generated.'
            )

        if check:
            if problems := contract.stale(directory, rendered, frontend, lock):
                raise CommandError(
                    '\n'.join(problems)
                    + '\nExport the contract with `manage.py bazis_front contract`.'
                )
            if lock is None:
                self.stdout.write(f'The contract in {directory} is up to date.')
            else:
                self.stdout.write(
                    f'The contract in {directory} and the generated files of {frontend} are '
                    'up to date.'
                )
            return

        contract.write(directory, rendered)
        self.stdout.write(f'Exported the contract to {directory}: {", ".join(rendered)}.')
        if lock is None:
            return
        try:
            missing = generated.write(frontend, lock, directory, rendered, node=not no_node)
        except generated.SchemaError as err:
            raise CommandError(f'{generated.SCHEMA_TS} is not generated: {err}') from err
        self.stdout.write(f'Generated {generated.GENERATED_DIR} of {frontend}.')
        if missing:
            self.stderr.write(
                f'{generated.SCHEMA_TS} is not generated: {missing}. It is `missing` in the '
                'lock and `bazis_front contract --check` fails until it is generated.'
            )

    def handle_check(self, layer=None, **options):
        spec = spec_create.spec_dir()
        if not spec.is_dir():
            raise CommandError(
                f'{spec} does not exist: `manage.py bazis_front init` creates it with the '
                'frontend.'
            )
        result = spec_validate.validate(spec.parent, (layer,) if layer else spec_validate.LAYERS)
        if options['json']:
            self.stdout.write(dumps(result.as_dict()), ending='')
        else:
            self.write_issues(result)
        if result.errors:
            raise CommandError(f'The specs have {len(result.errors)} errors.')

    def handle_screens(self, check=False, force=False, **options):
        frontend = frontend_lock.frontend_dir()
        lock = require_lock(frontend)
        rendered = self.render_screens()
        if check:
            if problems := spec_screens.stale(Path(settings.BASE_DIR), frontend, lock, rendered):
                raise CommandError(
                    '\n'.join(problems) + '\nGenerate them with `manage.py bazis_front screens`; never edit them.'
                )
            self.stdout.write(f'The generated screens of {frontend} are up to date.')
            return
        self.generate_screens(frontend, lock, rendered, contract_capabilities, force)

    def render_screens(self) -> dict[str, str]:
        """
        The generated screens of the specs; fails with the issues of specs with errors.
        """
        result = spec_validate.validate(Path(settings.BASE_DIR), generating=True)
        if result.errors:
            self.write_issues(result)
            raise CommandError(
                f'The specs have {len(result.errors)} errors: the screens are generated from specs '
                'that `bazis_front check` accepts.'
            )
        return spec_screens.render(result.specs)

    def generate_screens(self, frontend: Path, lock: dict, rendered: dict[str, str], capabilities_of, force=False):
        """
        Writes the generated screens, with the components that they import copied first; a
        generated file edited since is overwritten with `force` only.
        """
        if not force and (edited := spec_screens.edited_files(frontend, lock, rendered)):
            raise CommandError(
                f'Edited after they were generated: {", ".join(edited)}. `bazis_front screens` does '
                'not overwrite them: say it in the specs, in an extension (`extend`) or in a custom '
                'screen (`custom`), then run it again, or with `--force` to drop the edits.'
            )
        if missing := spec_screens.missing_assets(lock, rendered):
            try:
                added = copy.add_assets(frontend, lock, missing, capabilities_of)
            except copy.CopyError as err:
                raise CommandError('\n'.join(err.messages)) from err
            self.stdout.write(
                f'Added the components of bazis-front that the generated screens import: {", ".join(added.copied)}.'
            )
            if added.dependencies:
                packages = ', '.join(sorted(name for it in added.dependencies.values() for name in it))
                self.stdout.write(
                    f'Set their npm dependencies ({packages}) in package.json: run `npm install` in frontend/.'
                )
            if added.kept:
                self.stdout.write(kept_message(added.kept, added.dependencies))
        for path in spec_screens.write(Path(settings.BASE_DIR), frontend, lock, rendered):
            self.stdout.write(f'Deleted {path}: its screen is no longer generated.')
        self.stdout.write(f'Generated the screens of {frontend} in {spec_screens.GENERATED_DIR}.')

    def handle_e2e(self, check=False, **options):
        frontend = frontend_lock.frontend_dir()
        lock = require_lock(frontend)
        root = Path(settings.BASE_DIR)
        result = spec_validate.validate(root)
        if result.errors:
            self.write_issues(result)
            raise CommandError(
                f'The specs have {len(result.errors)} errors: the end-to-end tests are generated '
                'from specs that `bazis_front check` accepts.'
            )
        rendered = e2e.render(result.specs, 'screens' in lock)
        if check:
            if problems := e2e.stale(root, frontend, lock, rendered):
                raise CommandError(
                    '\n'.join(problems)
                    + '\nGenerate them with `manage.py bazis_front e2e`; never edit them.'
                )
            self.stdout.write(f'The end-to-end tests of {frontend} are up to date.')
            return
        removed = e2e.write(root, frontend, lock, rendered)
        for path in removed:
            self.stdout.write(f'Deleted {path}: its scenario no longer exists.')
        self.stdout.write(
            f'Generated {len(rendered) - 1} end-to-end tests in {frontend / e2e.GENERATED_DIR}. '
            'Run them with `npm run e2e` in frontend/ against the running backend, migrated '
            'and with the data of `manage.py e2e_data`, and E2E_PASSWORD set.'
        )

    def handle_shots(self, check=False, no_run=False, **options):
        frontend = frontend_lock.frontend_dir()
        lock = require_lock(frontend)
        root = Path(settings.BASE_DIR)
        result = spec_validate.validate(root)
        if result.errors:
            self.write_issues(result)
            raise CommandError(
                f'The specs have {len(result.errors)} errors: the screenshots are taken of specs '
                'that `bazis_front check` accepts.'
            )
        rendered = spec_shots.render(result.specs)
        if check:
            if problems := spec_shots.stale(root, frontend, lock, rendered):
                raise CommandError(
                    '\n'.join(problems) + '\nGenerate it with `manage.py bazis_front shots`; never edit it.'
                )
            self.stdout.write(f'The screenshots of {frontend} are up to date.')
            return
        spec_shots.write(root, frontend, lock, rendered)
        self.stdout.write(f'Generated {frontend / spec_shots.SHOTS_TS}.')
        if no_run:
            return
        self.stdout.flush()
        try:
            spec_shots.run(frontend)
        except spec_shots.NodeMissingError as err:
            raise CommandError(
                f'{err}: install Node 22, run `npm install` and `npx playwright install chromium` in '
                f'{frontend}, then `manage.py bazis_front shots` again.',
                returncode=2,
            ) from err
        report = spec_shots.collect(frontend, result.specs)
        path = frontend / spec_shots.OUTPUT_DIR / spec_shots.REPORT
        for shot in report['shots']:
            for issue in shot['issues']:
                if issue['severity'] == 'error':
                    self.stdout.write(
                        f'{shot["screen"]} {shot["role"]} {shot["mode"]} {shot["width"]}: {issue["code"]} '
                        f'{issue["selector"]}: {issue["message"]}'
                    )
        taken = [it for it in report['shots'] if it['file'] is not None]
        retried = sum(bool(it.get('retried')) for it in report['shots'])
        again = f', {retried} shot again (the proxy of the dev server, a reload of the page)' if retried else ''
        summary = (
            f'{len(taken)} screenshots of {len(report["shots"])}, {report["errors"]} errors, '
            f'{report["warnings"]} warnings{again}: {path}.'
        )
        if not taken:
            raise CommandError(
                f'{summary} No screen was shot: run the backend (migrated, with the data of '
                '`manage.py e2e_data`) and set E2E_PASSWORD, and see the output of Playwright '
                '(`npx playwright install chromium` without a browser; a port of E2E_PORT that '
                'is already used: another port, or no E2E_PORT for a free one).',
                returncode=2,
            )
        if report['errors']:
            raise CommandError(
                f'{summary} Fix the errors in the specs, the screens or the backend and take the '
                'screenshots again; look at the screenshots too (AGENTS.md, "The visual check").'
            )
        self.stdout.write(f'{summary} Look at the screenshots (AGENTS.md, "The visual check").')

    def handle_design(self, check=False, **options):
        frontend = frontend_lock.frontend_dir()
        lock = require_lock(frontend)
        if check:
            rendered = self.render_theme()
            if problems := design_theme.stale(Path(settings.BASE_DIR), frontend, lock, rendered):
                raise CommandError(
                    '\n'.join(problems)
                    + '\nGenerate it with `manage.py bazis_front design`; never edit it.'
                )
            self.stdout.write(f'The theme of {frontend} is up to date.')
            return
        self.generate_theme(frontend, lock)

    def render_theme(self) -> dict[str, str]:
        """
        The theme of the design of the specs; fails with the issues of a design with errors.
        """
        result = spec_validate.validate(Path(settings.BASE_DIR), ('design',))
        if errors := [it for it in result.errors if it.layer == 'design']:
            self.write_issue_lines(errors)
            raise CommandError(
                f'The design has {len(errors)} errors: the theme is generated from a design '
                'that `bazis_front check` accepts.'
            )
        return design_theme.render(result.specs)

    def generate_theme(self, frontend: Path, lock: dict) -> None:
        rendered = self.render_theme()
        design_theme.write(Path(settings.BASE_DIR), frontend, lock, rendered)
        self.stdout.write(f'Generated the theme of {frontend}: {", ".join(rendered)}.')

    def handle_status(self, **options):
        from bazis.core.app import app  # noqa: F401  the contract is compared with its routes

        frontend = frontend_lock.frontend_dir()
        # an unreadable lock is the issue front.W001
        lock = frontend_lock.read_valid(frontend)
        issues = [
            {
                'id': message.id,
                'level': logging.getLevelName(message.level).lower(),
                'message': message.msg,
                'hint': message.hint,
                'command': checks.COMMANDS.get(message.id),
            }
            for check in checks.STATUS
            for message in check(None)
        ]
        state = {
            'bazis_front': __version__,
            'frontend': None if lock is None else str(frontend),
            'assets': {name: entry['version'] for name, entry in sorted((lock or {}).get('assets', {}).items())},
            'generated': {name: bool((lock or {}).get(key)) for name, key in GENERATED.items()},
            'issues': issues,
        }
        if options['json']:
            self.stdout.write(dumps(state), ending='')
            return
        self.stdout.write(f'bazis-front {__version__}')
        if lock is None:
            self.stdout.write(
                f'{frontend}: no frontend made by `bazis_front init` '
                f'(no readable {frontend_lock.LOCK_FILE}).'
            )
        else:
            assets = ', '.join(f'{name} {version}' for name, version in state['assets'].items())
            self.stdout.write(f'{frontend}: {assets}.')
            generated_names = [name for name, present in state['generated'].items() if present]
            missing = [name for name, present in state['generated'].items() if not present]
            self.stdout.write(
                f'Generated: {", ".join(generated_names) or "nothing"}'
                + (f'; not generated: {", ".join(missing)}.' if missing else '.')
            )
        for issue in issues:
            self.stdout.write(f'{issue["id"]} {issue["level"]}: {issue["message"]}')
            if issue['hint']:
                self.stdout.write(f'    {issue["hint"]}')
        self.stdout.write(f'{len(issues)} issues.' if issues else 'No issues.')

    def write_issue_lines(self, issues):
        for issue in issues:
            self.stdout.write(f'{issue.location}: {issue.code} {issue.severity}: {issue.message}')
            self.stdout.write(f'    {issue.hint}')

    def write_issues(self, result):
        self.write_issue_lines(result.issues)
        if not result.contract:
            self.stdout.write(
                f'The specs are not checked against the backend: {spec_validate.CONTRACT_FILE} '
                'is missing or cannot be read, only their shape and their references to each '
                'other are checked. Export the contract with `manage.py bazis_front contract`.'
            )
        self.stdout.write(
            f'{len(result.errors)} errors, {len(result.warnings)} warnings'
            + (f' (checked against {spec_validate.CONTRACT_FILE}).' if result.contract else '.')
        )
