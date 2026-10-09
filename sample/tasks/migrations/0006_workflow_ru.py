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
The Russian names of the roles, the statuses and the transits of the sample were set here;
the names of the declarations of `tasks/roles.py` and `tasks/workflow.py` are translated by
the catalog of the app (`locale/ru/LC_MESSAGES/django.po`) now. Kept without effect as a
node of the migration graph.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0005_workflow'),
    ]

    operations = []
