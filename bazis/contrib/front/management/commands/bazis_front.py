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

import shutil
import subprocess
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from bazis.contrib.front import __version__, capabilities
from bazis.contrib.front.capabilities import DatabaseNotReadyError
from bazis.contrib.front.contract import export as contract
from bazis.contrib.front.contract import generated
from bazis.contrib.front.contract.openapi import dumps
from bazis.contrib.front.spec import create as spec_create
from bazis.contrib.front.spec import e2e
from bazis.contrib.front.spec import theme as design_theme
from bazis.contrib.front.spec import validate as spec_validate
from bazis.contrib.front.spec.issues import Issues
from bazis.contrib.front.vendor import copy, update
from bazis.contrib.front.vendor import lock as frontend_lock
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


class Command(BaseCommand):
    help = 'The frontend layer of a Bazis product.'

    def add_arguments(self, parser):
        subcommands = parser.add_subparsers(dest='subcommand', metavar='subcommand', required=True)

        init = subcommands.add_parser(
            'init',
            help='Create the frontend of the product: frontend/ in BASE_DIR.',
            description=(
                'Create frontend/ from the template of bazis-front (React, TypeScript, Vite), '
                'with copies of the protocol client in src/bazis/client/ and of the React hooks '
                'in src/bazis/react/ (with those of the installed packages, such as '
                'bazis-statusy), their pristine copies in .bazis/base/ and the lock '
                'bazis-front.lock.json, and its theme (`design`) in src/bazis/generated/, then '
                'run `npm install` in it. Also create spec/ (the JSON Schemas of the specs in '
                'spec/schema/, starters of product.yaml and of the design of the preset) when '
                'the product has none. An existing frontend/ or spec/ is never overwritten.'
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
            help='Update the copied assets to the installed bazis-front, merging the changes.',
            description=(
                'Bring the copies of the assets in frontend/ (the client, the hooks, the '
                'components, the helpers of the end-to-end tests) to the installed version of '
                'bazis-front: a file unchanged in the frontend is replaced, a file changed only '
                'there is kept, a file changed in both is merged with its pristine copy in '
                '.bazis/base/ (conflicts are written with markers and fail the command); files '
                'added to an asset are added, files removed from it are deleted unless changed. '
                'The assets that a new version requires are copied, the pristine copies and the '
                'lock are updated, and so are the JSON Schemas in spec/schema/. The template '
                'is the product\'s and never updated: the versions of the npm dependencies of '
                'its package.json are reported. Nothing is written when an asset cannot be '
                'updated.'
            ),
        )
        update_parser.add_argument(
            'assets', nargs='*', metavar='asset',
            help='The assets to update, with those they require (default: every copied asset).',
        )
        update_parser.add_argument(
            '--all', action='store_true', dest='all_assets', help='Update every copied asset.',
        )
        update_parser.add_argument(
            '--check',
            action='store_true',
            help='Write nothing; list the changes and exit with 1 if a copy is not up to date.',
        )

        check = subcommands.add_parser(
            'check',
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

        e2e_parser = subcommands.add_parser(
            'e2e',
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
            help='Generate the theme of the frontend from spec/design/.',
            description=(
                'Compile spec/design/theme.yaml and spec/design/tokens.json into '
                'frontend/src/bazis/generated/theme.css (the tokens as CSS variables of the '
                'light and the dark mode, the spacing of the density, the Tailwind theme and the '
                'base styles of the preset) and theme.ts (THEME: the navigation, the density, '
                'the composition, the tones of the statuses, read by the components); the lock '
                'records the hashes of the design and of the files. Without spec/design/, the '
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

    def execute(self, *args, **options):
        # `check` reports the issues of the specs itself, `update` the stale copies: the
        # system checks would repeat them (front.W002, front.W004)
        if options.get('subcommand') in ('check', 'update'):
            options['skip_checks'] = True
        return super().execute(*args, **options)

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
        try:
            lock = frontend_lock.read(frontend)
        except frontend_lock.LockError as err:
            raise CommandError(str(err)) from err
        if lock is None:
            raise CommandError(
                f'{frontend} has no {frontend_lock.LOCK_FILE}: create the frontend with '
                '`manage.py bazis_front init`.'
            )
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
        if added.copied:
            self.stdout.write(
                'Run their contract tests with `npm test` in frontend/; the product owns the '
                'copies and keeps the tests passing when it changes them.'
            )

    def handle_update(self, assets, all_assets=False, check=False, **options):
        if assets and all_assets:
            raise CommandError('Name the assets or pass --all, not both.')
        frontend = frontend_lock.frontend_dir()
        try:
            lock = frontend_lock.read(frontend)
        except frontend_lock.LockError as err:
            raise CommandError(str(err)) from err
        if lock is None:
            raise CommandError(
                f'{frontend} has no {frontend_lock.LOCK_FILE}: create the frontend with '
                '`manage.py bazis_front init`.'
            )
        root = Path(settings.BASE_DIR)
        try:
            plan = update.plan(root, frontend, lock, assets, contract_capabilities)
        except copy.CopyError as err:
            raise CommandError('\n'.join(err.messages)) from err

        self.write_plan(plan)
        if changes := update.dependency_changes(frontend):
            self.stdout.write(
                f'The package.json of the template of bazis-front {plan.version} has other '
                'versions of npm dependencies than frontend/package.json. `update` never changes '
                'it: bump those that the copies need and run `npm install`.'
            )
            for line in changes:
                self.stdout.write(f'  {line}')
        if not plan:
            self.stdout.write(f'The copies in {frontend} are those of bazis-front {plan.version}.')
            return
        if check:
            raise CommandError(
                f'The copies are not those of bazis-front {plan.version}: update them with '
                '`manage.py bazis_front update`.'
            )
        update.apply(root, frontend, lock, plan)
        if plan.conflicts:
            raise CommandError(
                f'Updated to bazis-front {plan.version} with conflicts in {len(plan.conflicts)} '
                f'files: {", ".join(plan.conflicts)}. Resolve the conflict markers (<<<<<<< '
                f'{update.LOCAL_NAME}, =======, >>>>>>> bazis-front {plan.version}) in them, '
                'then run `npx tsc --noEmit` and `npm test` in frontend/.'
            )
        self.stdout.write(
            f'Updated the copies to bazis-front {plan.version}. Run `npx tsc --noEmit`, '
            '`npm run lint` and `npm test` in frontend/, and commit the frontend with '
            f'{frontend_lock.BASE_DIR}/ and the lock.'
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

    def handle_e2e(self, check=False, **options):
        frontend = frontend_lock.frontend_dir()
        try:
            lock = frontend_lock.read(frontend)
        except frontend_lock.LockError as err:
            raise CommandError(str(err)) from err
        if lock is None:
            raise CommandError(
                f'{frontend} has no {frontend_lock.LOCK_FILE}: create the frontend with '
                '`manage.py bazis_front init`.'
            )
        if e2e.HELPERS not in lock.get('assets', {}):
            raise CommandError(
                f'{frontend} has no helpers of the end-to-end tests ({e2e.HELPERS_DIR}/, the asset '
                f'{e2e.HELPERS}): it was made by an older bazis-front. Copy them with '
                f'`manage.py bazis_front add {e2e.HELPERS}`.'
            )
        root = Path(settings.BASE_DIR)
        result = spec_validate.validate(root)
        if result.errors:
            self.write_issues(result)
            raise CommandError(
                f'The specs have {len(result.errors)} errors: the end-to-end tests are generated '
                'from specs that `bazis_front check` accepts.'
            )
        rendered = e2e.render(result.specs)
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
            'Run them with `npm run e2e` in frontend/ against the running backend, with the '
            'test data loaded and E2E_PASSWORD set.'
        )

    def handle_design(self, check=False, **options):
        frontend = frontend_lock.frontend_dir()
        try:
            lock = frontend_lock.read(frontend)
        except frontend_lock.LockError as err:
            raise CommandError(str(err)) from err
        if lock is None:
            raise CommandError(
                f'{frontend} has no {frontend_lock.LOCK_FILE}: create the frontend with '
                '`manage.py bazis_front init`.'
            )
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
            for issue in errors:
                self.stdout.write(f'{issue.location}: {issue.code} {issue.severity}: {issue.message}')
                self.stdout.write(f'    {issue.hint}')
            raise CommandError(
                f'The design has {len(errors)} errors: the theme is generated from a design '
                'that `bazis_front check` accepts.'
            )
        return design_theme.render(result.specs)

    def generate_theme(self, frontend: Path, lock: dict) -> None:
        rendered = self.render_theme()
        design_theme.write(Path(settings.BASE_DIR), frontend, lock, rendered)
        self.stdout.write(f'Generated the theme of {frontend}: {", ".join(rendered)}.')

    def write_issues(self, result):
        for issue in result.issues:
            self.stdout.write(f'{issue.location}: {issue.code} {issue.severity}: {issue.message}')
            self.stdout.write(f'    {issue.hint}')
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
