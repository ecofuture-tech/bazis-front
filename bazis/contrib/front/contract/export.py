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
The export of the contract: the files as text, their comparison and their writing.
"""

import re
from pathlib import Path

from django.conf import settings
from django.utils import translation

from bazis.core.introspect import packages

from ..capabilities import app_enabled, sections
from ..vendor import lock as frontend_lock
from . import generated
from .openapi import dumps
from .resources import resources


#: the version of the format of contract.json; a change of it is a minor release. 2: the
#: languages of the project, the names of the roles, statuses and transits by language; 3:
#: the search fields of the resources, the selectors of the permission models; 4: `reverse`
#: of the relationships whose foreign key or many-to-many field is on the other model; 5:
#: the titles of the fields, `title`, and the attributes that label the items of a
#: resource, `label`; 6: the fields that the create route of a resource takes, `create`,
#: and its custom actions, `custom_actions`; 7: whether a custom action is open to anonymous
#: users, `public`; 8: the format `decimal` of the attributes of a `DecimalField`; 9: the
#: decimal places of such an attribute, `places`, and the JSON Schema of the JSON answer of
#: a custom action, `custom_actions[].response`
CONTRACT_FORMAT = 9

#: the directory of the contract in the product root
CONTRACT_DIR = 'contract'


def default_dir() -> Path:
    """
    `contract/` in the product root: BASE_DIR, the directory that holds the project
    package and `manage.py` (Bazis sets it from DJANGO_SETTINGS_MODULE, BS_BASE_DIR
    overrides it).
    """
    return Path(settings.BASE_DIR) / CONTRACT_DIR


def render(app) -> dict[str, str]:
    """
    The files of the contract of the application as text, by file name, in LANGUAGE_CODE
    whatever the language of the process. Raises `capabilities.DatabaseNotReadyError` when
    a section needs the database and it is not migrated.

    The core (2.8) builds the OpenAPI per language and translates the titles of the schemas
    in the active language: the override is enough, whatever the process answered before.
    """
    with translation.override(settings.LANGUAGE_CODE):
        openapi = app.openapi()
        return {
            'openapi.json': dumps(openapi),
            'contract.json': dumps(build_contract(openapi)),
        }


def base_language(code: str) -> str:
    """
    The base code of a language code: `en` of `en-US`, `pt` of `pt_BR`.
    """
    return re.split(r'[-_]', code)[0].lower()


def default_language() -> str:
    """
    The code of LANGUAGES that LANGUAGE_CODE names: the same code (whatever its case and
    separator: `pt-br` for `pt-BR`), else the first one of the same base code (`en` for
    `en-EN`); the base code of LANGUAGE_CODE when LANGUAGES has neither.
    """
    def normal(code: str) -> str:
        return code.lower().replace('_', '-')

    codes = [code for code, _name in settings.LANGUAGES]
    wanted = normal(settings.LANGUAGE_CODE)
    same = [code for code in codes if normal(code) == wanted]
    base = [code for code in codes if base_language(code) == base_language(wanted)]
    return (same or base or [base_language(wanted)])[0]


def languages() -> list[dict]:
    """
    The languages of the project (LANGUAGES), in their order: the code and the name.
    """
    return [{'code': code, 'name': str(name)} for code, name in settings.LANGUAGES]


def build_contract(openapi: dict) -> dict:
    """
    The content of contract.json. The texts are in LANGUAGE_CODE, whatever the language of
    the process; the names of the roles, statuses and transits are in every language of
    LANGUAGES (`translated`).
    """
    with translation.override(settings.LANGUAGE_CODE):
        return {
            'format': CONTRACT_FORMAT,
            'generated_by': generated_by(),
            'project': {
                'language': default_language(),
                'languages': languages(),
                'resources': resources(openapi),
            },
            'capabilities': sections(),
        }


def generated_by() -> dict[str, str]:
    """
    The versions of the Bazis distributions whose apps the project installs: those that
    shape its API (tools such as bazis-mcp do not).
    """
    return {
        it['name']: it['version']
        for it in packages()
        if it['module'] and app_enabled(it['module'])
    }


def stale(directory: Path, rendered: dict[str, str], frontend: Path, lock: dict | None) -> list[str]:
    """
    Why the contract in the directory and the generated files of the frontend (with its
    lock; None when it has none) differ from the rendered contract, one message for each;
    empty when they are current. It runs no Node: `bazis_front contract --check` and the
    system check `front.W001` both use it.
    """
    problems = []
    if names := frontend_lock.stale_files(directory, rendered):
        problems.append(
            f'The contract in {directory} is stale: {", ".join(names)} differ from the backend.'
        )
    if lock is not None and (names := generated.stale_files(frontend, lock, rendered)):
        problems.append(f'The generated files of {frontend} are stale: {", ".join(names)}.')
    return problems


def write(directory: Path, rendered: dict[str, str]) -> None:
    frontend_lock.write_files(directory, rendered)
