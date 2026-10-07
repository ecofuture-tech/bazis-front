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
The specs of a new product (`bazis_front init`): the copies of the JSON Schemas for the
editors in `spec/schema/`, and starters of `product.yaml` and of the design. There are no
starters of screens: the agent writes them. `bazis_front update` brings the copies of the
JSON Schemas to the installed version (`schema_updates`).
"""

import os
import shutil
from importlib.resources import files
from pathlib import Path

from django.conf import settings

from .validate import SCHEMA_DIR, SPEC_DIR, schema_files


#: the starters, by their path in spec/
STARTERS = ('product.yaml', 'design/theme.yaml', 'design/tokens.json')


def spec_dir() -> Path:
    """
    `spec/` in the product root (BASE_DIR).
    """
    return Path(settings.BASE_DIR) / SPEC_DIR


def create_spec(spec: Path) -> None:
    """
    Creates the specs; the directory must not exist. They are written in a temporary
    directory next to it and renamed, so that a failure leaves nothing behind.
    """
    temporary = spec.with_name(f'.{spec.name}.init-{os.getpid()}')
    temporary.mkdir()
    try:
        (temporary / SCHEMA_DIR).mkdir()
        for name, source in schema_files().items():
            (temporary / SCHEMA_DIR / name).write_bytes(source.read_bytes())
        starters = files(__package__) / 'starters'
        for name in STARTERS:
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(starters.joinpath(*name.split('/')).read_bytes())
        os.rename(temporary, spec)
    except BaseException:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


def schema_updates(spec: Path) -> dict[str, bytes]:
    """
    The JSON Schemas of the package whose copies in `spec/schema/` differ or are missing, by
    file name; none when the product has no `spec/schema/`: the copies are only for the
    editors, and a product may go without them.
    """
    directory = spec / SCHEMA_DIR
    if not directory.is_dir():
        return {}
    updates = {}
    for name, source in schema_files().items():
        data = source.read_bytes()
        if not (directory / name).is_file() or (directory / name).read_bytes() != data:
            updates[name] = data
    return updates
