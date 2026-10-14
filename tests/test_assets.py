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

import json
import re
from importlib.resources import files
from pathlib import Path

import pytest

from bazis.contrib.front.capabilities import CAPABILITIES
from bazis.contrib.front.spec.refs import LABEL_FIELDS
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
    # the hooks of bazis-uploadable, `@/bazis/react/uploadable`
    uploadable = assets['react-uploadable']
    assert (uploadable.kind, uploadable.source, uploadable.target, uploadable.capabilities) == (
        registry.VENDORED, 'react/src/uploadable', 'src/bazis/react/uploadable', ('uploadable',)
    )
    # the hooks of bazis-ws, bazis-notify, bazis-bg and bazis-async-background
    packages = {'ws': 'ws', 'notify': 'notify', 'bg': 'bg', 'async': 'async_background'}
    for directory, capability in packages.items():
        hooks = assets[f'react-{directory}']
        assert (hooks.kind, hooks.source, hooks.target, hooks.capabilities, hooks.assets) == (
            registry.VENDORED, f'react/src/{directory}', f'src/bazis/react/{directory}', (capability,),
            ('react',),
        )
    # the translation of the interface, `@/bazis/i18n`, in the workspace of the hooks (it
    # imports them: the language of the profile), for every product
    i18n = assets['i18n']
    assert (i18n.kind, i18n.source, i18n.target, i18n.capabilities, i18n.assets) == (
        registry.VENDORED, 'react/src/i18n', 'src/bazis/i18n', (), ('react',),
    )
    listed = [
        *react.files,
        *(f'i18n/{name}' for name in i18n.files),
        *(f'statusy/{name}' for name in statusy.files),
        *(f'uploadable/{name}' for name in uploadable.files),
        *(f'{directory}/{name}' for directory in packages for name in assets[f'react-{directory}'].files),
    ]
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


def test_the_labels_of_the_components_are_those_of_the_check_of_the_specs():
    """
    `LABELS` of the components (the label of an item, `itemLabel`) and `LABEL_FIELDS` of the
    specs (the search fields that S017 asks for) are the same groups in the same order.
    """
    source = (ASSETS / 'ui' / 'resource' / 'fields.ts').read_text(encoding='utf-8')
    labels = re.search(r'const LABELS: [^=]+= \[(.*?)\n\];', source, re.S).group(1)
    groups = [tuple(re.findall(r"'(\w+)'", group)) for group in re.findall(r'\[([^\]]*)\]', labels)]
    assert groups == list(LABEL_FIELDS)


#: an import of a component (`@/bazis/ui/<asset>`) or of a shadcn/ui component
#: (`@/components/ui/<asset>`), with the quotes of either
UI_IMPORT = re.compile(r"""(?:from|import) ["']@/(?:bazis|components)/ui/([^/"']+)""")


def test_the_components_require_the_components_they_import():
    """
    `requires.assets` of a component names the components and the shadcn/ui components that
    its files (its contract test too: it is copied into products) import, and no other.
    """
    assets = registry.load()
    for asset in assets.values():
        if asset.kind != registry.UI:
            continue
        imported = {
            name
            for file in asset.files
            for name in UI_IMPORT.findall(asset.read(file).decode('utf-8'))
            if name != asset.name
        }
        required = {name for name in asset.assets if assets[name].kind == registry.UI}
        assert imported == required, asset.name


#: a bare import of the components: `from 'leaflet'`, `import 'leaflet/dist/leaflet.css'`
IMPORT = re.compile(r"""(?:from|import) '((?:@[^/'.][^/']*/)?[^/'.@][^/']*)[^']*'""")


def test_the_npm_dependencies_of_the_components_are_declared():
    """
    A package that a component imports is a dependency of the template, or of the asset
    (`npm`, set by `add`: the map and Leaflet), with the version of the workspace of the
    components; an optional one is never in the template.
    """
    template = json.loads((ASSETS / 'template' / 'package.json').read_text(encoding='utf-8'))
    workspace = json.loads((ASSETS / 'ui' / 'package.json').read_text(encoding='utf-8'))['devDependencies']
    declared = {**template['dependencies'], **template['devDependencies']}
    for asset in registry.load().values():
        if asset.kind != registry.UI:
            continue
        own = {name: version for section in asset.npm.values() for name, version in section.items()}
        assert set(asset.npm) <= {'dependencies', 'devDependencies'}, asset.name
        for name, version in own.items():
            assert name not in declared, (asset.name, name)
            assert workspace[name] == version, (asset.name, name)
        for file in asset.files:
            for package in IMPORT.findall(asset.read(file).decode('utf-8')):
                if package in ('react', 'react-dom', 'vitest') or package in declared:
                    continue
                assert package in own or f'@types/{package}' in own, (asset.name, file, package)
    map_asset = registry.load()['map']
    assert map_asset.npm == {'dependencies': {'leaflet': '1.9.4'}, 'devDependencies': {'@types/leaflet': '1.9.22'}}


def test_the_template_has_one_vite():
    """
    Every package of the frontend runs on the vite of the template (`overrides`: a `$`
    reference to its own version). Without it npm 10 resolves the optional peers of vitest
    with the latest vite (8: `@vitejs/devtools` -> `@vitejs/devtools-vitest` -> `vitest@*`) and
    `npm install` fails with `Cannot read properties of null (reading 'edgesOut')` as soon as
    the vitest of the template is not the latest one.
    """
    template = json.loads((ASSETS / 'template' / 'package.json').read_text(encoding='utf-8'))
    assert template['overrides'] == {'vite': '$vite'}
    assert 'vite' in template['devDependencies']


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


def test_the_end_to_end_tests_of_the_template_test_only_their_frontend():
    """
    `npm run e2e` of a product tests the frontend that it starts itself, on E2E_PORT, and fails
    when the port is taken, so that a server of another app already there is never tested in
    its place; a running frontend is tested only when E2E_BASE_URL names it. The browser has
    a fixed time zone and language, so that the dates and the texts of the scenarios do not
    depend on the machine. The frontend job compiles and lints the config, the e2e job runs it.
    """
    config = (ASSETS / 'template' / 'playwright.config.ts').read_text(encoding='utf-8')
    assert 'reuseExistingServer: false' in config and 'reuseExistingServer: true' not in config
    assert "const port = process.env.E2E_PORT ?? '5173';" in config
    assert 'command: `npm run dev -- --port ${port} --strictPort`' in config
    assert 'process.env.E2E_BASE_URL ?? `http://localhost:${port}`' in config
    assert "timezoneId: 'UTC'" in config and 'locale: LANGUAGE' in config


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
