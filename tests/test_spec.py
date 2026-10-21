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
import shutil
from io import StringIO
from pathlib import Path

from django.core.management import CommandError, call_command
from django.test import override_settings

import pytest
import yaml

from bazis.contrib.front import capabilities
from bazis.contrib.front.checks import check_spec
from bazis.contrib.front.contract.export import CONTRACT_FORMAT, render
from bazis.contrib.front.spec import color, design
from bazis.contrib.front.spec.access import Grant
from bazis.contrib.front.spec.issues import CODES
from bazis.contrib.front.spec.validate import schema_files, validate

from .support import SAMPLE_SPEC, copy_screen_code


AGENTS_MD = Path(__file__).resolve().parent.parent / 'bazis' / 'contrib' / 'front' / 'AGENTS.md'


@pytest.fixture
def root(tmp_path):
    """
    A product root (BASE_DIR) with the specs of the sample and the code of its screens,
    and no contract.
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    copy_screen_code(tmp_path)
    with override_settings(BASE_DIR=str(tmp_path)):
        yield tmp_path


@pytest.fixture
def contract(root, sample_app, db):
    """
    The contract of the sample, with the roles and the transits that `migrate` applied from
    its declarations, in the product root.
    """
    (root / 'contract').mkdir()
    (root / 'contract' / 'contract.json').write_text(
        render(sample_app)['contract.json'], encoding='utf-8'
    )
    return root / 'contract' / 'contract.json'


def check(*args) -> tuple[str, str]:
    out, err = StringIO(), StringIO()
    call_command('bazis_front', 'check', *args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


def issues(root, **kwargs) -> list[tuple[str, str]]:
    return [(it.code, it.location) for it in validate(root, **kwargs).issues]


#: the edit of a case of the installed versions of the distributions: `change(versions)`
VERSIONS = 'installed versions'


def installed(monkeypatch, change) -> None:
    """
    The versions of the installed distributions, as `importlib.metadata` reads them, changed
    by `change` (a dict of the versions to report instead).
    """
    from importlib import metadata

    versions: dict[str, str] = {}
    change(versions)
    real = metadata.version
    monkeypatch.setattr(metadata, 'version', lambda name: versions.get(name) or real(name))


# the files of the specs, edited by the cases


def read(path: Path):
    text = path.read_text(encoding='utf-8')
    return json.loads(text) if path.suffix == '.json' else yaml.safe_load(text)


def edit(root: Path, name: str, change) -> None:
    """
    Changes a file of the product: `change` edits its data in place, or returns new data
    (a dict) or a new text (a string).
    """
    path = root / name
    data = read(path) if path.exists() else None
    result = change(data)
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(result, str):
        path.write_text(result, encoding='utf-8')
        return
    data = result if isinstance(result, dict) else data
    path.write_text(
        json.dumps(data) if path.suffix == '.json' else yaml.safe_dump(data, sort_keys=False),
        encoding='utf-8',
    )


def task(data):
    return data['entities'][0]


def field(entity, field_id):
    return next(it for it in entity['fields'] if it['id'] == field_id)


def no_calendar_scenario(data):
    """Without the scenario of the add of the calendar, which fills its date-time."""
    data['scenarios'] = [it for it in data['scenarios'] if it['id'] != 'manager-plans-on-the-calendar']


def steps(data, scenario):
    return data['scenarios'][scenario]['steps']


PRODUCT, LIST, CARD = 'spec/product.yaml', 'spec/screens/task-list.yaml', 'spec/screens/task-card.yaml'
DRAFTS = 'spec/screens/draft-tasks.yaml'
#: the public screen of the sample: its role `visitor` is anonymous
PUBLIC = 'spec/screens/public-tasks.yaml'
#: the form of the action of the guests, `suggest`, as a public page of its own
SUGGEST = 'spec/screens/suggest-task.yaml'
HOME, BOARD, CALENDAR = 'spec/screens/home.yaml', 'spec/screens/task-board.yaml', 'spec/screens/task-calendar.yaml'
THEME, TOKENS, CONTRACT = 'spec/design/theme.yaml', 'spec/design/tokens.json', 'contract/contract.json'
LOCK = 'frontend/bazis-front.lock.json'
SCREENS = 'frontend/src/screens'
I18N = 'frontend/src/i18n'
#: a dictionary of the components (the copy of the asset `i18n`)
MESSAGES = 'frontend/src/bazis/i18n/messages/en.ts'
#: the hooks of the packages of the sample, which `init` copies
HOOKS = ('react-statusy', 'react-uploadable', 'react-ws', 'react-notify', 'react-bg', 'react-async')


def lock(*assets):
    """
    The lock of a frontend with these assets.
    """
    return {
        'lock': 1, 'contract': {}, 'generated': {},
        'assets': {name: {'version': '0.1.0'} for name in assets},
    }


def remove_statusy_section(data):
    del data['capabilities']['statusy']


def remove_statusy_model(data):
    data['capabilities']['statusy']['models'].pop('tasks.task')


def remove_labels(data):
    fields = data['project']['resources']['tasks.task']['fields']
    del fields['status']['filter'], fields['dt_created']['order']


def user_card(data, transitions=False):
    return {
        'spec': 'bazis-screen/1', 'id': 'user-card', 'route': '/users/:id', 'entity': 'user',
        'primitive': 'card',
        'card': {'sections': [{'id': 'main', 'fields': ['username']}], 'transitions': transitions},
        'states': ['loading', 'error', 'forbidden', 'not_found'],
    }


#: (code, the edits {file: change}, the issues expected (code, location)); every code of
#: the specs has a case, each checked against the contract of the sample
#: a task with an end, `ends`, a date-time that its create takes: the end of the calendar
WITH_END = {
    PRODUCT: lambda d: task(d)['fields'].append({'id': 'ends', 'type': 'datetime'}),
    CONTRACT: lambda d: [
        d['project']['resources']['tasks.task']['fields'].update(
            ends={'title': 'Ends', 'type': 'string', 'format': 'date-time', 'filter': 'ends', 'order': 'ends'}),
        d['project']['resources']['tasks.task']['create'].append('ends'),
    ],
}


CASES = [
    ('C001', {CONTRACT: lambda d: '{'}, [('C001', CONTRACT)]),
    # a contract of another format: of bazis-front 0.1.0 (4), without the titles and the labels
    ('C002', {CONTRACT: lambda d: {**d, 'format': 4}}, [('C002', f'{CONTRACT}#/format')]),
    (
        'C004',
        # the installed bazis-ws is older than the one whose protocol the hooks follow
        {VERSIONS: lambda versions: versions.update({'bazis-ws': '2.4.0'})},
        [('C004', f'{CONTRACT}#/capabilities/ws')],
    ),
    # the sample has bazis-statusy and bazis-uploadable: a frontend made by `init` has their hooks
    (
        'C003',
        # the hooks of the six packages of the sample that have their own
        {LOCK: lambda d: lock('client', 'react', 'template')},
        [('C003', f'{LOCK}#/assets')] * 6,
    ),
    ('P001', {PRODUCT: lambda d: 'spec: [\n'}, [('P001', PRODUCT)]),
    ('P002', {PRODUCT: lambda d: d.update(spec='bazis-product/2')}, [('P002', f'{PRODUCT}#/spec')]),
    (
        'P003',
        {PRODUCT: lambda d: [d['roles'].append({'id': 'viewer', 'permit': 'viewer'}),
                             task(d)['fields'].append({'id': 'status', 'type': 'string'})]},
        [('P003', f'{PRODUCT}#/roles/3/id'), ('P003', f'{PRODUCT}#/entities/0/fields/10/id')],
    ),
    (
        'P004',
        {PRODUCT: lambda d: task(d)['access'].update(member={'view': 'all'})},
        [('P004', f'{PRODUCT}#/entities/0/access/member')],
    ),
    (
        'P005',
        {PRODUCT: lambda d: task(d)['fields'][3].update(relation='person')},
        [('P005', f'{PRODUCT}#/entities/0/fields/3/relation')],
    ),
    (
        'P006',
        {PRODUCT: lambda d: [task(d)['workflow']['transitions'][0].update({'from': 'new'}),
                             task(d)['access']['viewer'].update(transit=['close'])]},
        [
            ('P006', f'{PRODUCT}#/entities/0/workflow/transitions/0/from'),
            ('P006', f'{PRODUCT}#/entities/0/access/viewer/transit/0'),
            # and the contract: start goes from draft
            ('P016', f'{PRODUCT}#/entities/0/workflow/transitions/0'),
        ],
    ),
    (
        'P010',
        {CONTRACT: remove_statusy_section},
        [('P010', f'{PRODUCT}#/packages/3'), ('P014', f'{PRODUCT}#/entities/0/workflow')],
    ),
    (
        'P011',
        {PRODUCT: lambda d: task(d).update(resource='tasks.job')},
        # and the relationship of the steps to the tasks references another resource
        [('P011', f'{PRODUCT}#/entities/0/resource'), ('P013', f'{PRODUCT}#/entities/2/fields/1')],
    ),
    (
        'P012',
        {PRODUCT: lambda d: task(d)['fields'].append({'id': 'due_date', 'type': 'date'})},
        [('P012', f'{PRODUCT}#/entities/0/fields/10')],
    ),
    (
        'P013',
        {PRODUCT: lambda d: [task(d)['fields'][0].update(type='integer'),
                             task(d)['fields'][2].update(type='date'),
                             task(d)['fields'][3].update(many=True)]},
        [
            ('P013', f'{PRODUCT}#/entities/0/fields/0'),
            ('P013', f'{PRODUCT}#/entities/0/fields/2'),
            ('P013', f'{PRODUCT}#/entities/0/fields/3'),
            # and the scenarios fill the assignee, now a to-many relationship, with one value
            ('P022', f'{PRODUCT}#/scenarios/2/steps/2/fill/assignee'),
            ('P022', f'{PRODUCT}#/scenarios/6/steps/2/fill/assignee'),
            ('P022', f'{PRODUCT}#/scenarios/11/steps/2/fill/assignee'),
        ],
    ),
    (
        'P013',
        # a file is a relationship to the uploaded files of bazis-uploadable, and a
        # relationship to them is a file
        {PRODUCT: lambda d: [task(d)['fields'][1].update(type='file'),
                             task(d)['fields'][4].update(type='string')]},
        [
            ('P013', f'{PRODUCT}#/entities/0/fields/1'),
            ('P013', f'{PRODUCT}#/entities/0/fields/4'),
            # and the scenario uploads into a field that is no longer a file
            ('P022', f'{PRODUCT}#/scenarios/5/steps/5/upload/field'),
        ],
    ),
    (
        'P014',
        {CONTRACT: remove_statusy_model},
        # the tones of the statuses of the theme name statuses of no model
        [('P014', f'{PRODUCT}#/entities/0/workflow'),
         *(('D008', f'{THEME}#/statuses/{it}') for it in ('draft', 'in_progress', 'done'))],
    ),
    (
        'P015',
        {PRODUCT: lambda d: [task(d)['workflow'].update(initial='in_progress'),
                             task(d)['workflow']['statuses'].append('archived')]},
        [
            ('P015', f'{PRODUCT}#/entities/0/workflow/initial'),
            ('P015', f'{PRODUCT}#/entities/0/workflow/statuses/3'),
        ],
    ),
    (
        'P016',
        {PRODUCT: lambda d: task(d)['workflow']['transitions'].append(
            {'id': 'cancel', 'from': 'draft', 'to': 'done'})},
        [('P016', f'{PRODUCT}#/entities/0/workflow/transitions/2')],
    ),
    (
        'P017',
        {PRODUCT: lambda d: [task(d)['workflow']['transitions'][1].pop('payload'),
                             task(d)['workflow']['transitions'][0].update(
                                 payload={'fields': [{'id': 'note', 'type': 'text'}]})]},
        [
            ('P017', f'{PRODUCT}#/entities/0/workflow/transitions/0/payload'),
            ('P017', f'{PRODUCT}#/entities/0/workflow/transitions/1/payload'),
            # the bulk action of the list starts the tasks without a payload
            ('S025', f'{LIST}#/list/bulk/0/transit'),
            # the scenarios give `start` no payload, and `finish` one it does not declare
            ('P024', f'{PRODUCT}#/scenarios/0/steps/5/transit'),
            ('P024', f'{PRODUCT}#/scenarios/0/steps/6/transit/payload/report'),
            ('P024', f'{PRODUCT}#/scenarios/4/steps/13/transit'),
            ('P024', f'{PRODUCT}#/scenarios/6/steps/5/transit'),
            ('P024', f'{PRODUCT}#/scenarios/6/steps/6/transit/payload/report'),
            ('P024', f'{PRODUCT}#/scenarios/9/steps/9/transit'),
            # the board moves a task to in_progress, which only `start` leads to
            ('P024', f'{PRODUCT}#/scenarios/13/steps/6/move/to'),
        ],
    ),
    (
        'P018',
        {PRODUCT: lambda d: d['roles'][1].update(permit='reader')},
        [('P018', f'{PRODUCT}#/roles/1/permit')],
    ),
    (
        'P019',
        {PRODUCT: lambda d: [task(d)['access']['manager'].update(delete='all'),
                             task(d)['access']['viewer'].update(
                                 change={'selector': 'all', 'statuses': ['draft', 'done']},
                                 transit={'start': 'all'})]},
        [
            ('P019', f'{PRODUCT}#/entities/0/access/manager/delete'),
            ('P019', f'{PRODUCT}#/entities/0/access/viewer/change'),
            ('P019', f'{PRODUCT}#/entities/0/access/viewer/change'),
            ('P019', f'{PRODUCT}#/entities/0/access/viewer/transit/start'),
        ],
    ),
    (
        'P020',
        {PRODUCT: lambda d: task(d)['access']['manager'].update(
            change={'selector': 'author', 'statuses': ['draft']})},
        [('P020', f'{PRODUCT}#/entities/0/access/manager/change/selector')],
    ),
    (
        'P021',
        {PRODUCT: lambda d: steps(d, 0).__setitem__(0, {'open': 'task-gantt'})},
        [('P021', f'{PRODUCT}#/scenarios/0/steps/0/open')],
    ),
    (
        'P022',
        {PRODUCT: lambda d: [steps(d, 1).__setitem__(1, {'action': 'edit'}),
                             steps(d, 1).__setitem__(0, {'open': 'task-card'}),
                             steps(d, 0).insert(0, {'submit': {}}),
                             steps(d, 2)[4]['expect'].update(field_absent='dt_created')]},
        [
            ('P022', f'{PRODUCT}#/scenarios/0/steps/0/submit'),
            # a card needs the id of its item; it has no action `edit`
            ('P022', f'{PRODUCT}#/scenarios/1/steps/0/open'),
            ('P022', f'{PRODUCT}#/scenarios/1/steps/1/action'),
            # the card does not show the field: it is always absent
            ('P022', f'{PRODUCT}#/scenarios/2/steps/4/expect/field_absent'),
        ],
    ),
    (
        'P022',
        # a file is uploaded, not filled; a list shows no values, nor a card the fields that
        # its sections do not have
        {PRODUCT: lambda d: [steps(d, 5).__setitem__(5, {'fill': {'attachment': 'brief.txt'}}),
                             steps(d, 5)[4]['expect'].update(values={'dt_created': 'today', 'deadline': 'never'}),
                             steps(d, 1).insert(1, {'expect': {'values': {'title': 'Review the plan'}}})]},
        [
            ('P022', f'{PRODUCT}#/scenarios/1/steps/1/expect/values'),
            ('P022', f'{PRODUCT}#/scenarios/5/steps/4/expect/values/dt_created'),
            ('P023', f'{PRODUCT}#/scenarios/5/steps/4/expect/values/deadline'),
            ('P022', f'{PRODUCT}#/scenarios/5/steps/5/fill/attachment'),
        ],
    ),
    (
        'P022',
        # a to-many relationship is filled with the list of the labels of its items, another
        # field with one value
        {PRODUCT: lambda d: [steps(d, 2)[2]['fill'].update(assignee=['Mary Manager']),
                             steps(d, 11)[2]['fill'].update(watchers='Mary Manager')]},
        [
            ('P022', f'{PRODUCT}#/scenarios/2/steps/2/fill/assignee'),
            ('P022', f'{PRODUCT}#/scenarios/11/steps/2/fill/watchers'),
        ],
    ),
    (
        'P023',
        {PRODUCT: lambda d: [steps(d, 0)[2]['fill'].update(due='tomorrow', report='Later'),
                             steps(d, 1)[2]['open_item']['where'].update(owner='me')]},
        [
            ('P023', f'{PRODUCT}#/scenarios/0/steps/2/fill/due'),
            # not in the `fields` of the form of `create`
            ('P023', f'{PRODUCT}#/scenarios/0/steps/2/fill/report'),
            ('P023', f'{PRODUCT}#/scenarios/1/steps/2/open_item/where/owner'),
        ],
    ),
    (
        'P024',
        {PRODUCT: lambda d: [steps(d, 0)[4]['expect'].update(status='archived'),
                             steps(d, 0).__setitem__(5, {'transit': 'cancel'})]},
        [
            ('P024', f'{PRODUCT}#/scenarios/0/steps/4/expect/status'),
            ('P024', f'{PRODUCT}#/scenarios/0/steps/5/transit'),
        ],
    ),
    (
        'P025',
        # the product logs in (`packages` has `users`): the role of a scenario needs a test
        # user; the guest of no scenario does not
        {PRODUCT: lambda d: [d['roles'][1].pop('test_user'),
                             d['roles'].append({'id': 'guest', 'permit': 'guest'})]},
        [('P025', f'{PRODUCT}#/scenarios/1/role'), ('P025', f'{PRODUCT}#/scenarios/7/role'),
         ('P025', f'{PRODUCT}#/scenarios/15/role')],
    ),
    (
        'P026',
        # bazis-authing without its service `password`: the test users cannot log in
        {CONTRACT: lambda d: d['capabilities']['authing'].update(actions=[])},
        [('P026', f'{PRODUCT}#/scenarios')],
    ),
    (
        'P027',
        # the notification of a scenario is one of bazis-notify (or of bazis-ws): neither
        {PRODUCT: lambda d: [d['packages'].remove('ws'), d['packages'].remove('notify')]},
        [('P027', f'{PRODUCT}#/scenarios/6/steps/7/expect/notification')],
    ),
    (
        'P028',
        # bazis-ws is installed, its socket is routed only in the main module of the project
        {CONTRACT: lambda d: d['capabilities']['ws'].update(path=None)},
        [('P028', f'{PRODUCT}#/packages/5')],
    ),
    (
        'P029',
        # the languages of the backend but one, and a default that is not one of them
        {PRODUCT: lambda d: d.update(languages=['en'], language='ru')},
        [('P029', f'{PRODUCT}#/language'), ('P029', f'{PRODUCT}#/languages'), ('P029', f'{PRODUCT}#/language')],
    ),
    (
        'P030',
        # anonymous roles: one whose permit role is not for anonymous users (`guest`), one
        # without a permit role that has access, one with a selector of a user
        {PRODUCT: lambda d: [d['roles'].extend([{'id': 'stranger', 'permit': 'guest', 'anonymous': True},
                                                {'id': 'walker', 'anonymous': True},
                                                {'id': 'public', 'permit': 'viewer', 'anonymous': True}]),
                             task(d)['access'].update(walker={'view': 'all'}, public={'view': 'assignee'})]},
        [
            ('P030', f'{PRODUCT}#/roles/3/permit'),
            ('P030', f'{PRODUCT}#/entities/0/access/walker'),
            ('P030', f'{PRODUCT}#/entities/0/access/public/view'),
            # and no screen of theirs
            ('S047', f'{PRODUCT}#/roles/3'), ('S047', f'{PRODUCT}#/roles/4'), ('S047', f'{PRODUCT}#/roles/5'),
        ],
    ),
    (
        'P031',
        # the label of the steps names a field that the step does not declare
        {PRODUCT: lambda d: d['entities'][2].update(label=['task', 'rank'])},
        [('P031', f'{PRODUCT}#/entities/2/label/1')],
    ),
    (
        'P032',
        # an entity named as the filter of a list in the code, two named alike
        {PRODUCT: lambda d: d['entities'].extend([
            {'id': 'filter', 'resource': 'users.user', 'fields': [{'id': 'username', 'type': 'string'}]},
            {'id': 'user_', 'resource': 'users.user', 'fields': [{'id': 'username', 'type': 'string'}]},
            {'id': 'user-', 'resource': 'users.user', 'fields': [{'id': 'username', 'type': 'string'}]},
        ])},
        [('P032', f'{PRODUCT}#/entities/3/id'), ('P032', f'{PRODUCT}#/entities/5/id')],
    ),
    (
        'P033',
        # a scenario changes the task of `e2e_data` in every way: bulk, transit, edit, a step
        # added to it, its custom action, its deletion, its move on the board
        {PRODUCT: lambda d: d['scenarios'].append({'id': 'manager-changes-the-plan', 'role': 'manager', 'steps': [
            {'open': 'task-list'},
            {'select': {'where': {'title': 'Review the plan'}}},
            {'bulk': 'start-all'},
            {'open_item': {'where': {'title': 'Review the plan'}}},
            {'transit': 'start'},
            {'fill': {'title': 'Review the plan again'}},
            {'submit': {}},
            {'action': 'add-step'},
            {'fill': {'title': 'Book the room'}},
            {'submit': {}},
            {'action': 'escalate'},
            {'fill': {'priority': 'Low'}},
            {'submit': {}},
            {'action': 'delete'},
            {'open': 'task-board'},
            {'move': {'where': {'title': 'Review the plan'}, 'to': 'in_progress'}},
        ]})},
        [
            ('P033', f'{PRODUCT}#/scenarios/20/steps/2/bulk'),
            ('P033', f'{PRODUCT}#/scenarios/20/steps/4/transit'),
            ('P033', f'{PRODUCT}#/scenarios/20/steps/6/submit'),
            ('P033', f'{PRODUCT}#/scenarios/20/steps/9/submit'),
            ('P033', f'{PRODUCT}#/scenarios/20/steps/12/submit'),
            ('P033', f'{PRODUCT}#/scenarios/20/steps/13/action'),
            ('P033', f'{PRODUCT}#/scenarios/20/steps/15/move'),
        ],
    ),
    (
        'P034',
        # the viewer opens a task by the title that `manager-finishes-a-task` gives the tasks it
        # creates; the board moves a task by a title that its scenario gives the task only after
        {PRODUCT: lambda d: [steps(d, 1)[2]['open_item']['where'].update(title='Write the report'),
                             steps(d, 13).insert(0, {'open': 'task-board'}),
                             steps(d, 13).insert(1, {'move': {'where': {'title': 'Move on the board'}, 'to': 'in_progress'}})]},
        [
            ('P033', f'{PRODUCT}#/scenarios/13/steps/1/move'),
            ('P034', f'{PRODUCT}#/scenarios/1/steps/2/open_item/where'),
            ('P034', f'{PRODUCT}#/scenarios/13/steps/1/move/where'),
        ],
    ),
    (
        'P035',
        # the guest opens a screen of a session first: the frontend sends him to the login
        {PRODUCT: lambda d: steps(d, 18).insert(0, {'open': 'task-list'})},
        [('P035', f'{PRODUCT}#/scenarios/18/steps/0/open')],
    ),
    ('S001', {LIST: lambda d: 'id: [\n'}, [('S001', LIST)]),
    ('S002', {CARD: lambda d: d['states'].append('gone')}, [('S002', f'{CARD}#/states/4')]),
    (
        'S002',
        # the title of a confirmation is that of a deletion, not of a form
        {LIST: lambda d: d['actions'][0].update(title={'en': 'Create?', 'ru': 'Создать?'})},
        [('S002', f'{LIST}#/actions/0')],
    ),
    (
        'S002',
        # a bulk action is one of a transition, a deletion or a custom action: a custom action
        # without its label beside a transition or a deletion is none of them
        {LIST: lambda d: [d['list']['bulk'][0].update(action='escalate'),
                          d['list']['bulk'].append({'id': 'delete-all', 'primitive': 'destroy', 'action': 'escalate'})]},
        [('S002', f'{LIST}#/list/bulk/0'), ('S002', f'{LIST}#/list/bulk/2')],
    ),
    (
        'S003',
        {CARD: lambda d: d.update(id='task-item', route='/tasks')},
        # a card at the route of a list has no `:id` either
        [('S003', f'{CARD}#/id'), ('S038', f'{CARD}#/route'), ('S003', f'{LIST}#/route')],
    ),
    ('S004', {LIST: lambda d: d.update(entity='job')}, [('S004', f'{LIST}#/entity')]),
    ('S005', {LIST: lambda d: d['roles'].append('member')}, [('S005', f'{LIST}#/roles/2')]),
    (
        'S006',
        {LIST: lambda d: d['list'].update(open='task-list'),
         CARD: lambda d: d['actions'][0].update(then='task-view')},
        # a row opens a list; the screen after a delete does not exist
        [('S006', f'{CARD}#/actions/0/then'), ('S006', f'{LIST}#/list/open')],
    ),
    (
        'S006',
        {'spec/screens/user-card.yaml': user_card, LIST: lambda d: d['list'].update(open='user-card')},
        # a row opens the card of another entity
        [('S006', f'{LIST}#/list/open')],
    ),
    (
        'S006',
        {'spec/screens/user-card.yaml': user_card,
         CARD: lambda d: d['actions'][0].update(then='task-card'),
         LIST: lambda d: d['actions'][0].update(then='user-card')},
        # a deletion leads to a screen of an item (none is left); a create to the card of
        # another entity than that of the saved item
        [('S006', f'{CARD}#/actions/0/then'), ('S006', f'{LIST}#/actions/0/then')],
    ),
    (
        'S007',
        {CARD: lambda d: d['card']['sections'][0]['fields'].append('rank')},
        [('S007', f'{CARD}#/card/sections/0/fields/8')],
    ),
    (
        'S008',
        {CONTRACT: remove_labels},
        # the filter of the drafts (a report) is by the status too, and so are the tiles of the
        # home, its chart by status and the columns of the board; its last tasks are sorted, as
        # the public list
        [('S008', f'{DRAFTS}#/list/filter/status'), ('S008', f'{DRAFTS}#/list/sort/0'),
         ('S008', f'{HOME}#/dashboard/tiles/0/filter/status'), ('S008', f'{HOME}#/dashboard/tiles/1/filter/status'),
         ('S008', f'{HOME}#/dashboard/tiles/2/filter/status'), ('S008', f'{HOME}#/dashboard/charts/0/by'),
         ('S008', f'{HOME}#/dashboard/recent/0/sort/0'), ('S008', f'{PUBLIC}#/list/sort/0'), ('S008', f'{BOARD}#/board/by'),
         ('S008', f'{LIST}#/list/filters/0'), ('S008', f'{LIST}#/list/sort/0')],
    ),
    ('S009', {LIST: lambda d: d['states'].remove('empty')}, [('S009', f'{LIST}#/states')]),
    (
        'S009',
        # a custom screen renders the states of its primitive as a generated one does: the
        # shots wait for its `state:*` mark, so `custom` does not lift the states
        {HOME: lambda d: d.update(custom=True, states=[])},
        [('S009', f'{HOME}#/states'), ('S028', f'{HOME}#/custom')],
    ),
    (
        'S010',
        {LIST: lambda d: d['actions'].extend([{'id': 'remove', 'primitive': 'destroy'},
                                              {'id': 'create', 'primitive': 'form', 'mode': 'create'}])},
        [('S010', f'{LIST}#/actions/1'), ('S010', f'{LIST}#/actions/2')],
    ),
    (
        'S010',
        # an update form `edit` on a card with `edit: true`, whose edit is the action `edit`
        {CARD: lambda d: d['actions'].append({'id': 'edit', 'primitive': 'form', 'mode': 'update'})},
        [('S010', f'{CARD}#/actions/2')],
    ),
    ('S011', {'spec/screens/user-card.yaml': lambda d: user_card(d, transitions=True)}, [('S011', 'spec/screens/user-card.yaml#/card/transitions')]),
    (
        'S012',
        # the users have no search: the pickers of the assignee (the filters of a list, of the
        # board and of the calendar, a form, the card) and of the watchers (a form, the card)
        {CONTRACT: lambda d: d['project']['resources']['users.user'].update(search=[])},
        [
            ('S012', f'{DRAFTS}#/list/filters/0'),
            ('S012', f'{BOARD}#/board/filters/0'),
            ('S012', f'{CALENDAR}#/calendar/filters/0'),
            ('S012', f'{CARD}#/card/sections/0/fields/2'),
            ('S012', f'{CARD}#/card/sections/0/fields/3'),
            ('S012', f'{LIST}#/list/filters/1'),
            ('S012', f'{LIST}#/actions/0/fields/1'),
            ('S012', f'{LIST}#/actions/0/fields/3'),
        ],
    ),
    (
        'S013',
        {CONTRACT: lambda d: d['project']['resources']['tasks.task'].update(search=[])},
        [('S013', f'{LIST}#/list/search')],
    ),
    (
        'S007',
        # the filter of the screen and its highlight by fields that the entity does not declare
        {LIST: lambda d: d['list'].update(filter={'rank': 1}, highlight={'field': 'is_late', 'tone': 'danger', 'label': {'en': 'Late', 'ru': 'Опоздание'}})},
        [('S007', f'{LIST}#/list/filter/rank'), ('S007', f'{LIST}#/list/highlight/field')],
    ),
    (
        'S008',
        # the filter of the screen by a field that the contract cannot filter by
        {LIST: lambda d: d['list'].update(filter={'dt_created': '2026-01-01'}),
         CONTRACT: lambda d: [d['project']['resources']['tasks.task']['fields']['dt_created'].pop('filter')],
         CALENDAR: lambda d: d['calendar'].update(field='dt_created')},
        # and the filter of the user by it, the charts of the home by week and by month and the
        # days of the calendar by it (whose add is S034: the backend sets the date)
        [('S008', f'{HOME}#/dashboard/charts/1/by'), ('S008', f'{HOME}#/dashboard/charts/2/by'),
         ('S034', f'{CALENDAR}#/calendar/add'),
         ('S008', f'{CALENDAR}#/calendar/field'),
         ('S008', f'{LIST}#/list/filters/3'), ('S008', f'{LIST}#/list/filter/dt_created')],
    ),
    (
        'S014',
        # a boolean for a text, a text for a relationship is an id; a highlight by a text
        {LIST: lambda d: d['list'].update(filter={'title': True, 'status': 'done', 'assignee': False},
                                          highlight={'field': 'title', 'tone': 'warning', 'label': {'en': 'Titled', 'ru': 'С названием'}})},
        [('S014', f'{LIST}#/list/filter/title'), ('S014', f'{LIST}#/list/filter/assignee'),
         ('S014', f'{LIST}#/list/highlight/field')],
    ),
    (
        'S014',
        # a highlight without its label: told by its color alone
        {LIST: lambda d: d['list'].update(highlight={'field': 'title', 'tone': 'warning'})},
        [('S014', f'{LIST}#/list/highlight'), ('S014', f'{LIST}#/list/highlight/field')],
    ),
    (
        'S016',
        # a map by a text, a filter of the user by a point
        {LIST: lambda d: d['list'].update(map={'field': 'title'}, filters=[*d['list']['filters'], 'location'])},
        [('S016', f'{LIST}#/list/filters/4'), ('S016', f'{LIST}#/list/map/field')],
    ),
    (
        'S017',
        # the users are searched by their username only, and shown by their names: the pickers
        # of the assignee (the filters of a list, of the board and of the calendar, a form, the
        # card) and of the watchers (a form, the card)
        {CONTRACT: lambda d: d['project']['resources']['users.user'].update(search=['username', 'last_name'])},
        [
            ('S017', f'{DRAFTS}#/list/filters/0'),
            ('S017', f'{BOARD}#/board/filters/0'),
            ('S017', f'{CALENDAR}#/calendar/filters/0'),
            ('S017', f'{CARD}#/card/sections/0/fields/2'),
            ('S017', f'{CARD}#/card/sections/0/fields/3'),
            ('S017', f'{LIST}#/list/filters/1'),
            ('S017', f'{LIST}#/actions/0/fields/1'),
            ('S017', f'{LIST}#/actions/0/fields/3'),
        ],
    ),
    (
        'S017',
        # a label that the LIST schema does not filter by (a calculated field) is not a search
        # field: not reported
        {CONTRACT: lambda d: [d['project']['resources']['users.user']['fields'].update(
                                  full_name={'title': 'Full name', 'type': 'string'}),
                              d['project']['resources']['users.user'].update(label=['full_name'], search=['username'])]},
        [],
    ),
    (
        'P013',
        # a point is not any JSON: the contract reads it from the model
        {PRODUCT: lambda d: task(d)['fields'][6].update(type='json')},
        [('P013', f'{PRODUCT}#/entities/0/fields/6'), ('S016', f'{LIST}#/list/map/field')],
    ),
    (
        'S015',
        # the steps of the card by their date, not by their relationship to the task
        {CARD: lambda d: d['card']['related'][0].update(relation='dt_created')},
        [('S015', f'{CARD}#/card/related/0/relation')],
    ),
    (
        'S018',
        # the backend titles a field by its name: a calculated field without a title of its
        # route set, a field whose `verbose_name` is its name
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['fields']['report'].update(title='report'),
                              d['project']['resources']['users.user']['fields']['username'].update(title='username')]},
        [('S018', f'{PRODUCT}#/entities/0/fields/1'), ('S018', f'{PRODUCT}#/entities/1/fields/0')],
    ),
    (
        'S018',
        # the default `verbose_name` of Django (the name with spaces), and a relationship titled
        # by its name (a reverse one has no `verbose_name`): reported alike
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['fields']['dt_created'].update(title='dt created'),
                              d['project']['resources']['tasks.task']['fields']['assignee'].update(title='assignee')]},
        [('S018', f'{PRODUCT}#/entities/0/fields/2'), ('S018', f'{PRODUCT}#/entities/0/fields/3')],
    ),
    (
        'S018',
        # a title other than the name, and a field titled by its name that no entity declares
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['fields']['report'].update(title='Report text'),
                              d['project']['resources']['tasks.task']['fields']['dt_updated'].update(title='dt_updated')]},
        [],
    ),
    (
        'S019',
        # the steps have no attribute of a label: shown by their id
        {CONTRACT: lambda d: d['project']['resources']['tasks.step'].update(label=[])},
        [('S019', f'{PRODUCT}#/entities/2')],
    ),
    (
        'S019',
        # the entity names the fields of its label
        {CONTRACT: lambda d: d['project']['resources']['tasks.step'].update(label=[]),
         PRODUCT: lambda d: d['entities'][2].update(label=['task', 'dt_created'])},
        [],
    ),
    (
        'S020',
        # a bar of a string, a number of a relationship, a phone of a long text
        {PRODUCT: lambda d: [task(d)['fields'][0].update(display={'bar': 100}),
                             task(d)['fields'][1].update(display='phone'),
                             task(d)['fields'][3].update(display='plain')]},
        [('S020', f'{PRODUCT}#/entities/0/fields/0/display'), ('S020', f'{PRODUCT}#/entities/0/fields/1/display'),
         ('S020', f'{PRODUCT}#/entities/0/fields/3/display')],
    ),
    (
        'S020',
        # a phone is a string, and so is a sum of a DecimalField
        {PRODUCT: lambda d: [task(d)['fields'][0].update(display='phone'),
                             d['entities'][1]['fields'][0].update(display={'currency': 'RUB'})]},
        [],
    ),
    (
        'S021',
        # a chart by a text, a week of the statuses, and the statuses of an entity without a workflow
        {HOME: lambda d: [d['dashboard']['charts'][0].update(by='title'),
                          d['dashboard']['charts'][1].update(by='status'),
                          d['dashboard']['charts'].append({'id': 'users', 'entity': 'user', 'by': 'status',
                                                           'kind': 'donut', 'label': {'en': 'Users', 'ru': 'Пользователи'}})]},
        [('S021', f'{HOME}#/dashboard/charts/0/by'), ('S021', f'{HOME}#/dashboard/charts/1/bucket'),
         ('S021', f'{HOME}#/dashboard/charts/1/last'), ('S021', f'{HOME}#/dashboard/charts/3/by')],
    ),
    (
        'S049',
        # the sum of a text, the maximum of a relationship, the average of a date; the minimum
        # of a date is a date
        {HOME: lambda d: [d['dashboard']['tiles'][0].update(value={'min': 'due'}),
                          d['dashboard']['tiles'][3].update(value={'max': 'assignee'}),
                          d['dashboard']['tiles'][4].update(value={'sum': 'title'}),
                          d['dashboard']['charts'][2].update(value={'avg': 'due'})]},
        [('S049', f'{HOME}#/dashboard/tiles/3/value/max'), ('S049', f'{HOME}#/dashboard/tiles/4/value/sum'),
         ('S049', f'{HOME}#/dashboard/charts/2/value/avg')],
    ),
    (
        'S049',
        # the hours of a string that is not a DecimalField in the contract (a text of the model):
        # the core does not sum it
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['fields']['hours'].pop('format')]},
        [('S049', f'{HOME}#/dashboard/tiles/4/value/sum'), ('S049', f'{HOME}#/dashboard/charts/2/value/sum')],
    ),
    (
        'S050',
        # the hours that the route set does not filter by; a field that the entity does not declare
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['fields']['hours'].pop('filter')],
         HOME: lambda d: d['dashboard']['tiles'][0].update(value={'sum': 'rank'})},
        [('S007', f'{HOME}#/dashboard/tiles/0/value/sum'), ('S050', f'{HOME}#/dashboard/tiles/4/value/sum'),
         ('S050', f'{HOME}#/dashboard/charts/2/value/sum')],
    ),
    (
        'S022',
        # a column of no status of the workflow, a badge by a text
        {BOARD: lambda d: [d['board'].update(columns=['draft', 'archived']),
                           d['board']['card'].update(badge='title')]},
        # the scenario of the board moves a task to a status that is no longer a column
        [('S022', f'{BOARD}#/board/columns/1'), ('S022', f'{BOARD}#/board/card/badge'),
         ('P022', f'{PRODUCT}#/scenarios/13/steps/6/move/to')],
    ),
    (
        'S022',
        # the steps have no workflow; a step opens no card of a task
        {BOARD: lambda d: [d.update(entity='step'), d['board'].update(card={'title': 'title'}),
                           d['board'].pop('filters'), d['board'].pop('open')]},
        # the scenario of the board moves a step that it did not create, and opens a step that
        # opens nothing
        [('S022', f'{BOARD}#/board/by'), ('P033', f'{PRODUCT}#/scenarios/13/steps/6/move'),
         ('P022', f'{PRODUCT}#/scenarios/13/steps/7/open_item')],
    ),
    (
        'S023',
        # the days of a text, the end of a choice, a tone by a text (and the time of the add of
        # a text: S042)
        {CALENDAR: lambda d: d['calendar'].update(field='title', end='priority',
                                                  tone={'field': 'title', 'tone': 'danger'})},
        [('S023', f'{CALENDAR}#/calendar/field'), ('S023', f'{CALENDAR}#/calendar/end'),
         ('S023', f'{CALENDAR}#/calendar/tone/field'), ('S042', f'{CALENDAR}#/calendar/add/time')],
    ),
    (
        'S024',
        # an unknown section, a section in two tabs, the history in none
        {CARD: lambda d: [d['card']['tabs'][0]['sections'].append('extra'),
                          d['card']['tabs'].__setitem__(2, {'id': 'more', 'title': {'en': 'More', 'ru': 'Ещё'}, 'sections': ['report']})]},
        [('S024', f'{CARD}#/card/tabs/0/sections/2'), ('S024', f'{CARD}#/card/tabs/2/sections/0'),
         ('S024', f'{CARD}#/card/tabs')],
    ),
    (
        'S024',
        # the history of a card without it, a tab declared twice and empty, a section in no tab
        {CARD: lambda d: [d['card'].update(history=False), d['card']['tabs'][0].update(sections=['main']),
                          d['card']['tabs'].append({'id': 'steps', 'title': {'en': 'Steps', 'ru': 'Шаги'}})]},
        [('S024', f'{CARD}#/card/tabs/2/history'), ('S024', f'{CARD}#/card/tabs/3/id'),
         ('S024', f'{CARD}#/card/tabs/3'), ('S024', f'{CARD}#/card/tabs')],
    ),
    (
        'S025',
        # a transition with a payload, an unknown one; a bulk action declared twice
        {LIST: lambda d: d['list']['bulk'].extend([{'id': 'finish-all', 'transit': 'finish'},
                                                   {'id': 'archive-all', 'transit': 'archive'},
                                                   {'id': 'start-all', 'primitive': 'destroy'}])},
        [('S025', f'{LIST}#/list/bulk/2/transit'), ('S025', f'{LIST}#/list/bulk/3/transit'),
         ('S010', f'{LIST}#/list/bulk/4/id')],
    ),
    (
        'S025',
        # the users have no workflow
        {'spec/screens/user-list.yaml': lambda d: {
            'spec': 'bazis-screen/1', 'id': 'user-list', 'route': '/users', 'entity': 'user', 'primitive': 'list',
            'list': {'columns': ['username'], 'bulk': [{'id': 'start-all', 'transit': 'start'}]},
            'states': ['loading', 'empty', 'error', 'forbidden'],
        }},
        [('S025', 'spec/screens/user-list.yaml#/list/bulk/0/transit')],
    ),
    # no screen at `/`: the template shows its overview
    ('S026', {HOME: lambda d: d.update(route='/home')}, [('S026', 'spec/screens')]),
    (
        'S026',
        # a list at `/`, a dashboard without tiles (whose tiles the scenario of the home expects)
        {HOME: lambda d: [d.update(route='/home'), d['dashboard'].pop('tiles')],
         LIST: lambda d: d.update(route='/')},
        [('S026', f'{HOME}#/dashboard'), ('S026', f'{LIST}#/primitive'),
         ('P022', f'{PRODUCT}#/scenarios/12/steps/1/expect/tile/review'),
         ('P022', f'{PRODUCT}#/scenarios/12/steps/1/expect/tile/review-hours')],
    ),
    (
        'S027',
        # the name of the product in its default language only, a label without its Russian, the
        # title of an entity without its Russian; a key of the dictionaries is in every language;
        # the title of a generated card is not shown
        {PRODUCT: lambda d: [d['product'].update(name='Tasks'), d['entities'][1].update(title={'en': 'User'})],
         CARD: lambda d: d.update(title='Task'),
         LIST: lambda d: [d['actions'][0]['label'].pop('ru'), d['list'].update(empty='tasks.empty')],
         f'{I18N}/en.ts': lambda d: "export const en: Messages = {\n  'tasks.empty': 'No tasks yet.',\n};\n",
         MESSAGES: lambda d: 'export const en: Messages = {};\n'},
        [('S027', f'{PRODUCT}#/product/name'), ('S027', f'{PRODUCT}#/entities/1/title'),
         ('S027', f'{LIST}#/actions/0/label')],
    ),
    (
        'S028',
        # a custom screen without the export of its component, another without its module
        {f'{SCREENS}/task-card/index.tsx': lambda d: 'export function TaskCard() {}\n',
         CARD: lambda d: d.update(custom=True),
         LIST: lambda d: [d.update(custom={'module': '@/screens/tasks', 'export': 'TaskListScreen'}), d.pop('extend')]},
        [('S028', f'{CARD}#/custom'), ('S028', f'{LIST}#/custom')],
    ),
    (
        'S029',
        # a screen of its own left next to the generated one; the code of a custom screen
        {f'{SCREENS}/draft-tasks/index.tsx': lambda d: 'export function DraftTasksScreen() {}\n',
         f'{SCREENS}/task-card/index.tsx': lambda d: 'export function TaskCardScreen() {}\n',
         CARD: lambda d: d.update(custom=True),
         LOCK: lambda d: {**lock('client', 'react', *HOOKS, 'template'), 'screens': {}}},
        [('S029', DRAFTS)],
    ),
    (
        'S030',
        # what the backend allows required of the home, which has no entity; the card of an item
        # in a group, a group declared twice with a screen linked twice, an unknown screen, the
        # board with `nav: false`; the form of a custom action with a requirement of its own
        {PRODUCT: lambda d: d.update(navigation=[
            {'screen': 'home', 'requires': {'can': 'view'}},
            {'group': 'tasks', 'title': 'list.actions', 'items': [{'screen': 'task-list'}, {'screen': 'task-card'}]},
            {'group': 'tasks', 'title': 'list.actions', 'items': [{'screen': 'draft-tasks'}, {'screen': 'task-list'}]},
            {'screen': 'reports'},
            {'screen': 'task-board'},
            {'screen': 'suggest-task', 'requires': {'can': 'add'}},
        ]),
         BOARD: lambda d: d.update(nav=False)},
        [('S030', f'{PRODUCT}#/navigation/0/requires'),
         ('S030', f'{PRODUCT}#/navigation/1/items/1/screen'), ('S030', f'{PRODUCT}#/navigation/2/group'),
         ('S030', f'{PRODUCT}#/navigation/2/items/1/screen'), ('S030', f'{PRODUCT}#/navigation/3/screen'),
         ('S030', f'{PRODUCT}#/navigation/4/screen'), ('S030', f'{PRODUCT}#/navigation/5/requires')],
    ),
    (
        'S031',
        # an extension without its export, a custom screen extended, an extension missing
        {f'{SCREENS}/draft-tasks/extend.tsx': lambda d: 'export const other = {};\n',
         f'{SCREENS}/task-card/index.tsx': lambda d: 'export function TaskCardScreen() {}\n',
         DRAFTS: lambda d: d.update(extend=True),
         CARD: lambda d: d.update(custom=True, extend=True),
         BOARD: lambda d: d.update(extend=True)},
        [('S031', f'{DRAFTS}#/extend'), ('S031', f'{BOARD}#/extend'), ('S031', f'{CARD}#/extend')],
    ),
    (
        'S033',
        # a screen named as the board in the code, an action as the "add here" of the steps
        {'spec/screens/task_board.yaml': lambda d: {
            **read(SAMPLE_SPEC / 'screens' / 'task-board.yaml'), 'id': 'task_board', 'route': '/board-2',
        },
         CARD: lambda d: d['actions'].append({'id': 'add_step', 'primitive': 'form', 'mode': 'create'})},
        [('S033', f'{CARD}#/card/related/0/add/id'), ('S033', 'spec/screens/task_board.yaml#/id')],
    ),
    (
        'S055',
        # a screen with the id of the menu of the top bar (`nav:more`)
        {'spec/screens/more.yaml': lambda d: {
            **read(SAMPLE_SPEC / 'screens' / 'task-board.yaml'), 'id': 'more', 'route': '/more',
        }},
        [('S055', 'spec/screens/more.yaml#/id')],
    ),
    (
        'P022',
        # a custom action of a list is run on a row: the scenarios run it on the card
        {PRODUCT: lambda d: d['scenarios'].append({'id': 'manager-escalates-a-draft', 'role': 'manager', 'steps': [
            {'open': 'draft-tasks'}, {'action': 'escalate'},
        ]})},
        [('P022', f'{PRODUCT}#/scenarios/20/steps/1/action')],
    ),
    (
        'P023',
        # the dialog of a custom action asks for the properties of its `fields` only
        {PRODUCT: lambda d: steps(d, 16)[6].update(fill={'level': 1})},
        [('P023', f'{PRODUCT}#/scenarios/16/steps/6/fill/level')],
    ),
    (
        'S032',
        # an action that the route set does not have; one of the route set on a card and of an
        # item in the toolbar of a list
        {CARD: lambda d: d['actions'].extend([
            {'id': 'archive', 'primitive': 'custom', 'action': 'archive', 'label': {'en': 'Archive', 'ru': 'В архив'}},
            {'id': 'count', 'primitive': 'custom', 'action': 'count', 'label': {'en': 'Count', 'ru': 'Посчитать'}},
        ]),
         DRAFTS: lambda d: d['list'].pop('row_actions')},
        [('S032', f'{DRAFTS}#/actions/0/action'), ('S032', f'{CARD}#/actions/2/action'),
         ('S032', f'{CARD}#/actions/3/action')],
    ),
    (
        'S032',
        # a property that the body does not have, one that it requires and the dialog does not
        # ask for, of the card, the rows and the bulk action (which asks for none)
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_escalate']['body'].update(
            required=['priority']),
         CARD: lambda d: d['actions'][1]['fields'].append('level')},
        [('S032', f'{DRAFTS}#/actions/0'), ('S032', f'{CARD}#/actions/1/fields/1'),
         ('S032', f'{LIST}#/list/bulk/1')],
    ),
    (
        'S032',
        # an action declared with GET reads: no button runs it
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_escalate'].update(method='get')},
        [('S032', f'{DRAFTS}#/actions/0/action'), ('S032', f'{CARD}#/actions/1/action'),
         ('S032', f'{LIST}#/list/bulk/1/action')],
    ),
    (
        'S032',
        # an action that requires of the item what a list does not tell per row: on the rows and
        # in a bulk action, not on the card
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_escalate'].update(
            access_action='approve')},
        [('S032', f'{DRAFTS}#/actions/0/action'), ('S032', f'{LIST}#/list/bulk/1/action')],
    ),
    (
        'S010',
        # a custom action of a board; a row action that is not a custom action of the list
        {BOARD: lambda d: d.update(actions=[
            {'id': 'escalate', 'primitive': 'custom', 'action': 'escalate', 'label': {'en': 'Escalate', 'ru': 'Повысить'}},
        ]),
         DRAFTS: lambda d: d['list']['row_actions'].append('open')},
        [('S010', f'{DRAFTS}#/list/row_actions/1'), ('S010', f'{BOARD}#/actions/0')],
    ),
    (
        'S033',
        # two custom bulk actions named alike in the code (`escalateAllBulk`)
        {LIST: lambda d: d['list']['bulk'].append(
            {'id': 'escalate_all', 'action': 'escalate', 'label': {'en': 'Escalate', 'ru': 'Повысить'}},
        )},
        [('S033', f'{LIST}#/list/bulk/2/id')],
    ),
    (
        'S034',
        # the add of a calendar on the day of the creation, which the backend sets itself
        {CALENDAR: lambda d: d['calendar'].update(field='dt_created')},
        [('S034', f'{CALENDAR}#/calendar/add')],
    ),
    (
        'S035',
        # two create actions without a label, one with the label of the add of the calendar; a
        # create action of a dashboard without a label
        {LIST: lambda d: d['actions'].extend([
            {'id': 'create-draft', 'primitive': 'form', 'mode': 'create'},
            {'id': 'create-other', 'primitive': 'form', 'mode': 'create'},
            {'id': 'create-again', 'primitive': 'form', 'mode': 'create', 'label': d['actions'][0]['label']},
        ]),
         HOME: lambda d: [d['dashboard']['actions'][0].pop('label')]},
        [('S035', f'{HOME}#/dashboard/actions/0'), ('S035', f'{LIST}#/actions/2'), ('S035', f'{LIST}#/actions/3')],
    ),
    (
        'S036',
        # keys of the dictionaries: one of the product, one of the components, one of none
        {LIST: lambda d: d['list'].update(empty='tasks.empty'),
         BOARD: lambda d: d.update(title='list.actions'),
         CALENDAR: lambda d: d.update(title='tasks.calendar'),
         f'{I18N}/ru.ts': lambda d: "export const ru: Messages = {\n  'tasks.empty': 'Задач нет.',\n};\n",
         MESSAGES: lambda d: "export const en: Messages = {\n  'list.actions': 'Actions',\n};\n"},
        [('S036', f'{CALENDAR}#/title')],
    ),
    (
        'S037',
        # the keys of a screen that is not there, of an action that is not there, of a text that
        # the spec does not give; those of a text of the specs and of a custom screen are kept
        {f'{I18N}/en.ts': lambda d: (
            'export const en: Messages = {\n'
            "  'screens.task-list.title': 'All the tasks',\n"
            "  'screens.reports.title': 'Reports',\n"
            "  'screens.task-list.actions.archive.label': 'Archive',\n"
            "  'screens.task-board.description': 'The board',\n"
            "  'tasks.count': 'Count',\n"
            '};\n'
        ),
         MESSAGES: lambda d: 'export const en: Messages = {};\n',
         BOARD: lambda d: [d.pop('description')]},
        [('S037', f'{I18N}/en.ts'), ('S037', f'{I18N}/en.ts'), ('S037', f'{I18N}/en.ts')],
    ),
    (
        'S038',
        # a card and an update form without the id of their item in their route; a custom card
        # and a custom update form find their item themselves
        {CARD: lambda d: d.update(route='/task'),
         'spec/screens/task-edit.yaml': lambda d: {
             'spec': 'bazis-screen/1', 'id': 'task-edit', 'route': '/edit', 'entity': 'task', 'primitive': 'form',
             'form': {'mode': 'update'}, 'states': ['loading', 'error', 'forbidden', 'invalid'],
         },
         'spec/screens/my-task.yaml': lambda d: {
             'spec': 'bazis-screen/1', 'id': 'my-task', 'route': '/my-task', 'entity': 'task', 'primitive': 'card',
             'custom': True, 'card': {'sections': [{'id': 'main', 'fields': ['title']}]},
             'states': ['loading', 'error', 'forbidden', 'not_found'],
         },
         'spec/screens/my-task-edit.yaml': lambda d: {
             'spec': 'bazis-screen/1', 'id': 'my-task-edit', 'route': '/my-task/edit', 'entity': 'task',
             'primitive': 'form', 'custom': True, 'form': {'mode': 'update'},
             'states': ['loading', 'error', 'forbidden', 'invalid'],
         },
         f'{SCREENS}/my-task/index.tsx': lambda d: 'export function MyTaskScreen() {}\n',
         f'{SCREENS}/my-task-edit/index.tsx': lambda d: 'export function MyTaskEditScreen() {}\n'},
        [('S038', f'{CARD}#/route'), ('S038', 'spec/screens/task-edit.yaml#/route')],
    ),
    (
        'S039',
        # a sort read as the sorts that the user may choose: a field twice, its `-` or not
        {LIST: lambda d: d['list'].update(sort=['dt_created', 'title', '-dt_created']),
         HOME: lambda d: d['dashboard']['recent'][0].update(sort=['-dt_created', 'dt_created'])},
        [('S039', f'{HOME}#/dashboard/recent/0/sort/1'), ('S039', f'{LIST}#/list/sort/2')],
    ),
    (
        'S040',
        # a route set that narrows its actions without the fields of its filters: the filters of
        # the list and of the board, the filters and the report of the drafts
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['actions'].pop('get_route_filter_fields')]},
        [('S040', f'{DRAFTS}#/list/filters'), ('S040', f'{DRAFTS}#/list/filter'),
         ('S040', f'{BOARD}#/board/filters'), ('S040', f'{CALENDAR}#/calendar/filters'), ('S040', f'{LIST}#/list/filters')],
    ),
    (
        'S040',
        # a report that the navigation does not link reads no filters of its link: only the
        # filters of the board and of the list are reported
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['actions'].pop('get_route_filter_fields')],
         PRODUCT: lambda d: [d['navigation'].pop(1)],
         DRAFTS: lambda d: d['list'].pop('filters')},
        [('S040', f'{BOARD}#/board/filters'), ('S040', f'{CALENDAR}#/calendar/filters'), ('S040', f'{LIST}#/list/filters')],
    ),
    (
        'S040',
        # the navigation is generated (none in the product): a report with `nav: false` is not
        # linked, so only the filters of the board and of the list are reported
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['actions'].pop('get_route_filter_fields')],
         PRODUCT: lambda d: d.pop('navigation'),
         DRAFTS: lambda d: [d.update(nav=False), d['list'].pop('filters')]},
        [('S040', f'{BOARD}#/board/filters'), ('S040', f'{CALENDAR}#/calendar/filters'), ('S040', f'{LIST}#/list/filters')],
    ),
    (
        'S040',
        # the navigation is generated: a route with `:` is not linked either (the scenarios,
        # which open the report, are left out)
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['actions'].pop('get_route_filter_fields')],
         PRODUCT: lambda d: [d.pop('navigation'), d.pop('scenarios')],
         DRAFTS: lambda d: [d.update(route='/drafts/:kind'), d['list'].pop('filters')]},
        [('S040', f'{BOARD}#/board/filters'), ('S040', f'{CALENDAR}#/calendar/filters'), ('S040', f'{LIST}#/list/filters')],
    ),
    (
        'S040',
        # the navigation is generated: an ordinary report is linked, and so is read
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['actions'].pop('get_route_filter_fields')],
         PRODUCT: lambda d: d.pop('navigation'),
         DRAFTS: lambda d: d['list'].pop('filters')},
        [('S040', f'{DRAFTS}#/list/filter'), ('S040', f'{BOARD}#/board/filters'), ('S040', f'{CALENDAR}#/calendar/filters'), ('S040', f'{LIST}#/list/filters')],
    ),
    (
        'S040',
        # a report with `nav: false` that the navigation of the product lists (in a group) is linked
        # (S030: a screen with `nav: false` is no entry of the navigation)
        {CONTRACT: lambda d: [d['project']['resources']['tasks.task']['actions'].pop('get_route_filter_fields')],
         DRAFTS: lambda d: [d.update(nav=False), d['list'].pop('filters')]},
        [('S040', f'{DRAFTS}#/list/filter'), ('S040', f'{BOARD}#/board/filters'), ('S040', f'{CALENDAR}#/calendar/filters'), ('S040', f'{LIST}#/list/filters'),
         ('S030', f'{PRODUCT}#/navigation/1/items/1/screen')],
    ),
    (
        'S041',
        # the add of the calendar by a date-time field that the create route takes (the due of
        # the sample), whose fields leave it out: the time cannot be picked (the scenario that
        # fills it removed)
        {CALENDAR: lambda d: d['calendar']['add'].update(fields=['title']), PRODUCT: no_calendar_scenario},
        [('S041', f'{CALENDAR}#/calendar/add/fields')],
    ),
    (
        'S041',
        # the create route does not take the field: S034 only, the fields cannot give the time
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['create'].remove('due'),
         CALENDAR: lambda d: d['calendar']['add'].update(fields=['title']), PRODUCT: no_calendar_scenario},
        [('S034', f'{CALENDAR}#/calendar/add')],
    ),
    (
        'S041',
        # no S041: the fields list the field, or the add lists none (all the writable fields)
        {CALENDAR: lambda d: d['calendar']['add'].update(fields=['due', 'title'])},
        [],
    ),
    (
        'S041',
        {CALENDAR: lambda d: d['calendar']['add'].pop('fields')},
        [],
    ),
    (
        'S041',
        # no S041 for a date field: the day is all of it (without the time of a date-time)
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['fields']['due'].update(format='date'),
         PRODUCT: lambda d: [field(task(d), 'due').update(type='date'), no_calendar_scenario(d)],
         CALENDAR: lambda d: [d['calendar']['add'].update(fields=['title']), d['calendar']['add'].pop('time')]},
        [],
    ),
    (
        'S042',
        # a duration of the add of a calendar without an end
        {CALENDAR: lambda d: d['calendar']['add'].update(duration=30)},
        [('S042', f'{CALENDAR}#/calendar/add/duration')],
    ),
    (
        'S042',
        # a duration whose end the form of the add leaves out
        {**WITH_END, CALENDAR: lambda d: [d['calendar'].update(end='ends'), d['calendar']['add'].update(duration=30)]},
        [('S042', f'{CALENDAR}#/calendar/add/duration')],
    ),
    (
        'S043',
        # the end of an item shown empty in the form of the add: the user fills it each time
        {**WITH_END, CALENDAR: lambda d: [d['calendar'].update(end='ends'), d['calendar']['add'].update(fields=['title', 'due', 'ends'])]},
        [('S043', f'{CALENDAR}#/calendar/add')],
    ),
    (
        'S043',
        # no S043: the end starts the duration after the start
        {**WITH_END, CALENDAR: lambda d: [d['calendar'].update(end='ends'),
                                          d['calendar']['add'].update(fields=['title', 'due', 'ends'], duration=30)]},
        [],
    ),
    # the public screens: an anonymous role (`visitor`) in their roles
    (
        'S044',
        # a public board moves its items, a public calendar adds one; both open a card of a
        # session
        {BOARD: lambda d: d['roles'].append('visitor'), CALENDAR: lambda d: d['roles'].append('visitor')},
        [('S044', f'{BOARD}#/board/move'), ('S045', f'{BOARD}#/board/open'),
         ('S044', f'{CALENDAR}#/calendar/add'), ('S045', f'{CALENDAR}#/calendar/open')],
    ),
    (
        'S044',
        # a public card: its deletion, its edit and "add here"; its deletion leads to a list of
        # a session, its custom action is not public, and it is in the layout of a list of a
        # session
        {CARD: lambda d: d['roles'].append('visitor')},
        [('S044', f'{CARD}#/actions/0'), ('S044', f'{CARD}#/card/edit'), ('S044', f'{CARD}#/card/related/0/add'),
         ('S045', f'{CARD}#/actions/0/then'), ('S045', f'{CARD}#/route'), ('S046', f'{CARD}#/actions/1/action')],
    ),
    (
        'S044',
        # a public list with a create form and bulk actions, whose card is of a session; a
        # public dashboard with a create form, whose tiles and last items lead to a session
        {LIST: lambda d: [d['roles'].append('visitor'), d.pop('extend')],
         HOME: lambda d: d['roles'].append('visitor')},
        [('S044', f'{HOME}#/dashboard/actions/0'), ('S045', f'{HOME}#/dashboard/actions/0/then'),
         ('S045', f'{HOME}#/dashboard/tiles/0/open'), ('S045', f'{HOME}#/dashboard/recent/0/open'),
         ('S045', f'{CARD}#/route'), ('S044', f'{LIST}#/actions/0'), ('S044', f'{LIST}#/list/bulk'),
         ('S045', f'{LIST}#/list/open'), ('S045', f'{LIST}#/actions/0/then')],
    ),
    (
        'S045',
        # the public list opens a card of a session
        {PUBLIC: lambda d: d['list'].update(open='task-card')},
        [('S045', f'{PUBLIC}#/list/open')],
    ),
    (
        'S045',
        # a public card outside the layout of a list (its route continues none) links back to
        # the list that opens it, which is of a session
        {'spec/screens/guest-task.yaml': lambda d: {
             'spec': 'bazis-screen/1', 'id': 'guest-task', 'route': '/guest-task/:id', 'entity': 'task',
             'primitive': 'card', 'roles': ['visitor'], 'card': {'sections': [{'id': 'main', 'fields': ['title']}]},
             'states': ['loading', 'error', 'forbidden', 'not_found'],
         },
         'spec/screens/all-tasks.yaml': lambda d: {
             'spec': 'bazis-screen/1', 'id': 'all-tasks', 'route': '/all-tasks', 'entity': 'task',
             'primitive': 'list', 'roles': ['manager'], 'list': {'columns': ['title'], 'open': 'guest-task'},
             'states': ['loading', 'empty', 'error', 'forbidden'],
         }},
        [('S045', 'spec/screens/guest-task.yaml#/roles')],
    ),
    (
        'S048',
        # the router of a product changed before 0.4.0 routes the generated screens of a session
        # only, not the public screen of the guests
        {'frontend/src/app/router.tsx': lambda d: (
            "import { BrowserRouter } from 'react-router';\n\n"
            "import { SCREEN_ROUTES } from \"@/screens/generated/routes\";\n"
        )},
        [('S048', 'frontend/src/app/router.tsx')],
    ),
    (
        'S046',
        # the action of the guests is not declared `public=True`
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_suggest'].update(public=False)},
        [('S046', f'{PUBLIC}#/actions/0/action'), ('S046', f'{SUGGEST}#/form/action')],
    ),
    (
        'S047',
        # no screen of the guests (nor their scenarios)
        {PUBLIC: lambda d: d.__delitem__('roles'), SUGGEST: lambda d: d.__delitem__('roles'),
         PRODUCT: lambda d: d.update(scenarios=d['scenarios'][:-2])},
        [('S047', f'{PRODUCT}#/roles/2')],
    ),
    (
        'S032',
        # the form of an action runs one of the route set, not one of an item
        {SUGGEST: lambda d: d['form'].update(action='escalate')},
        [('S032', f'{SUGGEST}#/form/action')],
    ),
    (
        'S032',
        # an action of the route set declared with GET reads: neither the toolbar nor a form runs it
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_suggest'].update(method='get')},
        [('S032', f'{PUBLIC}#/actions/0/action'), ('S032', f'{SUGGEST}#/form/action')],
    ),
    (
        'S032',
        # the form of an action asks for a property that its body does not have, and not for
        # one that it requires (nor does the dialog of the same action)
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_suggest']['body'].update(
            required=['title', 'priority']),
         SUGGEST: lambda d: d['form']['fields'].append('report')},
        [('S032', f'{PUBLIC}#/actions/0'), ('S032', f'{SUGGEST}#/form/fields/1'), ('S032', f'{SUGGEST}#/form')],
    ),
    (
        'S052',
        # the form of the guests asks for the assignee, the picker of the users, whom the
        # guests do not view
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_suggest']['body'][
            'properties'].update(assignee={'type': 'string', 'format': 'uuid', 'title': 'Assignee'}),
         PRODUCT: lambda d: d['entities'][1].update(access={'visitor': {'view': 'none'}}),
         SUGGEST: lambda d: d['form']['fields'].append('assignee')},
        [('S052', f'{SUGGEST}#/form/fields/1')],
    ),
    (
        'S053',
        # the message of the result shows what the answer of the action does not have
        {SUGGEST: lambda d: d['form']['result'].update(message={'en': 'Task {task}, number {number}', 'ru': 'Задача {task}'})},
        [('S053', f'{SUGGEST}#/form/result/message')],
    ),
    (
        'S053',
        # the action answers no JSON
        {CONTRACT: lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_suggest'].update(
            response=None)},
        [('S053', f'{SUGGEST}#/form/result/message')],
    ),
    (
        'S054',
        # the form and the dialog of an action ask for a list of texts, and the payload of a
        # transition for a union: typed as JSON
        {CONTRACT: lambda d: (
            d['project']['resources']['tasks.task']['custom_actions']['action_suggest']['body']['properties'].update(
                tags={'type': 'array', 'items': {'type': 'string'}}),
            d['capabilities']['statusy']['models']['tasks.task']['transits'][0]['payload']['schema']['properties'].update(
                report={'anyOf': [{'type': 'string'}, {'type': 'integer'}]}),
         ),
         SUGGEST: lambda d: d['form']['fields'].append('tags'),
         PUBLIC: lambda d: d['actions'][0]['fields'].append('tags')},
        [('S054', f'{PRODUCT}#/entities/0/workflow/transitions/1/payload/fields/0'),
         ('S054', f'{PUBLIC}#/actions/0/fields/1'), ('S054', f'{SUGGEST}#/form/fields/1')],
    ),
    (
        'S006',
        # the form of an action saves no item: no screen of an item after it
        {SUGGEST: lambda d: (d.update(roles=['viewer']), d['form'].update(then='task-card')),
         PRODUCT: lambda d: d.update(scenarios=d['scenarios'][:-1])},
        [('S006', f'{SUGGEST}#/form/then')],
    ),
    (
        'S009',
        # the form of an action with a result renders it
        {SUGGEST: lambda d: d['states'].remove('done')},
        [('S009', f'{SUGGEST}#/states')],
    ),
    (
        'S006',
        # a row of a list and a row of the last items open an item in a custom card that finds
        # its item itself: its route has nowhere to put the id
        {'spec/screens/my-task.yaml': lambda d: {
             'spec': 'bazis-screen/1', 'id': 'my-task', 'route': '/my-task', 'entity': 'task', 'primitive': 'card',
             'custom': True, 'card': {'sections': [{'id': 'main', 'fields': ['title']}]},
             'states': ['loading', 'error', 'forbidden', 'not_found'],
         },
         f'{SCREENS}/my-task/index.tsx': lambda d: 'export function MyTaskScreen() {}\n',
         LIST: lambda d: d['list'].update(open='my-task'),
         HOME: lambda d: d['dashboard']['recent'][0].update(open='my-task')},
        [('S006', f'{HOME}#/dashboard/recent/0/open'), ('S006', f'{LIST}#/list/open')],
    ),
    (
        'S004',
        # the parts of a dashboard name their entity
        {HOME: lambda d: d['dashboard']['tiles'][0].update(entity='ticket')},
        [('S004', f'{HOME}#/dashboard/tiles/0/entity')],
    ),
    (
        'S006',
        # a tile opens a list of its entity, a row of the last items a card of it
        {HOME: lambda d: [d['dashboard']['tiles'][0].update(open='task-card'),
                          d['dashboard']['recent'][0].update(open='task-list'),
                          d['dashboard']['tiles'][1].update(entity='step', filter={'title': 'Book'}, open='draft-tasks')]},
        [('S006', f'{HOME}#/dashboard/tiles/0/open'), ('S006', f'{HOME}#/dashboard/recent/0/open'),
         ('S006', f'{HOME}#/dashboard/tiles/1/open')],
    ),
    (
        'S007',
        # the fields of the parts of a dashboard are those of their entity
        {HOME: lambda d: [d['dashboard']['tiles'][0].update(filter={'rank': 1}),
                          d['dashboard']['recent'][0]['columns'].append('rank'),
                          d['dashboard']['actions'][0]['fields'].append('rank')]},
        [('S007', f'{HOME}#/dashboard/tiles/0/filter/rank'), ('S007', f'{HOME}#/dashboard/recent/0/columns/3'),
         ('S007', f'{HOME}#/dashboard/actions/0/fields/1')],
    ),
    (
        'S014',
        # the filter of a tile by a value of another type
        {HOME: lambda d: d['dashboard']['tiles'][3].update(filter={'title': True})},
        [('S014', f'{HOME}#/dashboard/tiles/3/filter/title')],
    ),
    ('D001', {TOKENS: lambda d: '{'}, [('D001', TOKENS)]),
    ('D002', {THEME: lambda d: d.update(preset='admin')}, [('D002', f'{THEME}#/preset')]),
    (
        'D003',
        {TOKENS: lambda d: d['color']['primary'].update({'$type': 'colour'})},
        [('D003', f'{TOKENS}#/color/primary/$type')],
    ),
    (
        'D004',
        {TOKENS: lambda d: d['color']['sidebar-foreground'].update({'$value': '{color.text}'})},
        [('D004', f'{TOKENS}#/color/sidebar-foreground/$value')],
    ),
    (
        'D004',
        # a cycle: color.sidebar-foreground references color.foreground
        {TOKENS: lambda d: [d['color']['sidebar-foreground'].update({'$value': '{color.foreground}'}),
                            d['color']['foreground'].update({'$value': '{color.sidebar-foreground}'})]},
        [('D004', f'{TOKENS}#/color/foreground/$value'),
         ('D004', f'{TOKENS}#/color/sidebar-foreground/$value')],
    ),
    (
        'D005',
        {TOKENS: lambda d: [d['color'].pop('sidebar'),
                            d['radius'].update({'$type': 'number', '$value': 10})]},
        [('D005', f'{TOKENS}#/radius/$type'), ('D005', f'{THEME}#/preset')],
    ),
    (
        'D006',
        {TOKENS: lambda d: d['font']['heading'].update({'$value': '{color.primary}'})},
        [('D006', f'{TOKENS}#/font/heading/$value')],
    ),
    (
        'D007',
        # a token of the dark mode of no token, and one of another type
        {TOKENS: lambda d: [d['dark']['color'].update(brand={'$type': 'color', '$value': 'red'}),
                            d['dark'].update(radius={'$type': 'number', '$value': 1})]},
        [('D007', f'{TOKENS}#/dark/color/brand'), ('D007', f'{TOKENS}#/dark/radius')],
    ),
    ('D008', {THEME: lambda d: d['statuses'].update(archived='neutral')}, [('D008', f'{THEME}#/statuses/archived')]),
    (
        'D009',
        # a muted text too light: on the backgrounds, and the neutral badges mixed from it
        {TOKENS: lambda d: d['color']['muted-foreground'].update({'$value': 'oklch(0.8 0 0)'})},
        [('D009', f'{TOKENS}#/color/muted-foreground')] * 4,
    ),
    (
        'D009',
        # over a palette, at the token of tokens.json that loses the contrast
        {THEME: lambda d: d.update(palette='forest', fonts='inter', shape='soft'),
         TOKENS: lambda d: {'color': {'muted-foreground': {'$type': 'color', '$value': 'oklch(0.8 0 0)'}}}},
        [('D009', f'{TOKENS}#/color/muted-foreground')] * 4,
    ),
    (
        'D010',
        # the dark mode only, and no tokens of the dark mode
        {THEME: lambda d: d.update(mode='dark'), TOKENS: lambda d: [d.pop('dark')]},
        [('D010', f'{THEME}#/mode')],
    ),
    # the dark mode of the palette, under a tokens.json without colors (with them, D012)
    (
        'D010',
        {THEME: lambda d: d.update(mode='dark', palette='slate'), TOKENS: lambda d: [d.pop('dark'), d.pop('color')]},
        [],
    ),
    ('D011', {THEME: lambda d: [d['icons'].pop('task')]}, [('D011', f'{THEME}#/icons')]),
    (
        'D013',
        # names that lucide-react does not have
        {THEME: lambda d: d['icons'].update(task='square-tick'),
         PRODUCT: lambda d: d['navigation'][1]['items'][0].update(icon='list-tick'),
         HOME: lambda d: d['dashboard']['tiles'][0].update(icon='tile-tick')},
        [('D013', f'{HOME}#/dashboard/tiles/0/icon'), ('D013', f'{PRODUCT}#/navigation/1/items/0/icon'),
         ('D013', f'{THEME}#/icons/task')],
    ),
    (
        'D012',
        # the layers under a tokens.json that defines every color, font and radius (of 0.1.0);
        # the surface, whose shadows it leaves, shows (the brand over a palette: the D009 above)
        {THEME: lambda d: d.update(palette='forest', fonts='inter', shape='soft', surface='flat')},
        [('D012', f'{THEME}#/palette'), ('D012', f'{THEME}#/fonts'), ('D012', f'{THEME}#/shape')],
    ),
]


def test_the_cases_cover_every_code():
    assert sorted({code for code, _, _ in CASES}) == sorted(CODES)


@pytest.mark.django_db
def test_the_sample_spec_is_valid(contract):
    out, _ = check()
    assert out == '0 errors, 0 warnings (checked against contract/contract.json).\n'


#: the module that declares what an issue lacks in the backend (bazis-permit and
#: bazis-statusy 2.9), which its hint names; the roles also with the data migration of
#: bazis-permit before 2.9, which the assets support (P015 and P016 also have issues of
#: another kind, with their own hints)
DECLARED_IN = {'P015': '`workflow.py`', 'P016': '`workflow.py`', 'P018': '`roles.py`', 'P019': '`roles.py`'}
DATA_MIGRATION = {'P018', 'P019'}


@pytest.mark.django_db
@pytest.mark.parametrize(('code', 'edits', 'expected'), CASES, ids=[it[0] for it in CASES])
def test_issues(contract, code, edits, expected, monkeypatch):
    root = contract.parent.parent
    for name, change in edits.items():
        if name == VERSIONS:
            installed(monkeypatch, change)
        else:
            edit(root, name, change)

    assert issues(root) == expected
    found = validate(root).issues
    for issue in found:
        assert issue.message and issue.hint
        assert issue.layer == layer_of(issue.file)
    if code in DECLARED_IN:
        assert any(
            DECLARED_IN[code] in it.hint and ('data migration' in it.hint) == (code in DATA_MIGRATION)
            for it in found if it.code == code
        )


@pytest.mark.django_db
def test_an_anonymous_role_logs_in_as_nobody(contract):
    """
    The users who do not log in (`anonymous: true`: the role `visitor` of the sample, whose
    permit role `viewer` is for anonymous users): no `test_user` and no P025 for its
    scenarios; the schema refuses a test user of an anonymous role and a role that is neither
    anonymous nor of a permit role.
    """
    root = contract.parent.parent
    assert read(root / PRODUCT)['roles'][2] == {'id': 'visitor', 'permit': 'viewer', 'title': 'Visitor', 'anonymous': True}
    assert issues(root) == []
    edit(root, PRODUCT, lambda d: d['roles'][2].update(test_user={'username': 'viewer'}))
    assert issues(root) == [('P002', f'{PRODUCT}#/roles/2')]
    edit(root, PRODUCT, lambda d: [d['roles'][2].pop('test_user'), d['roles'][2].pop('anonymous'),
                                   d['roles'][2].pop('permit')])
    assert ('P002', f'{PRODUCT}#/roles/2') in issues(root)


@pytest.mark.django_db
def test_a_custom_action_of_the_toolbar_of_a_list_changes_no_item(contract):
    """
    The guest of the sample runs `suggest`, a custom action of the route set, from the toolbar
    of the public list: it changes no item, so no P033 as for one of the item of a card; an
    action of the rows of a list is still run on its card or as a bulk action (P022).
    """
    root = contract.parent.parent
    suggests = read(root / PRODUCT)['scenarios'][18]
    assert suggests['id'] == 'visitor-suggests-a-task'
    assert suggests['steps'][1] == {'action': 'suggest'}
    assert issues(root) == []
    edit(root, PUBLIC, lambda d: d['list'].update(row_actions=['suggest']))
    assert ('P022', f'{PRODUCT}#/scenarios/18/steps/1/action') in issues(root)


@pytest.mark.django_db
def test_the_form_of_a_custom_action(contract):
    """
    The form of the action of the guests (`suggest-task`) asks for the properties of the body:
    a scenario fills only them (P023), whether the entity has the field or not; a relationship
    of its body is a picker, refused to a guest only when the access of its entity does not let
    the anonymous role view it (S052), never on a screen of a session or with an access that
    the specs leave to the backend; the parameters of a text that is a key of the dictionaries
    are not read (S053).
    """
    root = contract.parent.parent
    scenario = read(root / PRODUCT)['scenarios'][19]
    assert scenario['id'] == 'visitor-suggests-a-task-on-its-page'
    assert issues(root) == []
    edit(root, PRODUCT, lambda d: steps(d, 19)[1].update(fill={'report': 'Done'}))
    assert issues(root) == [('P023', f'{PRODUCT}#/scenarios/19/steps/1/fill/report')]
    edit(root, PRODUCT, lambda d: steps(d, 19)[1].update(fill={'title': 'A task'}))
    edit(root, CONTRACT, lambda d: d['project']['resources']['tasks.task']['custom_actions']['action_suggest']['body'][
        'properties'].update(assignee={'type': 'string', 'format': 'uuid', 'title': 'Assignee'}))
    edit(root, SUGGEST, lambda d: d['form']['fields'].append('assignee'))
    # the access of the users is left to the backend
    assert issues(root) == []
    # the anonymous role views the users (the permit role of the sample does not: P019)
    edit(root, PRODUCT, lambda d: d['entities'][1].update(access={'visitor': {'view': 'all'}}))
    assert issues(root) == [('P019', f'{PRODUCT}#/entities/1/access/visitor/view')]
    edit(root, PRODUCT, lambda d: d['entities'][1].update(access={'visitor': {'view': 'none'}}))
    assert issues(root) == [('S052', f'{SUGGEST}#/form/fields/1')]
    # a screen of a session
    edit(root, SUGGEST, lambda d: d.update(roles=['viewer']))
    edit(root, PRODUCT, lambda d: d.update(scenarios=d['scenarios'][:-1]))
    assert issues(root) == []
    edit(root, SUGGEST, lambda d: d['form']['result'].update(message='suggest.done'))
    assert ('S053', f'{SUGGEST}#/form/result/message') not in issues(root)


def layer_of(file: str) -> str:
    if file in (CONTRACT, LOCK):
        return 'contract'
    # the dictionaries of the frontend, against the texts of the screens, and its router, against
    # the public screens
    if file.startswith(f'{I18N}/') or file == 'frontend/src/app/router.tsx':
        return 'screens'
    return 'product' if file == PRODUCT else file.split('/')[1]


@pytest.mark.django_db
def test_the_assets_follow_the_capabilities(contract):
    root = contract.parent.parent
    edit(root, LOCK, lambda d: lock('client', 'react', *HOOKS, 'template'))
    assert issues(root) == []
    # the components of a package are added when the product needs them
    edit(root, LOCK, lambda d: lock(
        'client', 'react', *HOOKS, 'status-badge', 'file-field', 'notification-center', 'template'
    ))
    assert issues(root) == []

    # the hooks and a component of bazis-statusy without the package (the specs that need it
    # are wrong too)
    edit(root, CONTRACT, remove_statusy_section)
    c003 = [it for it in issues(root) if it[0] == 'C003']
    assert c003 == [('C003', f'{LOCK}#/assets/react-statusy'), ('C003', f'{LOCK}#/assets/status-badge')]

    # a lock that cannot be read is front.W001
    edit(root, LOCK, lambda d: '{')
    assert not [it for it in issues(root) if it[0] == 'C003']


@pytest.mark.django_db
def test_the_starters_are_valid(sample_app, tmp_path):
    with override_settings(BASE_DIR=str(tmp_path)):
        call_command('bazis_front', 'init', '--no-node', stdout=StringIO())
        call_command('bazis_front', 'contract', '--no-node', stdout=StringIO(), stderr=StringIO())
        out, _ = check()
    assert out == '0 errors, 0 warnings (checked against contract/contract.json).\n'


def test_the_starter_home_once_the_product_has_entities(contract):
    """
    The starter home of `init` follows the schema of the screens and has no tile: once the
    product declares entities, `check` warns that it is to be filled (S026), and only that.
    """
    root = contract.parent.parent
    starter = Path(design.__file__).parent / 'starters' / 'screens' / 'home.yaml'
    shutil.copyfile(starter, root / HOME)
    # the scenario of the home of the sample expects its tiles
    edit(root, PRODUCT, lambda d: [d['scenarios'].pop(12)])
    assert issues(root) == [('S026', f'{HOME}#/dashboard')]


def test_the_texts_and_the_code_of_the_screens(root):
    """
    A text in words is enough for a product of one language, and a map may have more
    languages than the product; the code of the screens is checked once the frontend
    exists; a custom module is one of frontend/src/screens.
    """
    edit(root, PRODUCT, lambda d: d.update(languages=['en'], language='en'))
    edit(root, LIST, lambda d: [d.update(title='Tasks', custom=True), d.pop('extend')])
    edit(root, f'{SCREENS}/task-list/index.tsx', lambda d: 'export function TaskListScreen() {}\n')
    assert issues(root) == []

    edit(root, LIST, lambda d: d.update(custom={'module': '@/screens/../app/router', 'export': 'Router'}))
    assert issues(root) == [('S002', f'{LIST}#/custom')]


@pytest.mark.parametrize('module', ['tasks.tsx', 'tasks.ts', 'tasks/index.tsx', 'tasks/index.ts'])
def test_the_module_of_a_custom_screen(root, module):
    """
    The module of a custom screen is `<path>.tsx`, `.ts`, `<path>/index.tsx` or `.ts`, and
    lists the component among its exports or declares it; never one of the generated screens.
    """
    edit(root, f'{SCREENS}/{module}', lambda d: 'function TaskListScreen() {}\n\nexport { TaskListScreen };\n')
    edit(root, LIST, lambda d: [d.update(custom={'module': '@/screens/tasks', 'export': 'TaskListScreen'}), d.pop('extend')])
    assert issues(root) == []

    edit(root, LIST, lambda d: d.update(custom={'module': '@/screens/generated/task-list', 'export': 'TaskListScreen'}))
    assert issues(root) == [('S002', f'{LIST}#/custom')]


def test_two_implementations_once_the_screens_are_generated(root):
    """
    S029 is told once the frontend generates its screens (the lock has `screens`), never for
    the module of another custom screen. It is told too when the router of the template imports
    the generated screens although the lock lacks them yet (`needs_screens`), and not while the
    router is the product's own.
    """
    edit(root, f'{SCREENS}/draft-tasks/index.tsx', lambda d: 'export function DraftTasksScreen() {}\n')
    edit(root, LOCK, lambda d: lock('client', 'react', *HOOKS, 'template'))
    assert issues(root) == []

    edit(root, LOCK, lambda d: {**d, 'screens': {}})
    assert issues(root) == [('S029', DRAFTS)]

    # the module of the custom list, in the folder of the drafts
    edit(root, f'{SCREENS}/draft-tasks/index.tsx', lambda d: 'export function TaskListScreen() {}\n')
    edit(root, LIST, lambda d: [d.update(custom={'module': '@/screens/draft-tasks', 'export': 'TaskListScreen'}), d.pop('extend')])
    assert issues(root) == []


def test_two_implementations_when_the_router_imports_the_generated_screens(root):
    """
    A router that imports `@/screens/generated` and a lock without `screens` (a frontend made
    before `screens`, updated since): `check` tells S029 for a screen of its own; with the
    router of the product, or a `custom` screen, it says nothing.
    """
    router = 'frontend/src/app/router.tsx'
    edit(root, f'{SCREENS}/draft-tasks/index.tsx', lambda d: 'export function DraftTasksScreen() {}\n')
    edit(root, LOCK, lambda d: lock('client', 'react', *HOOKS, 'template'))

    edit(root, router, lambda d: "import { routes } from '@/screens/home';\n")
    assert issues(root) == []
    assert issues(root, generating=True) == [('S029', DRAFTS)]

    edit(root, router, lambda d: "import { PUBLIC_ROUTES, SCREEN_ROUTES } from '@/screens/generated/routes';\n")
    assert issues(root) == [('S029', DRAFTS)]

    edit(root, DRAFTS, lambda d: d.update(custom=True))
    assert issues(root) == []


@pytest.mark.django_db
def test_a_link_that_requires_an_add_without_a_create_route(contract):
    """
    A link that requires that the user may add an item of a resource without a create route
    in the contract is never shown (S030).
    """
    root = contract.parent.parent
    # the board
    edit(root, PRODUCT, lambda d: d['navigation'][2]['items'][0].update(requires={'can': 'add'}))
    assert issues(root) == []

    edit(root, CONTRACT, lambda d: [d['project']['resources']['tasks.task']['actions'].pop('action_create')])
    assert ('S030', f'{PRODUCT}#/navigation/2/items/0/requires') in issues(root)


@pytest.mark.django_db
def test_a_custom_action_of_the_route_set_named_as_one_of_an_item(contract):
    """
    The route set has `/escalate/` beside `/{item_id}/escalate/` (S032): the toolbar of a list
    runs the first, whose body requires a property, the rows the second, whose body does not.
    """
    root = contract.parent.parent
    edit(root, CONTRACT, lambda d: d['project']['resources']['tasks.task']['custom_actions'].update(action_escalate_all={
        'name': 'escalate', 'item': False, 'method': 'post', 'access_action': None,
        'body': {'type': 'object', 'properties': {'level': {'type': 'integer'}}, 'required': ['level']},
    }))
    edit(root, DRAFTS, lambda d: d['actions'].append(
        {'id': 'escalate-all', 'primitive': 'custom', 'action': 'escalate', 'label': {'en': 'Escalate all', 'ru': 'Повысить все'}},
    ))
    assert issues(root) == [('S032', f'{DRAFTS}#/actions/1')]

    edit(root, DRAFTS, lambda d: d['actions'][1].update(fields=['level']))
    assert issues(root) == []


def test_a_missing_product_spec(root):
    (root / 'spec' / 'product.yaml').unlink()
    assert issues(root) == [('P001', PRODUCT)]
    assert 'is missing' in validate(root).issues[0].message


def test_without_a_contract_only_the_specs_are_checked(root):
    # wrong against the contract of the sample, not against the specs themselves
    edit(root, PRODUCT, lambda d: [task(d)['fields'].append({'id': 'due_date', 'type': 'date'}),
                                   task(d)['access']['manager'].update(delete='all'),
                                   d['roles'][1].update(permit='reader')])
    edit(root, LIST, lambda d: d['list']['filters'].append('due_date'))
    assert issues(root) == []
    assert validate(root).contract is False

    # an error of the specs themselves is found
    edit(root, LIST, lambda d: d['list']['filters'].append('rank'))
    assert issues(root) == [('S007', f'{LIST}#/list/filters/5')]

    out = StringIO()
    with pytest.raises(CommandError, match='The specs have 1 errors'):
        call_command('bazis_front', 'check', stdout=out)
    assert 'not checked against the backend' in out.getvalue()
    assert f'{LIST}#/list/filters/5: S007 error: ' in out.getvalue()


@pytest.mark.django_db
def test_the_related_sections_of_a_card(contract):
    """
    A related section of a card (`card.related`): its entity, its fields, the card that a
    row opens and the action of "add here", against the specs; the relationship that its list
    is filtered by, against the contract; the steps of a scenario in its form.
    """
    root = contract.parent.parent

    def related(**change):
        edit(root, CARD, lambda d: d['card']['related'][0].update(change))

    related(entity='part')
    assert issues(root) == [('S004', f'{CARD}#/card/related/0/entity')]

    # the action of "add here" takes the id of the deletion; a row opens a list
    related(entity='step', columns=['title', 'rank'], add={'id': 'delete', 'fields': ['title', 'note']}, open='task-list')
    assert sorted(issues(root)) == sorted([
        ('S010', f'{CARD}#/card/related/0/add/id'),
        ('S006', f'{CARD}#/card/related/0/open'),
        ('S007', f'{CARD}#/card/related/0/columns/1'),
        ('S007', f'{CARD}#/card/related/0/add/fields/1'),
        # the scenarios run `add-step` or expect it absent, and the card no longer has it
        ('P022', f'{PRODUCT}#/scenarios/1/steps/4/expect/action_absent'),
        ('P022', f'{PRODUCT}#/scenarios/9/steps/5/action'),
        ('P022', f'{PRODUCT}#/scenarios/9/steps/10/expect/action_absent'),
    ])

    # a row opens the card of another entity
    section = {'id': 'steps', 'entity': 'step', 'relation': 'task', 'columns': ['title'], 'open': 'task-card'}
    edit(root, CARD, lambda d: d['card']['related'].__setitem__(0, section))
    assert ('S006', f'{CARD}#/card/related/0/open') in issues(root)

    # the relationship to the task named in the form: shown read-only, never filled
    section = {**section, 'add': {'id': 'add-step', 'fields': ['title', 'task']}}
    del section['open']
    edit(root, CARD, lambda d: d['card']['related'].__setitem__(0, section))
    edit(root, PRODUCT, lambda d: steps(d, 9)[6].update(fill={'title': 'Book the room', 'task': 'Plan the launch'}))
    assert issues(root) == [('P022', f'{PRODUCT}#/scenarios/9/steps/6/fill/task')]

    # the list of the steps is filtered by their task: a field that the contract filters by
    edit(root, CONTRACT, lambda d: [d['project']['resources']['tasks.step']['fields']['task'].pop('filter')])
    assert ('S008', f'{CARD}#/card/related/0/relation') in issues(root)


@pytest.mark.django_db
def test_the_steps_of_the_dashboard_the_board_the_calendar_and_the_bulk_actions(contract):
    """
    The steps of the new primitives are checked on the screen they act on: the tiles and the
    days of a dashboard and a calendar, an item of a dashboard opened `in` its last items, the
    rows of a list selected before its bulk action, an item moved to a column of the board that
    a transition without a payload leads to.
    """
    root = contract.parent.parent
    where = {'where': {'title': 'Review the plan'}}
    edit(root, PRODUCT, lambda d: d['scenarios'].append({'id': 'manager-tries-the-steps', 'role': 'manager', 'steps': [
        {'open': 'home'},
        {'expect': {'tile': {'overdue': 1}}},
        {'expect': {'day': {'2026-10-07': 1}}},
        {'open_item': where},
        {'open': 'draft-tasks'},
        {'select': where},
        {'open': 'task-list'},
        {'bulk': 'start-all'},
        {'select': {'where': {'rank': 1}}},
        {'bulk': 'finish-all'},
        {'open': 'task-board'},
        {'move': {**where, 'to': 'done'}},
        {'move': {**where, 'to': 'archived'}},
        {'open': 'task-calendar'},
        {'expect': {'day': {'2026-10-07': 1}}},
        {'open_item': {**where, 'in': 'last-tasks'}},
    ]}))
    # a day from the day of the run, as the dates of `e2e_data`
    edit(root, PRODUCT, lambda d: d['scenarios'][-1]['steps'].insert(15, {'expect': {'day': {'today': 1, 'today+3': 0, 'today-1': 0}}}))
    steps = f'{PRODUCT}#/scenarios/20/steps'
    assert issues(root) == [
        ('P022', f'{steps}/1/expect/tile/overdue'),
        ('P022', f'{steps}/2/expect/day'),
        ('P022', f'{steps}/3/open_item'),
        ('P022', f'{steps}/5/select'),
        ('P022', f'{steps}/7/bulk'),
        ('P023', f'{steps}/8/select/where/rank'),
        ('P022', f'{steps}/9/bulk'),
        ('P024', f'{steps}/11/move/to'),
        ('P024', f'{steps}/12/move/to'),
        ('P022', f'{steps}/16/open_item'),
    ]
    edit(root, PRODUCT, lambda d: d['scenarios'][-1]['steps'][15]['expect']['day'].update({'tomorrow': 1}))
    assert issues(root) == [('P002', f'{steps}/15/expect/day')]


def test_the_entity_of_a_screen(root):
    """
    Every primitive has an entity but the dashboard, whose parts name theirs.
    """
    edit(root, HOME, lambda d: d.update(entity='task'))
    edit(root, BOARD, lambda d: d.pop('entity'))
    assert issues(root) == [('S002', HOME), ('S002', BOARD)]


@pytest.mark.django_db
def test_json_output(contract):
    root = contract.parent.parent
    edit(root, PRODUCT, lambda d: task(d)['access']['manager'].update(delete='author'))
    out = StringIO()
    with pytest.raises(CommandError, match='The specs have 1 errors'):
        call_command('bazis_front', 'check', '--json', stdout=out)
    result = json.loads(out.getvalue())
    assert result == {
        'contract': True,
        'errors': 1,
        'warnings': 1,
        'issues': [
            {
                'layer': 'product', 'file': PRODUCT, 'path': '/entities/0/access/manager/delete',
                'code': 'P020', 'severity': 'warning', 'message': result['issues'][0]['message'],
                'hint': result['issues'][0]['hint'],
            },
            {
                'layer': 'product', 'file': PRODUCT, 'path': '/entities/0/access/manager/delete',
                'code': 'P019', 'severity': 'error', 'message': result['issues'][1]['message'],
                'hint': result['issues'][1]['hint'],
            },
        ],
    }
    assert '`tasks.task.item.delete.author.all`' in result['issues'][1]['message']


@pytest.mark.django_db
def test_warnings_do_not_fail(contract):
    edit(contract.parent.parent, PRODUCT, lambda d: task(d)['access']['manager'].update(
        change={'selector': 'author', 'statuses': ['draft']}))
    out, _ = check()
    assert 'P020 warning' in out
    assert out.endswith('0 errors, 1 warnings (checked against contract/contract.json).\n')


def test_layers(root):
    edit(root, LIST, lambda d: d.update(entity='job'))
    edit(root, THEME, lambda d: d.update(preset='admin'))
    assert issues(root, layers=('design',)) == [('D002', f'{THEME}#/preset')]
    assert issues(root, layers=('screens',)) == [('S004', f'{LIST}#/entity')]
    assert issues(root, layers=('product',)) == []

    out, _ = check('--layer', 'product')
    assert out.endswith('0 errors, 0 warnings.\n')
    with pytest.raises(CommandError, match='1 errors'):
        check('--layer', 'screens')


def test_check_needs_the_specs(tmp_path):
    with override_settings(BASE_DIR=str(tmp_path)), pytest.raises(CommandError, match='init'):
        check()


@pytest.mark.django_db
def test_an_outdated_package_is_one_report_of_the_system_checks(contract, monkeypatch):
    from bazis.contrib.front.checks import check_packages

    installed(monkeypatch, lambda versions: versions.update({'bazis-ws': '2.4.0'}))
    root = contract.parent.parent
    # an error of `check`, which stops the generation of the end-to-end tests
    assert ('C004', f'{CONTRACT}#/capabilities/ws') in issues(root)
    assert validate(root).errors
    # the system checks report it once: front.W006, not again as front.W002
    assert [it.id for it in check_packages(None)] == ['front.W006']
    assert check_spec(None) == []


@pytest.mark.django_db
def test_the_system_check(root, tmp_path):
    assert check_spec(None) == []

    edit(root, LIST, lambda d: d.update(entity='job'))
    edit(root, PRODUCT, lambda d: [task(d).update(resource='users.user'),
                                   task(d)['access']['manager'].update(view='owner')])
    (root / 'contract').mkdir()
    (root / 'contract' / 'contract.json').write_text(
        json.dumps({'format': CONTRACT_FORMAT, 'capabilities': {'permit': {'roles': []}, 'statusy': {'models': {}}},
                    'project': {'resources': {'users.user': {
                        'actions': {}, 'fields': {}, 'label': [], 'create': [], 'custom_actions': {},
                    }}}}),
        encoding='utf-8',
    )
    messages = check_spec(None)
    assert {it.id for it in messages} == {'front.W002'}
    texts = [it.msg for it in messages]
    assert f'S004 (error) {LIST}#/entity: The entity `job` is not in spec/product.yaml.' in texts
    # the warnings are one message with the count of each code, never a line for each: every
    # management command prints it; `check` lists them
    assert [it for it in texts if 'warning)' in it] == []
    summary = messages[-1]
    assert summary.msg == '6 warnings of the specs (D008 x3, P020 x1, S019 x2).'
    assert 'bazis_front check' in summary.hint
    assert all(it.hint for it in messages)
    # an error of the specs never blocks a management command (migrate, contract...)
    call_command('check', stdout=StringIO(), stderr=StringIO())

    with override_settings(BASE_DIR=str(tmp_path / 'empty')):
        assert check_spec(None) == []


@pytest.mark.django_db
def test_the_selectors_of_bazis_permit(contract):
    root = contract.parent.parent
    # a reverse relation of the user, which the route set does not show: a selector all the same
    edit(root, CONTRACT, lambda d: d['capabilities']['permit']['selectors']['tasks.task'].update(
        members='users.user'))
    selectors = {
        'assignee': None,
        'status_author': None,
        'members': None,
        'self': '`self` is not a selector of `tasks.task`',
        # a many-to-many field to the user
        'watchers': None,
        'reviewers': '`reviewers` is not a selector of `tasks.task`',
        # a path of relations: tasks.task -> users.user -> permit.role, also through a
        # selector the route set does not show; users.user is not a permission model of the
        # contract, its last name is checked to be a relationship
        'assignee__roles': None,
        'members__roles': None,
        'assignee__username': '`username` is not a relationship of `users.user`',
        # a relation that the contract does not describe, neither a field nor a selector (the
        # reverse relation of the task to its steps, which its route set does not show): not
        # checked, bazis-permit checks the selectors of the permissions it declares
        'steps__task__assignee': None,
        'owner__author': None,
        # a field of the contract that is not a relation
        'title__author': '`title` is not a relationship of `tasks.task`',
        'assignee__self': '`self` is the object itself',
        # statusy.status is not a resource of the contract: not checked further
        'status__author': None,
    }
    for selector, problem in selectors.items():
        edit(root, PRODUCT, lambda d, it=selector: task(d)['access']['manager'].update(view=it))
        found = [it for it in validate(root).issues]
        if problem is None:
            assert found == [], selector
        else:
            assert [(it.code, it.path) for it in found] == [('P020', '/entities/0/access/manager/view')], selector
            assert problem in found[0].message


@pytest.mark.django_db
def test_a_missing_permission_through_an_undescribed_relation_is_not_copied(contract):
    # the manager has no permission to delete: the hint of a path that the contract does not
    # describe asks to check it, never to declare it as it is
    root = contract.parent.parent
    edit(root, PRODUCT, lambda d: task(d)['access']['manager'].update(
        delete=['all', 'steps__task__assignee']))
    found = {it.path: it.hint for it in validate(root).issues}
    assert set(found) == {'/entities/0/access/manager/delete/0', '/entities/0/access/manager/delete/1'}
    assert found['/entities/0/access/manager/delete/0'].startswith('Add `tasks.task.item.delete.all.all`')
    hint = found['/entities/0/access/manager/delete/1']
    assert hint.startswith('Check the path of the selector `steps__task__assignee` first: `steps` is not in the contract')
    assert 'tasks.task.item.delete.steps__task__assignee' not in hint


def test_a_text_in_one_language_is_told_its_key(root):
    # the hint of S027 names the key of the text that it is about, which the dictionaries of
    # the frontend may give instead
    edit(root, PRODUCT, lambda d: d['product'].update(name='Tasks'))
    edit(root, LIST, lambda d: [d['actions'][0]['label'].pop('ru')])
    hints = {it.location: it.hint for it in validate(root).issues if it.code == 'S027'}
    assert '(`product.name`)' in hints[f'{PRODUCT}#/product/name']
    assert '(`screens.task-list.actions.create.label`)' in hints[f'{LIST}#/actions/0/label']


@pytest.mark.django_db
def test_a_number_declared_for_a_string_names_the_decimal_field(contract):
    # a DecimalField is a string of the API (the format `decimal` of the contract): the spec
    # declares it `string`; a text declared a number is not told so
    root = contract.parent.parent
    hours = next(i for i, it in enumerate(task(read(root / PRODUCT))['fields']) if it['id'] == 'hours')
    edit(root, PRODUCT, lambda d: [task(d)['fields'][hours].update(type='number'),
                                   task(d)['fields'][0].update(type='number'),
                                   task(d)['fields'][2].update(type='date')])
    hints = {it.path: it.hint for it in validate(root).issues if it.code == 'P013'}
    assert set(hints) == {f'/entities/0/fields/{hours}', '/entities/0/fields/0', '/entities/0/fields/2'}
    assert 'A DecimalField is a string in the API' in hints[f'/entities/0/fields/{hours}']
    assert 'formatDecimal' in hints[f'/entities/0/fields/{hours}']
    assert 'DecimalField' not in hints['/entities/0/fields/0']
    assert 'DecimalField' not in hints['/entities/0/fields/2']


@pytest.mark.django_db
def test_self_is_a_selector_of_a_selector_source(contract):
    root = contract.parent.parent
    edit(root, CONTRACT, lambda d: d['capabilities']['permit']['selectors']['tasks.task'].update(
        self='tasks.task'))
    edit(root, PRODUCT, lambda d: task(d)['access']['manager'].update(view='self'))
    assert validate(root).issues == []


@pytest.mark.django_db
def test_a_selector_has_letters_and_underscores_only(contract):
    # bazis-permit reads a segment with other characters as a query, not as a selector
    root = contract.parent.parent
    edit(root, PRODUCT, lambda d: task(d)['access']['manager'].update(view='team1__author'))
    assert [(it.code, it.path) for it in validate(root).issues] == [
        ('P002', '/entities/0/access/manager/view')
    ]


@pytest.mark.django_db
def test_a_transit_id_generated_by_statusy(contract, sample_app):
    from django.apps import apps

    from bazis.contrib.statusy.models import Status, StatusyContentType, Transit

    transit = Transit.objects.create(
        model=StatusyContentType.objects.get_for_model(apps.get_model('tasks.Task')),
        status_src=Status.objects.get(pk='draft'), status_dst=Status.objects.get(pk='done'),
    )
    assert transit.id == 'task#draft_to_done'
    contract.write_text(render(sample_app)['contract.json'], encoding='utf-8')
    root = contract.parent.parent
    edit(root, PRODUCT, lambda d: [
        task(d)['workflow']['transitions'].append({'id': transit.id, 'from': 'draft', 'to': 'done'}),
        task(d)['access']['manager']['transit'].append(transit.id),
    ])
    found = validate(root).issues
    assert [(it.code, it.path) for it in found] == [('P019', '/entities/0/access/manager/transit/2')]
    assert '`tasks.task.item.transit.all.draft.task#draft_to_done`' in found[0].message

    group = apps.get_model('permit.GroupPermission').objects.get(slug='tasks_transit')
    group.permissions.create(slug='tasks.task.item.transit.all.draft.task#draft_to_done')
    contract.write_text(render(sample_app)['contract.json'], encoding='utf-8')
    assert issues(root) == []


def test_a_product_without_a_login_needs_no_test_users(root):
    # without bazis-users the end-to-end tests do not log in
    def change(data):
        data['packages'].remove('users')
        for role in data['roles']:
            role.pop('test_user', None)

    edit(root, PRODUCT, change)
    assert issues(root) == []


def test_only_true_and_false_are_booleans(root):
    # `No` is the name of the product, not false; `yes` is not the boolean of `search`
    for name, old, new in ((PRODUCT, 'name: Tasks', 'name: No'), (LIST, 'search: true', 'search: yes')):
        text = (root / name).read_text(encoding='utf-8')
        (root / name).write_text(text.replace(old, new), encoding='utf-8')
    assert issues(root) == [('S002', f'{LIST}#/list/search')]


# the slug grammar of bazis-permit


def test_grants_are_covered_by_the_permissions():
    view = Grant('shop.order', 'view', 'author')
    assert view.slug == 'shop.order.item.view.author'
    assert view.covered_by('shop.order.item.view.author')
    assert view.covered_by('shop.order.item.view.all')
    assert view.covered_by('shop.order.item.view.author.all')
    assert not view.covered_by('shop.order.item.view.org_owner')
    # narrower: a selector with conditions
    assert not view.covered_by('shop.order.item.view.author=__selector__&is_active=true')
    assert not view.covered_by('shop.order.item.change.all')
    assert not view.covered_by('shop.orders.item.view.all')

    change = Grant('shop.order', 'change', 'author', 'draft')
    assert change.slug == 'shop.order.item.change.author.draft'
    assert change.covered_by('shop.order.item.change.all.all')
    assert change.covered_by('shop.order.item.change.author.draft')
    assert not change.covered_by('shop.order.item.change.author.paid')
    assert not change.covered_by('shop.order.item.change.author')
    assert not Grant('shop.order', 'change', 'all', 'all').covered_by('shop.order.item.change.all.draft')

    transit = Grant('shop.order', 'transit', 'all', 'draft', 'pay')
    assert transit.slug == 'shop.order.item.transit.all.draft.pay'
    assert transit.covered_by('shop.order.item.transit.all.all.pay')
    assert not transit.covered_by('shop.order.item.transit.author.draft.pay')
    assert not transit.covered_by('shop.order.item.transit.all.draft.cancel')
    assert not transit.covered_by('shop.order.item.transit.all.draft')


# the files of the package


def test_the_schemas_are_valid_and_shipped():
    from jsonschema import Draft202012Validator

    for name, source in schema_files().items():
        schema = json.loads(source.read_text(encoding='utf-8'))
        Draft202012Validator.check_schema(schema)
        assert schema['$schema'] == 'https://json-schema.org/draft/2020-12/schema', name


def test_the_packages_are_the_capabilities():
    schema = json.loads(schema_files()['product.schema.json'].read_text(encoding='utf-8'))
    assert schema['properties']['packages']['items']['enum'] == sorted(capabilities.CAPABILITIES)


PACKAGE = Path(__file__).resolve().parent.parent / 'bazis' / 'contrib' / 'front'


def starters(directory: str) -> list[str]:
    """
    The names of the starters of a layer of the design (`spec/starters/design/<directory>/`).
    """
    return sorted(it.stem for it in (PACKAGE / 'spec' / 'starters' / 'design' / directory).glob('*.json'))


def test_the_starters_define_every_preset():
    # a palette, fonts and a shape give every token of a preset, without tokens.json
    for preset, required in design.PRESET_TOKENS.items():
        for palette in starters('palettes'):
            for fonts in starters('fonts'):
                data = {'preset': preset, 'palette': palette, 'fonts': fonts, 'shape': 'soft'}
                defined = design.effective_tokens(data, None)
                assert {name: defined[name].token['$type'] for name in required} == required, data


@pytest.mark.parametrize('palette', starters('palettes'))
def test_the_palettes_have_the_contrast_of_wcag_aa(palette):
    # every text color of the palette on its background, in the light and the dark mode
    defined = design.tokens_of(design.layer('palettes', palette))
    assert design.has_dark(defined)
    for dark in (False, True):
        values = design.variables(defined, dark=dark)
        for text, background, *opacity in design.CONTRAST:
            ratio = design.pair_contrast(values, text, background, *opacity)
            assert ratio is not None, (text, background)
            assert ratio >= color.AA, (palette, dark, text, background, opacity)


def test_the_translucent_text_colors_of_the_components_are_checked():
    # a text color that a component makes translucent is read at its opacity: D009 checks it
    # as such, so that a palette that passes cannot make the text unreadable
    checked = {(text[2:], round(opacity[0] * 100)) for text, _, *opacity in design.CONTRAST if opacity}
    used = set()
    for path in (PACKAGE / 'assets' / 'ui').rglob('*.tsx'):
        if 'node_modules' in path.parts or path.name.endswith('.test.tsx'):
            continue
        used |= {(name, int(alpha)) for name, alpha in re.findall(r'(?<![\w-])text-([a-z-]+)/(\d+)\b', path.read_text(encoding='utf-8'))}
    assert used and used <= checked, used - checked


def test_the_contrast_of_the_dark_mode(root):
    edit(root, TOKENS, lambda d: d['dark']['color']['muted-foreground'].update({'$value': 'oklch(0.3 0 0)'}))
    result = validate(root)
    found = [it for it in result.issues if it.code == 'D009']
    assert found and {it.location for it in found} == {f'{TOKENS}#/dark/color/muted-foreground'}
    assert all('in the dark mode' in it.message for it in found)
    assert {it.severity for it in found} == {'warning'}


def test_the_colors_of_css():
    assert color.parse('#fff') == (1.0, 1.0, 1.0)
    assert color.parse('rgb(0 0 0)') == (0.0, 0.0, 0.0)
    assert color.parse('oklch(1 0 0)') == pytest.approx((1.0, 1.0, 1.0), abs=1e-3)
    assert color.parse('oklch(62.8% 0.2577 29.23)') == pytest.approx((1.0, 0.0, 0.0), abs=2e-3)
    # not opaque, or not computed: not checked
    assert color.parse('oklch(1 0 0 / 10%)') is None
    assert color.parse('hsl(0 0% 0%)') is None
    assert color.parse('var(--x)', {'--x': 'var(--y)', '--y': '#000'}) == (0.0, 0.0, 0.0)
    assert color.parse('var(--x)', {'--x': 'var(--x)'}) is None
    assert color.parse('color-mix(in srgb, #fff 50%, #000)') == (0.5, 0.5, 0.5)
    assert round(color.contrast((1.0, 1.0, 1.0), (0.0, 0.0, 0.0)), 2) == 21.0


def test_every_code_is_documented():
    documented = dict(re.findall(r'^\| `([CPSD]\d{3})` \| (error|warning) \|', AGENTS_MD.read_text(encoding='utf-8'), re.M))
    assert documented == {code: severity for code, (severity, _) in CODES.items()}


@pytest.mark.django_db
def test_several_grants_of_one_operation(contract):
    """
    An operation with a list of grants (`view: [assignee, status_author]`): the role may do
    it on the objects of any of them, as bazis-permit unites the permissions of a role; each
    is a permission of its own, checked (P019) and its selector too (P020) at its index.
    """
    root = contract.parent.parent

    def viewer_permissions(*slugs):
        def change(data):
            role = next(it for it in data['capabilities']['permit']['roles'] if it['slug'] == 'viewer')
            # and the steps of the tasks, which the viewer views
            role['permissions'] = [*slugs, 'tasks.step.item.view.all']
        edit(root, CONTRACT, change)

    def found():
        return [(it.code, it.path) for it in validate(root).issues]

    grants = ['assignee', {'selector': 'status_author', 'statuses': ['done']}]
    # the guests of the sample view all the tasks through the permit role of the viewer too
    edit(root, PRODUCT, lambda d: [task(d)['access']['viewer'].update(view=grants), task(d)['access'].pop('visitor')])
    # the viewer views all the tasks: `view.all.all` covers both
    assert found() == []
    viewer_permissions('tasks.task.item.view.assignee.all', 'tasks.task.item.view.status_author.done')
    assert found() == []
    viewer_permissions('tasks.task.item.view.assignee.all')
    [issue] = validate(root).issues
    assert (issue.code, issue.path) == ('P019', '/entities/0/access/viewer/view/1')
    assert '`tasks.task.item.view.status_author.done`' in issue.message

    edit(root, PRODUCT, lambda d: task(d)['access']['viewer'].update(view=['assignee', 'reviewers']))
    assert sorted(found()) == [
        ('P019', '/entities/0/access/viewer/view/1'), ('P020', '/entities/0/access/viewer/view/1'),
    ]

    # a transit by several selectors, a status unknown to the workflow in a list
    edit(root, PRODUCT, lambda d: task(d)['access']['viewer'].update(
        view='assignee', transit={'start': ['assignee', 'owner']},
        change=['assignee', {'selector': 'assignee', 'statuses': ['archived']}],
    ))
    assert sorted(found()) == [
        ('P006', '/entities/0/access/viewer/change/1/statuses/0'),
        ('P019', '/entities/0/access/viewer/change/0'),
        ('P019', '/entities/0/access/viewer/change/1'),
        ('P019', '/entities/0/access/viewer/transit/start/0'),
        ('P019', '/entities/0/access/viewer/transit/start/1'),
        ('P020', '/entities/0/access/viewer/transit/start/1'),
    ]

    # `none` grants nothing: it is no grant of a list
    for value in (['assignee', 'none'], [{'selector': 'none', 'statuses': ['done']}], []):
        edit(root, PRODUCT, lambda d, it=value: task(d)['access']['viewer'].update(view=it, change='none', transit=[]))
        assert [code for code, _ in found()] == ['P002'], value
