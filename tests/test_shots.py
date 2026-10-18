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
The screenshots of the screens (`bazis_front shots`): the text of `shots.ts` of the sample is
a fixture of the helpers (`assets/playwright/shots/`, type-checked against them; with
`BAZIS_FRONT_WRITE_FIXTURES=1` the test writes it), the shots of the specs, the file and the
lock in a frontend, `--check`, the report gathered from the results of a run (Playwright
replaced), the exit statuses, `front.W008` and `front.W009`. The checks of what a screen renders are those
of `assets/playwright/test/shots.spec.ts`.
"""

import json
import os
import re
import socket
from io import StringIO
from pathlib import Path

from django.core.checks import WARNING
from django.core.management import CommandError, call_command

import pytest
import yaml

from bazis.contrib.front import checks
from bazis.contrib.front.checks import check_shots
from bazis.contrib.front.spec import shots
from bazis.contrib.front.spec.validate import validate

from .support import read_lock


REPOSITORY = Path(__file__).resolve().parent.parent
PLAYWRIGHT = REPOSITORY / 'bazis' / 'contrib' / 'front' / 'assets' / 'playwright'
FIXTURE = PLAYWRIGHT / 'shots' / 'shots.ts'
GUIDE = REPOSITORY / 'bazis' / 'contrib' / 'front' / 'AGENTS.md'


def specs(root: Path):
    result = validate(root)
    assert not result.errors, [it.as_dict() for it in result.errors]
    return result.specs


def shoot(*args) -> str:
    out = StringIO()
    call_command('bazis_front', 'shots', *args, stdout=out, stderr=StringIO())
    return out.getvalue()


def edit(root: Path, name: str, change) -> None:
    path = root / 'spec' / name
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    change(data)
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding='utf-8')


def test_the_shots_of_the_sample_are_the_fixture_of_the_helpers():
    text = shots.render(specs(REPOSITORY / 'sample'))[shots.SHOTS_TS]
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        FIXTURE.parent.mkdir(exist_ok=True)
        FIXTURE.write_text(text, encoding='utf-8', newline='\n')
    assert FIXTURE.read_text(encoding='utf-8') == text


def test_the_shots_of_the_specs(root):
    plan, skipped = shots.plan(specs(root))
    every, first = shots.modes(specs(root)), ('light',)
    assert every == ('light', 'dark')
    assert [(it['screen'], it['variant'], it['role'], it['via'], it['modes']) for it in plan] == [
        ('draft-tasks', None, 'manager', None, every),
        # the screen as its other roles too, in the first color mode only
        ('draft-tasks', None, 'viewer', None, first),
        ('home', None, 'manager', None, every),
        ('home', None, 'viewer', None, first),
        ('task-board', None, 'manager', None, every),
        ('task-board', None, 'viewer', None, first),
        ('task-calendar', None, 'manager', None, every),
        ('task-calendar', None, 'viewer', None, first),
        # the screen of an item through a list that opens it: all the items, not the report
        # of the drafts (draft-tasks, first by its id), for each role
        ('task-card', None, 'manager', {'screen': 'task-list', 'part': None}, every),
        ('task-card', None, 'viewer', {'screen': 'task-list', 'part': None}, first),
        ('task-list', None, 'manager', None, every),
        ('task-list', None, 'viewer', None, first),
        # a list searched for nothing (it has a search), and with its create form open, as
        # its first role only; the drafts have neither
        ('task-list', 'empty', 'manager', None, every),
        ('task-list', 'form', 'manager', None, every),
    ]
    assert skipped == {}
    by_screen = {it['screen']: it for it in plan if it['variant'] is None and not it['also']}
    # the forms that create an item, which an empty state offers
    assert by_screen['home']['creates'] == ['create']
    assert by_screen['task-card']['creates'] == []

    # a screen of an item that no screen opens is not shot, and said so; the role of a
    # screen is the first of its roles
    (root / 'spec' / 'screens' / 'task-edit.yaml').write_text(yaml.safe_dump({
        'spec': 'bazis-screen/1', 'id': 'task-edit', 'route': '/tasks/:id/edit', 'roles': ['viewer'],
        'entity': 'task', 'primitive': 'form', 'form': {'mode': 'update', 'fields': ['title']},
        'states': ['loading', 'error', 'forbidden', 'invalid'],
    }), encoding='utf-8')
    edit(root, 'screens/task-list.yaml', lambda d: d.update(roles=['viewer', 'manager']))
    plan, skipped = shots.plan(specs(root))
    assert 'task-edit' not in [it['screen'] for it in plan]
    roles = {(it['screen'], it['variant'], it['also']): it['role'] for it in plan}
    assert (roles[('task-list', None, False)], roles[('task-list', None, True)]) == ('viewer', 'manager')
    # its create form open as the first of its roles that may create a task: not the viewer
    assert roles[('task-list', 'form', False)] == 'manager'
    assert skipped == {'task-edit': 'no list, board, calendar or dashboard of the specs opens its items'}
    # a list of no role that may create: no form open, and said so
    task_list = yaml.safe_load((root / 'spec' / 'screens' / 'task-list.yaml').read_text(encoding='utf-8'))
    # without an extension of its own
    del task_list['extend']
    (root / 'spec' / 'screens' / 'task-archive.yaml').write_text(yaml.safe_dump({
        **task_list, 'id': 'task-archive', 'route': '/archive', 'roles': ['viewer'],
    }), encoding='utf-8')
    plan, skipped = shots.plan(specs(root))
    assert [it['variant'] for it in plan if it['screen'] == 'task-archive'] == [None, 'empty']
    assert skipped['task-archive.form'] == 'no role of the screen may create the items of its forms'
    text = shots.render(specs(root))[shots.SHOTS_TS]
    assert '// Not shot: task-edit: no list, board, calendar or dashboard of the specs opens its items.\n' in text


def test_the_shots_of_an_item_through_a_dashboard(root):
    """
    A card that only the second part of a dashboard opens is reached from that part; the
    role of a card is the first of its roles that a screen opening it is for.
    """
    card = yaml.safe_load((root / 'spec' / 'screens' / 'task-card.yaml').read_text(encoding='utf-8'))
    (root / 'spec' / 'screens' / 'task-summary.yaml').write_text(yaml.safe_dump({
        **card, 'id': 'task-summary', 'route': '/tasks/:id/summary', 'roles': ['viewer', 'manager'],
        'actions': [],
    }), encoding='utf-8')

    def recent(home):
        home['dashboard']['recent'].append({
            'id': 'summaries', 'entity': 'task', 'columns': ['title'], 'sort': ['-dt_created'], 'limit': 5,
            'open': 'task-summary', 'label': 'Summaries',
        })
        home['roles'] = ['manager']

    edit(root, 'screens/home.yaml', recent)
    plan, skipped = shots.plan(specs(root))
    by_screen = {it['screen']: it for it in plan if it['variant'] is None and not it['also']}
    # the viewer is not a role of the home, the only screen that opens the summary: not shot
    # as the viewer
    assert [it['role'] for it in plan if it['screen'] == 'task-summary'] == ['manager']
    assert by_screen['task-summary']['role'] == 'manager'
    assert by_screen['task-summary']['via'] == {'screen': 'home', 'part': 'recent:summaries'}
    # the card of the tasks: the lists still open it
    assert by_screen['task-card']['via'] == {'screen': 'task-list', 'part': None}
    assert "via: { screen: 'home', part: 'recent:summaries' }" in shots.render(specs(root))[shots.SHOTS_TS]

    # a card of a role whose screens do not open it
    edit(root, 'screens/task-summary.yaml', lambda d: d.update(roles=['viewer']))
    plan, skipped = shots.plan(specs(root))
    assert 'task-summary' not in [it['screen'] for it in plan]
    assert skipped == {'task-summary': 'no list, board, calendar or dashboard of its roles opens its items'}


def test_the_text_of_the_shots(root):
    text = shots.render(specs(root))[shots.SHOTS_TS]
    assert text.startswith(
        '// Generated by `manage.py bazis_front shots` from spec/:\n'
        '// never edit it, change the specs and generate it again.\n\n'
        "import { test } from '@playwright/test';\n\n"
        "import { shoot } from '../bazis/shots';\n\n"
        '/** What the helpers of e2e/bazis/ read of the specs'
    )
    # every color mode of the theme, a test for each screen
    assert "test.describe('light', () => {\n  test.use({ colorScheme: 'light' });\n" in text
    assert (
        "  test('task-card', async ({ page }, info) => {\n"
        "    await shoot(page, PRODUCT, { screen: 'task-card', role: 'manager', mode: 'dark', via: { screen: "
        "'task-list', part: null }, creates: [], variant: null }, info);\n"
        '  });\n'
    ) in text
    # the variants of a list, named after it
    # another role, in the first color mode only
    assert (
        "  test('task-card as viewer', async ({ page }, info) => {\n"
        "    await shoot(page, PRODUCT, { screen: 'task-card', role: 'viewer', mode: 'light', via: { screen: "
        "'task-list', part: null }, creates: [], variant: null }, info);\n"
    ) in text
    assert "role: 'viewer', mode: 'dark'" not in text
    assert (
        "  test('task-list.empty', async ({ page }, info) => {\n"
        "    await shoot(page, PRODUCT, { screen: 'task-list', role: 'manager', mode: 'dark', via: null, creates: "
        "['create'], variant: 'empty' }, info);\n"
    ) in text

    # the one mode of the theme
    (root / 'spec' / 'design').mkdir(exist_ok=True)
    (root / 'spec' / 'design' / 'theme.yaml').write_text('spec: bazis-design/1\npreset: workspace\nmode: dark\n', encoding='utf-8')
    text = shots.render(specs(root))[shots.SHOTS_TS]
    assert "test.describe('dark'" in text and "test.describe('light'" not in text


@pytest.mark.django_db
def test_shots_writes_the_test_and_the_lock(root):
    frontend = root / 'frontend'
    out = shoot('--no-run')
    assert f'Generated {frontend / shots.SHOTS_TS}.' in out
    assert (frontend / shots.SHOTS_TS).read_text(encoding='utf-8') == shots.render(specs(root))[shots.SHOTS_TS]
    lock = read_lock(root)['shots']
    assert sorted(lock['generated']) == [shots.SHOTS_TS]
    assert 'spec/product.yaml' in lock['spec'] and 'spec/screens/task-card.yaml' in lock['spec']
    assert 'up to date' in shoot('--check')
    # generated, not taken: no report (as in CI, whose --check compares the generated file only)
    [warning] = check_shots(None)
    assert warning.id == 'front.W009' and warning.level == WARNING
    assert warning.msg == 'The screenshots were not taken: run `manage.py bazis_front shots`.'
    # a report that cannot be read is none
    (frontend / shots.OUTPUT_DIR).mkdir(parents=True)
    (frontend / shots.OUTPUT_DIR / shots.REPORT).write_text('{', encoding='utf-8')
    assert [it.msg for it in check_shots(None)] == [warning.msg]
    (frontend / shots.OUTPUT_DIR / shots.REPORT).write_text('{"errors": 0, "warnings": 0, "shots": []}', encoding='utf-8')
    assert check_shots(None) == []

    # a change of a screen: stale until it is generated again
    edit(root, 'screens/task-list.yaml', lambda d: d.update(route='/all-tasks'))
    with pytest.raises(CommandError) as error:
        shoot('--check')
    assert f'are stale: {shots.SHOTS_TS}' in str(error.value)
    assert 'The specs changed since it was generated: spec/screens/task-list.yaml.' in str(error.value)
    [warning] = check_shots(None)
    assert warning.id == 'front.W008' and checks.COMMANDS['front.W008'] == 'shots'
    # an edited file
    shoot('--no-run')
    (frontend / shots.SHOTS_TS).write_text('// edited\n', encoding='utf-8')
    with pytest.raises(CommandError, match='Edited after it was generated'):
        shoot('--check')


@pytest.mark.django_db
def test_shots_needs_specs_without_errors(root):
    edit(root, 'screens/task-list.yaml', lambda d: d['list']['columns'].append('rank'))
    with pytest.raises(CommandError, match='The specs have 1 errors'):
        shoot('--no-run')
    assert not (root / 'frontend' / shots.SHOTS_TS).exists()


def fake_playwright(monkeypatch, results: list[dict]) -> list:
    """
    Replaces Node and Playwright: the run writes these results, as `shoot` does.
    """
    runs = []

    def run(command, cwd, env, check):
        runs.append((command, Path(cwd), env['BAZIS_SHOTS_DIR'], env.get('E2E_PORT')))
        for result in results:
            shown = result['screen'] if result['variant'] is None else f'{result["screen"]}.{result["variant"]}'
            name = f'{shown}-{result["role"]}-{result["mode"]}-{result["width"]}'
            (Path(env['BAZIS_SHOTS_DIR']) / f'{name}.json').write_text(json.dumps(result), encoding='utf-8')

    monkeypatch.setattr(shots.shutil, 'which', lambda name: f'/usr/bin/{name}')
    monkeypatch.setattr(shots.subprocess, 'run', run)
    return runs


def result(
    screen: str, mode: str, width: int, *issues: tuple[str, str], variant: str | None = None, role: str = 'manager',
) -> dict:
    return {
        'screen': screen, 'role': role, 'mode': mode, 'width': width, 'variant': variant,
        'file': f'{screen}-{role}-{mode}-{width}.png',
        'issues': [
            {'code': code, 'severity': severity, 'selector': f'[data-bz="screen:{screen}"]', 'message': 'Wrong.'}
            for code, severity in issues
        ],
    }


def every_result(root: Path) -> list[dict]:
    plan, _ = shots.plan(specs(root))
    return [
        result(it['screen'], mode, width, variant=it['variant'], role=it['role'])
        for it in plan
        for mode in it['modes']
        for width in (1280, 390)
    ]


@pytest.mark.django_db
def test_shots_gathers_the_report(root, monkeypatch):
    frontend = root / 'frontend'
    output = frontend / shots.OUTPUT_DIR
    results = every_result(root)
    results[0] = result(results[0]['screen'], results[0]['mode'], 1280, ('V004', 'error'), ('V009', 'warning'))
    missing = results.pop()
    output.mkdir(parents=True)
    (output / 'old.png').write_bytes(b'')
    runs = fake_playwright(monkeypatch, results)

    with pytest.raises(CommandError) as error:
        shoot()
    assert error.value.returncode == 1
    [(command, cwd, directory, _port)] = runs
    assert command == ['/usr/bin/npx', '--no-install', 'playwright', 'test', '--config', shots.CONFIG]
    assert cwd == frontend and directory == str(output)
    # the screenshots of the previous run are deleted first
    assert not (output / 'old.png').exists()
    report = json.loads((output / shots.REPORT).read_text(encoding='utf-8'))
    assert (report['errors'], report['warnings']) == (2, 1)
    # by screen, its variants after it (none first), mode and width
    assert [(it['screen'], it['variant'] or '', it['mode'], it['width']) for it in report['shots']] == sorted(
        (it['screen'], it['variant'] or '', it['mode'], it['width']) for it in [*results, missing]
    )
    # the shot without a result: its test did not finish
    [not_shot] = [it for it in report['shots'] if it['file'] is None]
    assert [not_shot[key] for key in ('screen', 'variant', 'mode', 'width')] == [
        missing[key] for key in ('screen', 'variant', 'mode', 'width')
    ]
    assert not_shot['issues'][0]['code'] == 'V001'
    assert f'{len(results)} screenshots of {len(results) + 1}, 2 errors, 1 warnings' in str(error.value)
    # not stale: no command brings the screens up to date
    [warning] = check_shots(None)
    assert warning.id == 'front.W009' and 'has 2 errors' in warning.msg
    assert 'front.W009' not in checks.COMMANDS

    # a clean report
    fake_playwright(monkeypatch, every_result(root))
    out = shoot()
    assert '0 errors, 0 warnings' in out
    assert check_shots(None) == []


@pytest.mark.django_db
def test_shots_without_a_screenshot(root, monkeypatch):
    # nothing shot: no frontend, no backend or no browser
    fake_playwright(monkeypatch, [])
    with pytest.raises(CommandError, match='No screen was shot') as error:
        shoot()
    assert error.value.returncode == 2
    # no Node
    monkeypatch.setattr(shots.shutil, 'which', lambda name: None)
    with pytest.raises(CommandError, match='Node') as error:
        shoot()
    assert error.value.returncode == 2


@pytest.mark.django_db
def test_shots_take_a_free_port(root, monkeypatch):
    # the dev server of the shots takes a free port: the default one of the end-to-end tests is
    # that of the dev server of the developer, which the config never tests in its place
    monkeypatch.delenv('E2E_PORT', raising=False)
    monkeypatch.delenv('E2E_BASE_URL', raising=False)
    runs = fake_playwright(monkeypatch, every_result(root))
    shoot()
    [(_command, _cwd, _directory, port)] = runs
    with socket.socket() as probe:
        probe.bind(('localhost', int(port)))
    # the port of E2E_PORT, and none for a frontend already running
    for name, value in (('E2E_PORT', '5999'), ('E2E_BASE_URL', 'http://localhost:4000')):
        monkeypatch.setenv(name, value)
        runs = fake_playwright(monkeypatch, every_result(root))
        shoot()
        assert runs[0][3] == ('5999' if name == 'E2E_PORT' else None)
        monkeypatch.delenv(name)


def test_the_codes_of_the_shots_are_in_the_guide():
    source = (PLAYWRIGHT / 'bazis' / 'shots.ts').read_text(encoding='utf-8')
    codes = dict(re.findall(r"^  (V\d{3}): \['(error|warning)'", source, re.MULTILINE))
    assert codes and codes[shots.NOT_SHOT] == 'error'
    guide = GUIDE.read_text(encoding='utf-8')
    rows = dict(re.findall(r'^\| `(V\d{3})` \| (error|warning) \|', guide, re.MULTILINE))
    assert rows == codes
