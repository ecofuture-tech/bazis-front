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
The roles, statuses and transits of the sample (`tasks.workflow`): the data of a product is
created by its migrations, so that the contract is exported from a migrated database and the
e2e data command only adds the test users. The data is in `tasks.workflow`, which the
fixture `workflow` of the tests also reads; a product writes it in its data migrations, and
changes it with new ones.
"""

from django.db import migrations


def workflow(apps, schema_editor):
    from tasks.workflow import create_workflow

    create_workflow(apps)


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('permit', '0007_name_en_blank'),
        ('statusy', '0006_transits_related_through'),
        ('tasks', '0004_attachment'),
    ]

    operations = [
        migrations.RunPython(workflow, migrations.RunPython.noop),
    ]
