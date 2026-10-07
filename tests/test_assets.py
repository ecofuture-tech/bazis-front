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

from importlib.resources import files
from pathlib import Path

from bazis.contrib.front.capabilities import CAPABILITIES
from bazis.contrib.front.vendor import registry
from bazis.contrib.front.vendor.copy import stamp


def test_client_sources_are_package_data():
    src = files('bazis.contrib.front') / 'assets' / 'client' / 'src'
    assert {'index.ts', 'client.ts', 'filter.ts'} <= {it.name for it in src.iterdir()}


ASSETS = Path(str(registry.assets_dir()))
HEADER = '// Copyright 2026 EcoFuture Technology Services LLC and contributors'


def files_of(directory: Path) -> list[str]:
    return sorted(
        it.relative_to(directory).as_posix()
        for it in directory.rglob('*')
        if it.is_file() and not {'node_modules', 'dist'} & set(it.parts)
    )


def test_the_registry_lists_the_sources_of_the_client():
    client = registry.load()['client']
    assert (client.kind, client.source, client.target) == (
        registry.VENDORED, 'client/src', 'src/bazis/client'
    )
    assert sorted(client.files) == files_of(ASSETS / 'client' / 'src')


def test_the_registry_lists_the_sources_of_the_hooks():
    assets = registry.load()
    react, statusy = assets['react'], assets['react-statusy']
    assert (react.kind, react.source, react.target, react.capabilities) == (
        registry.VENDORED, 'react/src', 'src/bazis/react', ()
    )
    # the hooks of bazis-statusy, `@/bazis/react/statusy`, only for a product that has it
    assert (statusy.kind, statusy.source, statusy.target, statusy.capabilities) == (
        registry.VENDORED, 'react/src/statusy', 'src/bazis/react/statusy', ('statusy',)
    )
    listed = [*react.files, *(f'statusy/{name}' for name in statusy.files)]
    assert sorted(listed) == files_of(ASSETS / 'react' / 'src')


def test_the_required_capabilities_are_known():
    for asset in registry.load().values():
        assert set(asset.capabilities) <= set(CAPABILITIES), asset.name
        assert asset.wanted([*asset.capabilities, 'other'])
        assert asset.wanted([]) is not bool(asset.capabilities)


def test_the_registry_lists_every_file_of_the_template():
    template = registry.load()['template']
    assert (template.kind, template.target) == (registry.TEMPLATE, '')
    assert sorted(template.files) == files_of(ASSETS / 'template')


def test_the_sources_start_with_the_license_header():
    assets = registry.load()
    for asset in assets.values():
        if asset.kind == registry.VENDORED:
            for name in asset.files:
                assert asset.read(name).decode('utf-8').startswith(HEADER + '\n'), name
    for name in assets['template'].files:
        if name.endswith(('.ts', '.tsx', '.js', '.css', '.html')):
            head = assets['template'].read(name).decode('utf-8').splitlines()[:3]
            assert any('Copyright 2026 EcoFuture Technology Services LLC' in it for it in head), name


def test_the_stamp_follows_the_license_header():
    assert stamp('// license\n// header\n\nexport {};\n', 'client', '1.2.3') == (
        '// license\n// header\n// bazis-front 1.2.3 asset client\n\nexport {};\n'
    )
    assert stamp('export {};\n', 'client', '1.2.3') == (
        '// bazis-front 1.2.3 asset client\nexport {};\n'
    )
