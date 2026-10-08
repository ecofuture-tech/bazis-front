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
bazis-users: the token endpoint, the resource of the user model and whether its users have
a language of their own (`profile_language`: a text field `language` of the user model, the
code of a language of LANGUAGES, which the frontend adopts at a login and changes with the
language of the interface). bazis-users has no such field yet; a project may add it to its
user model.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import FieldDoesNotExist
from django.db import models

from bazis.core.models_abstract import JsonApiMixin


def profile_language(user_model) -> bool:
    """
    Whether the users have a language of their own: a text field `language` of a resource.
    """
    if not issubclass(user_model, JsonApiMixin):
        return False
    try:
        field = user_model._meta.get_field('language')
    except FieldDoesNotExist:
        return False
    return isinstance(field, models.CharField)


def section() -> dict:
    user_model = get_user_model()
    return {
        'token_url': settings.BAZIS_OPENAPI_TOKEN_URL,
        'user_resource': (
            user_model.get_resource_label() if issubclass(user_model, JsonApiMixin) else None
        ),
        'profile_language': profile_language(user_model),
    }
