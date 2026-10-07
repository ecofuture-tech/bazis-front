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

import pytest

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


def test_the_registry_lists_the_helpers_of_the_end_to_end_tests():
    helpers = registry.load()['playwright']
    # next to e2e/generated/ of the frontend, which the generated tests import them from
    assert (helpers.kind, helpers.source, helpers.target, helpers.capabilities) == (
        registry.VENDORED, 'playwright/bazis', 'e2e/bazis', ()
    )
    assert sorted(helpers.files) == files_of(ASSETS / 'playwright' / 'bazis')


def test_the_required_capabilities_are_known():
    for asset in registry.load().values():
        assert set(asset.capabilities) <= set(CAPABILITIES), asset.name
        assert asset.wanted([*asset.capabilities, 'other'])
        assert asset.wanted([]) is not bool(asset.capabilities)


#: the files of the workspace of the components that only check them in this repository
UI_TOOLING = {'package.json', 'tsconfig.json', 'vitest.config.ts', 'README.md'}


def test_the_registry_lists_the_sources_of_the_components():
    assets = registry.load()
    components = [it for it in assets.values() if it.kind == registry.UI]
    listed = [f'{it.source.removeprefix("ui/")}/{name}' for it in components for name in it.files]
    assert sorted(listed) == [
        it for it in files_of(ASSETS / 'ui') if it not in UI_TOOLING and not it.startswith('test/')
    ]
    for asset in components:
        if asset.source == 'ui/shadcn':
            # a component of shadcn/ui, where its configuration (components.json) puts it
            assert (asset.target, asset.files) == ('src/components/ui', (f'{asset.name}.tsx',))
        else:
            assert (asset.source, asset.target) == (f'ui/{asset.name}', f'src/bazis/ui/{asset.name}')
        if asset.source == 'ui/shadcn' or asset.name == 'testing':
            continue
        # a component comes with its contract test, which runs with the support of `testing`
        assert {'index.ts', f'{asset.name}.contract.test.tsx'} <= set(asset.files), asset.name
        assert 'testing' in asset.assets, asset.name


def test_the_required_assets_exist():
    assets = registry.load()
    for asset in assets.values():
        assert set(asset.assets) <= set(assets) - {'template'}, asset.name
        # the assets of a package require its capabilities
        for required in asset.assets:
            assert set(assets[required].capabilities) <= set(asset.capabilities), asset.name
    # every asset after those it requires, each once
    order = [it.name for it in registry.resolve(assets, assets)]
    assert sorted(order) == sorted(assets)
    for index, name in enumerate(order):
        assert set(assets[name].assets) <= set(order[:index]), name


def test_the_components_of_init_need_no_capability():
    assets = registry.load()
    initial = [it.name for it in assets.values() if it.init]
    assert initial == ['state-panel', 'app-shell', 'login-form']
    for asset in registry.resolve(initial, assets):
        assert asset.kind in (registry.UI, registry.VENDORED) and not asset.capabilities, asset.name


def test_resolve_rejects_a_cycle():
    assets = {
        'a': registry.Asset('a', registry.UI, 'ui/a', 'src/a', (), assets=('b',)),
        'b': registry.Asset('b', registry.UI, 'ui/b', 'src/b', (), assets=('a',)),
    }
    with pytest.raises(ValueError, match='a -> b -> a'):
        registry.resolve(['a'], assets)


def test_the_registry_lists_every_file_of_the_template():
    template = registry.load()['template']
    assert (template.kind, template.target) == (registry.TEMPLATE, '')
    assert sorted(template.files) == files_of(ASSETS / 'template')


#: the notice of the MIT license of shadcn/ui, in the header of its components
SHADCN_LICENSE = '// MIT License\n//\n// Copyright (c) 2023 shadcn\n//\n// Permission is hereby granted'


def test_the_sources_start_with_the_license_header():
    assets = registry.load()
    for asset in assets.values():
        if asset.source == 'ui/shadcn':
            text = asset.read(asset.files[0]).decode('utf-8')
            head = text[:text.index('\n\n')]
            assert head.startswith(f'// The component {asset.name} of shadcn/ui'), asset.name
            assert SHADCN_LICENSE in head and 'IN THE\n// SOFTWARE.' in head, asset.name
        elif asset.kind in (registry.VENDORED, registry.UI):
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
