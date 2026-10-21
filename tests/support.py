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
import shutil
from pathlib import Path

from bazis.contrib.front.contract.export import CONTRACT_FORMAT


#: the specs of the sample: a complete valid spec
SAMPLE_SPEC = Path(__file__).resolve().parent.parent / 'sample' / 'spec'
#: the code of the custom screens of the sample (`custom: true` in their specs)
SAMPLE_SCREENS = SAMPLE_SPEC.parent / 'frontend-overlay' / 'src' / 'screens'


def copy_screen_code(root: Path) -> None:
    """
    The code of the screens of the sample (the extension of its list) in the frontend of the
    product root.
    """
    shutil.copytree(SAMPLE_SCREENS, root / 'frontend' / 'src' / 'screens', dirs_exist_ok=True)


def read_lock(root: Path) -> dict:
    """
    The lock of the frontend of the product root.
    """
    return json.loads((root / 'frontend' / 'bazis-front.lock.json').read_text(encoding='utf-8'))


def write_lock(root: Path, lock: dict) -> None:
    (root / 'frontend' / 'bazis-front.lock.json').write_text(json.dumps(lock), encoding='utf-8')


def labels_of_choices() -> bool:
    """
    Whether the core gives the labels of the choices of a body (`enumDict` of a type of Django
    choices, bazis 2.21).
    """
    from bazis.core.utils import fastapi_monkey_patch

    return hasattr(fastapi_monkey_patch, 'ChoicesJsonSchema')


def sample_contract(app) -> str:
    """
    The contract of the sample as `contract` exports it, with the labels of the choices of its
    bodies that bazis 2.21 gives (`enumDict` of `Task.Priority`) also with an older core: the
    tests of the other checks see no S058 of the sample whatever the core
    (`test_the_choices_of_the_bodies_of_the_sample_are_labeled_by_bazis_2_21` checks the export
    itself).
    """
    from bazis.contrib.front.contract.export import render

    text = render(app)['contract.json']
    if labels_of_choices():
        return text
    from tasks.models import Task

    labels = {value: str(label) for value, label in Task.Priority.choices}

    def label(node) -> None:
        if isinstance(node, dict):
            if node.get('enum') == list(labels):
                node.setdefault('enumDict', labels)
            for value in node.values():
                label(value)
        elif isinstance(node, list):
            for value in node:
                label(value)

    contract = json.loads(text)
    label(contract)
    return json.dumps(contract, ensure_ascii=False, indent=2)


def write_contract(root: Path, *names: str) -> None:
    """
    A contract.json in the product root with these capabilities only.
    """
    (root / 'contract').mkdir(exist_ok=True)
    (root / 'contract' / 'contract.json').write_text(
        json.dumps({'format': CONTRACT_FORMAT, 'capabilities': dict.fromkeys(names, {})}),
        encoding='utf-8',
    )
