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

from django.core.management.base import BaseCommand, CommandError

from bazis.contrib.front import __version__
from bazis.contrib.front.capabilities import DatabaseNotReadyError
from bazis.contrib.front.contract import export as contract
from bazis.contrib.front.contract import generated
from bazis.contrib.front.vendor import copy
from bazis.contrib.front.vendor import lock as frontend_lock


class Command(BaseCommand):
    help = 'The frontend layer of a Bazis product.'

    def add_arguments(self, parser):
        subcommands = parser.add_subparsers(dest='subcommand', metavar='subcommand', required=True)

        init = subcommands.add_parser(
            'init',
            help='Create the frontend of the product: frontend/ in BASE_DIR.',
            description=(
                'Create frontend/ from the template of bazis-front (React, TypeScript, Vite), '
                'with a copy of the protocol client in src/bazis/client/, its pristine copy in '
                '.bazis/base/ and the lock bazis-front.lock.json, then run `npm install` in it. '
                'An existing frontend/ is never overwritten.'
            ),
        )
        init.add_argument('--no-node', action='store_true', help='Do not run `npm install`.')

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

    def handle(self, *args, subcommand, **options):
        return getattr(self, f'handle_{subcommand}')(**options)

    def handle_init(self, no_node=False, **options):
        frontend = frontend_lock.frontend_dir()
        if frontend.exists():
            raise CommandError(
                f'{frontend} already exists: `bazis_front init` creates a new frontend and '
                'never overwrites one.'
            )
        copy.create_frontend(frontend)
        self.stdout.write(f'Created the frontend in {frontend} (bazis-front {__version__}).')
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
            problems = []
            if stale := contract.stale_files(directory, rendered):
                problems.append(
                    f'The contract in {directory} is stale: {", ".join(stale)} differ from '
                    'the backend.'
                )
            if lock is not None and (stale := generated.stale_files(frontend, lock, rendered)):
                problems.append(
                    f'The generated files of {frontend} are stale: {", ".join(stale)}.'
                )
            if problems:
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
