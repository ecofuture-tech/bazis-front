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

from tasks.workflow import TEST_USERS, create_test_data


class Command(BaseCommand):
    help = (
        'Create the data of the end-to-end tests on top of the migrations (which create the '
        'roles, statuses and transits): the test users of the roles of the specs, with the '
        'password of E2E_PASSWORD, and the task that a scenario opens. It can run again: the '
        'data that exists is kept, the password of the test users is set again.'
    )

    def handle(self, *args, **options):
        password = os.environ.get('E2E_PASSWORD')
        if not password:
            raise CommandError('Set E2E_PASSWORD, the password of the test users.')
        try:
            with transaction.atomic():
                create_test_data(password)
        except LookupError as error:
            raise CommandError(str(error)) from None
        self.stdout.write(f'Created the test users {", ".join(TEST_USERS)} and the data of the scenarios.')
