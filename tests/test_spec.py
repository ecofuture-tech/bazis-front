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
from bazis.contrib.front.contract.export import render
from bazis.contrib.front.spec import design
from bazis.contrib.front.spec.access import Grant
from bazis.contrib.front.spec.issues import CODES
from bazis.contrib.front.spec.validate import schema_files, validate


SAMPLE_SPEC = Path(__file__).resolve().parent.parent / 'sample' / 'spec'
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
def contract(root, sample_app, workflow):
    """
    The contract of the sample, with the roles and the transits of the fixture `workflow`,
    in the product root.
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
THEME, TOKENS, CONTRACT = 'spec/design/theme.yaml', 'spec/design/tokens.json', 'contract/contract.json'
LOCK = 'frontend/bazis-front.lock.json'


def lock(*assets):
    """
    The lock of a frontend with these assets.
    """
    return {
        'lock': 1, 'bazis_front': '0.1.0', 'contract': {}, 'generated': {},
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
    ('C002', {CONTRACT: lambda d: {**d, 'format': 2}}, [('C002', f'{CONTRACT}#/format')]),
    # the sample has bazis-statusy: a frontend made by `init` has its hooks
    ('C003', {LOCK: lambda d: lock('client', 'react', 'template')}, [('C003', f'{LOCK}#/assets')]),
    ('P001', {PRODUCT: lambda d: 'spec: [\n'}, [('P001', PRODUCT)]),
    ('P002', {PRODUCT: lambda d: d.update(spec='bazis-product/2')}, [('P002', f'{PRODUCT}#/spec')]),
    (
        'P003',
        {PRODUCT: lambda d: [d['roles'].append({'id': 'viewer', 'permit': 'viewer'}),
                             task(d)['fields'].append({'id': 'status', 'type': 'string'})]},
        [('P003', f'{PRODUCT}#/roles/2/id'), ('P003', f'{PRODUCT}#/entities/0/fields/4/id')],
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
        [('P010', f'{PRODUCT}#/packages/2'), ('P014', f'{PRODUCT}#/entities/0/workflow')],
    ),
    (
        'P011',
        {PRODUCT: lambda d: task(d).update(resource='tasks.job')},
        [('P011', f'{PRODUCT}#/entities/0/resource')],
    ),
    (
        'P012',
        {PRODUCT: lambda d: task(d)['fields'].append({'id': 'due_date', 'type': 'date'})},
        [('P012', f'{PRODUCT}#/entities/0/fields/4')],
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
        ],
    ),
    ('P014', {CONTRACT: remove_statusy_model}, [('P014', f'{PRODUCT}#/entities/0/workflow')]),
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
            # the scenario gives `start` no payload, and `finish` one it does not declare
            ('P024', f'{PRODUCT}#/scenarios/0/steps/5/transit'),
            ('P024', f'{PRODUCT}#/scenarios/0/steps/6/transit/payload/report'),
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
        {PRODUCT: lambda d: steps(d, 0).__setitem__(0, {'open': 'task-board'})},
        [('P021', f'{PRODUCT}#/scenarios/0/steps/0/open')],
    ),
    (
        'P022',
        {PRODUCT: lambda d: [steps(d, 1).__setitem__(1, {'action': 'edit'}),
                             steps(d, 1).__setitem__(0, {'open': 'task-card'}),
                             steps(d, 0).insert(0, {'submit': {}})]},
        [
            ('P022', f'{PRODUCT}#/scenarios/0/steps/0/submit'),
            # a card needs the id of its item; it has no action `edit`
            ('P022', f'{PRODUCT}#/scenarios/1/steps/0/open'),
            ('P022', f'{PRODUCT}#/scenarios/1/steps/1/action'),
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
        [('P025', f'{PRODUCT}#/scenarios/1/role')],
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
        {CARD: lambda d: d['card']['sections'][0]['fields'].append('priority')},
        [('S007', f'{CARD}#/card/sections/0/fields/3')],
    ),
    (
        'S008',
        {CONTRACT: remove_labels},
        [('S008', f'{LIST}#/list/filters/0'), ('S008', f'{LIST}#/list/sort/0')],
    ),
    ('S009', {LIST: lambda d: d['states'].remove('empty')}, [('S009', f'{LIST}#/states')]),
    (
        'S010',
        {LIST: lambda d: d['actions'].extend([{'id': 'remove', 'primitive': 'destroy'},
                                              {'id': 'create', 'primitive': 'form', 'mode': 'create'}])},
        [('S010', f'{LIST}#/actions/1'), ('S010', f'{LIST}#/actions/2')],
    ),
    ('S011', {'spec/screens/user-card.yaml': lambda d: user_card(d, transitions=True)}, [('S011', 'spec/screens/user-card.yaml#/card/transitions')]),
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
        {TOKENS: lambda d: d['color']['foreground'].update({'$value': '{color.sidebar-foreground}'})},
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
]


def test_the_cases_cover_every_code():
    assert sorted({code for code, _, _ in CASES}) == sorted(CODES)


@pytest.mark.django_db
def test_the_sample_spec_is_valid(contract):
    out, _ = check()
    assert out == '0 errors, 0 warnings (checked against contract/contract.json).\n'


@pytest.mark.django_db
@pytest.mark.parametrize(('code', 'edits', 'expected'), CASES, ids=[it[0] for it in CASES])
def test_issues(contract, code, edits, expected):
    root = contract.parent.parent
    for name, change in edits.items():
        edit(root, name, change)

    assert issues(root) == expected
    for issue in validate(root).issues:
        assert issue.message and issue.hint
        assert issue.layer == layer_of(issue.file)


def layer_of(file: str) -> str:
    if file in (CONTRACT, LOCK):
        return 'contract'
    return 'product' if file == PRODUCT else file.split('/')[1]


@pytest.mark.django_db
def test_the_assets_follow_the_capabilities(contract):
    root = contract.parent.parent
    edit(root, LOCK, lambda d: lock('client', 'react', 'react-statusy', 'template'))
    assert issues(root) == []
    # the components of a package are added when the product needs them
    edit(root, LOCK, lambda d: lock('client', 'react', 'react-statusy', 'status-badge', 'template'))
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
    edit(root, LIST, lambda d: d['list']['filters'].append('priority'))
    assert issues(root) == [('S007', f'{LIST}#/list/filters/3')]

    out = StringIO()
    with pytest.raises(CommandError, match='The specs have 1 errors'):
        call_command('bazis_front', 'check', stdout=out)
    assert 'not checked against the backend' in out.getvalue()
    assert f'{LIST}#/list/filters/3: S007 error: ' in out.getvalue()


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
def test_the_system_check(root, tmp_path):
    assert check_spec(None) == []

    edit(root, LIST, lambda d: d.update(entity='job'))
    edit(root, PRODUCT, lambda d: [task(d).update(resource='users.user'),
                                   task(d)['access']['manager'].update(view='owner')])
    (root / 'contract').mkdir()
    (root / 'contract' / 'contract.json').write_text(
        json.dumps({'format': 1, 'capabilities': {'permit': {'roles': []}, 'statusy': {'models': {}}},
                    'project': {'resources': {'users.user': {'fields': {}}}}}),
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
    selectors = {
        'self': None,
        'assignee': None,
        # a path of relationships: tasks.task -> users.user -> permit.role
        'assignee__roles': None,
        'assignee__username': '`username` is not a relationship of `users.user`',
        'owner__author': '`owner` is not a relationship of `tasks.task`',
        # statusy.status is not a resource of the contract: not checked further
        'status__author': None,
    }
    for selector, problem in selectors.items():
        edit(root, PRODUCT, lambda d, it=selector: task(d)['access']['manager'].update(view=it))
        found = [it for it in validate(root).issues]
        if problem is None:
            assert found == [], selector
        else:
            assert [(it.code, it.path) for it in found] == [('P020', '/entities/0/access/manager/view')]
            assert problem in found[0].message


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


def test_the_starter_tokens_define_every_preset():
    tokens = design.tokens_of(json.loads(
        (PACKAGE / 'spec' / 'starters' / 'design' / 'tokens.json').read_text(encoding='utf-8')
    ))
    for preset, required in design.PRESET_TOKENS.items():
        assert {name: tokens[name][1]['$type'] for name in required} == {
            name: kind for name, (kind, _) in required.items()
        }, preset


def test_the_tokens_are_the_css_variables_of_the_template():
    css = (PACKAGE / 'assets' / 'template' / 'src' / 'index.css').read_text(encoding='utf-8')
    root = dict(re.findall(r'^  (--[\w-]+): (.+);$', css.split(':root {', 1)[1].split('}', 1)[0], re.M))
    tokens = design.tokens_of(json.loads(
        (PACKAGE / 'spec' / 'starters' / 'design' / 'tokens.json').read_text(encoding='utf-8')
    ))

    def css(variable):
        text = root[variable]
        return css(text[4:-1]) if text.startswith('var(') else text

    def token(name):
        data = tokens[name][1]
        if (target := design.alias(data)) is not None:
            return token(target)
        return ', '.join(data['$value']) if isinstance(data['$value'], list) else data['$value']

    for required in design.PRESET_TOKENS.values():
        for name, (_, variable) in required.items():
            # the starter has the values of the template
            assert css(variable) == token(name), name


def test_every_code_is_documented():
    documented = dict(re.findall(r'^\| `([CPSD]\d{3})` \| (error|warning) \|', AGENTS_MD.read_text(encoding='utf-8'), re.M))
    assert documented == {code: severity for code, (severity, _) in CODES.items()}
