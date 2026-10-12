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
The helpers of the tests that act on a product root (BASE_DIR) with a frontend.
"""

import json
from pathlib import Path

from bazis.contrib.front.contract.export import CONTRACT_FORMAT


#: the specs of the sample: a complete valid spec
SAMPLE_SPEC = Path(__file__).resolve().parent.parent / 'sample' / 'spec'


def read_lock(root: Path) -> dict:
    """
    The lock of the frontend of the product root.
    """
    return json.loads((root / 'frontend' / 'bazis-front.lock.json').read_text(encoding='utf-8'))


def write_lock(root: Path, lock: dict) -> None:
    (root / 'frontend' / 'bazis-front.lock.json').write_text(json.dumps(lock), encoding='utf-8')


def write_contract(root: Path, *names: str) -> None:
    """
    A contract.json in the product root with these capabilities only.
    """
    (root / 'contract').mkdir(exist_ok=True)
    (root / 'contract' / 'contract.json').write_text(
        json.dumps({'format': CONTRACT_FORMAT, 'capabilities': dict.fromkeys(names, {})}),
        encoding='utf-8',
    )
