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
bazis-authing: the authorization endpoint (`GET /auth/`), the login actions of the services
of BAZIS_AUTH_KINDS as the endpoint lists them in `meta.actions` (`code`, `name`, `method`,
`url`, in the order of the setting) and the query parameter of the store token
(BAZIS_AUTH_COOKIE_NAME), which the page of a `GET` action (Google) takes, and the logout
endpoint (`POST /logout/`, bazis-authing 2.6.0: it deletes the stores of the request and
their cookie), which the frontend calls when the user signs out. The endpoints and the
routes of the services are those of the application: an action whose route is not
registered is left out (the system check `authing.E001` reports it), and `auth_url` and
`logout_url` are null when their endpoint is not.
"""

from importlib import import_module

from django.conf import settings

from starlette.routing import NoMatchFound


def url_path(app, name: str) -> str | None:
    """
    The path of the route of this name of the application, None when it is not registered.
    """
    try:
        return str(app.router.url_path_for(name))
    except NoMatchFound:
        return None


def section() -> dict:
    from bazis.core.app import app

    logout_url = url_path(app, 'auth_logout')
    auth_url = url_path(app, 'auth')
    if auth_url is None:
        return {
            'auth_url': None, 'actions': [], 'logout_url': logout_url,
            'token_param': settings.BAZIS_AUTH_COOKIE_NAME,
        }
    actions = []
    for path in settings.BAZIS_AUTH_KINDS:
        try:
            service = import_module(path)
            action = service.get_login_action()
        except (ImportError, AttributeError, NoMatchFound):
            # not importable (`authing.W001`), no login action, its route not registered
            continue
        actions.append({
            'code': action['code'],
            'name': str(action['name']),
            'method': action['method'],
            'url': str(action['url']),
        })
    return {
        'auth_url': auth_url,
        'actions': actions,
        'logout_url': logout_url,
        'token_param': settings.BAZIS_AUTH_COOKIE_NAME,
    }
