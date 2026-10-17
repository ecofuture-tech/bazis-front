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
`scripts/check_chunks.py`, which the frontend and the e2e jobs of CI run on the builds of the
frontends: Leaflet, recharts, react-day-picker, @dnd-kit, the views that import them and the
file field must not be in the chunks loaded with the entry, and none of those chunks is larger
than the budget.
"""

import importlib.util
import json
from pathlib import Path

import pytest


SCRIPT = Path(__file__).resolve().parent.parent / 'scripts' / 'check_chunks.py'


def check(tmp_path, manifest: dict, code: str = 'export {};', sizes: dict[str, int] | None = None) -> int:
    spec = importlib.util.spec_from_file_location('check_chunks', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    (tmp_path / '.vite').mkdir()
    (tmp_path / '.vite' / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    (tmp_path / 'assets').mkdir()
    for chunk in manifest.values():
        # the code of the vendor chunk, the others empty modules, padded to their `sizes`
        text = code if chunk['file'] == 'assets/vendor.js' else 'export {};'
        text = text.ljust((sizes or {}).get(chunk['file'], 0))
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
    assert capsys.readouterr().out == (
        '2 chunks with the entry, the largest 0.01 kB;'
        ' lazy: node_modules/leaflet/dist/leaflet-src.js, src/bazis/ui/map/leaflet-map.tsx\n'
    )


def test_leaflet_imported_with_the_entry_fails(tmp_path, capsys):
    assert check(tmp_path, manifest(['src/bazis/ui/map/leaflet-map.tsx'])) == 1
    assert 'not lazily: node_modules/leaflet/dist/leaflet-src.js, src/bazis/ui/map/leaflet-map.tsx' in capsys.readouterr().err


@pytest.mark.parametrize('code', [
    'L.DomUtil.addClass(container, "leaflet-container");',
    'className: "recharts-wrapper"',
    'classNames[key] = `rdp-${key}`;',
    'const id = `DndDescribedBy-${instance}`;',
])
def test_a_lazy_library_bundled_into_a_chunk_of_the_entry_fails(tmp_path, capsys, code):
    # Leaflet, recharts, react-day-picker, @dnd-kit
    assert check(tmp_path, manifest([]), code) == 1
    assert 'not lazily: assets/vendor.js' in capsys.readouterr().err


def test_the_views_of_the_charts_the_dates_and_the_boards_are_lazy(tmp_path, capsys):
    views = ['src/bazis/ui/charts/chart-view.tsx', 'src/bazis/ui/date-picker/calendar-view.tsx',
             'src/bazis/ui/board-dnd/dnd-view.tsx']
    eager = manifest([])
    eager.update({it: {'file': f'assets/{Path(it).stem}.js'} for it in views})
    eager['_vendor.js']['imports'] = views
    assert check(tmp_path, eager) == 1
    assert f'not lazily: {", ".join(sorted(views))}' in capsys.readouterr().err


def test_a_chunk_of_the_entry_at_the_budget_passes(tmp_path, capsys):
    assert check(tmp_path, manifest([]), sizes={'assets/vendor.js': 400_000}) == 0
    assert '2 chunks with the entry, the largest 400.00 kB;' in capsys.readouterr().out


def test_a_chunk_of_the_entry_over_the_budget_fails(tmp_path, capsys):
    assert check(tmp_path, manifest([]), sizes={'assets/index.js': 400_001}) == 1
    assert capsys.readouterr().err == 'Loaded with the entry chunk, over 400 kB: assets/index.js (400.00 kB)\n'


def test_a_lazy_chunk_over_the_budget_passes(tmp_path):
    # Leaflet, loaded with the first map: the budget is that of what every page loads
    assert check(tmp_path, manifest([]), sizes={'assets/leaflet.js': 400_001}) == 0
