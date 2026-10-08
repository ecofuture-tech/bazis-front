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
import shutil
import subprocess
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import override_settings

import pytest

from bazis.contrib.front import __version__, capabilities
from bazis.contrib.front.spec import create as spec_create
from bazis.contrib.front.spec import theme
from bazis.contrib.front.spec.validate import schema_files
from bazis.contrib.front.vendor import copy, registry
from bazis.contrib.front.vendor.lock import digest


#: the components that `init` copies, with those they require
INIT_COMPONENTS = [
    'state-panel', 'app-shell', 'login-form', 'testing', 'button', 'card', 'input', 'label',
    'sheet', 'skeleton',
]


@pytest.fixture
def product(tmp_path):
    with override_settings(BASE_DIR=str(tmp_path)):
        yield tmp_path


def init(*args):
    out, err = StringIO(), StringIO()
    call_command('bazis_front', 'init', *args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


@pytest.fixture
def npm(monkeypatch):
    """
    Node on the PATH whose `npm install` succeeds; the calls are recorded.
    """
    calls = []

    def run(args, cwd, **kwargs):
        calls.append((args, cwd))
        return subprocess.CompletedProcess(args, getattr(run, 'returncode', 0))

    monkeypatch.setattr(shutil, 'which', lambda name: f'/node/bin/{name}')
    monkeypatch.setattr(subprocess, 'run', run)
    run.calls = calls
    return run


def test_init_creates_the_frontend(product):
    out, _ = init('--no-node')

    frontend = product / 'frontend'
    assert sorted(it.name for it in product.iterdir()) == ['frontend', 'spec']
    assert 'Run `npm install`' in out and 'bazis_front contract' in out
    assets = registry.load()
    template = assets['template']
    for name in template.files:
        assert (frontend / name).read_bytes() == template.read(name), name
    assert (frontend / 'AGENTS.md').read_text(encoding='utf-8').startswith('# Frontend')

    lock = json.loads((frontend / 'bazis-front.lock.json').read_text(encoding='utf-8'))
    # the sample has bazis-statusy and bazis-uploadable: their hooks are copied; the helpers
    # of the end-to-end tests; and the components marked `init` with the components and the
    # shadcn/ui components they require
    vendored = ['client', 'react', 'react-statusy', 'react-uploadable', 'playwright', *INIT_COMPONENTS]
    files = {name: lock['assets'][name].pop('files') for name in vendored}
    # the theme of the starters of the design
    design = lock.pop('design')
    assert lock == {
        'lock': 1,
        'bazis_front': __version__,
        'contract': {},
        'generated': {},
        'assets': {name: {'version': __version__} for name in [*vendored, 'template']},
    }
    assert sorted(design['spec']) == ['spec/design/theme.yaml', 'spec/design/tokens.json']
    assert sorted(design['generated']) == [theme.THEME_CSS, theme.THEME_TS]
    for path, value in design['generated'].items():
        assert digest((frontend / path).read_bytes()) == value
    for asset in (assets[name] for name in vendored):
        assert sorted(files[asset.name]) == sorted(asset.target_path(it) for it in asset.files)
        for name in asset.files:
            copied = (frontend / asset.target_path(name)).read_bytes()
            lines = copied.decode('utf-8').splitlines()
            # the stamp follows the license header (the comment lines the file starts with:
            # 13 of Apache-2.0, more of the MIT license of shadcn/ui)
            source = asset.read(name).decode('utf-8').splitlines()
            header = next(i for i, line in enumerate(source) if not line.startswith('//'))
            assert header >= 13
            assert lines[header] == f'// bazis-front {__version__} asset {asset.name}'
            assert lines[:header] + lines[header + 1:] == source
            # the pristine copy for the merge of the next version, hashed in the lock
            base = frontend / '.bazis' / 'base' / f'{asset.name}@{__version__}' / name
            assert base.read_bytes() == copied
            assert files[asset.name][asset.target_path(name)] == digest(copied)
    assert (frontend / 'src' / 'bazis' / 'react' / 'statusy' / 'index.ts').is_file()
    assert (frontend / 'src' / 'bazis' / 'react' / 'uploadable' / 'upload.ts').is_file()
    assert (frontend / 'src' / 'bazis' / 'ui' / 'login-form' / 'login-form.contract.test.tsx').is_file()
    assert (frontend / 'src' / 'components' / 'ui' / 'button.tsx').is_file()
    assert (frontend / 'e2e' / 'bazis' / 'index.ts').is_file()
    assert (frontend / 'e2e' / 'custom' / 'README.md').is_file()
    # only the theme is generated: the contract needs the database
    assert sorted(it.name for it in (frontend / 'src' / 'bazis' / 'generated').iterdir()) == ['theme.css', 'theme.ts']
    assert 'Generated the theme' in out
    assert not (frontend / 'e2e' / 'generated').exists()


def test_init_copies_the_hooks_of_the_installed_packages(product, monkeypatch):
    # a product without bazis-statusy and bazis-uploadable
    monkeypatch.setattr(capabilities, 'enabled', lambda: ['authing', 'permit', 'users'])
    init('--no-node')

    frontend = product / 'frontend'
    lock = json.loads((frontend / 'bazis-front.lock.json').read_text(encoding='utf-8'))
    assert sorted(lock['assets']) == sorted(['client', 'react', 'playwright', 'template', *INIT_COMPONENTS])
    assert (frontend / 'src' / 'bazis' / 'react' / 'index.ts').is_file()
    assert not (frontend / 'src' / 'bazis' / 'react' / 'statusy').exists()
    assert not (frontend / 'src' / 'bazis' / 'react' / 'uploadable').exists()
    assert sorted(it.name for it in (frontend / '.bazis' / 'base').iterdir()) == sorted(
        f'{name}@{__version__}' for name in ['client', 'react', 'playwright', *INIT_COMPONENTS]
    )


def test_init_creates_the_specs(product):
    out, _ = init('--no-node')

    spec = product / 'spec'
    assert 'Created the specs' in out and 'bazis_front check' in out
    assert sorted(it.relative_to(spec).as_posix() for it in spec.rglob('*') if it.is_file()) == sorted(
        [*(f'schema/{name}' for name in schema_files()), *spec_create.STARTERS]
    )
    for name, source in schema_files().items():
        assert (spec / 'schema' / name).read_bytes() == source.read_bytes()
    product_yaml = (spec / 'product.yaml').read_text(encoding='utf-8')
    assert product_yaml.startswith('# yaml-language-server: $schema=./schema/product.schema.json\n')
    theme = (spec / 'design' / 'theme.yaml').read_text(encoding='utf-8')
    assert theme.startswith('# yaml-language-server: $schema=../schema/design.schema.json\n')
    tokens = json.loads((spec / 'design' / 'tokens.json').read_text(encoding='utf-8'))
    assert tokens['$schema'] == '../schema/tokens.schema.json'
    # no starters of screens: the agent writes them
    assert not (spec / 'screens').exists()


def test_init_with_the_preset_portal(product):
    init('--no-node', '--preset', 'portal')

    spec = product / 'spec'
    starters = spec_create.files(spec_create.__package__) / 'starters' / 'design' / 'portal'
    for name in ('theme.yaml', 'tokens.json'):
        assert (spec / 'design' / name).read_bytes() == (starters / name).read_bytes()
    text = (product / 'frontend' / theme.THEME_TS).read_text(encoding='utf-8')
    assert 'preset: "portal"' in text and 'navigation: "topbar"' in text


def test_init_with_a_design_with_errors(product):
    (product / 'spec' / 'design').mkdir(parents=True)
    (product / 'spec' / 'design' / 'theme.yaml').write_text('spec: bazis-design/1\npreset: admin\n', encoding='utf-8')

    out, err = init('--no-node')
    # the frontend is created, the theme is not: `design` generates it once the design is fixed
    assert 'D002' in out
    assert 'bazis_front design' in err
    assert (product / 'frontend' / 'package.json').is_file()
    assert not (product / 'frontend' / theme.THEME_CSS).exists()


def test_init_keeps_the_specs(product):
    (product / 'spec').mkdir()
    (product / 'spec' / 'product.yaml').write_text('mine', encoding='utf-8')

    out, _ = init('--no-node')
    assert 'spec exists: it is kept as it is' in out
    assert [it.name for it in (product / 'spec').iterdir()] == ['product.yaml']
    assert (product / 'frontend' / 'package.json').is_file()


def test_init_never_overwrites_a_frontend(product):
    (product / 'frontend').mkdir()
    (product / 'frontend' / 'main.ts').write_text('mine', encoding='utf-8')

    with pytest.raises(CommandError, match='frontend already exists'):
        init('--no-node')
    assert [it.name for it in (product / 'frontend').iterdir()] == ['main.ts']
    assert not (product / 'spec').exists()


def test_a_failed_init_leaves_nothing(product, monkeypatch):
    def fail(*args):
        raise OSError('disk full')

    monkeypatch.setattr(copy, 'copy_vendored', fail)
    with pytest.raises(OSError, match='disk full'):
        init('--no-node')
    # the specs are created first: init runs again and keeps them
    assert [it.name for it in product.iterdir()] == ['spec']

    monkeypatch.setattr(spec_create, 'schema_files', fail)
    (product / 'spec').rename(product / 'kept')
    with pytest.raises(OSError, match='disk full'):
        init('--no-node')
    assert [it.name for it in product.iterdir()] == ['kept']


def test_init_installs_the_dependencies(product, npm):
    init()
    assert npm.calls == [(['/node/bin/npm', 'install'], product / 'frontend')]


def test_init_reports_a_failed_install(product, npm):
    npm.returncode = 1
    with pytest.raises(CommandError, match='`npm install` failed'):
        init()
    # the frontend is created: the install can be run again
    assert (product / 'frontend' / 'package.json').is_file()


def test_init_without_node(product, monkeypatch):
    monkeypatch.setattr(shutil, 'which', lambda name: None)

    _, err = init()
    assert 'Node (npm) is not found' in err
    assert (product / 'frontend' / 'bazis-front.lock.json').is_file()
