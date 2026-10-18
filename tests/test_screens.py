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
The screens generated from the specs (`bazis_front screens`): the text of those of the
sample is a fixture (`tests/fixtures/screens/`, compiled, linted and formatted in the frontend
of the sample by the e2e job of the CI; with `BAZIS_FRONT_WRITE_FIXTURES=1` the test writes
it), the files and the lock in a
frontend with the components they import, `--check`, `front.W010`, the generated files edited
by hand, the deletion of the files of a screen that is no longer generated, the screens not
generated yet, and the parts of the specs that the sample does not have (the kitchen sink of
`tests/fixtures/kitchen-sink/`, which the frontend job of the CI builds too).
"""

import os
import shutil
from io import StringIO
from pathlib import Path

from django.core.management import CommandError, call_command

import pytest
import yaml

from bazis.contrib.front.checks import check_screens
from bazis.contrib.front.spec import screens
from bazis.contrib.front.spec.validate import validate
from bazis.contrib.front.vendor.lock import digest

from .support import SAMPLE_SPEC, read_lock, write_lock


REPOSITORY = Path(__file__).resolve().parent.parent
FIXTURES = Path(__file__).resolve().parent / 'fixtures' / 'screens'
KITCHEN_SINK = Path(__file__).resolve().parent / 'fixtures' / 'kitchen-sink'

DRAFTS = f'{screens.GENERATED_DIR}/draft-tasks.tsx'
CARD = f'{screens.GENERATED_DIR}/task-card.tsx'


def rendered(root: Path) -> dict[str, str]:
    result = validate(root)
    assert not result.errors, [it.as_dict() for it in result.errors]
    assert screens.unsupported(result.specs) == []
    return screens.render(result.specs)


def generate(*args) -> str:
    out = StringIO()
    call_command('bazis_front', 'screens', *args, stdout=out, stderr=StringIO())
    return out.getvalue()


def edit_screen(root: Path, screen_id: str, change) -> None:
    path = root / 'spec' / 'screens' / f'{screen_id}.yaml'
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    change(data)
    path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding='utf-8')


@pytest.fixture
def frontend(root, sample_app):
    """The frontend of the sample with the contract of its database: the components of the packages need it."""
    from bazis.contrib.front.contract.export import render

    (root / 'contract').mkdir()
    (root / 'contract' / 'contract.json').write_text(render(sample_app)['contract.json'], encoding='utf-8')
    return root / 'frontend'


def test_the_screens_of_the_sample_are_the_fixture():
    files = {
        path.removeprefix(f'{screens.GENERATED_DIR}/'): text for path, text in rendered(REPOSITORY / 'sample').items()
    }
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        shutil.rmtree(FIXTURES, ignore_errors=True)
        FIXTURES.mkdir()
        for name, text in files.items():
            (FIXTURES / name).write_text(text, encoding='utf-8', newline='\n')
    assert sorted(files) == sorted(it.name for it in FIXTURES.iterdir())
    for name, text in files.items():
        assert (FIXTURES / name).read_text(encoding='utf-8') == text, name


def test_the_texts_of_the_specs_are_the_generated_messages(tmp_path):
    """
    The texts of every spec in the dictionaries of the languages; a map without the default
    language gives it the text of the first language that the map has; a key of the
    dictionaries is the product's own; the screens and the navigation use them by their keys.
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    edit_screen(
        tmp_path, 'draft-tasks', lambda data: data.update(title={'ru': 'Черновики'}, description='tasks.drafts'),
    )
    files = rendered(tmp_path)
    messages = files[f'{screens.GENERATED_DIR}/messages.ts']
    assert "    'screens.draft-tasks.title': 'Черновики',\n" in messages.split('  ru: {')[0]
    assert 'tasks.drafts' not in messages
    assert "description={t('tasks.drafts')}" in files[DRAFTS]
    # the groups of the navigation are labelled by their titles
    assert "    'navigation.planning.title': 'Planning',\n" in messages
    assert "label: t('navigation.planning.title')," in files[f'{screens.GENERATED_DIR}/navigation.ts']


def test_the_parts_that_the_sample_does_not_have(tmp_path):
    """
    The kitchen sink: a generated list with its map, its create form, its bulk action and its
    status filter; a card without tabs (its history and its related list under its heading)
    with a create form in its header, an update form and a delete that describes itself; the
    tone of the rows; forms as pages; a board without drag and drop and with a badge; a
    calendar with its add and its tone; a dashboard of two entities; forms that show a screen
    without an item after them, whose code takes no saved item; a plain card, whose code
    uses no navigation, no translation and no item (the lint of the frontend job refuses them
    unused).
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    shutil.copytree(KITCHEN_SINK / 'screens', tmp_path / 'spec' / 'screens', dirs_exist_ok=True)

    def urgent(path):
        data = yaml.safe_load(path.read_text(encoding='utf-8'))
        data['entities'][0]['fields'].append({'id': 'urgent', 'type': 'boolean'})
        path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding='utf-8')

    urgent(tmp_path / 'spec' / 'product.yaml')
    edit_screen(tmp_path, 'task-list', lambda data: data['list'].update(
        highlight={'field': 'urgent', 'tone': 'warning', 'label': {'en': 'Urgent', 'ru': 'Срочно'}},
    ))
    edit_screen(tmp_path, 'task-flow', lambda data: data['board']['card'].update(badge='urgent'))
    edit_screen(tmp_path, 'task-schedule', lambda data: data['calendar'].update(tone={'field': 'urgent', 'tone': 'danger'}))
    files = rendered(tmp_path)
    task_list = files[f'{screens.GENERATED_DIR}/task-list.tsx']
    assert '        {...createForm}\n' in task_list
    assert "{ field: 'status', options: statusOptions(TASK.type, language) }," in task_list
    assert "run: (item) => transit.mutateAsync({ id: item, transit: 'start' })," in task_list
    assert "rowTone={(row) => (fieldValue(row, 'urgent') === true ? 'warning' : undefined)}" in task_list
    assert (
        '        rowToneLabel={(row) =>\n'
        "          fieldValue(row, 'urgent') === true ? t('screens.task-list.list.highlight.label') : undefined\n"
        '        }\n'
    ) in task_list
    # the map beside the list: the open task selected, a marker opening it
    assert (
        '      <ResourceMap\n        path={TASK.path}\n        entity="task"\n        field="location"\n'
        '        selected={id}\n'
    ) in task_list

    summary = files[f'{screens.GENERATED_DIR}/task-summary.tsx']
    assert "description: t('screens.task-summary.actions.delete.description')," in summary
    assert '      {deleteAction.confirm}\n' in summary
    # the children of the card, given its item: no tabs
    assert '        {(item) => (\n          <>\n            <TransitBar path={TASK.path} id={id} />\n' in summary
    # an "add here" of `when: always` is not gated by the permission to change the item
    assert "add={{ id: 'add-step', label: t('form.create'), fields: ['title'] }}" in summary
    assert '      actions={\n        <ScreenAction\n' in summary
    # the update form, an action of the card shown to whom may change the item
    assert "{ id: 'edit', label: t('card.edit'), permission: 'change', onClick: editForm.onOpen }," in summary
    assert '      <UpdateFormAction\n        {...editForm}\n        path={TASK.path}\n        id={id}\n' in summary
    # a card under the list whose route its route continues; the others at their own
    routes = files[f'{screens.GENERATED_DIR}/routes.tsx']
    assert '      <Route path="/tasks/:id" element={<TaskCardScreen />} />\n    </Route>\n' in routes
    assert '    <Route path="/tasks/:id/summary" element={<TaskSummaryScreen />} />\n' in routes

    # the forms as pages: a create, then the card of the item; an update of the item of the route
    new = files[f'{screens.GENERATED_DIR}/task-new.tsx']
    assert "onSaved={(saved) => void navigate(routeTo('task-card', saved.data.id))}" in new
    edit = files[f'{screens.GENERATED_DIR}/task-edit.tsx']
    assert "  const { id = '' } = useParams();\n" in edit
    assert '      <ResourceForm\n        path={TASK.path}\n        id={id}\n' in edit
    assert 'fields=' not in edit

    # a board without `move` is not in `BoardDnd`; its badge, some of its columns
    flow = files[f'{screens.GENERATED_DIR}/task-flow.tsx']
    assert 'BoardDnd' not in flow and '        move\n' not in flow
    assert "        columns={['draft', 'in_progress']}\n        title=\"title\"\n        badge=\"urgent\"\n" in flow
    assert "requires={{ path: TASK.path, can: 'add' }}" in flow
    assert "onSaved={() => void navigate(routeTo('task-flow'))}" in flow

    # the add of a calendar fills its field with the selected day
    schedule = files[f'{screens.GENERATED_DIR}/task-schedule.tsx']
    assert (
        '          onAdd: (day) => {\n            addForm.onOpenWith({ dt_created: day });\n          },\n'
    ) in schedule
    assert "        tone={{ field: 'urgent', tone: 'danger' }}\n" in schedule
    assert '      <CreateFormAction\n        {...addForm}\n' in schedule

    # a dashboard of two entities: a tile of two conditions, a chart by a date, the forms of both
    overview = files[f'{screens.GENERATED_DIR}/overview.tsx']
    assert "filter: Filter.and(Filter.where('status', 'in_progress'), Filter.where('title', 'Review the plan'))," in overview
    assert "label: t('tiles.started_reviews')," in overview
    assert '        <TimeChart\n' in overview and 'StatusChart' not in overview
    assert "requires={{ path: STEP.path, can: 'add' }}" in overview
    assert "onSaved={() => void navigate(routeTo('home'))}" in overview

    # a plain card: no workflow, no texts, no parent, a related list without history and add
    user = files[f'{screens.GENERATED_DIR}/user-card.tsx']
    assert 'useNavigate' not in user and 'useLanguage' not in user
    assert '    <Screen id="user-card">\n' in user
    assert '        {() => (\n          <RelatedList\n' in user


def test_the_routes_of_the_home(tmp_path):
    """
    Without a screen at `/`, `/` leads to the first link of the navigation; a list at `/`
    whose cards are at `/:id` is the layout route `/` of its cards, never an index route (it
    has no children).
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    edit_screen(tmp_path, 'home', lambda data: data.update(route='/home'))
    routes = rendered(tmp_path)[f'{screens.GENERATED_DIR}/routes.tsx']
    assert "import { Navigate, Route } from 'react-router';\n" in routes
    assert '    <Route index element={<Navigate to="/home" replace />} />\n' in routes

    edit_screen(tmp_path, 'task-list', lambda data: data.update(route='/'))
    edit_screen(tmp_path, 'task-card', lambda data: data.update(route='/:id'))
    routes = rendered(tmp_path)[f'{screens.GENERATED_DIR}/routes.tsx']
    assert 'Navigate' not in routes and ' index' not in routes
    assert '    <Route path="/" element={<ListCardLayout list={<TaskListScreen />} />}>\n' in routes
    assert '      <Route path="/:id" element={<TaskCardScreen />} />\n' in routes


@pytest.mark.django_db
def test_screens_generates_the_screens_with_their_components(frontend, root):
    # none generated yet: the template needs them
    assert [it.msg for it in check_screens(None)] == [screens.NEEDS_SCREENS]
    lock = read_lock(root)
    assert 'resource-list' not in lock['assets']
    out = generate()
    files = rendered(root)
    assert 'Added the components that the screens import: ' in out
    assert f'Generated the screens of {frontend} in {screens.GENERATED_DIR}.' in out
    for path, text in files.items():
        assert (frontend / path).read_text(encoding='utf-8') == text, path
    lock = read_lock(root)
    assert set(screens.assets(files)) <= set(lock['assets'])
    specs = [f'spec/screens/{it.name}' for it in (root / 'spec' / 'screens').iterdir()]
    assert sorted(lock['screens']['spec']) == sorted(['spec/product.yaml', 'spec/design/theme.yaml', *specs])
    assert lock['screens']['generated'] == {path: digest(text.encode('utf-8')) for path, text in files.items()}
    assert 'up to date' in generate('--check')
    assert check_screens(None) == []

    # a component that they import removed from the frontend
    del lock['assets']['transit-bar']
    write_lock(root, lock)
    with pytest.raises(CommandError, match='The components that they import are not in the frontend: transit-bar.'):
        generate('--check')
    assert 'transit-bar' in check_screens(None)[0].msg


@pytest.mark.django_db
def test_a_change_of_the_specs_makes_the_screens_stale(frontend, root):
    generate()
    edit_screen(root, 'draft-tasks', lambda data: data['list'].update(columns=['title']))
    with pytest.raises(CommandError, match=r'(?s)are stale: src/screens/generated/draft-tasks.tsx\..*'
                       r'The specs changed since they were generated: spec/screens/draft-tasks.yaml'):
        generate('--check')
    [warning] = check_screens(None)
    assert warning.id == 'front.W010' and 'draft-tasks.tsx' in warning.msg
    generate()
    assert "columns={['title']}" in (frontend / DRAFTS).read_text(encoding='utf-8')
    assert check_screens(None) == []


@pytest.mark.django_db
def test_an_edited_screen_is_overwritten_with_force_only(frontend, root):
    generate()
    card = frontend / CARD
    edited = card.read_text(encoding='utf-8') + '// mine\n'
    card.write_text(edited, encoding='utf-8')
    with pytest.raises(CommandError, match='Edited after they were generated'):
        generate('--check')
    assert 'Edited after they were generated: src/screens/generated/task-card.tsx.' in check_screens(None)[0].msg
    refused = 'Edited after they were generated: src/screens/generated/task-card.tsx. `bazis_front screens` does not'
    with pytest.raises(CommandError, match=refused):
        generate()
    assert card.read_text(encoding='utf-8') == edited
    # an edit that the specs would make anyway is not one
    edit_screen(root, 'task-card', lambda data: data['card']['related'][0].update(columns=['title']))
    expected = rendered(root)[CARD]
    card.write_text(expected, encoding='utf-8')
    generate()
    assert card.read_text(encoding='utf-8') == expected

    card.write_text(edited, encoding='utf-8')
    # an option by its full name only: an abbreviation overwrites nothing
    for command, option in (('screens', '--forc'), ('e2e', '--chec'), ('shots', '--no-r')):
        with pytest.raises(CommandError, match=f'unrecognized arguments: {option}$'):
            call_command('bazis_front', command, option, stdout=StringIO(), stderr=StringIO())
    assert card.read_text(encoding='utf-8') == edited
    generate('--force')
    assert card.read_text(encoding='utf-8') == expected
    assert check_screens(None) == []


@pytest.mark.django_db
def test_the_files_of_a_screen_no_longer_generated_are_deleted(frontend, root):
    generate()
    # a file of the lock outside src/screens/generated/ is never deleted
    lock = read_lock(root)
    lock['screens']['generated']['src/app/router.tsx'] = 'sha256:0'
    write_lock(root, lock)
    (frontend / 'src' / 'screens' / 'draft-tasks').mkdir()
    code = frontend / 'src' / 'screens' / 'draft-tasks' / 'index.tsx'
    code.write_text('export function DraftTasksScreen() {}\n', encoding='utf-8')
    edit_screen(root, 'draft-tasks', lambda data: data.update(custom=True))
    with pytest.raises(CommandError, match=r'draft-tasks.tsx \(of a screen that is no longer generated\)'):
        generate('--check')
    out = generate()
    assert f'Deleted {DRAFTS}: its screen is no longer generated.' in out
    assert not (frontend / DRAFTS).exists()
    assert (frontend / 'src' / 'app' / 'router.tsx').is_file()
    routes = (frontend / f'{screens.GENERATED_DIR}/routes.tsx').read_text(encoding='utf-8')
    assert "lazyScreen(() => import('@/screens/draft-tasks')" in routes
    assert DRAFTS not in read_lock(root)['screens']['generated']


@pytest.mark.django_db
def test_a_screen_that_is_not_generated_must_be_custom(frontend, root):
    """An extension is not generated yet; an update form must have the item in its route."""
    generate()
    edit_screen(root, 'task-board', lambda data: data.update(extend=True))
    (frontend / 'src' / 'screens' / 'task-board').mkdir()
    (frontend / 'src' / 'screens' / 'task-board' / 'extend.tsx').write_text(
        'export const extension = {};\n', encoding='utf-8',
    )
    before = {it: it.read_bytes() for it in (frontend / screens.GENERATED_DIR).iterdir()}
    message = (
        'The screen `task-board` has `extend`, which `bazis_front screens` does not generate yet: declare it '
        '`custom: true`'
    )
    with pytest.raises(CommandError, match=message):
        generate()
    assert {it: it.read_bytes() for it in (frontend / screens.GENERATED_DIR).iterdir()} == before
    assert check_screens(None)[0].msg.startswith(message)

    edit_screen(root, 'task-board', lambda data: data.pop('extend'))
    (root / 'spec' / 'screens' / 'task-edit.yaml').write_text(yaml.safe_dump({
        'spec': 'bazis-screen/1', 'id': 'task-edit', 'route': '/edit', 'entity': 'task', 'primitive': 'form',
        'form': {'mode': 'update'}, 'states': ['loading', 'error', 'forbidden', 'invalid'],
    }), encoding='utf-8')
    with pytest.raises(CommandError, match=r'The screen `task-edit` updates an item, but its route `/edit` does not '):
        generate()


def test_the_screens_need_a_frontend(tmp_path, settings):
    settings.BASE_DIR = str(tmp_path)
    with pytest.raises(CommandError, match='init'):
        generate()
