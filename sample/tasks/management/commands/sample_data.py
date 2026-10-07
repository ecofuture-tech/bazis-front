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

import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from tasks.workflow import TEST_USERS, create_test_data, create_workflow


class Command(BaseCommand):
    help = (
        'Create the data of the sample that its migrations do not: the roles, statuses and '
        'transits (read by `bazis_front contract`), and for the end-to-end tests the test users '
        'of the roles and a task. Data that exists is kept, but the password of the test users '
        'is set to E2E_PASSWORD again.'
    )

    def handle(self, *args, **options):
        password = os.environ.get('E2E_PASSWORD')
        if not password:
            raise CommandError('Set E2E_PASSWORD, the password of the test users.')
        with transaction.atomic():
            create_workflow()
            create_test_data(password)
        self.stdout.write(f'Created the workflow and the test users {", ".join(TEST_USERS)}.')
