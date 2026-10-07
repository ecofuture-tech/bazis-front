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
The registry of the assets, `assets/registry.json`: the files that each asset copies into
the frontend of a product. It is the only list of them: `init` copies what it lists, and
the wheel is checked against it (`scripts/check_wheel.py`).
"""

import json
from dataclasses import dataclass
from importlib.resources import files
from importlib.resources.abc import Traversable


#: copied with the version stamp, kept pristine in `.bazis/base/`, hashed in the lock and
#: updated from the package
VENDORED = 'vendored'
#: copied once by `init`; the product owns it, the lock keeps only its version
TEMPLATE = 'template'


@dataclass(frozen=True)
class Asset:
    name: str
    kind: str
    #: the directory of the files in `assets/`
    source: str
    #: the directory of the files in the frontend, '' for its root
    target: str
    #: the paths of the files, relative to `source` and to `target`
    files: tuple[str, ...]

    def read(self, name: str) -> bytes:
        return assets_dir().joinpath(*self.source.split('/'), *name.split('/')).read_bytes()

    def target_path(self, name: str) -> str:
        """
        The path of a file in the frontend, as the lock records it.
        """
        return f'{self.target}/{name}' if self.target else name


def assets_dir() -> Traversable:
    return files('bazis.contrib.front') / 'assets'


def load() -> dict[str, Asset]:
    """
    The assets of the registry by name, in its order.
    """
    data = json.loads((assets_dir() / 'registry.json').read_text(encoding='utf-8'))
    return {
        it['name']: Asset(it['name'], it['kind'], it['source'], it['target'], tuple(it['files']))
        for it in data['assets']
    }
