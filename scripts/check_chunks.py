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
Checks the build of a frontend (its `dist/`, built with `vite build --manifest`): the
entry chunk and the chunks it imports statically do not have what the components load
with the first map or file field shown (Leaflet, `leaflet-map.tsx`, `upload-field.tsx`), so
that the main chunk of a product does not carry them, and none of them is larger than
`BUDGET`, which leaves a product 100 kB of its own code under the limit of the warning of
Vite (500 kB; the npm libraries are chunks of their own, `manualChunks` of `vite.config.ts`
of the template). Run by the frontend job of CI on the frontend of every preset and by the
e2e job on that of the sample.
"""

import json
import sys
from pathlib import Path


#: the sources that only a dynamic import may load
LAZY = ('node_modules/leaflet/', '/ui/map/leaflet-map.tsx', '/ui/file-field/upload-field.tsx')
#: a text of the code of Leaflet, which may be bundled into a chunk without a key of its own
LEAFLET = 'leaflet-container'
#: the largest chunk loaded with the entry, in bytes (the kB of Vite are 1000 bytes)
BUDGET = 400_000


def static_sources(manifest: dict) -> set[str]:
    """
    The sources of the entry chunks and of the chunks they import statically, by their key in
    the manifest.
    """
    seen: set[str] = set()
    pending = [key for key, chunk in manifest.items() if chunk.get('isEntry')]
    while pending:
        key = pending.pop()
        if key not in seen:
            seen.add(key)
            pending.extend(manifest[key].get('imports', []))
    return seen


def main(dist: str) -> int:
    manifest = json.loads((Path(dist) / '.vite' / 'manifest.json').read_text(encoding='utf-8'))
    static = static_sources(manifest)
    eager = sorted(key for key in static if any(it in f'/{key}' for it in LAZY))
    eager += sorted(
        manifest[key]['file'] for key in static
        if LEAFLET in (Path(dist) / manifest[key]['file']).read_text(encoding='utf-8')
    )
    sizes = {manifest[key]['file']: (Path(dist) / manifest[key]['file']).stat().st_size for key in static}
    large = sorted(f'{file} ({size / 1000:.2f} kB)' for file, size in sizes.items() if size > BUDGET)
    if eager:
        print(f'Loaded with the entry chunk, not lazily: {", ".join(eager)}', file=sys.stderr)
    if large:
        print(f'Loaded with the entry chunk, over {BUDGET / 1000:.0f} kB: {", ".join(large)}', file=sys.stderr)
    if eager or large:
        return 1
    lazy = sorted(key for key in manifest if key not in static and any(it in f'/{key}' for it in LAZY))
    print(
        f'{len(static)} chunks with the entry, the largest {max(sizes.values()) / 1000:.2f} kB;'
        f' lazy: {", ".join(lazy) or "none"}'
    )
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
