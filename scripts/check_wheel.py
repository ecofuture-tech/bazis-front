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
Checks the wheel in the given directory against the registry of the assets
(`assets/registry.json`): it has every file that the registry copies into a product, and
of the assets nothing else than the registry and the READMEs of the assets (no tests,
fixtures, scripts, Node config, node_modules or dist of their checks); and the JSON Schemas
and the starters of the specs (run from the root of the repository).
"""

import json
import sys
import zipfile
from pathlib import Path


ASSETS = 'bazis/contrib/front/assets'
SPEC = 'bazis/contrib/front/spec'

wheel = next(Path(sys.argv[1]).glob('bazis_front-*.whl'))
archive = zipfile.ZipFile(wheel)
names = set(archive.namelist())
registry = json.loads(archive.read(f'{ASSETS}/registry.json'))

expected = {
    f'{ASSETS}/{asset["source"]}/{name}' for asset in registry['assets'] for name in asset['files']
}
assert expected, 'the registry lists no files'
missing = sorted(expected - names)
assert not missing, f'the wheel misses files of the registry: {missing}'

allowed = expected | {f'{ASSETS}/registry.json'} | {
    f'{ASSETS}/{asset["name"]}/README.md' for asset in registry['assets']
}
unexpected = sorted(it for it in names if it.startswith(f'{ASSETS}/') and it not in allowed)
assert not unexpected, f'the wheel has asset files outside the registry: {unexpected}'

# the JSON Schemas and the starters of the specs, read by `check` and copied by `init`
specs = {
    it.as_posix() for it in Path(SPEC).rglob('*') if it.suffix in ('.json', '.yaml')
}
assert specs, 'no JSON Schemas or starters of the specs'
missing = sorted(specs - names)
assert not missing, f'the wheel misses files of the specs: {missing}'
print(f'{wheel.name}: {len(expected)} asset files of the registry, {len(specs)} files of the specs')
