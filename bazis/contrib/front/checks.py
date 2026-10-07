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
Django system checks of bazis-front (see `manage.py bazis_doctor`).
"""

from django.core.checks import Info, Warning, register


@register()
def check_contract(app_configs, **kwargs):
    """
    The contract in the product root (`contract/`) must be the export of the backend.
    Runs when the product has a contract and the application is loaded
    (`manage.py bazis_doctor`); a database that is not migrated skips it with an info.
    """
    from bazis.core.introspect import loaded_app

    from .capabilities import DatabaseNotReadyError
    from .contract import export as contract

    directory = contract.default_dir()
    if not directory.is_dir() or (app := loaded_app()) is None:
        return []
    try:
        rendered = contract.render(app)
    except DatabaseNotReadyError as err:
        return [
            Info(
                f'The contract in {directory} is not checked: {err.error.msg}',
                hint=err.error.hint,
                id='front.I001',
            )
        ]
    if stale := contract.stale_files(directory, rendered):
        return [
            Warning(
                f'The contract in {directory} is stale: {", ".join(stale)} differ from the '
                'backend.',
                hint='Export it with `manage.py bazis_front contract`; never edit it by hand.',
                id='front.W001',
            )
        ]
    return []
