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
The issues of the specs and their stable codes. A code never changes its meaning: the
guides of the products refer to it. The severity belongs to the code: errors fail
`bazis_front check`, warnings do not; the system checks report both as `front.W002`.
"""

from collections.abc import Iterable
from dataclasses import dataclass, field


ERROR = 'error'
WARNING = 'warning'

#: the end of the hints of the issues fixed in the backend
EXPORT_HINT = 'export the contract again with `manage.py bazis_front contract`'
#: where the backend declares its roles and its workflows, which `migrate` applies (the
#: declarations of bazis-permit and bazis-statusy 2.9; the data migrations of bazis-permit
#: before them, as the assets need bazis-permit 2.7 and bazis-statusy 2.12:
#: `capabilities.CAPABILITIES`)
DECLARE_ROLES = (
    'in `roles.py` of an app; with bazis-permit before 2.9: in a data migration'
)
DECLARE_WORKFLOWS = 'a Workflow in `workflow.py` of an app'

#: the layer of the issues of contract/contract.json, reported whatever layers are checked
CONTRACT = 'contract'

#: {code: (severity, what it means)}; documented in the table of the codes of AGENTS.md
CODES: dict[str, tuple[str, str]] = {
    'C001': (ERROR, 'contract/contract.json cannot be read'),
    'C002': (ERROR, 'contract/contract.json has another format: it was exported by another version of bazis-front'),
    'C003': (WARNING, 'the assets of the frontend (its lock) differ from the capabilities of the contract: the hooks of a package are missing, or assets of a package are there without it'),
    'C004': (ERROR, 'the installed package of a capability of the contract is older than the version whose protocol the frontend follows'),
    'C005': (WARNING, 'the Google login of the contract is that of bazis-authing 2.7 or older (`GET`), which the login screen does not offer'),
    'P001': (ERROR, 'spec/product.yaml is missing or is not valid YAML'),
    'P002': (ERROR, 'spec/product.yaml does not follow product.schema.json'),
    'P003': (ERROR, 'an id is declared twice (role, entity, field, transition, scenario)'),
    'P004': (ERROR, 'an unknown role (in access or in a scenario)'),
    'P005': (ERROR, 'a relation references an unknown entity'),
    'P006': (ERROR, 'the workflow is inconsistent: a status or a transition that the workflow of the entity does not declare'),
    'P010': (ERROR, 'a package is not installed: the contract has no section for it'),
    'P011': (ERROR, 'the resource of an entity is not in the contract'),
    'P012': (ERROR, 'a field is not in the resource of the contract'),
    'P013': (ERROR, 'a field differs from the contract: attribute or relationship, type, related resource, many'),
    'P014': (ERROR, 'the entity has a workflow, the resource is not a statusy model of the contract'),
    'P015': (ERROR, 'a status of the workflow is not in the contract, or the initial status differs'),
    'P016': (ERROR, 'a transition is not in the contract, or its from/to differ'),
    'P017': (ERROR, 'the payload of a transition differs from the contract'),
    'P018': (ERROR, 'the permit role of a role is not in the contract'),
    'P019': (ERROR, 'the permit role lacks a permission that `access` grants'),
    'P020': (WARNING, 'a selector of `access` is not a selector of the resource in the contract (`selectors` of the section `permit`), or a relation of its path is not a relationship of the contract'),
    'P021': (ERROR, 'a scenario step references an unknown screen'),
    'P022': (ERROR, 'a scenario step is not possible on the current screen'),
    'P023': (ERROR, 'a scenario step references a field that the entity of the screen does not declare'),
    'P024': (ERROR, 'a scenario step references an unknown status or transition, or its payload differs'),
    'P025': (ERROR, 'the role of a scenario has no `test_user` and is not `anonymous`, and the product logs in (`packages` has `users`)'),
    'P026': (ERROR, 'the scenarios log in with a password, and the bazis-authing of the contract has no service `password`'),
    'P027': (ERROR, 'a scenario expects a notification, and the product has no notifications (`packages` has neither `notify` nor `ws`)'),
    'P028': (ERROR, '`packages` has `ws`, and the contract has no path of the socket: the socket of bazis-ws is not routed where the export sees it (the router module)'),
    'P029': (ERROR, 'the languages of the product differ from the contract (`languages`: LANGUAGES, `language`: the code of LANGUAGES that LANGUAGE_CODE names), or `language` is not one of `languages`'),
    'P030': (ERROR, 'an anonymous role is not what bazis-permit gives the users who do not log in: its permit role is not `for_anonymous`, it has `access` without a permit role, or a selector of its access is not `all`'),
    'P031': (ERROR, 'the `label` of an entity names a field that the entity does not declare'),
    'P032': (ERROR, 'the generated screens would name two entities alike (`task-step` and `task_step`: `TASK_STEP`), or an entity by a name of their own (`ENTITIES`, `FILTER`)'),
    'P033': (WARNING, 'a scenario changes an item that it did not create (a transit, a move, an edit, a custom or a bulk action, a deletion, a related item added to it): an item of the test data, which the other scenarios and the next runs expect as it is'),
    'P034': (WARNING, 'a scenario finds an item that it did not create by the texts of the items that a scenario creates: on a database that keeps the items of the previous runs it may find one of theirs'),
    'P035': (ERROR, 'a scenario of an anonymous role opens a screen that is not public (no anonymous role in its `roles`): the frontend sends a user without a session to the login'),
    'P036': (WARNING, 'the product has the users (`packages`) and the contract has no route of the user resource: the author of a status and every user that a screen shows is labeled by the start of his id'),
    'S001': (ERROR, 'a screen file is not valid YAML'),
    'S002': (ERROR, 'a screen does not follow screen.schema.json'),
    'S003': (ERROR, 'the id of a screen differs from its file name, or its route is taken'),
    'S004': (ERROR, 'a screen references an unknown entity'),
    'S005': (ERROR, 'a screen references an unknown role'),
    'S006': (ERROR, 'a screen references an unknown screen, or one of another primitive, or opens an item in a card without `:id` in its route; a form or an action leads to a screen of an item (`:id` in its route) that is not a card of the saved item, or a deletion or the form of a custom action, which save none, to one'),
    'S007': (ERROR, 'a screen references a field that its entity does not declare'),
    'S008': (ERROR, 'a filter or a sort field cannot be filtered or sorted by in the contract'),
    'S009': (ERROR, 'a state required by the primitive is missing'),
    'S010': (ERROR, 'an action is not valid: a duplicate id (`edit` on a card with `edit: true`, which is its edit), or not possible on the primitive'),
    'S011': (ERROR, 'transitions or history on a card whose entity has no workflow'),
    'S012': (WARNING, 'a screen edits or filters a relationship with a picker, and the related resource has no search fields in the contract: its picker lists the items without a search'),
    'S013': (ERROR, 'a list has `search`, and the resource of its entity has no search fields in the contract: the search is 400 `ERR_FILTER`'),
    'S014': (ERROR, 'a value of the filter of a list or a tile does not fit the type of its field in the contract, or the highlight of a list is not by a boolean field or has no label'),
    'S015': (ERROR, 'the relation of a related section of a card is not a to-one relationship of the related entity to the entity of the card'),
    'S016': (ERROR, 'the map of a list is not by a point field of its entity, or a point field is a filter of a list'),
    'S017': (WARNING, 'a screen edits or filters a relationship with a picker, and the search fields of the related resource do not cover the fields that give the label of its items: a search by the label shown finds nothing'),
    'S018': (WARNING, 'the title of a field of an entity in the contract is its name: the backend gives the field no label (a calculated field without a title), or one that reads as its name'),
    'S019': (WARNING, 'the resource of an entity has no attribute that labels its items in the contract (`label`), and the entity has no `label`: the frontend shows an item by its id'),
    'S020': (ERROR, 'the `display` of a field does not fit its type'),
    'S021': (ERROR, 'a chart of a dashboard is neither by the status of an entity with a workflow nor by a date or a date-time field, or has a bucket or a period without a date'),
    'S022': (ERROR, 'a board is of an entity without a workflow, has a column that is not a status of its workflow, or a badge that is not a boolean field'),
    'S023': (ERROR, 'a calendar is not by a date or a date-time field, or its tone is not by a boolean field'),
    'S024': (ERROR, 'the tabs of a card are inconsistent: a tab names an unknown section or related section, or is empty; a section or a related section is in no tab or in two; the history is in no tab, or a tab has a history that the card does not have'),
    'S025': (ERROR, 'a bulk action of a list runs a transition that its entity does not have (or has no workflow), or one with a payload'),
    'S026': (WARNING, 'the frontend has no home of its own: the product declares entities, and no screen has the route `/` (it leads to the first link of the navigation), it is not a dashboard, or a dashboard has no tile'),
    'S027': (WARNING, 'a text of the specs is not in every language of the product (`languages`): a text without the map of its languages, or a map without one of them; the frontend shows the text of another language'),
    'S028': (ERROR, 'a custom screen has no code: the module of `custom` (frontend/src/screens/<id>/index.tsx for `custom: true`) is missing, or does not export its component'),
    'S029': (ERROR, 'a screen has two implementations: frontend/src/screens/<id>/index.tsx is there, and the screen is not `custom` (the frontend generates its screens)'),
    'S030': (ERROR, 'the navigation of spec/product.yaml links an unknown screen, a screen of an item (`:id` in its route), a form of the items (not that of a custom action) or a screen with `nav: false`, or a screen twice, `requires` a screen without an entity, the form of a custom action (which requires its action, `custom_actions` of the list) or `can: add` of a resource without a create route, or declares a group twice'),
    'S031': (ERROR, 'a screen with `extend` has no extension: frontend/src/screens/<id>/extend.tsx is missing or does not export `extension`, or the screen is `custom`'),
    'S032': (ERROR, 'a custom action of a screen (`primitive: custom`), a custom bulk action of a list or the action of a form (`form.action`) is not a custom action of the route set of its entity in the contract (`custom_actions` of its resource) declared with POST, of an item on a card and in a bulk action, of the route set in a form, on the rows of a list or in a bulk action one whose `access_action` is not `view`, `change` or `delete` (a list has no meta of another per row), or its `fields` are not the properties of its body that it requires and may take (a bulk action takes none)'),
    'S033': (ERROR, 'the generated code would name two screens alike (`task-list` and `task_list`: `TaskListScreen`), or two actions of a screen (`add-step` and `add_step`: `addStep`), or two custom bulk actions of a list'),
    'S034': (ERROR, 'the add of a calendar creates the item on the selected day, in a field that the create route of its resource does not take (a date that the backend sets, such as that of the creation: the day is lost), or the resource has no create route'),
    'S035': (WARNING, 'the buttons of the create forms of a screen cannot be told apart: two create actions (or the add of a calendar) with the same label, or without one (both say `Create`), or a create action of a dashboard without a label'),
    'S036': (WARNING, 'a text of the specs is a key that no dictionary of the frontend has (src/i18n/<language>.ts of the product, nor those of the components): the screen would show the key, unless the product gives it otherwise (the dictionaries are read as text)'),
    'S037': (WARNING, 'a dictionary of the product (src/i18n/<language>.ts) has a key of the texts of the specs (`screens.<id>...`) that no text of the specs has: of a screen, a section, a tab or an action that is not there, or a text that the spec does not give'),
    'S038': (ERROR, 'a screen of an item has no `:id` in its route: a card or an update form that is not custom (the id of the item is in the route; a custom one finds its item itself)'),
    'S039': (ERROR, 'a sort names a field twice (`planned_date` and `-planned_date`): a sort is the order of the items by default, by its first field, then by the next one for the items equal by it'),
    'S040': (ERROR, 'a list, a board or a calendar has filters, or a list is a report (a `filter`, whose link in the navigation reads them), and the route set of its resource does not route the fields that the user may filter by (`route_filter_fields/`, `get_route_filter_fields` left out of its `actions`): the filters show an error; a report that the navigation does not link is not checked'),
    'S041': (WARNING, 'the add of a calendar whose field is a date-time, which the create route takes, lists `fields` without it: the item is created at the start of the selected day (00:00), and the user cannot pick the time'),
    'S042': (ERROR, 'the add of a calendar has a `time` or a `duration` that it cannot use: the field of the calendar (and its `end`, for a duration) is not a date-time, the calendar has no `end`, or the form of the add does not send its end (left out of its `fields`, or of the create route)'),
    'S043': (WARNING, 'the add of a calendar by date-times shows the `end` of the item in its form without a `duration`: the form starts with the end empty, which the user fills for every item'),
    'S044': (ERROR, 'a public screen (an anonymous role in its `roles`) creates, changes or deletes through the routes of the entities, which bazis-permit always refuses to anonymous users: a form (a create or an update action, a form screen other than that of a custom action, the edit of a card, "add here", the add of a calendar, a create form of a dashboard), a deletion, a bulk action or the moves of a board'),
    'S045': (ERROR, 'a public screen leads to a screen that is not public (`open`, `then`, a tile, the last items, a related section), or a card is shown in the layout of a list (its route continues the route of the list) that is not public when it is, or public when it is not'),
    'S046': (ERROR, 'a custom action of a public screen (`primitive: custom`, or the action of a form: `form.action`) is not declared `public=True` in the contract: bazis-permit refuses it to anonymous users'),
    'S047': (WARNING, 'the product has an anonymous role that no screen lists in its `roles`: the users who do not log in have no screen'),
    'S048': (ERROR, 'the router of the frontend routes the generated screens (it imports `@/screens/generated/routes`) without the public ones, `PUBLIC_ROUTES`: a user without a session never reaches them'),
    'S049': (ERROR, 'the `value` of a tile or a chart of a dashboard aggregates a field of a type that its function does not take: `sum` and `avg` a number (a DecimalField: a `string` of the format `decimal` in the contract), `min` and `max` also a date'),
    'S050': (ERROR, 'the field of the `value` of a tile or a chart of a dashboard cannot be aggregated: its route set does not filter by it in the contract, and the core aggregates only the fields that the filter of the list reaches'),
    'S052': (ERROR, 'a property of the body of a custom action on a public screen (the fields of its dialog or of the form of the action) is the picker of a relationship whose entity an anonymous role of the screen does not view (its `access`): the picker of a guest is refused (403)'),
    'S053': (ERROR, 'the message of the result of the form of a custom action (`form.result.message`) shows a `{name}` that is not a property of the answer of the action in the contract (`response` of its custom action), or the action answers no JSON'),
    'S054': (WARNING, 'a property of the body of a custom action (a field of its dialog or of the form of the action) or a field of the payload of a transition has a type that the form cannot ask for: a union (other than a decimal, a number or a text, and a text that may be empty), an object, an array (other than the ids of a to-many relationship); the user types it as JSON'),
    'S055': (ERROR, 'the id of the screen is the mark of the menu of the top bar, `more`: the links of the screen (`nav:more`) would be marked as the menu of the links that the top bar has no room for'),
    'D001': (ERROR, 'a design file is not valid YAML or JSON'),
    'D002': (ERROR, 'spec/design/theme.yaml does not follow design.schema.json'),
    'D003': (ERROR, 'spec/design/tokens.json does not follow tokens.schema.json'),
    'D004': (ERROR, 'a token references an undefined token, or references itself through other tokens'),
    'D005': (ERROR, 'a token required by the preset is undefined or of another type'),
    'D006': (ERROR, 'a token references a token of another type'),
    'D007': (ERROR, 'a token of the dark mode (the group `dark`) overrides no token of the same name and type'),
    'D008': (WARNING, 'a status of `statuses` in theme.yaml is not a status of the contract'),
    'D009': (WARNING, 'a text color (at the opacity of the components that use it translucent) has a contrast below 4.5:1 (WCAG AA) on its background, in the light or the dark mode'),
    'D010': (ERROR, '`mode: dark` in theme.yaml, and the design has no tokens of the dark mode (the group `dark`)'),
    'D011': (WARNING, 'an entity with a screen has no icon in `icons` of theme.yaml'),
    'D012': (WARNING, 'spec/design/tokens.json replaces more than half of the tokens of a layer that theme.yaml names (palette, fonts, shape, surface): the layer barely shows'),
    'D013': (WARNING, 'an icon of the specs (`icons` of theme.yaml, `icon` of the navigation or of a tile of a dashboard) is not an icon of the lucide-react of the template'),
}


@dataclass(frozen=True)
class Issue:
    #: product, screens, design or contract
    layer: str
    #: the path of the file, relative to the product root
    file: str
    #: the JSON Pointer of the value in the file ('' for the whole file)
    path: str
    code: str
    message: str
    #: what to do about it
    hint: str

    @property
    def severity(self) -> str:
        return CODES[self.code][0]

    @property
    def location(self) -> str:
        return f'{self.file}#{self.path}' if self.path else self.file

    def as_dict(self) -> dict:
        return {
            'layer': self.layer,
            'file': self.file,
            'path': self.path,
            'code': self.code,
            'severity': self.severity,
            'message': self.message,
            'hint': self.hint,
        }


def pointer(path: Iterable) -> str:
    """
    The JSON Pointer of a path of keys and indexes.
    """
    return ''.join('/' + str(it).replace('~', '~0').replace('/', '~1') for it in path)


@dataclass
class Document:
    """
    A file of the specs as loaded: its data is None when it cannot be read, and `valid`
    is true only when it follows its JSON Schema, so that only valid documents are checked
    further.
    """

    layer: str
    file: str
    data: object = None
    valid: bool = False


@dataclass
class Issues:
    items: list[Issue] = field(default_factory=list)

    def add(self, doc: Document, path: Iterable, code: str, message: str, hint: str) -> None:
        if code not in CODES:
            raise ValueError(f'unknown code of a spec issue: {code}')
        self.items.append(Issue(doc.layer, doc.file, pointer(path), code, message, hint))
