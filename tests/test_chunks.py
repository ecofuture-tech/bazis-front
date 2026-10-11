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
`scripts/check_chunks.py`, which the e2e job of CI runs on the build of the frontend of the
sample: Leaflet and the file field must not be in the chunks loaded with the entry.
"""

import importlib.util
import json
from pathlib import Path


SCRIPT = Path(__file__).resolve().parent.parent / 'scripts' / 'check_chunks.py'


def check(tmp_path, manifest: dict, code: str = 'export {};') -> int:
    spec = importlib.util.spec_from_file_location('check_chunks', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    (tmp_path / '.vite').mkdir()
    (tmp_path / '.vite' / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    (tmp_path / 'assets').mkdir()
    for chunk in manifest.values():
        # the code of the vendor chunk, the others empty modules
        text = code if chunk['file'] == 'assets/vendor.js' else 'export {};'
        (tmp_path / chunk['file']).write_text(text, encoding='utf-8')
    return module.main(str(tmp_path))


def manifest(map_imports: list[str]) -> dict:
    return {
        'index.html': {'file': 'assets/index.js', 'isEntry': True, 'imports': ['_vendor.js'],
                       'dynamicImports': ['src/bazis/ui/map/leaflet-map.tsx']},
        '_vendor.js': {'file': 'assets/vendor.js', 'imports': map_imports},
        'src/bazis/ui/map/leaflet-map.tsx': {'file': 'assets/leaflet-map.js', 'isDynamicEntry': True,
                                             'imports': ['node_modules/leaflet/dist/leaflet-src.js']},
        'node_modules/leaflet/dist/leaflet-src.js': {'file': 'assets/leaflet.js'},
    }


def test_leaflet_is_a_lazy_chunk(tmp_path, capsys):
    assert check(tmp_path, manifest([])) == 0
    assert 'lazy: node_modules/leaflet/dist/leaflet-src.js, src/bazis/ui/map/leaflet-map.tsx' in capsys.readouterr().out


def test_leaflet_imported_with_the_entry_fails(tmp_path, capsys):
    assert check(tmp_path, manifest(['src/bazis/ui/map/leaflet-map.tsx'])) == 1
    assert 'not lazily: node_modules/leaflet/dist/leaflet-src.js, src/bazis/ui/map/leaflet-map.tsx' in capsys.readouterr().err


def test_leaflet_bundled_into_a_chunk_of_the_entry_fails(tmp_path, capsys):
    code = 'L.DomUtil.addClass(container, "leaflet-container");'
    assert check(tmp_path, manifest([]), code) == 1
    assert 'not lazily: assets/vendor.js' in capsys.readouterr().err
