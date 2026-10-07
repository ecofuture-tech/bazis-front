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

from pathlib import Path

from django.conf import settings
from django.utils import translation

from bazis.core.introspect import packages

from ..capabilities import app_enabled, sections
from . import generated
from .openapi import dumps, openapi_hash
from .resources import resources


#: the version of the format of contract.json; a change of it is a minor release
CONTRACT_FORMAT = 1

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
    The files of the contract of the application as text, by file name. Raises
    `capabilities.DatabaseNotReadyError` when a section needs the database and it is not
    migrated.
    """
    openapi = app.openapi()
    return {
        'openapi.json': dumps(openapi),
        'contract.json': dumps(build_contract(openapi)),
    }


def build_contract(openapi: dict) -> dict:
    """
    The content of contract.json. The names of the roles, statuses and transits are in
    LANGUAGE_CODE, whatever the language of the process.
    """
    with translation.override(settings.LANGUAGE_CODE):
        return {
            'format': CONTRACT_FORMAT,
            'generated_by': generated_by(),
            'openapi_hash': openapi_hash(openapi),
            'project': {'resources': resources(openapi)},
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


def stale_files(directory: Path, rendered: dict[str, str]) -> list[str]:
    """
    The names of the files that are missing in the directory or differ from the rendered
    ones, byte for byte (also in their line endings).
    """
    return [
        name
        for name, text in rendered.items()
        if not (path := directory / name).is_file() or path.read_bytes() != text.encode('utf-8')
    ]


def stale(directory: Path, rendered: dict[str, str], frontend: Path, lock: dict | None) -> list[str]:
    """
    Why the contract in the directory and the generated files of the frontend (with its
    lock; None when it has none) differ from the rendered contract, one message for each;
    empty when they are current. It runs no Node: `bazis_front contract --check` and the
    system check `front.W001` both use it.
    """
    problems = []
    if names := stale_files(directory, rendered):
        problems.append(
            f'The contract in {directory} is stale: {", ".join(names)} differ from the backend.'
        )
    if lock is not None and (names := generated.stale_files(frontend, lock, rendered)):
        problems.append(f'The generated files of {frontend} are stale: {", ".join(names)}.')
    return problems


def write(directory: Path, rendered: dict[str, str]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for name, text in rendered.items():
        (directory / name).write_text(text, encoding='utf-8', newline='\n')
