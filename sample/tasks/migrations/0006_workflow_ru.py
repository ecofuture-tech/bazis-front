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
The Russian names of the roles, statuses and transits of the sample (LANGUAGES: en and ru):
the names are translated fields of bazis-permit and bazis-statusy (a column per language),
which the contract exports in every language. Data of the product, frozen here; the fixture
`workflow` of the tests runs `name_workflow` again after `create_workflow`.
"""

from django.db import migrations


#: the Russian names by the slug of the role
ROLES = {'guest': 'Гость', 'viewer': 'Наблюдатель', 'manager': 'Менеджер'}

#: the Russian names by the id of the status
STATUSES = {'draft': 'Черновик', 'in_progress': 'В работе', 'done': 'Готово'}

#: the Russian names by the id of the transit
TRANSITS = {'start': 'Начать', 'finish': 'Завершить'}


def name_workflow(apps, schema_editor=None) -> None:
    """
    Sets the Russian names, with the models of `apps`: those of the migration, or
    `django.apps.apps` for the fixture `workflow` of the tests.
    """
    for model, names, key in (
        (apps.get_model('permit', 'Role'), ROLES, 'slug'),
        (apps.get_model('statusy', 'Status'), STATUSES, 'id'),
        (apps.get_model('statusy', 'Transit'), TRANSITS, 'id'),
    ):
        for value, name in names.items():
            model.objects.filter(**{key: value}).update(name_ru=name)


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0005_workflow'),
    ]

    operations = [
        migrations.RunPython(name_workflow, migrations.RunPython.noop),
    ]
