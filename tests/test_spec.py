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

from .support import SAMPLE_SPEC


AGENTS_MD = Path(__file__).resolve().parent.parent / 'bazis' / 'contrib' / 'front' / 'AGENTS.md'


@pytest.fixture
def root(tmp_path):
    """
    A product root (BASE_DIR) with the specs of the sample and no contract.
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
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


def steps(data, scenario):
    return data['scenarios'][scenario]['steps']


PRODUCT, LIST, CARD = 'spec/product.yaml', 'spec/screens/task-list.yaml', 'spec/screens/task-card.yaml'
DRAFTS = 'spec/screens/draft-tasks.yaml'
HOME, BOARD, CALENDAR = 'spec/screens/home.yaml', 'spec/screens/task-board.yaml', 'spec/screens/task-calendar.yaml'
THEME, TOKENS, CONTRACT = 'spec/design/theme.yaml', 'spec/design/tokens.json', 'contract/contract.json'
LOCK = 'frontend/bazis-front.lock.json'


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
        [('P003', f'{PRODUCT}#/roles/2/id'), ('P003', f'{PRODUCT}#/entities/0/fields/8/id')],
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
        [('P012', f'{PRODUCT}#/entities/0/fields/8')],
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
                             steps(d, 5)[4]['expect'].update(values={'dt_created': 'today', 'due': 'never'}),
                             steps(d, 1).insert(1, {'expect': {'values': {'title': 'Review the plan'}}})]},
        [
            ('P022', f'{PRODUCT}#/scenarios/1/steps/1/expect/values'),
            ('P022', f'{PRODUCT}#/scenarios/5/steps/4/expect/values/dt_created'),
            ('P023', f'{PRODUCT}#/scenarios/5/steps/4/expect/values/due'),
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
        # a language that the backend does not have, and a default that is not one of them
        {PRODUCT: lambda d: d.update(languages=['en', 'de'], language='ru')},
        [('P029', f'{PRODUCT}#/language'), ('P029', f'{PRODUCT}#/languages'), ('P029', f'{PRODUCT}#/language')],
    ),
    (
        'P030',
        # anonymous roles: one whose permit role is not for anonymous users (`guest`), one
        # without a permit role that has access, one with a selector of a user
        {PRODUCT: lambda d: [d['roles'].extend([{'id': 'visitor', 'permit': 'guest', 'anonymous': True},
                                                {'id': 'walker', 'anonymous': True},
                                                {'id': 'public', 'permit': 'viewer', 'anonymous': True}]),
                             task(d)['access'].update(walker={'view': 'all'}, public={'view': 'assignee'})]},
        [
            ('P030', f'{PRODUCT}#/roles/2/permit'),
            ('P030', f'{PRODUCT}#/entities/0/access/walker'),
            ('P030', f'{PRODUCT}#/entities/0/access/public/view'),
        ],
    ),
    (
        'P031',
        # the label of the steps names a field that the step does not declare
        {PRODUCT: lambda d: d['entities'][2].update(label=['task', 'rank'])},
        [('P031', f'{PRODUCT}#/entities/2/label/1')],
    ),
    ('S001', {LIST: lambda d: 'id: [\n'}, [('S001', LIST)]),
    ('S002', {CARD: lambda d: d['states'].append('gone')}, [('S002', f'{CARD}#/states/4')]),
    (
        'S003',
        {CARD: lambda d: d.update(id='task-item', route='/tasks')},
        [('S003', f'{CARD}#/id'), ('S003', f'{LIST}#/route')],
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
        'S007',
        {CARD: lambda d: d['card']['sections'][0]['fields'].append('rank')},
        [('S007', f'{CARD}#/card/sections/0/fields/7')],
    ),
    (
        'S008',
        {CONTRACT: remove_labels},
        # the filter of the drafts (a report) is by the status too, and so are the tiles of the
        # home, its chart by status and the columns of the board; its last tasks are sorted
        [('S008', f'{DRAFTS}#/list/filter/status'), ('S008', f'{DRAFTS}#/list/sort/0'),
         ('S008', f'{HOME}#/dashboard/tiles/0/filter/status'), ('S008', f'{HOME}#/dashboard/tiles/1/filter/status'),
         ('S008', f'{HOME}#/dashboard/tiles/2/filter/status'), ('S008', f'{HOME}#/dashboard/charts/0/by'),
         ('S008', f'{HOME}#/dashboard/recent/0/sort/0'), ('S008', f'{BOARD}#/board/by'),
         ('S008', f'{LIST}#/list/filters/0'), ('S008', f'{LIST}#/list/sort/0')],
    ),
    ('S009', {LIST: lambda d: d['states'].remove('empty')}, [('S009', f'{LIST}#/states')]),
    (
        'S010',
        {LIST: lambda d: d['actions'].extend([{'id': 'remove', 'primitive': 'destroy'},
                                              {'id': 'create', 'primitive': 'form', 'mode': 'create'}])},
        [('S010', f'{LIST}#/actions/1'), ('S010', f'{LIST}#/actions/2')],
    ),
    ('S011', {'spec/screens/user-card.yaml': lambda d: user_card(d, transitions=True)}, [('S011', 'spec/screens/user-card.yaml#/card/transitions')]),
    (
        'S012',
        # the users have no search: the pickers of the assignee (the filters of a list and of
        # the board, a form, the card) and of the watchers (a form, the card)
        {CONTRACT: lambda d: d['project']['resources']['users.user'].update(search=[])},
        [
            ('S012', f'{DRAFTS}#/list/filters/0'),
            ('S012', f'{BOARD}#/board/filters/0'),
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
        {LIST: lambda d: d['list'].update(filter={'rank': 1}, highlight={'field': 'is_late', 'tone': 'danger', 'label': 'Late'})},
        [('S007', f'{LIST}#/list/filter/rank'), ('S007', f'{LIST}#/list/highlight/field')],
    ),
    (
        'S008',
        # the filter of the screen by a field that the contract cannot filter by
        {LIST: lambda d: d['list'].update(filter={'dt_created': '2026-01-01'}),
         CONTRACT: lambda d: [d['project']['resources']['tasks.task']['fields']['dt_created'].pop('filter')]},
        # and the filter of the user by it, the chart of the home by week and the days of the calendar
        [('S008', f'{HOME}#/dashboard/charts/1/by'), ('S008', f'{CALENDAR}#/calendar/field'),
         ('S008', f'{LIST}#/list/filters/3'), ('S008', f'{LIST}#/list/filter/dt_created')],
    ),
    (
        'S014',
        # a boolean for a text, a text for a relationship is an id; a highlight by a text
        {LIST: lambda d: d['list'].update(filter={'title': True, 'status': 'done', 'assignee': False},
                                          highlight={'field': 'title', 'tone': 'warning', 'label': 'Titled'})},
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
        # of the assignee (the filters of a list and of the board, a form, the card) and of the
        # watchers (a form, the card)
        {CONTRACT: lambda d: d['project']['resources']['users.user'].update(search=['username', 'last_name'])},
        [
            ('S017', f'{DRAFTS}#/list/filters/0'),
            ('S017', f'{BOARD}#/board/filters/0'),
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
                                                           'kind': 'donut', 'label': 'Users'})]},
        [('S021', f'{HOME}#/dashboard/charts/0/by'), ('S021', f'{HOME}#/dashboard/charts/1/bucket'),
         ('S021', f'{HOME}#/dashboard/charts/1/last'), ('S021', f'{HOME}#/dashboard/charts/2/by')],
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
        # the scenario of the board opens a step that opens nothing
        [('S022', f'{BOARD}#/board/by'), ('P022', f'{PRODUCT}#/scenarios/13/steps/7/open_item')],
    ),
    (
        'S023',
        # the days of a text, the end of a choice, a tone by a text
        {CALENDAR: lambda d: d['calendar'].update(field='title', end='priority',
                                                  tone={'field': 'title', 'tone': 'danger'})},
        [('S023', f'{CALENDAR}#/calendar/field'), ('S023', f'{CALENDAR}#/calendar/end'),
         ('S023', f'{CALENDAR}#/calendar/tone/field')],
    ),
    (
        'S024',
        # an unknown section, a section in two tabs, the history in none
        {CARD: lambda d: [d['card']['tabs'][0]['sections'].append('extra'),
                          d['card']['tabs'].__setitem__(2, {'id': 'more', 'title': 'More', 'sections': ['report']})]},
        [('S024', f'{CARD}#/card/tabs/0/sections/2'), ('S024', f'{CARD}#/card/tabs/2/sections/0'),
         ('S024', f'{CARD}#/card/tabs')],
    ),
    (
        'S024',
        # the history of a card without it, a tab declared twice and empty, a section in no tab
        {CARD: lambda d: [d['card'].update(history=False), d['card']['tabs'][0].update(sections=['main']),
                          d['card']['tabs'].append({'id': 'steps', 'title': 'Empty'})]},
        [('S024', f'{CARD}#/card/tabs/2/history'), ('S024', f'{CARD}#/card/tabs/3/id'),
         ('S024', f'{CARD}#/card/tabs/3'), ('S024', f'{CARD}#/card/tabs')],
    ),
    (
        'S025',
        # a transition with a payload, an unknown one; a bulk action declared twice
        {LIST: lambda d: d['list']['bulk'].extend([{'id': 'finish-all', 'transit': 'finish'},
                                                   {'id': 'archive-all', 'transit': 'archive'},
                                                   {'id': 'start-all', 'primitive': 'destroy'}])},
        [('S025', f'{LIST}#/list/bulk/1/transit'), ('S025', f'{LIST}#/list/bulk/2/transit'),
         ('S010', f'{LIST}#/list/bulk/3/id')],
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
        # a list at `/`, a dashboard without tiles (whose tile the scenario of the home expects)
        {HOME: lambda d: [d.update(route='/home'), d['dashboard'].pop('tiles')],
         LIST: lambda d: d.update(route='/')},
        [('S026', f'{HOME}#/dashboard'), ('S026', f'{LIST}#/primitive'),
         ('P022', f'{PRODUCT}#/scenarios/12/steps/1/expect/tile/review')],
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
    ('D010', {THEME: lambda d: d.update(mode='dark', palette='slate')}, []),
    ('D011', {THEME: lambda d: [d['icons'].pop('task')]}, [('D011', f'{THEME}#/icons')]),
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
    The users who do not log in (`anonymous: true`, the permit role `viewer` of the sample is
    for anonymous users): no `test_user` and no P025 for its scenarios; the schema refuses a
    test user of an anonymous role and a role that is neither anonymous nor of a permit role.
    """
    root = contract.parent.parent

    def anonymous(data):
        data['roles'][1].pop('test_user')
        data['roles'][1]['anonymous'] = True

    edit(root, PRODUCT, anonymous)
    assert issues(root) == []
    edit(root, PRODUCT, lambda d: d['roles'][1].update(test_user={'username': 'viewer'}))
    assert issues(root) == [('P002', f'{PRODUCT}#/roles/1')]
    edit(root, PRODUCT, lambda d: [d['roles'][1].pop('test_user'), d['roles'][1].pop('anonymous'),
                                   d['roles'][1].pop('permit')])
    assert ('P002', f'{PRODUCT}#/roles/1') in issues(root)


def layer_of(file: str) -> str:
    if file in (CONTRACT, LOCK):
        return 'contract'
    return 'product' if file == PRODUCT else file.split('/')[1]


@pytest.mark.django_db
def test_the_assets_follow_the_capabilities(contract):
    root = contract.parent.parent
    hooks = ['react-statusy', 'react-uploadable', 'react-ws', 'react-notify', 'react-bg', 'react-async']
    edit(root, LOCK, lambda d: lock('client', 'react', *hooks, 'template'))
    assert issues(root) == []
    # the components of a package are added when the product needs them
    edit(root, LOCK, lambda d: lock(
        'client', 'react', *hooks, 'status-badge', 'file-field', 'notification-center', 'template'
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
    steps = f'{PRODUCT}#/scenarios/16/steps'
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
        ('P022', f'{steps}/15/open_item'),
    ]


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
                    'project': {'resources': {'users.user': {'fields': {}, 'label': []}}}}),
        encoding='utf-8',
    )
    messages = check_spec(None)
    assert {it.id for it in messages} == {'front.W002'}
    texts = [it.msg for it in messages]
    assert f'S004 (error) {LIST}#/entity: The entity `job` is not in spec/product.yaml.' in texts
    assert any(it.startswith(f'P020 (warning) {PRODUCT}#/entities/0/access/manager/view: ') for it in texts)
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


@pytest.mark.django_db
def test_a_number_declared_for_a_string_names_the_decimal_field(contract):
    # a DecimalField is a string of the API: the spec declares it `string`
    root = contract.parent.parent
    edit(root, PRODUCT, lambda d: [task(d)['fields'][0].update(type='number'),
                                   task(d)['fields'][2].update(type='date')])
    hints = {it.path: it.hint for it in validate(root).issues if it.code == 'P013'}
    assert set(hints) == {'/entities/0/fields/0', '/entities/0/fields/2'}
    assert 'A DecimalField is a string in the API' in hints['/entities/0/fields/0']
    assert 'formatDecimal' in hints['/entities/0/fields/0']
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
            role.pop('test_user')

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
        for text, background in design.CONTRAST:
            first, second = color.parse(values[text], values), color.parse(values[background], values)
            assert first is not None and second is not None, (text, background)
            assert color.contrast(first, second) >= color.AA, (palette, dark, text, background)


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
    edit(root, PRODUCT, lambda d: task(d)['access']['viewer'].update(view=grants))
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
