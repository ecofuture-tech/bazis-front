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
The frontend of a product and its lock, `frontend/bazis-front.lock.json`: the versions and
hashes of what bazis-front wrote there.

```json
{"lock": 1, "bazis_front": "0.1.0",
 "contract": {"contract.json": "sha256:…", "openapi.json": "sha256:…"},
 "generated": {"src/bazis/generated/contract.ts": "sha256:…",
               "src/bazis/generated/schema.d.ts": "sha256:…"},
 "assets": {"client": {"version": "0.1.0", "files": {"src/bazis/client/client.ts": "sha256:…"}},
            "template": {"version": "0.1.0"}}}
```

`contract` has the hashes of the contract files from which the files of `generated` were
made; a generated file that could not be made is `"missing"`. The hashes of the files of
a vendored asset are those of its pristine copy in `.bazis/base/<asset>@<version>/`.
"""

import hashlib
import json
from pathlib import Path

from django.conf import settings

from ..contract.openapi import dumps


#: the version of the format of the lock; a change of it is a minor release
LOCK_FORMAT = 1

#: the directory of the frontend in the product root
FRONTEND_DIR = 'frontend'

LOCK_FILE = 'bazis-front.lock.json'

#: the pristine copies of the vendored assets, `<asset>@<version>/` in the frontend
BASE_DIR = '.bazis/base'


class LockError(Exception):
    """
    The lock cannot be read.
    """


def frontend_dir() -> Path:
    """
    `frontend/` in the product root (BASE_DIR, the directory of `manage.py`).
    """
    return Path(settings.BASE_DIR) / FRONTEND_DIR


def digest(data: bytes) -> str:
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def read(frontend: Path) -> dict | None:
    """
    The lock of the frontend; None when there is none, i.e. the directory is not a frontend
    made by `bazis_front init`.
    """
    path = frontend / LOCK_FILE
    if not path.is_file():
        return None
    try:
        lock = json.loads(path.read_text(encoding='utf-8'))
    except ValueError as err:
        raise LockError(f'{path} is not valid JSON: {err}') from err
    if not isinstance(lock, dict) or lock.get('lock') != LOCK_FORMAT:
        raise LockError(
            f'{path} is not a lock of format {LOCK_FORMAT}: it was written by another '
            'version of bazis-front.'
        )
    return lock


def write(frontend: Path, lock: dict) -> None:
    (frontend / LOCK_FILE).write_text(dumps(lock), encoding='utf-8', newline='\n')
