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
The language of the profile of a user (`UserLanguageMixin` of bazis-users 2.7.0), as the
frontend reads and saves it (`followProfileLanguage` of the asset i18n): the contract says
the users have one (`users.profile_language`), the user finds his item by the username of
his session token (`filter=username=<sub>`), reads his language (null: none) and changes it
with a PATCH of the attribute `language` (a language of LANGUAGES, else 422); nobody else
changes it. Skipped while the user
model has no such field: the language of the frontend is kept in the browser then.
"""

import json

import pytest
from bazis_test_utils.utils import get_api_client


USERS = '/api/v1/users/user/'


@pytest.fixture
def profile(db):
    from django.contrib.auth import get_user_model

    from bazis.contrib.front.capabilities.users import profile_language

    if not profile_language(get_user_model()):
        pytest.skip('the user model has no language (UserLanguageMixin of bazis-users 2.7.0)')


def user_client(app, username: str):
    from bazis.contrib.users import get_user_model

    user = get_user_model().objects.create_user(username, password='p')
    return user, get_api_client(app, user.jwt_build())


@pytest.mark.django_db(transaction=True)
def test_the_user_reads_and_saves_the_language_of_his_profile(sample_app, workflow, profile, tmp_path):
    from django.core.management import call_command

    call_command('bazis_front', 'contract', '--out', str(tmp_path))
    contract = json.loads((tmp_path / 'contract.json').read_text(encoding='utf-8'))
    assert contract['capabilities']['users']['profile_language'] is True
    assert contract['project']['resources']['users.user']['fields']['language']['type'] == 'string'

    user, client = user_client(sample_app, 'speaker')
    # his item by the username of the token, without a language at first
    found = client.get(USERS, params={'filter': 'username=speaker', 'page[limit]': 1}).json()['data']
    assert [(it['id'], it['attributes']['language']) for it in found] == [(str(user.pk), None)]

    item = f'{USERS}{user.pk}/'
    document = {'data': {'type': 'users.user', 'id': str(user.pk), 'attributes': {'language': 'ru'}}}
    response = client.patch(item, json_data=document)
    assert response.status_code == 200, response.text
    assert client.get(item).json()['data']['attributes']['language'] == 'ru'

    # only a language of the backend (422 at the attribute), and none is null
    response = client.patch(item, json_data={'data': {**document['data'], 'attributes': {'language': 'de'}}})
    assert response.status_code == 422, response.text
    assert response.json()['errors'][0]['source']['pointer'] == '/data/attributes/language'
    response = client.patch(item, json_data={'data': {**document['data'], 'attributes': {'language': None}}})
    assert response.status_code == 200, response.text
    assert response.json()['data']['attributes']['language'] is None
    assert client.patch(item, json_data=document).status_code == 200

    # another user neither reads nor changes it
    _, other = user_client(sample_app, 'other')
    assert other.patch(item, json_data=document).status_code == 404
    user.refresh_from_db()
    assert user.language == 'ru'
