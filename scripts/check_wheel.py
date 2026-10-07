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
Checks the wheel in the given directory: it has the sources of the assets and none of
their checks (tests, fixtures, scripts, Node config, node_modules, dist).
"""

import sys
import zipfile
from pathlib import Path


wheel = next(Path(sys.argv[1]).glob('bazis_front-*.whl'))
names = zipfile.ZipFile(wheel).namelist()
assets = [it for it in names if '/assets/' in it]
assert 'bazis/contrib/front/assets/client/src/index.ts' in names, 'the client sources are missing'
unexpected = [
    it for it in assets
    if any(part in it for part in ('/test/', '/scripts/', '/node_modules/', '/dist/'))
    or it.endswith(('/package.json', '/tsconfig.json'))
]
assert not unexpected, f'the wheel has the checks of the assets: {unexpected}'
print(f'{wheel.name}: {len(assets)} asset files')
