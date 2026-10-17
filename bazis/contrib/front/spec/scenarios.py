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
"""

from dataclasses import dataclass

from .issues import Document, Issues
from .refs import Entity, Product, related_fields, related_sections, screen_actions


#: the package whose users log in: the role of a scenario then needs a `test_user`
LOGIN_PACKAGE = 'users'

#: the packages of the notifications of the users: the stored ones of bazis-notify, the live
#: ones of bazis-ws
NOTIFY_PACKAGES = ('notify', 'ws')


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


#: the states of a screen that a submit which does not save shows
FAILED_STATES = {'invalid', 'error', 'forbidden', 'not_found'}


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


def check(doc: Document, product: Product | None, screens: dict, issues: Issues) -> dict[str, list[Step]]:
    """
    Checks the scenarios; returns the steps of each by its id (those of a spec with errors
    are not meant to be used).
    """
    if product is None:
        return {}
    login = LOGIN_PACKAGE in doc.data.get('packages', [])
    walked = {}
    for i, scenario in enumerate(doc.data.get('scenarios', [])):
        path = ('scenarios', i)
        role = product.roles.get(scenario['role'])
        if role is None:
            issues.add(
                doc, (*path, 'role'), 'P004', f'The role `{scenario["role"]}` is not in `roles`.',
                'Use the id of a role of `roles`.',
            )
        elif login and 'test_user' not in role and not role.get('anonymous'):
            issues.add(
                doc, (*path, 'role'), 'P025',
                f'The role `{scenario["role"]}` has no `test_user`: the end-to-end test of the '
                'scenario cannot log in.',
                'Give the role `test_user: {username: ...}`, a user of this role that the test '
                'data of the backend creates with the password of E2E_PASSWORD; or `anonymous: '
                'true` for the users who do not log in.',
            )
        walked[scenario['id']] = _Scenario(doc, product, screens, scenario, path, issues).run()
    return walked


class _Scenario:
    """
    Follows the steps of a scenario from screen to screen and checks each against the
    screen it acts on.
    """

    def __init__(self, doc, product, screens, scenario, path, issues):
        self.doc, self.product, self.screens = doc, product, screens
        self.role = scenario['role']
        self.scenario, self.path, self.issues = scenario, path, issues
        self.state = _State(known=True)
        # what the current step implies (`Step`), whether it is a refused submit, and whether
        # the step before was one
        self.edit, self.then, self.failing, self.refused = False, None, False, False

    def run(self) -> list[Step]:
        steps = []
        for i, step in enumerate(self.scenario['steps']):
            (name, value), = step.items()
            self.edit, self.then, self.refused = False, None, self.failing
            self.failing = name == 'submit' and fails(self.scenario['steps'], i)
            getattr(self, f'step_{name}')((*self.path, 'steps', i, name), value)
            steps.append(Step(name, value, self.edit, self.then, self.failing))
        return steps

    def add(self, path, code, message, hint):
        self.issues.add(self.doc, path, code, message, hint)

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
        self.state = _State(screen, known=screen is not None)
        if screen is not None and screen['primitive'] == 'form':
            self.state.form = screen['form']

    def lead(self, path, screen_id) -> None:
        """
        The step leads to the given screen without naming it.
        """
        self.go(path, screen_id)
        self.then = screen_id

    def require(self, path, condition: bool, message: str) -> bool:
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
            self.add(path, 'P022', message, 'Fix the step, or open the screen it acts on first.')
            return False
        return True

    def fields(self, items, form: dict | None = None, entity: Entity | None = None) -> None:
        """
        Checks that the entity of the screen (or the given one) has the fields of
        `(path, name)` items, and the form, when it lists its fields.
        """
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
        screen = self.state.screen
        if screen is None:
            return
        if ':' in screen['route']:
            self.add(
                path, 'P022', f'The screen `{screen_id}` shows an item (`{screen["route"]}`): a '
                'scenario does not know its id.',
                'Open a list and reach the item with `open_item`, or after a form with `then`.',
            )
        if screen.get('roles') and self.role not in screen['roles']:
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
        if not self.require(path, bool(screen) and possible, message):
            self.state.known = False
            return
        entity = self.product.entities.get(part.get('entity', screen.get('entity')))
        self.fields((((*path, 'where', name), name) for name in value['where']), entity=entity)
        self.lead(path, part['open'])

    def step_select(self, path, value):
        screen = self.state.screen
        if self.require(
            path, bool(screen) and screen['primitive'] == 'list' and 'bulk' in screen['list'],
            'Only a list with bulk actions (`list.bulk`) selects rows.',
        ):
            self.fields(((*path, 'where', name), name) for name in value['where'])
            self.state.selected = True

    def step_bulk(self, path, action_id):
        screen = self.state.screen
        actions = {it['id'] for it in screen['list'].get('bulk', [])} if screen and screen['primitive'] == 'list' else set()
        if self.require(path, action_id in actions, f'The screen has no bulk action `{action_id}`.'):
            self.require(path, self.state.selected, 'No row is selected: `select` the rows first.')
            self.state.selected = False

    def step_move(self, path, value):
        screen = self.state.screen
        if not self.require(
            path, bool(screen) and screen['primitive'] == 'board' and screen['board'].get('move', False),
            'Items move on a board with `move: true`.',
        ):
            return
        self.fields(((*path, 'where', name), name) for name in value['where'])
        entity, to = self.entity, value['to']
        if entity is None or entity.workflow is None:
            return
        columns = screen['board'].get('columns', entity.workflow['statuses'])
        if to not in entity.workflow['statuses']:
            self.add(
                (*path, 'to'), 'P024', f'The entity `{entity.data["id"]}` has no status `{to}`.',
                'Use a status of the workflow of the entity.',
            )
        elif to not in columns:
            self.add((*path, 'to'), 'P022', f'The board has no column `{to}`.', 'Move the item to a column of the board.')
        elif not any(it['to'] == to and 'payload' not in it for it in entity.transitions.values()):
            self.add(
                (*path, 'to'), 'P024', f'No transition without a payload leads to `{to}`.',
                'Move the item to a status that a transition without a payload leads to; run one '
                'with a payload on the card (`transit`).',
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
        if action['primitive'] == 'form':
            self.state.form = action
        elif 'then' in action:
            self.lead(path, action['then'])

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

    def editing(self, path) -> bool:
        """
        Whether a form is open for the step: one that is open, or the edit of a card with
        `edit: true`, which the step starts when it is not open yet.
        """
        screen = self.state.screen
        card = bool(screen) and screen['primitive'] == 'card' and screen['card'].get('edit', False)
        if not self.require(
            path, self.state.form is not None or card,
            'No form is open: run a form action, or edit a card with `edit: true`.',
        ):
            return False
        if self.state.form is None and not self.state.editing:
            self.state.editing = self.edit = True
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
        if self.editing(path):
            self.fields([((*path, name), name) for name in values], self.state.form)
            for name, value in values.items():
                self.fixed((*path, name), name)
                if self.file(name):
                    self.add(
                        (*path, name), 'P022', f'The field `{name}` is a file: it is not filled.',
                        f'Upload its file: `upload: {{field: {name}, file: <a file of e2e/fixtures/>}}`.',
                    )
                else:
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
            entity = self.entity
            if entity is not None and name in entity.fields and not self.file(name):
                self.add(
                    (*path, 'field'), 'P022', f'The field `{name}` is not a file (`type: file`).',
                    'Upload into a field of the type `file`, or fill this one.',
                )

    def file(self, name) -> bool:
        """
        Whether the entity of the screen declares the field as a file.
        """
        entity = self.entity
        return entity is not None and entity.fields.get(name, {}).get('type') == 'file'

    def step_submit(self, path, value):
        """
        A submit closes the form and leads to its `then`; a refused one (`fails`: the next
        step expects the `error` of a field or a failed `state`) keeps the form open.
        """
        if not self.editing(path) or self.failing:
            return
        form, self.state.form, self.state.editing = self.state.form, None, False
        then = (form or {}).get('then')
        if then is not None:
            self.lead(path, then)

    def step_transit(self, path, value):
        transit_id, payload = (value, None) if isinstance(value, str) else (value['id'], value.get('payload'))
        screen = self.state.screen
        if not self.require(
            path, bool(screen) and screen['primitive'] == 'card' and screen['card'].get('transitions', False),
            'Transits run on a card with `transitions: true`.',
        ):
            return
        entity = self.entity
        if entity is None or entity.workflow is None:
            return
        transition = entity.transitions.get(transit_id)
        if transition is None:
            self.add(
                path, 'P024', f'The workflow of `{entity.data["id"]}` has no transition `{transit_id}`.',
                'Use a transition of the workflow.',
            )
            return
        declared = {it['id'] for it in transition.get('payload', {}).get('fields', [])}
        if declared and not payload:
            self.add(
                path, 'P024', f'The transition `{transit_id}` requires a payload.',
                f'Give the payload: {{id: {transit_id}, payload: {{...}}}} with {", ".join(sorted(declared))}.',
            )
        for name in payload or {}:
            if name not in declared:
                self.add(
                    (*path, 'payload', name), 'P024',
                    f'The payload of `{transit_id}` has no field `{name}`.',
                    'Use the fields of the payload of the transition.',
                )

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
        screen = self.state.screen
        self.expect_items(path, value)
        if 'action_absent' in value:
            actions = self.actions()
            self.require(
                (*path, 'action_absent'), value['action_absent'] in actions,
                f'The screen has no action `{value["action_absent"]}`: it is always absent.',
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
            ((*path, key), value[key]) for key in ('field_readonly', 'field_absent', 'error') if key in value
        )
        if 'values' in value:
            self.fields(((*path, 'values', name), name) for name in value['values'])
        entity = self.entity
        if 'status' in value and entity is not None:
            statuses = (entity.workflow or {}).get('statuses', [])
            if value['status'] not in statuses:
                self.add(
                    (*path, 'status'), 'P024',
                    f'The entity `{entity.data["id"]}` has no status `{value["status"]}`.',
                    'Use a status of the workflow of the entity.',
                )
