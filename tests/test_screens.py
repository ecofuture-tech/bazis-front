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
by hand, the deletion of the files of a screen that is no longer generated, the extended and
the custom screens, and the parts of the specs that the sample does not have (the kitchen sink
of `tests/fixtures/kitchen-sink/` with the code of its screens, which the frontend job of the
CI builds too).
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


def test_the_title_of_an_entity_is_a_text_of_the_specs(tmp_path):
    """
    `title` of an entity is a text like the others: `ENTITIES.<id>.title` is the key of its text, a
    text in each language or in words is a message under the key of its place, a key of the
    dictionaries is the product's own.
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    path = tmp_path / 'spec' / 'product.yaml'
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    data['entities'][1]['title'] = 'users.title'
    data['entities'][2]['title'] = 'Step'
    path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding='utf-8')

    files = rendered(tmp_path)
    entities = files[f'{screens.GENERATED_DIR}/entities.ts']
    messages = files[f'{screens.GENERATED_DIR}/messages.ts']
    assert "title: 'entities.task.title'," in entities
    assert "    'entities.task.title': 'Task',\n" in messages
    assert "    'entities.task.title': 'Задача',\n" in messages
    assert "title: 'users.title'," in entities and 'users.title' not in messages
    assert "title: 'entities.step.title'," in entities
    assert "    'entities.step.title': 'Step',\n" in messages.split('  ru: {')[0]


def test_a_link_of_the_navigation_is_labelled_by_its_label_else_by_the_title_of_its_screen(tmp_path):
    """
    A link with a `label` (shorter than the title of its screen) is labelled by it, a text of
    the generated messages by the screen of the link; the others by the titles of their screens.
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    path = tmp_path / 'spec' / 'product.yaml'
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    data['navigation'][0]['label'] = {'en': 'Start', 'ru': 'Начало'}
    data['navigation'][1]['items'][1]['label'] = 'tasks.drafts'
    path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding='utf-8')

    files = rendered(tmp_path)
    navigation = files[f'{screens.GENERATED_DIR}/navigation.ts']
    messages = files[f'{screens.GENERATED_DIR}/messages.ts']
    assert "label: t('navigation.home.label')," in navigation
    assert "    'navigation.home.label': 'Start',\n" in messages
    assert "    'navigation.home.label': 'Начало',\n" in messages
    # a key of the dictionaries is the product's own
    assert "label: t('tasks.drafts')," in navigation
    assert 'tasks.drafts' not in messages
    assert "label: t('screens.task-list.title')," in navigation


def test_the_confirmation_of_a_deletion_is_titled_by_its_title(tmp_path):
    """
    The confirmation of a deletion is titled by `title` of the action, a question, and its
    button by its label; without a title, by the default question of the components.
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    card = rendered(tmp_path)[f'{screens.GENERATED_DIR}/task-card.tsx']
    assert "label: t('screens.task-card.actions.delete.label')," in card
    assert "title: t('screens.task-card.actions.delete.title')," in card

    edit_screen(tmp_path, 'task-card', lambda data: data['actions'][0].pop('title'))
    card = rendered(tmp_path)[f'{screens.GENERATED_DIR}/task-card.tsx']
    assert 'actions.delete.title' not in card


def kitchen_sink(root: Path) -> None:
    """The specs of the sample and of the kitchen sink in a product root."""
    shutil.copytree(SAMPLE_SPEC, root / 'spec')
    shutil.copytree(KITCHEN_SINK / 'screens', root / 'spec' / 'screens', dirs_exist_ok=True)


def test_the_parts_that_the_sample_does_not_have(tmp_path):
    """
    The kitchen sink: a list with its map, its create form, a custom action of the route set,
    its bulk action and its status filter; a card without tabs (its transits under its
    heading, its related list and its history under its sections) with a create form in its
    header, an update form, a delete that describes itself and a custom action; the tone of
    the rows; forms as pages; a board without drag and drop, with a badge and its own empty
    text; a calendar with its add and its tone; a dashboard of two entities, a tile with its
    own icon; forms that show a screen without an item after them, whose code takes no saved
    item; a plain card, whose code uses no navigation, no translation and no item (the lint of
    the frontend job refuses them unused).
    """
    kitchen_sink(tmp_path)

    def urgent(path):
        data = yaml.safe_load(path.read_text(encoding='utf-8'))
        for entity in data['entities']:
            if entity['id'] in ('task', 'user'):
                entity['fields'].append({'id': 'urgent', 'type': 'boolean'})
        path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding='utf-8')

    urgent(tmp_path / 'spec' / 'product.yaml')
    edit_screen(tmp_path, 'task-places', lambda data: data['list'].update(
        highlight={'field': 'urgent', 'tone': 'warning', 'label': {'en': 'Urgent', 'ru': 'Срочно'}},
    ))
    edit_screen(tmp_path, 'task-flow', lambda data: data['board']['card'].update(badge='urgent'))
    edit_screen(tmp_path, 'user-schedule', lambda data: data['calendar'].update(tone={'field': 'urgent', 'tone': 'danger'}))
    files = rendered(tmp_path)
    places = files[f'{screens.GENERATED_DIR}/task-places.tsx']
    assert '        {...createForm}\n' in places
    assert "        filters={[{ field: 'status', options: statusOptions(TASK.type, language) }]}\n" in places
    assert "run: (item) => transit.mutateAsync({ id: item, transit: 'start' })," in places
    # a custom action of the route set in the toolbar, after the create form, its dialog after the list
    assert "    action: 'count',\n    target: 'route',\n    fields: ['priority'],\n" in places
    assert '          countAction.action,\n        ]}\n' in places and '      {countAction.dialog}\n' in places
    assert "rowTone={(row) => (fieldValue(row, 'urgent') === true ? 'warning' : undefined)}" in places
    assert (
        '        rowToneLabel={(row) =>\n'
        "          fieldValue(row, 'urgent') === true ? t('screens.task-places.list.highlight.label') : undefined\n"
        '        }\n'
    ) in places
    # the map beside the list, of the items of its filter, a marker opening the card
    assert (
        '      <ResourceMap\n        path={TASK.path}\n        entity="task"\n        field="location"\n'
        '        filter={FILTER}\n'
    ) in places
    # after its form, the list of all the tasks: the code takes no saved item
    assert "onSaved={() => void navigate(routeTo('task-list'))}" in places

    summary = files[f'{screens.GENERATED_DIR}/task-summary.tsx']
    assert "description: t('screens.task-summary.actions.delete.description')," in summary
    assert '      {deleteAction.confirm}\n' in summary
    # a custom action of the item, among the actions of the card
    assert "    action: 'escalate',\n    target: 'item',\n    item: id,\n    confirm: false,\n  });\n" in summary
    assert '              escalateAction.action,\n' in summary and '      {escalateAction.dialog}\n' in summary
    # no tabs: the transits under the heading, the related list and the history under the sections
    assert '            children: <TransitBar path={TASK.path} id={id} />,\n' in summary
    assert (
        '            after: (item) => (\n              <>\n                <RelatedList\n'
    ) in summary
    assert '                <StatusHistory resource={item} />\n              </>\n            ),\n' in summary
    # an "add here" of `when: always` is not gated by the permission to change the item
    assert "add={{ id: 'add-step', label: t('form.create'), fields: ['title'] }}" in summary
    assert '      actions={\n        <>\n          <ScreenAction\n' in summary
    # the update form, an action of the card shown to whom may change the item
    assert "{ id: 'edit', label: t('card.edit'), permission: 'change', onClick: editForm.onOpen }," in summary
    assert '      <UpdateFormAction\n        {...editForm}\n        path={TASK.path}\n        id={id}\n' in summary
    # the title of a generated card is not shown: not a text of the screen
    assert 'screens.task-summary.title' not in files[f'{screens.GENERATED_DIR}/messages.ts']
    # a card under the list whose route its route continues; the others at their own
    routes = files[f'{screens.GENERATED_DIR}/routes.tsx']
    assert '      <Route path="/tasks/:id" element={<TaskCardScreen />} />\n    </Route>\n' in routes
    assert '    <Route path="/tasks/:id/summary" element={<TaskSummaryScreen />} />\n' in routes

    # the forms as pages: a create, then the card of the item; an update of the item of the route
    new = files[f'{screens.GENERATED_DIR}/task-new.tsx']
    assert "onSaved: (saved) => void navigate(routeTo('task-card', saved.data.id))," in new
    edit = files[f'{screens.GENERATED_DIR}/task-edit.tsx']
    assert "  const { id = '' } = useParams();\n" in edit
    assert '      <ResourceForm\n        path={TASK.path}\n        id={id}\n' in edit
    assert 'fields=' not in edit

    # a board without `move` is not in `BoardDnd`; its badge, some of its columns, its empty text
    flow = files[f'{screens.GENERATED_DIR}/task-flow.tsx']
    assert 'BoardDnd' not in flow and 'move: true' not in flow
    assert "            columns: ['draft', 'in_progress'],\n            title: 'title',\n            badge: 'urgent',\n" in flow
    assert "            emptyMessage: t('screens.task-flow.board.empty'),\n" in flow
    assert "requires={{ path: TASK.path, can: 'add' }}" in flow
    assert "onSaved={() => void navigate(routeTo('task-flow'))}" in flow

    # the add of a calendar opens its form starting with the value of its field on the selected day
    schedule = files[f'{screens.GENERATED_DIR}/user-schedule.tsx']
    assert (
        '              onAdd: (value) => {\n                addForm.onOpenWith({ dt_first_login: value });\n'
    ) in schedule
    assert "            tone: { field: 'urgent', tone: 'danger' },\n" in schedule
    assert '      <CreateFormAction\n        {...addForm}\n' in schedule

    # a dashboard of two entities: a tile of two conditions, a tile with its own icon, a chart by
    # a date, the forms of both, one then the home
    overview = files[f'{screens.GENERATED_DIR}/overview.tsx']
    assert "filter: Filter.and(Filter.where('status', 'in_progress'), Filter.where('title', 'Review the plan'))," in overview
    assert "label: t('async.processing')," in overview
    assert "import { FootprintsIcon, PlusIcon } from 'lucide-react';\n" in overview
    assert '              icon: FootprintsIcon,\n' in overview
    assert '        <TimeChart\n' in overview and 'StatusChart' not in overview
    assert "requires={{ path: STEP.path, can: 'add' }}" in overview
    assert "onSaved={() => void navigate(routeTo('home'))}" in overview

    # a plain card: no workflow, no texts, no parent, a related list without history and add
    user = files[f'{screens.GENERATED_DIR}/user-card.tsx']
    assert 'useNavigate' not in user and 'useLanguage' not in user
    assert '    <Screen id="user-card">\n' in user
    assert '        after={() => (\n          <RelatedList\n' in user


#: an extended screen of each primitive: the list of the sample, the screens of the kitchen sink
EXTENDED = {
    'list': ('task-list', 'ResourceList', 'ResourceListProps'),
    'card': ('task-summary', 'ResourceCard', 'ResourceCardProps'),
    'board': ('task-flow', 'ResourceBoard', 'ResourceBoardProps'),
    'calendar': ('user-schedule', 'ResourceCalendar', 'ResourceCalendarProps'),
    'form': ('task-new', 'ResourceForm', 'ResourceFormProps'),
}


@pytest.mark.parametrize('primitive', sorted(EXTENDED))
def test_an_extended_screen(tmp_path, primitive):
    """
    The extension of a screen (`extend`): what it shows before and after the component, its
    actions after those of the header, its props merged with those of the spec
    (`extended<Props>`), the children among them; the hooks are those of the generated screen.
    """
    kitchen_sink(tmp_path)
    screen_id, name, props = EXTENDED[primitive]
    code = rendered(tmp_path)[f'{screens.GENERATED_DIR}/{screen_id}.tsx']
    assert f"import {{ extension }} from '@/screens/{screen_id}/extend';\n" in code
    # the import of `extended`, on one line or on several
    assert f'type {props} }}' in code and 'extended' in code.split("from '@/bazis/ui/screens'")[0].rsplit('import ', 1)[1]
    assert f'      <{name}\n        {{...extended<{props}>(\n          {{\n' in code
    assert '          extension.props,\n        )}\n      />\n' in code
    body = code.split('return (')[1]
    assert body.index('{extension.before}') < body.index(f'<{name}') < body.index('{extension.after}')
    assert 'actions={extension.actions}' in code or '          {extension.actions}\n        </>\n' in code
    # the extension is a value of the module: it adds no hook to the screen
    assert 'extension' not in code.split('return (')[0].split('export function')[1]


def test_an_extended_list_and_dashboard(tmp_path):
    """
    The map of an extended list takes the props of `extension.map`; an extended dashboard, the
    screen itself, shows `extension.before` after its heading and `extension.after` after its
    parts, the props of its parts merged.
    """
    kitchen_sink(tmp_path)
    files = rendered(tmp_path)
    task_list = files[f'{screens.GENERATED_DIR}/task-list.tsx']
    assert '      <ResourceMap\n        {...extended<ResourceMapProps>(\n' in task_list
    assert '            selected: id,\n' in task_list and '          extension.map,\n' in task_list
    overview = files[f'{screens.GENERATED_DIR}/overview.tsx']
    assert '      before={extension.before}\n      {...extended<DashboardProps>(\n' in overview
    assert '        extension.props,\n      )}\n    >\n      {extension.after}\n' in overview
    assert '          {extension.actions}\n        </>\n      }\n      before={extension.before}\n' in overview


#: a screen of each primitive of the sample, declared custom
CUSTOM = {
    'list': 'draft-tasks', 'card': 'task-card', 'dashboard': 'home', 'board': 'task-board',
    'calendar': 'task-calendar', 'form': 'task-new',
}


@pytest.mark.parametrize('primitive', sorted(CUSTOM))
@pytest.mark.parametrize('custom', [True, {'module': '@/screens/hand', 'export': 'HandScreen'}])
def test_a_custom_screen(tmp_path, primitive, custom):
    """
    A custom screen (`custom: true`, or the export of a module) of every primitive is not
    generated: its route loads its code, its link and its texts are generated all the same.
    """
    kitchen_sink(tmp_path)
    screen_id = CUSTOM[primitive]
    edit_screen(
        tmp_path, screen_id, lambda data: data.update(custom=custom, title='Hand-written') or data.pop('extend', None),
    )
    files = rendered(tmp_path)
    assert f'{screens.GENERATED_DIR}/{screen_id}.tsx' not in files
    source, export = (
        (f'@/screens/{screen_id}', screens.component_name(screen_id)) if custom is True
        else (custom['module'], custom['export'])
    )
    routes = files[f'{screens.GENERATED_DIR}/routes.tsx']
    assert f"import('{source}').then((module) => module.{export})" in routes
    # the title of a custom card too: its code heads the screen as it likes
    assert f"'screens.{screen_id}.title': 'Hand-written'" in files[f'{screens.GENERATED_DIR}/messages.ts']


def test_the_routes_of_custom_screens_of_items(tmp_path):
    """
    A generated card beside a custom list (`/steps/:id` under `/steps`) and a custom card beside
    a generated list (`/tasks/:id`) are in the layout of their list; the generated card links
    back to the custom list.
    """
    kitchen_sink(tmp_path)
    edit_screen(tmp_path, 'task-card', lambda data: data.update(custom=True))
    files = rendered(tmp_path)
    routes = files[f'{screens.GENERATED_DIR}/routes.tsx']
    assert (
        '    <Route path="/steps" element={<ListCardLayout list={<StepListScreen />} />}>\n'
        '      <Route path="/steps/:id" element={<StepCardScreen />} />\n    </Route>\n'
    ) in routes
    assert (
        '    <Route path="/tasks" element={<ListCardLayout list={<TaskListScreen />} />}>\n'
        '      <Route path="/tasks/:id" element={<TaskCardScreen />} />\n    </Route>\n'
    ) in routes
    assert "import('@/screens/task-card').then((module) => module.TaskCardScreen)" in routes
    assert "import('@/screens/steps').then((module) => module.StepListScreen)" in routes
    assert f'{screens.GENERATED_DIR}/step-list.tsx' not in files
    step_card = files[f'{screens.GENERATED_DIR}/step-card.tsx']
    assert "parent={{ screen: 'step-list', label: t('screens.step-list.title'), to: routeTo('step-list') }}" in step_card
    # the generated list selects the custom card of its route
    assert '            selected: id,\n' in files[f'{screens.GENERATED_DIR}/task-list.tsx']


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
def test_an_extended_screen_in_the_frontend(frontend, root):
    """
    The extension is the product's: the generation never writes it, and `--force` drops the
    edits of the generated screen only; a screen of its own beside the extension (`index.tsx`)
    is refused (S029), the extension stays the place of what the spec cannot say.
    """
    extension = frontend / 'src' / 'screens' / 'task-list' / 'extend.tsx'
    mine = extension.read_text(encoding='utf-8')
    generate()
    task_list = frontend / f'{screens.GENERATED_DIR}/task-list.tsx'
    expected = task_list.read_text(encoding='utf-8')
    assert "import { extension } from '@/screens/task-list/extend';\n" in expected
    task_list.write_text(expected.replace('extension.props', '{}'), encoding='utf-8')
    with pytest.raises(CommandError, match='Edited after they were generated: src/screens/generated/task-list.tsx.'):
        generate()
    generate('--force')
    assert task_list.read_text(encoding='utf-8') == expected
    assert extension.read_text(encoding='utf-8') == mine

    (extension.parent / 'index.tsx').write_text('export function TaskListScreen() {}\n', encoding='utf-8')
    with pytest.raises(CommandError, match='The specs have 1 errors'):
        generate()
    [issue] = validate(root).errors
    assert issue.code == 'S029' and issue.file == 'spec/screens/task-list.yaml'


@pytest.mark.django_db
def test_screens_refuse_a_screen_of_its_own_on_the_first_run_too(frontend, root):
    """
    A frontend of 0.1.0 has the code of its screens and no `screens` in its lock: `screens`
    refuses a screen that has `index.tsx` and no `custom` (S029) before it writes anything,
    and `--force` (about the edited generated files) does not lift it; `custom` does. `check`
    tells it too, as the router of this frontend imports the generated screens.
    """
    own = frontend / 'src' / 'screens' / 'draft-tasks' / 'index.tsx'
    own.parent.mkdir(parents=True, exist_ok=True)
    own.write_text('export function DraftTasksScreen() {}\n', encoding='utf-8')
    assert 'screens' not in read_lock(root)
    [issue] = validate(root).errors
    assert issue.code == 'S029' and issue.file == 'spec/screens/draft-tasks.yaml'
    before = read_lock(root)

    for args in ((), ('--force',), ('--check',)):
        with pytest.raises(CommandError, match='The specs have 1 errors'):
            generate(*args)
    assert not (frontend / screens.GENERATED_DIR).exists()
    assert read_lock(root) == before
    [issue] = validate(root, generating=True).errors
    assert issue.code == 'S029' and issue.file == 'spec/screens/draft-tasks.yaml'

    edit_screen(root, 'draft-tasks', lambda data: data.update(custom=True))
    generate()
    assert 'screens' in read_lock(root)
    assert not (frontend / DRAFTS).exists()


@pytest.mark.django_db
def test_a_key_that_no_dictionary_has_does_not_stop_the_screens(frontend, root):
    """
    A text of the specs that is a key of no dictionary (S036) is a warning: the dictionaries are
    read as text, and the product may give the key otherwise; the screen asks for the key.
    """
    edit_screen(root, 'draft-tasks', lambda data: data.update(title='tasks.drafts'))
    [issue] = [it for it in validate(root).issues if it.code == 'S036']
    assert issue.severity == 'warning' and issue.file == 'spec/screens/draft-tasks.yaml'
    generate()
    assert "title={t('tasks.drafts')}" in (frontend / DRAFTS).read_text(encoding='utf-8')


def test_the_screens_need_a_frontend(tmp_path, settings):
    settings.BASE_DIR = str(tmp_path)
    with pytest.raises(CommandError, match='init'):
        generate()
