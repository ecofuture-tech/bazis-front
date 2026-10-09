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
The errors of an item that fails its invariants (`JsonApiMixin.validate_item` of the core
2.10), as `ApiError.fieldErrors()` and `ApiError.formErrors()` of the client read them:
422 `ERR_ITEM_INVALID`, the pointer of the field (`/data/attributes/<name>`,
`/data/relationships/<name>`), `/data` for the item as a whole.
"""

from django.core.exceptions import NON_FIELD_ERRORS, ValidationError

import pytest

from .test_related import TASKS, manager_client


@pytest.mark.django_db(transaction=True)
def test_the_pointers_of_an_invalid_item(sample_app, monkeypatch):
    from django.apps import apps

    task = apps.get_model('tasks.Task')

    def validate_item(self, changes):
        if self.title == 'Taken':
            raise ValidationError({
                'title': 'The title is taken.',
                'assignee': 'The assignee is busy.',
                NON_FIELD_ERRORS: 'The task overlaps another one.',
            })

    monkeypatch.setattr(task, 'validate_item', validate_item)
    user, client = manager_client(sample_app)

    document = {'data': {
        'type': 'tasks.task',
        'attributes': {'title': 'Taken'},
        'relationships': {'assignee': {'data': {'type': 'users.user', 'id': str(user.id)}}},
    }}
    response = client.post(TASKS, json_data=document)
    assert response.status_code == 422, response.text
    errors = sorted(
        (it['code'], it['source']['pointer'], it['detail']) for it in response.json()['errors']
    )
    assert errors == [
        ('ERR_ITEM_INVALID', '/data', 'The task overlaps another one.'),
        ('ERR_ITEM_INVALID', '/data/attributes/title', 'The title is taken.'),
        ('ERR_ITEM_INVALID', '/data/relationships/assignee', 'The assignee is busy.'),
    ]
    # the write is rolled back
    assert not task.objects.filter(title='Taken').exists()
