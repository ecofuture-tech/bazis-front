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
"""

from dataclasses import dataclass

from .issues import Document, Issues
from .refs import Entity, Product


@dataclass
class _State:
    """
    Where a scenario is: the current screen (None when it cannot be known: an unknown or
    broken screen, after which the steps are not checked until the next `open`) and
    whether a form is open on it (the action that opened it, or the screen itself).
    """

    screen: dict | None = None
    known: bool = False
    form: dict | None = None


def check(doc: Document, product: Product | None, screens: dict, issues: Issues) -> None:
    if product is None:
        return
    for i, scenario in enumerate(doc.data.get('scenarios', [])):
        path = ('scenarios', i)
        if scenario['role'] not in product.roles:
            issues.add(
                doc, (*path, 'role'), 'P004', f'The role `{scenario["role"]}` is not in `roles`.',
                'Use the id of a role of `roles`.',
            )
        _Scenario(doc, product, screens, scenario, path, issues).run()


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

    def run(self):
        for i, step in enumerate(self.scenario['steps']):
            (name, value), = step.items()
            getattr(self, f'step_{name}')((*self.path, 'steps', i, name), value)

    def add(self, path, code, message, hint):
        self.issues.add(self.doc, path, code, message, hint)

    @property
    def entity(self) -> Entity | None:
        screen = self.state.screen
        return self.product.entities.get(screen['entity']) if screen else None

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

    def fields(self, items, form: dict | None = None) -> None:
        """
        Checks that the entity of the screen has the fields of `(path, name)` items, and
        the form, when it lists its fields.
        """
        entity = self.entity
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
        screen = self.state.screen
        if not self.require(
            path, bool(screen) and screen['primitive'] == 'list' and 'open' in screen['list'],
            'Only a list whose rows open a card (`list.open`) opens an item.',
        ):
            self.state.known = False
            return
        self.fields(((*path, 'where', name), name) for name in value['where'])
        self.go(path, screen['list']['open'])

    def step_action(self, path, action_id):
        screen = self.state.screen
        actions = {it['id']: it for it in (screen or {}).get('actions', [])}
        if not self.require(path, action_id in actions, f'The screen has no action `{action_id}`.'):
            self.state.known = False
            return
        action = actions[action_id]
        if action['primitive'] == 'form':
            self.state.form = action
        elif 'then' in action:
            self.go(path, action['then'])

    def editing(self, path) -> bool:
        screen = self.state.screen
        return self.require(
            path,
            self.state.form is not None or (bool(screen) and screen['primitive'] == 'card' and screen['card'].get('edit', False)),
            'No form is open: run a form action, or edit a card with `edit: true`.',
        )

    def step_fill(self, path, values):
        if self.editing(path):
            self.fields([((*path, name), name) for name in values], self.state.form)

    def step_upload(self, path, value):
        if self.editing(path):
            self.fields([((*path, 'field'), value['field'])], self.state.form)

    def step_submit(self, path, value):
        if not self.editing(path):
            return
        form, self.state.form = self.state.form, None
        then = (form or {}).get('then')
        if then is not None:
            self.go(path, then)

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

    def step_expect(self, path, value):
        if 'screen' in value:
            self.go((*path, 'screen'), value['screen'])
        screen = self.state.screen
        if 'rows' in value:
            self.require(
                (*path, 'rows'), bool(screen) and screen['primitive'] == 'list', 'Only a list has rows.'
            )
        if 'action_absent' in value:
            actions = {it['id'] for it in (screen or {}).get('actions', [])}
            self.require(
                (*path, 'action_absent'), value['action_absent'] in actions,
                f'The screen has no action `{value["action_absent"]}`: it is always absent.',
            )
        if not self.state.known:
            return
        self.fields(((*path, key), value[key]) for key in ('field_readonly', 'error') if key in value)
        entity = self.entity
        if 'status' in value and entity is not None:
            statuses = (entity.workflow or {}).get('statuses', [])
            if value['status'] not in statuses:
                self.add(
                    (*path, 'status'), 'P024',
                    f'The entity `{entity.data["id"]}` has no status `{value["status"]}`.',
                    'Use a status of the workflow of the entity.',
                )
