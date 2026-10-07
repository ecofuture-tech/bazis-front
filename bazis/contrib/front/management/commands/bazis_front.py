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

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from bazis.contrib.front.capabilities import DatabaseNotReadyError
from bazis.contrib.front.contract import export as contract


class Command(BaseCommand):
    help = 'The frontend layer of a Bazis product.'

    def add_arguments(self, parser):
        subcommands = parser.add_subparsers(dest='subcommand', metavar='subcommand', required=True)

        export = subcommands.add_parser(
            'contract',
            help='Export the contract: contract/openapi.json and contract/contract.json.',
            description=(
                'Export the OpenAPI of the backend and contract.json (the resources and the '
                'sections of the installed packages: users, permit roles, statusy transits). '
                'The permit and statusy sections are read from the database, which must be '
                'migrated. The contract is generated: never edit it.'
            ),
        )
        export.add_argument(
            '--check',
            action='store_true',
            help='Write nothing; exit with 1 if the files differ from the export.',
        )
        export.add_argument(
            '--out',
            type=Path,
            help='The directory of the contract (default: contract/ in BASE_DIR).',
        )

    def handle(self, *args, subcommand, **options):
        return getattr(self, f'handle_{subcommand}')(**options)

    def handle_contract(self, check=False, out=None, **options):
        from bazis.core.app import app

        directory = Path(out) if out else contract.default_dir()
        try:
            rendered = contract.render(app)
        except DatabaseNotReadyError as err:
            raise CommandError(f'{err.error.msg} ({err.error.id})\n{err.error.hint}') from err

        if check:
            if stale := contract.stale_files(directory, rendered):
                raise CommandError(
                    f'The contract in {directory} is stale: {", ".join(stale)} differ from '
                    'the backend. Export it with `manage.py bazis_front contract`.'
                )
            self.stdout.write(f'The contract in {directory} is up to date.')
            return

        contract.write(directory, rendered)
        self.stdout.write(f'Exported the contract to {directory}: {", ".join(rendered)}.')
