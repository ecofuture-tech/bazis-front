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
bazis-users: the token endpoint and the resource of the user model.
"""

from django.conf import settings
from django.contrib.auth import get_user_model

from bazis.core.models_abstract import JsonApiMixin


def section() -> dict:
    user_model = get_user_model()
    return {
        'token_url': settings.BAZIS_OPENAPI_TOKEN_URL,
        'user_resource': (
            user_model.get_resource_label() if issubclass(user_model, JsonApiMixin) else None
        ),
    }
