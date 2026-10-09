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
The npm dependencies of the optional assets (`npm` of the registry: the map and Leaflet): the
template declares those of every component that `init` may copy, an asset that brings a
library of its own sets it in `package.json` of the frontend when it is copied (`add`) and
when it is updated, and records it in its entry of the lock. `package.json` stays a file of
the template: `update` merges it with the dependencies of the assets on both sides
(`with_dependencies`), so that they never conflict with the changes of the product or of the
template.
"""

import json
from collections.abc import Iterable, Mapping


#: the npm manifest of the frontend, a file of the template
PACKAGE_JSON = 'package.json'

#: `{section: {package: version}}`, the sections of package.json (`dependencies`,
#: `devDependencies`)
Dependencies = Mapping[str, Mapping[str, str]]


def with_dependencies(text: str, dependencies: Dependencies, previous: Dependencies | None = None) -> str:
    """
    The text of a package.json with these dependencies set, each section sorted by name as
    npm keeps it, written as npm writes it (two spaces, a final newline); those of
    `previous` that they no longer have are removed when their version is still the one
    recorded (the product's otherwise). Raises ValueError when the text is not a JSON object
    (a conflict of the last update not resolved).
    """
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError('package.json is not a JSON object')
    for section, packages in (previous or {}).items():
        for name, version in packages.items():
            if name not in dependencies.get(section, {}) and data.get(section, {}).get(name) == version:
                del data[section][name]
    for section, packages in dependencies.items():
        if packages:
            data[section] = dict(sorted({**data.get(section, {}), **packages}.items()))
    return json.dumps(data, indent=2, ensure_ascii=False) + '\n'


def merged(entries: Iterable[Dependencies]) -> dict[str, dict[str, str]]:
    """
    The dependencies of several assets (their `npm` in the registry or in the lock), by
    section.
    """
    result: dict[str, dict[str, str]] = {}
    for dependencies in entries:
        for section, packages in dependencies.items():
            result.setdefault(section, {}).update(packages)
    return result
