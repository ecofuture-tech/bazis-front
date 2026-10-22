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
The scenarios of product.yaml, followed step by step from screen to screen: each step is
checked against the screen it acts on (its actions, its form, its entity and workflow).
The walk is the only reading of the steps: `bazis_front check` reports its issues, and the
generator of the end-to-end tests (`e2e.py`) turns the steps it returns into calls of the
Playwright helpers.

The scenarios run again and again on a database that keeps what the previous runs created
(`e2e_data` only adds): the walk follows the items that a scenario creates (the values filled
in a create form that saves), so that a step that finds one of them by its texts finds the
item of its own run (`Step.created`), and it reports a scenario that changes an item it did
not create (P033), or finds one by the texts of the items that a scenario creates (P034).

A scenario runs in the sessions of several roles (`as`): each has its screen, its form and its
card; the items that the scenario creates and the values that it remembers from the answers of
the actions (`remember`, used as `$<name>`) are of the whole scenario.

The walk knows the status of the item of a card when the scenario set it: the initial status of
an item that it created, the status that a transit or a move led it to, the one that an `expect`
read; another item, or another screen, has none known until then.
"""

import re
from dataclasses import dataclass, field, replace

from . import access
from .issues import Document, Issues
from .refs import (
    Entity,
    Product,
    body_files,
    form_answer,
    is_public,
    related_fields,
    related_sections,
    screen_actions,
)


#: the package whose users log in: the role of a scenario then needs a `test_user`
LOGIN_PACKAGE = 'users'

#: the packages of the notifications of the users: the stored ones of bazis-notify, the live
#: ones of bazis-ws
NOTIFY_PACKAGES = ('notify', 'ws')

#: a value `$<name>` of `fill`, `where`, `values` or `payload`: the value that `remember` took
VARIABLE = re.compile(r'\$([a-z][a-z0-9_]*)')


def variable(value) -> str | None:
    """The name of the value that a step takes from `remember` (`$<name>`), or None."""
    match = VARIABLE.fullmatch(value) if isinstance(value, str) else None
    return match[1] if match else None


@dataclass(frozen=True)
class Step:
    """
    A step of a scenario as the walk understands it: its key and value in product.yaml, and
    what it implies on the screens.
    """

    name: str
    value: object
    #: a `fill`, `upload` or `submit` on a card with `edit: true` whose edit is not open:
    #: the step starts the edit of the card first (`action:edit`)
    edit: bool = False
    #: the screen that the step leads to without naming it: the `list.open` of an
    #: `open_item`, the `then` of a destroy action or of the submitted form; None when the
    #: screen stays (or is named by the step, `open`), as after a failing submit
    then: str | None = None
    #: a `submit` that the next step expects to be refused (`fails`): its form stays open on
    #: its screen and its test waits for the form only; any other submit must save, or its
    #: test fails with the error shown
    failing: bool = False
    #: a destroy action, or a custom action with `confirm`: its dialog confirms it
    #: (`action:confirm-<id>`) when the screens are generated (`screens`), `required` on a
    #: generated screen, `optional` on a custom one, which may show none; None for any other step
    confirm: str | None = None
    #: an `open_item`, `select` or `move` whose `where` finds an item that the scenario created
    #: before (`agrees`): the step takes one of the items its test created, never an item of a
    #: previous run with the same texts
    created: bool = False
    #: a `remember`: the names of its values that a next step takes (`$<name>`), the constants
    #: that its test declares; it reads the others without keeping them
    taken: tuple[str, ...] = ()


#: the states of a screen that a submit which does not save shows
FAILED_STATES = {'invalid', 'error', 'forbidden', 'not_found'}

#: the item of a card that the scenario did not create (an item of the test data), as opposed
#: to one it created (`_Made`) and to none known
OTHER = 'other'


@dataclass
class _Made:
    """
    An item that a scenario creates: its entity and the values filled in its forms (its create
    form, then its edits), those it has at the end of the scenario, and its status when the walk
    knows it.
    """

    entity: str | None
    values: dict
    status: str | None = None


def of_body(form: dict | None) -> bool:
    """
    Whether an open form asks for the properties of the body of a custom action: its dialog
    (`primitive: custom`) or the form of the action (`form.action` of a form screen).
    """
    return form is not None and 'action' in form


def remembered(answer: dict[str, bool]) -> str:
    """
    The properties of an answer that a scenario remembers, for a hint.
    """
    return ', '.join(f'`{it}`' for it in sorted(answer) if answer[it]) or 'none'


def agrees(where: dict, values: dict) -> bool:
    """
    Whether the item of these values has the texts of `where`: they share a field at least, and
    have the same value in each field they share.
    """
    shared = where.keys() & values.keys()
    return bool(shared) and all(where[name] == values[name] for name in shared)


def fails(steps: list[dict], index: int) -> bool:
    """
    Whether the `submit` at the index is refused: the next step expects the `error` of a
    field or a state of a failure (`FAILED_STATES`). The form stays open then, on its screen,
    without its `then`; every other submit saves.
    """
    following = steps[index + 1] if index + 1 < len(steps) else {}
    expect = following.get('expect', {})
    return 'error' in expect or expect.get('state') in FAILED_STATES


@dataclass
class _State:
    """
    Where a scenario is: the current screen (None when it cannot be known: an unknown or
    broken screen, after which the steps are not checked until the next `open`), whether a
    form is open on it (the action that opened it, or the screen itself), whether the edit
    of a card is open and whether rows of a list are selected.
    """

    screen: dict | None = None
    known: bool = False
    form: dict | None = None
    editing: bool = False
    selected: bool = False
    #: the values filled in the open form since it was opened
    values: dict = field(default_factory=dict)
    #: whether a selected row is an item that the scenario did not create
    others: bool = False
    #: whether the result of the form of an action is shown, after its submit, and the
    #: properties of its answer, each with whether it is remembered (`answer` of refs; None
    #: when the contract does not have it)
    result: bool = False
    answer: dict[str, bool] | None = None


def check(
    doc: Document, product: Product | None, screens: dict, contract: dict | None, issues: Issues
) -> dict[str, list[Step]]:
    """
    Checks the scenarios; returns the steps of each by its id (those of a spec with errors
    are not meant to be used).
    """
    if product is None:
        return {}
    walked, runs = {}, []
    for i, scenario in enumerate(doc.data.get('scenarios', [])):
        path = ('scenarios', i)
        run = _Scenario(doc, product, screens, contract, scenario, path, issues)
        run.check_role((*path, 'role'), scenario['role'])
        walked[scenario['id']] = run.run()
        runs.append(run)
    check_finds(doc, runs, issues)
    return walked


def check_finds(doc: Document, runs: list['_Scenario'], issues: Issues) -> None:
    """
    Reports the steps that find an item that their scenario did not create by the texts of the
    items that a scenario creates (P034): the previous runs left such items in the database.
    """
    for run in runs:
        for path, entity, where in run.finds:
            maker = next(
                (it for it in runs if any(made.entity == entity and agrees(where, made.values) for made in it.made)),
                None,
            )
            if maker is not None:
                issues.add(
                    doc, (*path, 'where'), 'P034',
                    f'The item is found by the texts of the items that the scenario `{maker.scenario["id"]}` '
                    'creates: on a database that keeps the items of the previous runs it may find one of theirs.',
                    'Create the item in this scenario before it is found, or find an item of the test data '
                    '(`e2e_data`) by texts that no scenario gives its items.',
                )


class _Scenario:
    """
    Follows the steps of a scenario from screen to screen and checks each against the
    screen it acts on.
    """

    def __init__(self, doc, product, screens, contract, scenario, path, issues):
        self.doc, self.product, self.screens, self.contract = doc, product, screens, contract
        # the role of the current session (`as`), and the state, the item of the current card
        # and its status, when known, of each session by its role (`state`, `item`, `status`)
        self.role = scenario['role']
        self.states: dict[str, _State] = {self.role: _State(known=True)}
        self.items: dict[str, _Made | str | None] = {self.role: None}
        self.statuses: dict[str, str | None] = {self.role: None}
        self.scenario, self.path, self.issues = scenario, path, issues
        # what the current step implies (`Step`), whether it is a refused submit, whether
        # the step before was one, whether its action is confirmed and whether it finds an
        # item that the scenario created
        self.edit, self.then, self.failing, self.refused, self.confirm = False, None, False, False, None
        self.created = False
        # the items that the scenario creates; the item of the current card (one of them,
        # OTHER, or None when no item is known); the steps that find an item it did not create
        # (P034: their path, the entity and `where`); whether a step could not be followed
        # (an unknown screen, action or entity), after which the items it created are not known
        self.made: list[_Made] = []
        self.finds: list[tuple[tuple, str | None, dict]] = []
        self.lost = False
        # the names of the values remembered (`remember`), and those that a step takes (`$<name>`)
        self.variables: set[str] = set()
        self.taken: set[str] = set()

    @property
    def state(self) -> _State:
        return self.states[self.role]

    @state.setter
    def state(self, state: _State) -> None:
        self.states[self.role] = state

    @property
    def item(self) -> '_Made | str | None':
        return self.items[self.role]

    @item.setter
    def item(self, item: '_Made | str | None') -> None:
        """The item of the card: its status is the one known of an item that the scenario created."""
        self.items[self.role] = item
        self.statuses[self.role] = item.status if isinstance(item, _Made) else None

    @property
    def status(self) -> str | None:
        """The status of the item of the current card, None when the walk does not know it."""
        return self.statuses[self.role]

    def reached(self, status: str) -> None:
        """The item of the current card is in the status (a transit, an `expect` of its status)."""
        self.statuses[self.role] = status
        if isinstance(self.item, _Made):
            self.item.status = status

    def run(self) -> list[Step]:
        steps = []
        for i, step in enumerate(self.scenario['steps']):
            (name, value), = step.items()
            self.edit, self.then, self.refused, self.confirm = False, None, self.failing, None
            self.failing, self.created = name == 'submit' and fails(self.scenario['steps'], i), False
            getattr(self, f'step_{name}')((*self.path, 'steps', i, name), value)
            self.lost = self.lost or not self.state.known
            steps.append(Step(name, value, self.edit, self.then, self.failing, self.confirm, self.created))
        return [
            replace(it, taken=tuple(name for name in it.value if name in self.taken)) if it.name == 'remember' else it
            for it in steps
        ]

    def add(self, path, code, message, hint):
        self.issues.add(self.doc, path, code, message, hint)

    def check_role(self, path, role_id) -> None:
        """
        The role of the scenario or of `as` is a role of product.yaml (P004) whose test user
        logs in (P025): its `test_user`, unless it is anonymous or the product has no login.
        """
        role = self.product.roles.get(role_id)
        if role is None:
            self.add(path, 'P004', f'The role `{role_id}` is not in `roles`.', 'Use the id of a role of `roles`.')
        elif LOGIN_PACKAGE in self.doc.data.get('packages', []) and 'test_user' not in role and not role.get('anonymous'):
            self.add(
                path, 'P025',
                f'The role `{role_id}` has no `test_user`: the end-to-end test of the scenario cannot log in.',
                'Give the role `test_user: {username: ...}`, a user of this role that the test '
                'data of the backend creates with the password of E2E_PASSWORD; or `anonymous: '
                'true` for the users who do not log in.',
            )

    def remembered(self, path, values: dict) -> None:
        """Takes the values `$<name>`, and reports one that no `remember` before took (P022)."""
        for name, value in values.items():
            taken = variable(value)
            if taken is not None:
                self.taken.add(taken)
            if taken is not None and taken not in self.variables:
                self.add(
                    (*path, name), 'P022', f'No `remember` before this step takes `${taken}`.',
                    f'Remember it after the result of the form of an action: `remember: {{{taken}: <a property of its answer>}}`.',
                )

    def step_as(self, path, role):
        """
        The next steps run in the session of the role: a new one the first time (no screen
        open), the one it left again.
        """
        self.check_role(path, role)
        self.role = role
        self.states.setdefault(role, _State(known=True))
        self.items.setdefault(role, None)
        self.statuses.setdefault(role, None)

    def step_remember(self, path, value):
        """
        Remembers properties of the answer of the action whose result is shown (P022: no result
        shown, a property that its answer does not have or that is not a text or a number, a
        name remembered twice).
        """
        shown = self.require(
            path, self.state.result,
            'No result of the form of an action is shown: `remember` follows the submit of a form with `result`.',
        )
        answer = self.state.answer if shown else None
        for name, prop in value.items():
            if name in self.variables:
                self.add((*path, name), 'P022', f'`${name}` is remembered twice.', 'Give the other value another name.')
            elif answer is not None and prop not in answer:
                self.add(
                    (*path, name), 'P022', f'The answer of the action has no property `{prop}`.',
                    f'Remember a property of its answer: {remembered(answer)}.',
                )
            elif answer is not None and not answer[prop]:
                self.add(
                    (*path, name), 'P022',
                    f'The property `{prop}` of the answer of the action is not a text or a number: it is not remembered.',
                    f'Remember a text or a number of its answer: {remembered(answer)}.',
                )
            self.variables.add(name)

    def find(self, path, entity: str | None, where: dict) -> _Made | None:
        """
        The item that the scenario created before and that `where` finds (the last that
        agrees), or None: the item found is one it did not create then (`finds`, P034). An
        item found by a value that the scenario remembered (`$<name>`) is one that an action of
        this run made (the number of an order that a guest sent): it is the scenario's own, which
        it may change, although its test did not create it (not `created`).
        """
        self.lost = self.lost or entity not in self.product.entities
        if any(variable(it) for it in where.values()):
            self.created = False
            return _Made(entity, dict(where))
        made = next((it for it in reversed(self.made) if it.entity == entity and agrees(where, it.values)), None)
        if made is None and not self.lost:
            self.finds.append((path, entity, where))
        self.created = made is not None
        return made

    def changes(self, path, own: bool, what: str) -> None:
        """
        Reports a step that changes an item that the scenario did not create (P033), unless a
        step before could not be followed, or the role of the scenario cannot add an item of the
        entity (`access` has no `add` for it): there is nothing it could create, the items of the
        test data are the only ones it can change.
        """
        if not own and not self.lost and not self.cannot_add():
            self.add(
                path, 'P033',
                f'The scenario {what} an item that it did not create: an item of the test data, which the '
                'other scenarios and the next runs expect as it is.',
                'Create the item in the scenario (a create form) and change that one; open the items of the '
                'test data (`e2e_data`) only to read them. A role that cannot add an item changes one that '
                '`e2e_data` creates afresh at every run, which the scenario opens by `where`.',
            )

    def cannot_add(self) -> bool:
        """Whether `access` of the entity of the step grants the role of the scenario no `add`."""
        entity = self.entity
        grants = entity.data.get('access', {}).get(self.role) if entity else None
        return grants is not None and not access.allows(grants, 'add')

    def changes_item(self, path, what: str) -> None:
        """
        Reports a step that changes the item of the current card when the scenario did not create it.
        """
        self.changes(path, self.item != OTHER, what)

    @property
    def entity(self) -> Entity | None:
        """
        The entity that the step acts on: that of the open form of "add here" of a related
        section of a card or of a create form of a dashboard, else that of the screen (none on
        a dashboard).
        """
        screen, form = self.state.screen, self.state.form
        if form is not None and 'entity' in form:
            return self.product.entities.get(form['entity'])
        return self.product.entities.get(screen.get('entity')) if screen else None

    def go(self, path, screen_id) -> None:
        """
        The current screen becomes the given one.
        """
        if screen_id not in self.screens:
            self.add(
                path, 'P021', f'The screen `{screen_id}` does not exist.',
                f'Create spec/screens/{screen_id}.yaml or use an existing screen.',
            )
        screen = self.screens.get(screen_id)
        if screen is not None and self.closed(screen):
            self.add(
                path, 'P035',
                f'The scenario of the anonymous role `{self.role}` opens `{screen_id}`, which is not public: '
                'the frontend sends a user without a session to the login.',
                f'List `{self.role}` in `roles` of `{screen_id}`, or give the scenario a role that logs in.',
            )
        self.state = _State(screen, known=screen is not None)
        if screen is not None and screen['primitive'] == 'form':
            self.state.form = screen['form']

    def closed(self, screen: dict) -> bool:
        """Whether the role is anonymous and the screen is not public: the frontend sends him to the login (P035)."""
        return bool(self.product.roles.get(self.role, {}).get('anonymous')) and not is_public(screen, self.product.roles)

    def lead(self, path, screen_id) -> None:
        """
        The step leads to the given screen without naming it.
        """
        self.go(path, screen_id)
        self.then = screen_id

    def require(
        self, path, condition: bool, message: str, hint: str = 'Fix the step, or open the screen it acts on first.'
    ) -> bool:
        """
        Whether the step can be checked on the current screen; reports it when it is not
        possible there.
        """
        if not self.state.known:
            return False
        if self.state.screen is None:
            self.add(path, 'P022', 'No screen is open.', 'Start the scenario with `open`.')
            self.state.known = False
            return False
        if not condition:
            self.add(path, 'P022', message, hint)
            return False
        return True

    def fields(self, items, form: dict | None = None, entity: Entity | None = None) -> None:
        """
        Checks that the entity of the screen (or the given one) has the fields of
        `(path, name)` items, and the form, when it lists its fields.
        """
        if of_body(form):
            # the dialog of a custom action or the form of an action: the properties of its body
            # (S032), not fields of the entity
            what = 'dialog' if form.get('primitive') == 'custom' else 'form'
            for path, name in items:
                if name not in form['fields']:
                    self.add(
                        path, 'P023', f'The {what} of the action has no field `{name}`.',
                        'Fill a property of its body that the action asks for (`fields` of the action).',
                    )
            return
        entity = entity or self.entity
        if entity is None:
            return
        for path, name in items:
            if name not in entity.fields:
                self.add(
                    path, 'P023', f'The entity `{entity.data["id"]}` has no field `{name}`.',
                    'Use a field of the entity of the screen.',
                )
            elif form is not None and 'fields' in form and name not in form['fields']:
                self.add(
                    path, 'P023', f'The form has no field `{name}`.',
                    'Add the field to the `fields` of the form, or fill another one.',
                )

    def step_open(self, path, screen_id):
        self.go(path, screen_id)
        self.item = None
        screen = self.state.screen
        if screen is None:
            return
        if ':' in screen['route']:
            self.add(
                path, 'P022', f'The screen `{screen_id}` shows an item (`{screen["route"]}`): a '
                'scenario does not know its id.',
                'Open a list and reach the item with `open_item`, or after a form with `then`.',
            )
        if screen.get('roles') and self.role not in screen['roles'] and not self.closed(screen):
            self.add(
                path, 'P022', f'The screen `{screen_id}` is not for the role `{self.role}`.',
                'Add the role to the `roles` of the screen, or open another screen.',
            )

    def step_open_item(self, path, value):
        """
        Opens an item of a list, a board or a calendar whose items open a card (`open`), or a
        row of the last items `in` of a dashboard that open one.
        """
        screen = self.state.screen or {}
        primitive = screen.get('primitive')
        if primitive == 'dashboard':
            parts = {it['id']: it for it in screen['dashboard'].get('recent', [])}
            part = parts.get(value.get('in'))
            possible = part is not None and 'open' in part
            message = 'On a dashboard an item is opened `in` its last items (`recent`) that open a card.'
        else:
            part = screen.get(primitive)
            possible = primitive in ('list', 'board', 'calendar') and 'open' in part and 'in' not in value
            message = (
                'Only a list, a board or a calendar whose items open a card (`open`), or the last '
                'items `in` of a dashboard, open an item.'
            )
        self.remembered((*path, 'where'), value['where'])
        if not self.require(path, bool(screen) and possible, message):
            self.state.known = False
            return
        entity_id = part.get('entity', screen.get('entity'))
        self.fields((((*path, 'where', name), name) for name in value['where']), entity=self.product.entities.get(entity_id))
        self.item = self.find(path, entity_id, value['where']) or OTHER
        self.lead(path, part['open'])

    def step_select(self, path, value):
        screen = self.state.screen
        self.remembered((*path, 'where'), value['where'])
        if self.require(
            path, bool(screen) and screen['primitive'] == 'list' and 'bulk' in screen['list'],
            'Only a list with bulk actions (`list.bulk`) selects rows.',
        ):
            self.fields(((*path, 'where', name), name) for name in value['where'])
            self.state.selected = True
            if not self.find(path, screen.get('entity'), value['where']):
                self.state.others = True

    def step_bulk(self, path, action_id):
        screen = self.state.screen
        actions = {it['id'] for it in screen['list'].get('bulk', [])} if screen and screen['primitive'] == 'list' else set()
        if self.require(path, action_id in actions, f'The screen has no bulk action `{action_id}`.'):
            if self.require(path, self.state.selected, 'No row is selected: `select` the rows first.'):
                self.changes(path, not self.state.others, 'runs a bulk action on')
            self.state.selected = self.state.others = False

    def step_move(self, path, value):
        """
        Moves an item of a board to the column of a status: by a transition without a payload,
        or with `payload`, which its dialog asks for, by one with a payload (P024 otherwise).
        """
        screen, payload = self.state.screen, value.get('payload')
        self.remembered((*path, 'where'), value['where'])
        self.remembered((*path, 'payload'), payload or {})
        if not self.require(
            path, bool(screen) and screen['primitive'] == 'board' and screen['board'].get('move', False),
            'Items move on a board with `move: true`.',
        ):
            return
        self.fields(((*path, 'where', name), name) for name in value['where'])
        made = self.find(path, screen.get('entity'), value['where'])
        self.changes(path, bool(made), 'moves')
        entity, to = self.entity, value['to']
        if entity is None or entity.workflow is None:
            return
        columns = screen['board'].get('columns', entity.workflow['statuses'])
        leading = [it for it in entity.transitions.values() if it['to'] == to]
        if to not in entity.workflow['statuses']:
            self.add(
                (*path, 'to'), 'P024', f'The entity `{entity.data["id"]}` has no status `{to}`.',
                'Use a status of the workflow of the entity.',
            )
        elif to not in columns:
            self.add((*path, 'to'), 'P022', f'The board has no column `{to}`.', 'Move the item to a column of the board.')
        elif not leading:
            self.add(
                (*path, 'to'), 'P024', f'No transition leads to `{to}`.',
                'Move the item to a status that a transition leads to.',
            )
        elif payload is None and all('payload' in it for it in leading):
            fields = sorted({field['id'] for it in leading for field in it['payload']['fields']})
            self.add(
                (*path, 'to'), 'P024', f'No transition without a payload leads to `{to}`.',
                f'Give the payload of its dialog: {{where: ..., to: {to}, payload: {{...}}}} with {", ".join(fields)}.',
            )
        elif payload is not None and not any('payload' in it for it in leading):
            self.add(
                (*path, 'payload'), 'P024', f'No transition with a payload leads to `{to}`.',
                'Move the item without a payload: the transition to the status asks for none.',
            )
        elif payload is not None:
            asking = [it for it in leading if 'payload' in it]
            self.payload_fields(
                path, ' or '.join(f'`{it["id"]}`' for it in asking),
                f'{{where: ..., to: {to}, payload: {{...}}}}',
                {field['id'] for it in asking for field in it['payload']['fields']}, payload,
            )
        if made is not None and to in entity.workflow['statuses']:
            made.status = to

    def payload_fields(self, path, transit: str, example: str, declared: set[str], payload: dict | None) -> None:
        """
        The payload of a step that runs a transition (`transit`, `move`) against the fields of the
        payload of the transition (P024): given when it has some, and of them only.
        """
        if declared and not payload:
            self.add(
                path, 'P024', f'The transition {transit} requires a payload.',
                f'Give the payload: {example} with {", ".join(sorted(declared))}.',
            )
        for name in payload or {}:
            if name not in declared:
                self.add(
                    (*path, 'payload', name), 'P024', f'The payload of {transit} has no field `{name}`.',
                    'Use the fields of the payload of the transition.',
                )

    def actions(self) -> dict[str, dict]:
        """
        The actions of the current screen by id (the create forms of a dashboard, of their
        entity), the forms of "add here" of its related sections (a create form of the related
        entity, its relationship to the item fixed, that keeps the card open) and the form of
        "add" of a calendar.
        """
        screen = self.state.screen or {}
        actions = {it['id']: it for _, it in screen_actions(screen)} if screen else {}
        if screen.get('primitive') == 'calendar' and 'add' in screen['calendar']:
            add = screen['calendar']['add']
            actions[add['id']] = {'primitive': 'form', **({'fields': add['fields']} if 'fields' in add else {})}
        for section in related_sections(screen) if screen else []:
            if 'add' in section:
                # an unknown entity is reported with its screen (S004): its fields are not checked
                related = self.product.entities.get(section['entity'])
                actions[section['add']['id']] = {
                    'primitive': 'form', 'entity': section['entity'], 'fixed': section['relation'],
                    **({'fields': related_fields(section, related)} if related is not None else {}),
                }
        return actions

    def step_action(self, path, action_id):
        actions = self.actions()
        if not self.require(path, action_id in actions, f'The screen has no action `{action_id}`.'):
            self.state.known = False
            return
        action = actions[action_id]
        if action['primitive'] in ('form', 'custom'):
            self.state.values = {}
        if action['primitive'] == 'form':
            self.state.form = action
            return
        custom = (self.state.screen or {}).get('custom')
        if action['primitive'] == 'custom':
            # a list runs those of its rows on each row: the scenarios run those of the item of
            # a card, those of the rows as bulk actions, and those of the route set from the
            # toolbar of a list (the guest of a public screen with a public action)
            screen = self.state.screen
            self.require(
                path, screen['primitive'] == 'card' or action_id not in screen.get('list', {}).get('row_actions', []),
                'A custom action of the rows of a list is run on each row: run it on the card of the item, '
                'or as a bulk action of the list.',
            )
            if action.get('fields'):
                self.state.form = action
                return
            if action.get('confirm'):
                self.confirm = 'optional' if custom else 'required'
            self.changes_item(path, 'runs a custom action on')
            return
        if action['primitive'] == 'destroy':
            self.confirm = 'optional' if custom else 'required'
            self.changes_item(path, 'deletes')
        if 'then' in action:
            self.lead(path, action['then'])
            self.item = None

    def shown(self) -> set[str] | None:
        """
        The fields that the current screen shows: those of its open form (None for every
        field of the entity), else the columns of a list, the fields of the sections of a card
        (the edit of a card has them too), of the items of a board or of a calendar (its label,
        None for the label of the entity); none on a dashboard.
        """
        form, screen = self.state.form, self.state.screen
        if form is not None:
            return set(form['fields']) if 'fields' in form else None
        primitive = screen['primitive']
        if primitive == 'list':
            return set(screen['list']['columns'])
        if primitive == 'card':
            return {name for section in screen['card']['sections'] for name in section['fields']}
        if primitive == 'board':
            card = screen['board']['card']
            return {card['title'], *card.get('fields', []), *([card['badge']] if 'badge' in card else [])}
        if primitive == 'calendar':
            return set(screen['calendar']['label']) if 'label' in screen['calendar'] else None
        return set()

    def card_edit(self) -> bool:
        """Whether the current screen is a card with `edit: true`: its edit, `action:edit`."""
        screen = self.state.screen
        return bool(screen) and screen['primitive'] == 'card' and screen['card'].get('edit', False)

    def editing(self, path) -> bool:
        """
        Whether a form is open for the step: one that is open, or the edit of a card with
        `edit: true`, which the step starts when it is not open yet.
        """
        if not self.require(
            path, self.state.form is not None or self.card_edit(),
            'No form is open: run a form action, or edit a card with `edit: true`.',
        ):
            return False
        if self.state.form is None and not self.state.editing:
            self.state.editing = self.edit = True
            self.state.values = {}
        return True

    def fixed(self, path, name) -> None:
        """
        Reports a field that the open form of "add here" fixes: the user never changes it.
        """
        form = self.state.form or {}
        if name == form.get('fixed'):
            self.add(
                path, 'P022', f'The field `{name}` is fixed to the item of the card: it is not filled.',
                'Fill the other fields of the related item.',
            )

    def step_fill(self, path, values):
        self.remembered(path, values)
        if self.editing(path):
            self.fields([((*path, name), name) for name in values], self.state.form)
            self.state.values.update(values)
            body = of_body(self.state.form)
            for name, value in values.items():
                if not body:
                    self.fixed((*path, name), name)
                if self.file(name):
                    self.add(
                        (*path, name), 'P022', f'The field `{name}` is a file: it is not filled.',
                        f'Upload its file: `upload: {{field: {name}, file: <a file of e2e/fixtures/>}}`.',
                    )
                elif not body:
                    self.fill_value((*path, name), name, value)

    def fill_value(self, path, name, value) -> None:
        """
        Reports a value of the wrong shape: a to-many relationship (`many: true`) is filled
        with the list of the labels of its items, every other field with one value.
        """
        entity = self.entity
        field = entity.fields.get(name) if entity is not None else None
        if field is None:
            return
        many = field.get('many', False)
        if many and not isinstance(value, list):
            self.add(
                path, 'P022', f'The field `{name}` is a to-many relationship: it is filled with a list.',
                f'Fill it with the labels of its items: `{name}: [<label>, ...]` (`[]` for none).',
            )
        elif not many and isinstance(value, list):
            self.add(
                path, 'P022', f'The field `{name}` takes one value, not a list.',
                'A list fills a to-many relationship (`many: true`) only: fill one value.',
            )

    def step_upload(self, path, value):
        if self.editing(path):
            name = value['field']
            self.fields([((*path, 'field'), name)], self.state.form)
            if of_body(self.state.form):
                known = name in self.state.form['fields']
            else:
                known = self.entity is not None and name in self.entity.fields
            if known and self.file(name) is False:
                self.add(
                    (*path, 'field'), 'P022', f'The field `{name}` is not a file.',
                    'Upload into a field of the type `file` (in the form of an action, a property of its body that '
                    'takes the ids of uploaded files: `UploadedFileId` of bazis-uploadable), or fill this one.',
                )

    def file(self, name) -> bool | None:
        """
        Whether a field of the open form is a file: in the form or the dialog of an action, a
        property of its body that takes the ids of uploaded files (`refs.body_files`; None when
        the contract does not have the action); else a field that the entity of the screen
        declares `type: file`.
        """
        if of_body(self.state.form):
            files = self.body_files()
            return None if files is None else name in files
        entity = self.entity
        return entity is not None and entity.fields.get(name, {}).get('type') == 'file'

    def body_files(self) -> set[str] | None:
        """
        The properties of the body of the action of the open form or dialog that are uploaded
        files: of the route set for a form and a list, of its item on a card; None when the
        contract does not have the action.
        """
        form, screen, entity = self.state.form, self.state.screen or {}, self.entity
        if self.contract is None or entity is None:
            return None
        resource = self.contract['project']['resources'].get(entity.data['resource'])
        item = form.get('primitive') == 'custom' and screen.get('primitive') == 'card'
        action = next(
            (it for it in (resource or {}).get('custom_actions', {}).values() if it['name'] == form['action'] and it['item'] == item),
            None,
        )
        return None if action is None else body_files(action['body'] or {}, resource, self.contract)

    def step_submit(self, path, value):
        """
        A submit closes the form and leads to its `then`; the form of an action with a
        `result` shows it on its screen instead (`state: done`, with the link to its `then`); a
        refused one (`fails`: the next step expects the `error` of a field or a failed `state`)
        keeps the form open.
        """
        if not self.editing(path) or self.failing:
            return
        form, self.state.form, self.state.editing = self.state.form, None, False
        made = self.save(path, form)
        if 'result' in (form or {}):
            # the form of an action shows its result, with the answer that `remember` takes
            self.state.result, self.state.answer = True, form_answer(self.state.screen, self.product, self.contract)
        then = None if 'result' in (form or {}) else (form or {}).get('then')
        if then is not None:
            self.lead(path, then)
            # the screen of the item created, or of none
            self.item = made

    def save(self, path, form: dict | None) -> _Made | None:
        """
        The saved submit of the open form: a create form (of the screen, of a dashboard, of the
        add of a calendar or of "add here" of a card) makes an item, which it returns; "add here"
        and any other form (the edit of a card, a custom action) change the item of the card,
        whose values an edit updates when the scenario created it (a list has no item: an action
        of its toolbar changes none, nor the form of an action, which runs one of the route set).
        """
        if of_body(form) and form.get('primitive') != 'custom':
            return None
        values, custom = self.state.values, form is not None and form.get('primitive') == 'custom'
        if form is not None and not custom and form.get('mode', 'create') == 'create':
            made = _Made(form.get('entity', (self.state.screen or {}).get('entity')), dict(values))
            workflow = getattr(self.product.entities.get(made.entity), 'workflow', None)
            made.status = workflow['initial'] if workflow else None
            self.made.append(made)
            self.lost = self.lost or made.entity not in self.product.entities
            if 'fixed' in form:
                self.changes_item(path, 'adds a related item to')
            return made
        self.changes_item(path, 'runs a custom action on' if custom else 'edits')
        if isinstance(self.item, _Made) and not custom:
            self.item.values.update(values)
        return None

    def step_transit(self, path, value):
        transit_id, payload = (value, None) if isinstance(value, str) else (value['id'], value.get('payload'))
        self.remembered((*path, 'payload'), payload or {})
        screen = self.state.screen
        if not self.require(
            path, bool(screen) and screen['primitive'] == 'card' and screen['card'].get('transitions', False),
            'Transits run on a card with `transitions: true`.',
        ):
            return
        entity = self.entity
        if entity is None or entity.workflow is None:
            return
        self.changes_item(path, 'runs a transit of')
        transition = self.transition(path, entity, transit_id)
        if transition is None:
            return
        self.payload_fields(
            path, f'`{transit_id}`', f'{{id: {transit_id}, payload: {{...}}}}',
            {it['id'] for it in transition.get('payload', {}).get('fields', [])}, payload,
        )
        self.reached(transition['to'])

    def transition(self, path, entity: Entity, transit_id: str) -> dict | None:
        """The transition of the workflow of the entity, or None: reported (P024)."""
        transition = entity.transitions.get(transit_id)
        if transition is None:
            self.add(
                path, 'P024', f'The workflow of `{entity.data["id"]}` has no transition `{transit_id}`.',
                'Use a transition of the workflow.',
            )
        return transition

    def expect_items(self, path, value):
        """
        The expectations of the items of a screen: the rows of a list, the counts of the tiles
        of a dashboard, the items of the days of a calendar.
        """
        screen = self.state.screen or {}
        primitive = screen.get('primitive')
        if 'rows' in value:
            self.require((*path, 'rows'), primitive == 'list', 'Only a list has rows.')
        tiles = {it['id'] for it in screen['dashboard'].get('tiles', [])} if primitive == 'dashboard' else set()
        for tile in value.get('tile', {}):
            self.require((*path, 'tile', tile), tile in tiles, f'The screen has no tile `{tile}`.')
        if 'day' in value:
            self.require((*path, 'day'), primitive == 'calendar', 'Only a calendar has days.')

    def step_expect(self, path, value):
        self.remembered((*path, 'values'), value.get('values', {}))
        packages = self.doc.data.get('packages', [])
        if 'notification' in value and not any(it in packages for it in NOTIFY_PACKAGES):
            self.add(
                (*path, 'notification'), 'P027',
                'The product has no notifications: `packages` has neither `notify` nor `ws`.',
                'Add `notify` to `packages` (the backend installs bazis-notify and notifies the '
                'user with `notify`; `ws` too for the live delivery), or expect something else.',
            )
        current = (self.state.screen or {}).get('id')
        if 'screen' in value and self.refused and self.state.known and value['screen'] != current:
            self.add(
                (*path, 'screen'), 'P022',
                f'The submit before is refused: its form stays open on `{current}`, the screen is '
                f'not `{value["screen"]}`.',
                'Expect the screen of the form, or remove the expectation of the refusal.',
            )
        # the screen of a refused submit stays, with its open form
        if 'screen' in value and not (self.refused and value['screen'] == current):
            self.go((*path, 'screen'), value['screen'])
            if value['screen'] != current:
                # another screen than the walk followed: its item is not known
                self.item = None
        screen = self.state.screen
        self.expect_items(path, value)
        if 'action_absent' in value:
            action_id = value['action_absent']
            self.require(
                (*path, 'action_absent'), action_id in self.actions() or (action_id == 'edit' and self.card_edit()),
                f'The screen has no action `{action_id}`: it is always absent.',
                'Expect the absence of an action of the screen (an action of its `actions`, the add of a related '
                'section or of a calendar, `edit` of a card with `edit: true`); a transit of the item is '
                '`transit_absent: <id>`; a change of a field that the role may not make is `field_readonly` on a '
                'card with `edit`, or the refusal of the backend (403) in a test of pytest.',
            )
        if 'field_absent' in value:
            name = value['field_absent']
            self.require(
                (*path, 'field_absent'), bool(screen) and (self.shown() is None or name in self.shown()),
                f'The screen does not show the field `{name}`: it is always absent.',
            )
        if 'values' in value:
            card = bool(screen) and screen['primitive'] == 'card' and self.state.form is None
            if self.require((*path, 'values'), card, 'Only a card without an open form shows values.'):
                declared = self.entity.fields if self.entity is not None else {}
                for name in value['values']:
                    # an undeclared field is reported below (P023)
                    if name in declared and name not in self.shown():
                        self.add(
                            (*path, 'values', name), 'P022',
                            f'The card does not show the field `{name}`.',
                            'Add the field to a section of the card, or expect another one.',
                        )
        if not self.state.known:
            return
        self.fields(
            (((*path, key), value[key]) for key in ('field_readonly', 'field_absent', 'error') if key in value),
            self.state.form if of_body(self.state.form) else None,
        )
        if 'values' in value:
            self.fields(((*path, 'values', name), name) for name in value['values'])
        if 'status' in value:
            self.expect_status((*path, 'status'), value['status'])
        # after the status of the same expectation
        if 'transit_absent' in value:
            self.transit_absent((*path, 'transit_absent'), value['transit_absent'])

    def expect_status(self, path, status) -> None:
        """A status of the workflow of the entity (P024); on a card, the status of its item from now on."""
        entity = self.entity
        if entity is None:
            return
        if status not in (entity.workflow or {}).get('statuses', []):
            self.add(
                path, 'P024',
                f'The entity `{entity.data["id"]}` has no status `{status}`.',
                'Use a status of the workflow of the entity.',
            )
        elif self.state.screen['primitive'] == 'card':
            self.reached(status)

    def transit_absent(self, path, transit_id) -> None:
        """
        A transit that the card of the item does not offer the role: one of the workflow of its
        entity (P024), on a card with `transitions: true` (P022), and not one that `access`
        grants the role on every item (`all`) when the item is in its source status (P022: its
        button is shown).
        """
        screen = self.state.screen
        if not self.require(
            path, bool(screen) and screen['primitive'] == 'card' and screen['card'].get('transitions', False),
            'Transits are shown on a card with `transitions: true`.',
        ):
            return
        entity = self.entity
        if entity is None or entity.workflow is None:
            return
        transition = self.transition(path, entity, transit_id)
        grants = entity.data.get('access', {}).get(self.role, {}).get(access.TRANSIT, [])
        granted = any(it == transit_id and selector == access.ALL for _, it, selector in access.transits(grants))
        if transition is not None and granted and self.status == transition['from']:
            self.add(
                path, 'P022',
                f'The role `{self.role}` runs the transit `{transit_id}` of every item in `{self.status}` (`access`): '
                'the card shows it.',
                'Expect it absent for a role that may not run it, or for an item in another status.',
            )
