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
The references of the specs: the ids that product.yaml declares, the screens that use them,
and their comparison with contract.json. Only the documents that follow their JSON Schema
are checked here; a reference to a screen that does not is accepted unchecked, so that one
broken file does not cascade.
"""

from dataclasses import dataclass, field
from pathlib import Path

from . import access
from .design import check_icon
from .issues import DECLARE_ROLES, DECLARE_WORKFLOWS, EXPORT_HINT, Document, Issues


#: the field of an entity with a workflow: its status (bazis-statusy)
STATUS_FIELD = 'status'

#: the states that a screen of a primitive must render (its `data-bz="state:<state>"`)
REQUIRED_STATES = {
    'list': ('loading', 'empty', 'error', 'forbidden'),
    'card': ('loading', 'error', 'forbidden', 'not_found'),
    'form': ('loading', 'error', 'forbidden', 'invalid'),
    'dashboard': ('loading', 'error'),
    'board': ('loading', 'empty', 'error', 'forbidden'),
    'calendar': ('loading', 'empty', 'error', 'forbidden'),
}

#: the route of the home of the frontend
HOME_ROUTE = '/'

#: the types of the fields of the days of a calendar and of the charts by date
DATES = ('date', 'datetime')

#: the format of a string attribute of the contract by the type of the specs
FORMATS = {'date': 'date', 'datetime': 'date-time', 'time': 'time'}
#: the format of the GeoJSON object of a point field in the contract (the type `point`)
POINT = 'point'

#: the types of the fields that each `display` of a field fits (a DecimalField, a sum, is a
#: `string` of its exact digits)
DISPLAY_TYPES = {
    'plain': ('integer', 'number'),
    'currency': ('integer', 'number', 'string'),
    'unit': ('integer', 'number', 'string'),
    'bar': ('integer', 'number'),
    'phone': ('string',),
}


@dataclass
class Entity:
    data: dict
    #: the path of the entity in product.yaml
    path: tuple
    #: the declared fields by id, and `status` for an entity with a workflow
    fields: dict[str, dict] = field(default_factory=dict)
    #: the transitions of the workflow by id
    transitions: dict[str, dict] = field(default_factory=dict)

    @property
    def workflow(self) -> dict | None:
        return self.data.get('workflow')


@dataclass
class Product:
    roles: dict[str, dict]
    entities: dict[str, Entity]


def index(doc: Document, items: list[dict], path: tuple, kind: str, issues: Issues) -> dict:
    """
    The items by id; an id declared again is reported (P003) and its item left out.
    """
    result = {}
    for i, item in enumerate(items):
        if item['id'] in result:
            issues.add(
                doc, (*path, i, 'id'), 'P003', f'The {kind} `{item["id"]}` is declared twice.',
                f'Rename or remove one of the {kind}s `{item["id"]}`.',
            )
        else:
            result[item['id']] = item
    return result


def statusy_model(contract: dict, resource: str) -> dict | None:
    return (contract['capabilities'].get('statusy') or {}).get('models', {}).get(resource)


def matches_type(spec_type: str, schema: dict) -> bool:
    """
    Whether an attribute of the contract (its JSON `type` and `format`) has the type of the
    specs.
    """
    kind, fmt = schema.get('type'), schema.get('format')
    if spec_type in ('string', 'text'):
        return kind == 'string' and fmt not in FORMATS.values()
    if spec_type == 'file':
        # an uploaded file is a relationship (`is_file`), never an attribute
        return False
    if spec_type in FORMATS:
        return kind == 'string' and fmt == FORMATS[spec_type]
    if spec_type == 'point':
        # a PointField of the model, a GeoJSON point (the contract reads it from the model)
        return kind == 'object' and fmt == POINT
    if spec_type == 'json':
        return kind in ('object', 'array') and fmt != POINT
    return kind == spec_type


def uploads(contract: dict) -> set[str]:
    """
    The resources of the uploaded files of bazis-uploadable in the contract.
    """
    return set((contract['capabilities'].get('uploadable') or {}).get('resources', []))


def is_file(schema: dict, contract: dict) -> bool:
    """
    Whether a field of the contract is a file of the specs (`type: file`): a to-one
    relationship to a resource of the uploaded files of bazis-uploadable.
    """
    return schema.get('many') is False and schema.get('relation') in uploads(contract)


def _describe(schema: dict) -> str:
    if 'relation' in schema:
        return f'a relationship to {schema["relation"]} (many: {str(schema["many"]).lower()})'
    return f'an attribute of type {schema.get("type")}' + (
        f' ({schema["format"]})' if 'format' in schema else ''
    )


# product.yaml


def check_product(doc: Document, contract: dict | None, issues: Issues) -> Product | None:
    """
    The ids of product.yaml, checked; None when it does not follow its schema.
    """
    if not doc.valid:
        return None
    data = doc.data
    product = Product(
        roles=index(doc, data.get('roles', []), ('roles',), 'role', issues),
        entities={},
    )
    entities = index(doc, data.get('entities', []), ('entities',), 'entity', issues)
    for i, item in enumerate(data.get('entities', [])):
        if entities[item['id']] is item:
            product.entities[item['id']] = _entity(doc, item, ('entities', i), issues)
    for entity in product.entities.values():
        _check_entity(doc, entity, product, issues)
    index(doc, data.get('scenarios', []), ('scenarios',), 'scenario', issues)

    _check_languages(doc, data, contract, issues)
    if contract is not None:
        _check_packages(doc, data, contract, issues)
        _check_login(doc, data, contract, issues)
        _check_roles(doc, product, contract, issues)
        for entity in product.entities.values():
            _check_entity_contract(doc, entity, product, contract, issues)
    return product


def _entity(doc: Document, data: dict, path: tuple, issues: Issues) -> Entity:
    entity = Entity(data, path)
    entity.fields = index(doc, data['fields'], (*path, 'fields'), 'field', issues)
    workflow = entity.workflow
    if workflow is None:
        return entity
    if STATUS_FIELD in entity.fields:
        position = next(i for i, it in enumerate(data['fields']) if it['id'] == STATUS_FIELD)
        issues.add(
            doc, (*path, 'fields', position, 'id'), 'P003',
            f'The field `{STATUS_FIELD}` of the entity `{data["id"]}` is the status of its '
            'workflow.',
            f'Remove it from `fields`: an entity with a workflow has the field `{STATUS_FIELD}`.',
        )
    entity.fields[STATUS_FIELD] = {'id': STATUS_FIELD, 'status': True}
    entity.transitions = index(
        doc, workflow.get('transitions', []), (*path, 'workflow', 'transitions'), 'transition',
        issues,
    )
    return entity


def _check_entity(doc: Document, entity: Entity, product: Product, issues: Issues) -> None:
    """
    The references inside product.yaml: relations, the label, the displays, the workflow and
    the access.
    """
    path = entity.path
    for i, item in enumerate(entity.data['fields']):
        if 'relation' in item and item['relation'] not in product.entities:
            issues.add(
                doc, (*path, 'fields', i, 'relation'), 'P005',
                f'The field `{item["id"]}` references the unknown entity `{item["relation"]}`.',
                'Declare the entity in `entities`, with its resource.',
            )
        if 'display' in item:
            _check_display(doc, (*path, 'fields', i, 'display'), item, issues)
    for i, name in enumerate(entity.data.get('label', [])):
        if name not in entity.fields:
            issues.add(
                doc, (*path, 'label', i), 'P031',
                f'The label of `{entity.data["id"]}` names `{name}`, which is not a field of the '
                'entity.',
                'Name fields of the entity in `label`, or declare the field in `fields`.',
            )

    workflow = entity.workflow
    if workflow is not None:
        statuses = workflow['statuses']
        if workflow['initial'] not in statuses:
            _unknown_status(doc, (*path, 'workflow', 'initial'), workflow['initial'], issues)
        for i, item in enumerate(workflow.get('transitions', [])):
            for end in ('from', 'to'):
                if item[end] not in statuses:
                    _unknown_status(doc, (*path, 'workflow', 'transitions', i, end), item[end], issues)

    for role, grants in entity.data.get('access', {}).items():
        role_path = (*path, 'access', role)
        if role not in product.roles:
            issues.add(
                doc, role_path, 'P004', f'The access of `{entity.data["id"]}` is for the unknown role `{role}`.',
                'Declare the role in `roles`, or remove its access.',
            )
        for operation, grant in grants.items():
            _check_grant(doc, entity, (*role_path, operation), operation, grant, issues)


def _check_display(doc: Document, path: tuple, item: dict, issues: Issues) -> None:
    """
    The `display` of a field fits its type: a number is `plain`, a `bar` (of an integer or
    a number), a sum in a `currency` or a quantity in a `unit` (also of a DecimalField, a
    `string`); a `phone` is a string; a relationship has none.
    """
    display = item['display']
    kind = display if isinstance(display, str) else next(iter(display))
    if item.get('type') in DISPLAY_TYPES[kind]:
        return
    declared = f'the type `{item["type"]}`' if 'type' in item else 'a relationship'
    issues.add(
        doc, path, 'S020',
        f'The display `{kind}` of the field `{item["id"]}` does not fit {declared}.',
        f'Give `{kind}` to a field of the type {" or ".join(f"`{it}`" for it in DISPLAY_TYPES[kind])}, '
        'or remove it.',
    )


def _unknown_status(doc: Document, path: tuple, status: str, issues: Issues) -> None:
    issues.add(
        doc, path, 'P006', f'The status `{status}` is not in the `statuses` of the workflow.',
        'Add it to `statuses` or use one of them.',
    )


def _check_grant(doc: Document, entity: Entity, path: tuple, operation: str, grant, issues: Issues) -> None:
    workflow = entity.workflow
    hint = 'Declare the workflow of the entity, or remove it from the access.'
    if operation == access.TRANSIT:
        keys = enumerate(grant) if isinstance(grant, list) else ((it, it) for it in grant)
        for key, transit in keys:
            if workflow is None:
                issues.add(doc, (*path, key), 'P006', 'The entity has no workflow to transit.', hint)
            elif transit not in entity.transitions:
                issues.add(
                    doc, (*path, key), 'P006', f'The transition `{transit}` is not in the workflow.',
                    'Declare it in `workflow.transitions` or remove it from the access.',
                )
        return
    for key, value in access.listed(grant):
        if isinstance(value, str):
            continue
        for i, status in enumerate(value['statuses']):
            if workflow is None:
                issues.add(doc, (*path, *key, 'statuses'), 'P006', 'The entity has no workflow: it has no statuses.', hint)
                break
            if status not in workflow['statuses']:
                _unknown_status(doc, (*path, *key, 'statuses', i), status, issues)


def _check_packages(doc: Document, data: dict, contract: dict, issues: Issues) -> None:
    for i, package in enumerate(data.get('packages', [])):
        if package not in contract['capabilities']:
            issues.add(
                doc, ('packages', i), 'P010',
                f'The contract has no section `{package}`: bazis-{package} is not installed.',
                f'Install bazis-{package} with its app in BS_INSTALLED_APPS, and {EXPORT_HINT}.',
            )
        elif package == 'ws' and contract['capabilities']['ws'].get('path') is None:
            issues.add(
                doc, ('packages', i), 'P028',
                'The contract has no path of the socket of bazis-ws: the application does not '
                'route the socket where the export sees it, and the frontend opens no socket '
                '(no notification, no live update).',
                'Route it in the module of BS_BAZIS_ROUTER_MODULE, not in the main module: '
                "`router.register('bazis.contrib.ws.router')` (bazis-ws 2.6.0, under the prefix of "
                'the router: `/api/v1/ws`), or `router.routes.append(ws_route)` (`/ws`); then '
                f'{EXPORT_HINT}.',
            )


def _check_languages(doc: Document, data: dict, contract: dict | None, issues: Issues) -> None:
    """
    The languages of the interface: `language` is one of `languages`, and both are those of
    the backend (`project.languages` and `project.language` of the contract).
    """
    languages, language = data.get('languages'), data.get('language')
    if languages is not None and language is not None and language not in languages:
        issues.add(
            doc, ('language',), 'P029', f'The language `{language}` is not one of `languages`.',
            'Add it to `languages`, or set `language` to one of them.',
        )
    if contract is None:
        return
    project = contract['project']
    hint = (
        'Make the specs follow the backend, or change LANGUAGES and LANGUAGE_CODE of its '
        f'settings (BS_LANGUAGES, BS_LANGUAGE_CODE), and {EXPORT_HINT}.'
    )
    codes = [it['code'] for it in project.get('languages', [])]
    if languages is not None and sorted(languages) != sorted(codes):
        issues.add(
            doc, ('languages',), 'P029',
            f'The languages {", ".join(languages)} differ from those of the backend: {", ".join(codes)}.',
            hint,
        )
    if language is not None and language != project.get('language'):
        issues.add(
            doc, ('language',), 'P029',
            f'The language `{language}` differs from that of the backend: `{project.get("language")}`.',
            hint,
        )


def _check_login(doc: Document, data: dict, contract: dict, issues: Issues) -> None:
    """
    The end-to-end tests log in with the username and the password of the test users: with
    bazis-authing, through its service `password` (the login screen has no password without
    it).
    """
    authing = contract['capabilities'].get('authing')
    if not data.get('scenarios') or 'users' not in data.get('packages', []) or not (authing or {}).get('auth_url'):
        return
    if not any(it['code'] == 'password' and it['method'] == 'POST' for it in authing['actions']):
        issues.add(
            doc, ('scenarios',), 'P026',
            'The scenarios log in with a password, and bazis-authing has no service `password`: '
            'the login screen offers no password.',
            'Add `bazis.contrib.authing.services.password` to BAZIS_AUTH_KINDS and register its '
            f'router, then {EXPORT_HINT}.',
        )


def _check_roles(doc: Document, product: Product, contract: dict, issues: Issues) -> None:
    if not product.roles:
        return
    permit = contract['capabilities'].get('permit')
    if permit is None:
        issues.add(
            doc, ('roles',), 'P010', 'The roles need bazis-permit: the contract has no section `permit`.',
            f'Install bazis-permit with its app in BS_INSTALLED_APPS, and {EXPORT_HINT}.',
        )
        return
    roles = {it['slug']: it for it in permit['roles']}
    for i, role in enumerate(doc.data['roles']):
        if 'permit' not in role:
            # an anonymous role of the public routes and actions only (the schema)
            continue
        if role['permit'] not in roles:
            issues.add(
                doc, ('roles', i, 'permit'), 'P018',
                f'The permit role `{role["permit"]}` of the role `{role["id"]}` is not in the contract.',
                f'Create the Role `{role["permit"]}` of bazis-permit ({DECLARE_ROLES}), migrate, '
                f'and {EXPORT_HINT}.',
            )
        elif role.get('anonymous') and not roles[role['permit']].get('for_anonymous'):
            issues.add(
                doc, ('roles', i, 'permit'), 'P030',
                f'The permit role `{role["permit"]}` of the anonymous role `{role["id"]}` is not a '
                'role for anonymous users: bazis-permit gives the users who do not log in only '
                'the permissions of the roles `for_anonymous`.',
                f'Declare the Role `{role["permit"]}` with `for_anonymous=True` ({DECLARE_ROLES}), '
                f'migrate, and {EXPORT_HINT}; or name a role for anonymous users.',
            )


def _check_entity_contract(
    doc: Document, entity: Entity, product: Product, contract: dict, issues: Issues
) -> None:
    data, path = entity.data, entity.path
    resource = contract['project']['resources'].get(data['resource'])
    if resource is None:
        issues.add(
            doc, (*path, 'resource'), 'P011',
            f'The resource `{data["resource"]}` of the entity `{data["id"]}` is not in the contract.',
            'Use the JSON:API type of a resource of contract.json (`app.model`), or create the '
            f'model and its route set, and {EXPORT_HINT}.',
        )
        return
    for i, item in enumerate(data['fields']):
        if entity.fields.get(item['id']) is item:
            _check_field(doc, (*path, 'fields', i), item, data['resource'], resource, product, contract, issues)
    if not resource['label'] and 'label' not in data:
        issues.add(
            doc, path, 'S019',
            f'The items of `{data["resource"]}` have no attribute that labels them in the '
            'contract (`label`: a `name`, a `title`, the names of a person...), and the entity '
            'no `label`: the frontend shows an item by its id.',
            'Give the entity the fields that label its items, `label: [...]` (the book and the '
            'reader of a loan: `[book, reader]`), which the screens give to the components; or '
            f'give its route set an attribute of a label, and {EXPORT_HINT}.',
        )
    if entity.workflow is not None:
        _check_workflow(doc, entity, contract, issues)
    if data.get('access'):
        statusy = statusy_model(contract, data['resource'])
        access.check(doc, entity, statusy, product, contract, issues)


def _check_field(
    doc: Document, path: tuple, item: dict, name: str, resource: dict, product: Product,
    contract: dict, issues: Issues,
) -> None:
    actual = resource['fields'].get(item['id'])
    if actual is None:
        issues.add(
            doc, path, 'P012', f'The field `{item["id"]}` is not in the resource `{name}`.',
            'Add the field to the model and to the schemas of its route set, or remove it from '
            f'the spec; then {EXPORT_HINT}.',
        )
        return
    # its name, or the default `verbose_name` of Django (`status author`): in English only
    if actual['title'] in (item['id'], item['id'].replace('_', ' ')):
        issues.add(
            doc, path, 'S018',
            f'The title of the field `{item["id"]}` of `{name}` in the contract is its name: the '
            'frontend shows the name as the label of the field, in every language.',
            "Give the field a label in the backend: `SchemaField(title=_('...'))` in "
            '`SchemaFields(include=...)` of the fields of its route set (a calculated field, a '
            'reverse relationship, a field of a package), or a `verbose_name` other than its '
            f'name (a field of the model); then {EXPORT_HINT}.',
        )
    if 'relation' in item:
        target = product.entities.get(item['relation'])
        if target is None:
            return
        related = actual.get('relation')
        related = related if isinstance(related, list) else [related]
        if target.data['resource'] in related and actual.get('many') == item.get('many', False):
            return
        expected = {'relation': target.data['resource'], 'many': item.get('many', False)}
    elif item['type'] == 'file':
        if is_file(actual, contract):
            return
        issues.add(
            doc, path, 'P013',
            f'The field `{item["id"]}` of `{name}` is {_describe(actual)} in the contract, the '
            'spec declares a file: a relationship to the uploaded files of bazis-uploadable.',
            'Make the field a foreign key to `uploadable.FileUpload` (bazis-uploadable, with a '
            'route set of FileUploadRouteSet registered), or give the spec its type; then '
            f'{EXPORT_HINT}.',
        )
        return
    else:
        if matches_type(item['type'], actual):
            return
        expected = None
    # a DecimalField is a string of its exact digits in the API, not a JSON number
    decimal = item.get('type') in ('number', 'integer') and matches_type('string', actual)
    issues.add(
        doc, path, 'P013',
        f'The field `{item["id"]}` of `{name}` is {_describe(actual)} in the contract, '
        + (f'the spec declares {_describe(expected)}.' if expected else f'the spec declares the type `{item["type"]}`.'),
        'Make the spec follow the contract, or change the model.'
        + (' A relationship to the uploaded files of bazis-uploadable is `type: file`.' if is_file(actual, contract) else '')
        + (' A DecimalField is a string in the API (its exact digits): declare it `type: string`, '
           'and show it with `formatDecimal` of `@/bazis/i18n`.' if decimal else ''),
    )


def _check_workflow(doc: Document, entity: Entity, contract: dict, issues: Issues) -> None:
    data, path, workflow = entity.data, entity.path, entity.workflow
    model = statusy_model(contract, data['resource'])
    if model is None:
        issues.add(
            doc, (*path, 'workflow'), 'P014',
            f'The resource `{data["resource"]}` has no statuses in the contract.',
            'Make the model a StatusyMixin with a StatusyRouteSetBase route set (bazis-statusy), '
            f'or remove the workflow; then {EXPORT_HINT}.',
        )
        return
    hint = (
        f'Create the statuses and transits of `{data["resource"]}` ({DECLARE_WORKFLOWS}), '
        f'migrate, and {EXPORT_HINT}.'
    )
    if workflow['initial'] != model['initial']:
        issues.add(
            doc, (*path, 'workflow', 'initial'), 'P015',
            f'The initial status is `{model["initial"]}` in the contract, not `{workflow["initial"]}`.',
            'Use the initial status of the model in the backend: `initial` of its `Workflow` '
            '(bazis-statusy), else BAZIS_STATUS_INITIAL.',
        )
    statuses = {it['id'] for it in model['statuses']}
    for i, status in enumerate(workflow['statuses']):
        if status not in statuses:
            issues.add(
                doc, (*path, 'workflow', 'statuses', i), 'P015',
                f'The status `{status}` is not a status of `{data["resource"]}` in the contract.', hint,
            )
    transits = {it['id']: it for it in model['transits']}
    for i, item in enumerate(workflow.get('transitions', [])):
        item_path = (*path, 'workflow', 'transitions', i)
        transit = transits.get(item['id'])
        if transit is None:
            issues.add(
                doc, item_path, 'P016', f'The transition `{item["id"]}` is not a transit of `{data["resource"]}` in the contract.',
                hint,
            )
            continue
        if (item['from'], item['to']) != (transit['src'], transit['dst']):
            issues.add(
                doc, item_path, 'P016',
                f'The transition `{item["id"]}` goes from `{transit["src"]}` to `{transit["dst"]}` in the contract.',
                'Make the spec follow the Transit of the backend, or change the Transit.',
            )
        _check_payload(doc, (*item_path, 'payload'), item, transit, issues)


def _check_payload(doc: Document, path: tuple, item: dict, transit: dict, issues: Issues) -> None:
    payload = transit['payload']
    if (payload is None) != ('payload' not in item):
        issues.add(
            doc, path, 'P017',
            f'The transition `{item["id"]}` '
            + ('requires a payload in the contract.' if payload else 'has no payload in the contract.'),
            'Declare the fields of the payload of the transit in the spec.' if payload else
            'Remove the payload from the spec, or give the transit an action with a typed payload.',
        )
        return
    if payload is None:
        return
    properties = payload['schema'].get('properties', {})
    for i, item_field in enumerate(item['payload']['fields']):
        prop = properties.get(item_field['id'])
        if prop is None:
            issues.add(
                doc, (*path, 'fields', i), 'P017',
                f'The payload of `{item["id"]}` has no field `{item_field["id"]}` in the contract.',
                f'Use the fields of the payload: {", ".join(sorted(properties)) or "none"}.',
            )
        elif not matches_type(item_field['type'], _not_null(prop)):
            issues.add(
                doc, (*path, 'fields', i, 'type'), 'P017',
                f'The field `{item_field["id"]}` of the payload of `{item["id"]}` is '
                f'{_describe(_not_null(prop))} in the contract.',
                'Make the spec follow the payload type of the transit.',
            )


def _not_null(schema: dict) -> dict:
    """
    The JSON Schema of a property of a payload without its `null` alternative; a model
    (`$ref`) is an object.
    """
    for alternative in schema.get('anyOf', [schema]):
        if alternative.get('type') != 'null':
            return {'type': 'object'} if '$ref' in alternative else alternative
    return schema


# screens


def check_screens(
    docs: list[Document], product: Product | None, contract: dict | None, issues: Issues
) -> dict[str, dict | None]:
    """
    The screens by id (their file name), checked; None for those that do not follow their
    schema.
    """
    screens = {Path(doc.file).stem: doc.data if doc.valid else None for doc in docs}
    routes = {}
    for doc in docs:
        if not doc.valid:
            continue
        data = doc.data
        stem = Path(doc.file).stem
        if data['id'] != stem:
            issues.add(
                doc, ('id',), 'S003', f'The id `{data["id"]}` differs from the file name `{stem}`.',
                f'Rename the file to `{data["id"]}.yaml` or the id to `{stem}`.',
            )
        if data['route'] in routes:
            issues.add(
                doc, ('route',), 'S003', f'The route `{data["route"]}` is also the route of `{routes[data["route"]]}`.',
                'Give every screen its own route.',
            )
        routes.setdefault(data['route'], stem)
        _check_screen(doc, product, screens, contract, issues)
    if product and product.entities:
        _check_home(docs, routes, issues)
    return screens


def check_navigation(
    doc: Document, screens: dict[str, dict | None], product: Product | None, contract: dict | None, issues: Issues
) -> None:
    """
    The navigation of product.yaml: each link opens a screen of the specs without an item, not
    a form, without `nav: false`, linked once, what it `requires` the backend allows on the
    items of the entity of its screen (one with an entity; `can: add` of a resource with a
    create route in the contract), and each group is declared once (S030); their icons are
    those of lucide-react (D013). A screen that does not follow its schema is accepted
    unchecked.
    """
    if not doc.valid:
        return
    linked, groups = set(), set()
    for i, item in enumerate(doc.data.get('navigation', [])):
        if 'group' in item:
            if item['group'] in groups:
                issues.add(
                    doc, ('navigation', i, 'group'), 'S030', f'The group `{item["group"]}` is declared twice.',
                    'Give every group of the navigation an id of its own.',
                )
            groups.add(item['group'])
            links = [(('navigation', i, 'items', j), it) for j, it in enumerate(item['items'])]
        else:
            links = [(('navigation', i), item)]
        for path, link in links:
            if 'icon' in link:
                check_icon(doc, (*path, 'icon'), link['icon'], issues)
            _check_link(doc, (*path, 'screen'), link['screen'], screens, linked, issues)
            linked.add(link['screen'])
            if 'requires' in link:
                _check_requires(doc, (*path, 'requires'), link, screens.get(link['screen']), product, contract, issues)


def _check_link(
    doc: Document, path: tuple, screen_id: str, screens: dict[str, dict | None], linked: set[str], issues: Issues
) -> None:
    hint = 'Link the screens that the user opens from the navigation: lists, boards, calendars and dashboards.'
    if screen_id not in screens:
        problem = f'The screen `{screen_id}` does not exist.'
        hint = f'Create spec/screens/{screen_id}.yaml or link an existing screen.'
    elif screen_id in linked:
        problem = f'The screen `{screen_id}` is linked twice.'
        hint = 'Link every screen once.'
    elif (screen := screens[screen_id]) is None:
        return
    elif ':' in screen['route']:
        problem = f'The screen `{screen_id}` shows an item (`{screen["route"]}`): it is opened from another screen.'
    elif screen['primitive'] == 'form':
        problem = f'The screen `{screen_id}` is a form: it is opened from another screen.'
    elif screen.get('nav') is False:
        problem = f'The screen `{screen_id}` has `nav: false`.'
        hint = 'Remove the link, or `nav: false` from the screen.'
    else:
        return
    issues.add(doc, path, 'S030', problem, hint)


def _check_requires(
    doc: Document, path: tuple, link: dict, screen: dict | None, product: Product | None, contract: dict | None,
    issues: Issues,
) -> None:
    if screen is None:
        return
    if 'entity' not in screen:
        issues.add(
            doc, path, 'S030',
            f'The link of `{link["screen"]}` requires what the backend allows on the items of the entity of '
            'the screen, which has none.',
            'Remove `requires`: the link of a screen without an entity (a dashboard) is shown to every user.',
        )
        return
    entity = product.entities.get(screen['entity']) if product else None
    resource = contract['project']['resources'].get(entity.data['resource']) if contract and entity else None
    if link['requires']['can'] == 'add' and resource is not None and 'create' not in resource['actions'].values():
        issues.add(
            doc, path, 'S030',
            f'The link of `{link["screen"]}` requires that the user may add a `{entity.data["resource"]}`, '
            'which has no create route in the contract: it is never shown.',
            f'Remove `requires`, or give the route set of `{entity.data["resource"]}` its create route and '
            f'{EXPORT_HINT}.',
        )


def _check_home(docs: list[Document], routes: dict[str, str], issues: Issues) -> None:
    """
    The home of the frontend (S026, a warning) of a product that declares entities: the
    screen at `/`, a dashboard with tiles; without it `/` leads to the first link of the
    navigation. A product without entities (the starter home of `init` has no
    tile: there is nothing to count yet), without screens, or with a screen that does not
    follow its schema, is not told.
    """
    hint = (
        f'Give the product a dashboard at `{HOME_ROUTE}` (`spec/screens/home.yaml`): tiles that '
        'count the items by their statuses and dates, the last items of its main entity.'
    )
    if docs and all(it.valid for it in docs) and HOME_ROUTE not in routes:
        folder = Document('screens', Path(docs[0].file).parent.as_posix())
        issues.add(
            folder, (), 'S026',
            f'No screen has the route `{HOME_ROUTE}`: it leads to the first link of the navigation.', hint,
        )
    for doc in docs:
        if not doc.valid:
            continue
        data = doc.data
        if data['route'] == HOME_ROUTE and data['primitive'] != 'dashboard':
            issues.add(doc, ('primitive',), 'S026', f'The home `{HOME_ROUTE}` is a {data["primitive"]}.', hint)
        if data['primitive'] == 'dashboard' and not data['dashboard'].get('tiles'):
            issues.add(
                doc, ('dashboard',), 'S026', 'The dashboard has no tile.',
                'Count the items of the entities in `tiles`: by their statuses, their dates, '
                'what needs the attention of the user.',
            )


def _check_screen(
    doc: Document, product: Product | None, screens: dict, contract: dict | None, issues: Issues
) -> None:
    data = doc.data
    primitive = data['primitive']
    missing = [it for it in REQUIRED_STATES[primitive] if it not in data['states']]
    if missing:
        issues.add(
            doc, ('states',), 'S009', f'A {primitive} must render the states {", ".join(missing)}.',
            f'Add {", ".join(missing)} to `states` and render them (`data-bz="state:<state>"`).',
        )
    _check_screen_refs(doc, screens, issues)
    if primitive == 'card' and 'tabs' in data['card']:
        _check_tabs(doc, issues)
    if product is None:
        return
    for i, role in enumerate(data.get('roles', [])):
        if role not in product.roles:
            issues.add(
                doc, ('roles', i), 'S005', f'The role `{role}` is not in spec/product.yaml.',
                'Use the id of a role of `roles`.',
            )
    if primitive == 'dashboard':
        _check_dashboard(doc, product, screens, contract, issues)
        return
    entity = _screen_entity(doc, ('entity',), data['entity'], product, issues)
    if entity is None:
        return
    _check_fields(doc, entity, _screen_fields(data), issues)
    section = data[primitive]
    if 'open' in section:
        _check_opens(doc, (primitive, 'open'), section['open'], 'card', entity, screens, issues)
    _check_point_filters(doc, (primitive,), section, entity, issues)
    checks = {'list': _check_list, 'card': _check_card, 'board': _check_board, 'calendar': _check_calendar}
    if primitive in checks:
        checks[primitive](doc, entity, issues)
    resource = contract['project']['resources'].get(entity.data['resource']) if contract else None
    if resource is not None:
        _check_queries(doc, (primitive,), section, entity, resource, issues)
        _check_search_contract(doc, entity, resource, contract, issues)
    _check_related_sections(doc, entity, product, screens, contract, issues)


def _screen_entity(doc: Document, path: tuple, entity_id: str, product: Product, issues: Issues) -> Entity | None:
    """
    The entity of a screen or of a part of a dashboard; None, reported (S004), when
    product.yaml does not declare it.
    """
    entity = product.entities.get(entity_id)
    if entity is None:
        issues.add(
            doc, path, 'S004', f'The entity `{entity_id}` is not in spec/product.yaml.',
            'Use the id of an entity of `entities`.',
        )
    return entity


def _check_fields(doc: Document, entity: Entity, items, issues: Issues) -> None:
    """
    The fields `(path, name)` that a screen references are fields of the entity (S007).
    """
    for path, name in items:
        if name not in entity.fields:
            issues.add(
                doc, path, 'S007', f'The entity `{entity.data["id"]}` has no field `{name}`.',
                'Declare the field in the entity, or use one of its fields.',
            )


def _check_opens(
    doc: Document, path: tuple, target_id: str, primitive: str, entity: Entity, screens: dict, issues: Issues
) -> None:
    """
    The screen that a part of a screen opens (`open`, a list or a card, checked to exist by
    `_check_screen_refs`) is of the entity of the part (S006).
    """
    target = screens.get(target_id)
    if target is not None and target['primitive'] == primitive and target['entity'] != entity.data['id']:
        issues.add(
            doc, path, 'S006',
            f'The {primitive} `{target_id}` is a {primitive} of `{target["entity"]}`, not of '
            f'`{entity.data["id"]}`.',
            f'Open a {primitive} of `{entity.data["id"]}`.',
        )


def _check_dashboard(doc: Document, product: Product, screens: dict, contract: dict | None, issues: Issues) -> None:
    """
    The parts of a dashboard, each of its own entity: the fields they reference (S007), the
    screens they open (S006), the field of a chart (S021); against the contract, their
    queries (S008, S014) and the pickers of the create forms (S012, S017).
    """
    resources = contract['project']['resources'] if contract else {}
    parts = [
        (('dashboard', key, i), key, part)
        for key in ('tiles', 'charts', 'recent', 'actions')
        for i, part in enumerate(doc.data['dashboard'].get(key, []))
    ]
    for path, key, part in parts:
        entity = _screen_entity(doc, (*path, 'entity'), part['entity'], product, issues)
        if entity is None:
            continue
        _check_fields(doc, entity, (it for keys in PART_REFERENCES for it in _references(part, path, keys)), issues)
        if 'open' in part:
            kind = 'list' if key == 'tiles' else 'card'
            _check_opens(doc, (*path, 'open'), part['open'], kind, entity, screens, issues)
        if key == 'charts':
            _check_chart(doc, path, part, entity, issues)
        resource = resources.get(entity.data['resource'])
        if resource is None:
            continue
        _check_queries(doc, path, part, entity, resource, issues)
        if key == 'actions':
            _check_pickers(doc, resource, form_fields(path, part, entity), contract, issues)


def _check_chart(doc: Document, path: tuple, chart: dict, entity: Entity, issues: Issues) -> None:
    """
    A chart is by the status of an entity with a workflow or by a date or a date-time field
    (S021, S007 for another field); a bucket and a period are those of the dates.
    """
    by = chart['by']
    dated = entity.fields.get(by, {}).get('type') in DATES
    hint = (
        'Chart by `status` (an entity with a workflow: a count for each status) or by a field '
        'with `type: date` or `type: datetime` (a count for each `bucket`).'
    )
    if by == STATUS_FIELD and entity.workflow is None:
        issues.add(doc, (*path, 'by'), 'S021', f'The entity `{entity.data["id"]}` has no workflow.', hint)
    elif by not in entity.fields:
        _check_fields(doc, entity, [((*path, 'by'), by)], issues)
    elif by != STATUS_FIELD and not dated:
        issues.add(doc, (*path, 'by'), 'S021', f'The field `{by}` is neither the status nor a date.', hint)
    for key in ('bucket', 'last'):
        if key in chart and not dated:
            issues.add(
                doc, (*path, key), 'S021', f'`{key}` is that of a chart by a date, not by `{by}`.',
                f'Remove `{key}`, or chart by a date.',
            )


def _check_card(doc: Document, entity: Entity, issues: Issues) -> None:
    """
    The transits and the history of a card need the workflow of its entity (S011).
    """
    if entity.workflow is not None:
        return
    for key in ('transitions', 'history'):
        if doc.data['card'].get(key):
            issues.add(
                doc, ('card', key), 'S011', f'The entity `{entity.data["id"]}` has no workflow.',
                'Declare the workflow of the entity, or remove it from the card.',
            )


def _check_list(doc: Document, entity: Entity, issues: Issues) -> None:
    """
    A list without the contract: its highlight has a label; its map is by a point field of
    the entity; its bulk actions run transitions of the workflow without a payload (S025),
    and none is declared twice.
    """
    lst = doc.data['list']
    highlight = lst.get('highlight')
    if highlight is not None and 'label' not in highlight:
        issues.add(
            doc, ('list', 'highlight'), 'S014',
            f'The highlight by `{highlight["field"]}` has no `label`: its rows would be told by '
            'their color alone (WCAG 1.4.1).',
            'Give it a `label` (a key of the dictionaries of the frontend, `tickets.overdue`, or a '
            'text), which the screen gives `ResourceList` as `rowToneLabel`.',
        )
    field = lst.get('map', {}).get('field')
    declared = entity.fields.get(field) if field else None
    if declared is not None and declared.get('type') != POINT:
        issues.add(
            doc, ('list', 'map', 'field'), 'S016',
            f'The map of the list is by `{field}`, which the entity `{entity.data["id"]}` does not '
            'declare as a point.',
            'Map a field with `type: point` (a PointField of the model).',
        )
    seen = set()
    for i, action in enumerate(lst.get('bulk', [])):
        if action['id'] in seen:
            issues.add(
                doc, ('list', 'bulk', i, 'id'), 'S010', f'The bulk action `{action["id"]}` is declared twice.',
                'Give every bulk action an id of its own.',
            )
        seen.add(action['id'])
        if 'transit' in action:
            _check_bulk_transit(doc, ('list', 'bulk', i, 'transit'), action['transit'], entity, issues)


def _check_bulk_transit(doc: Document, path: tuple, transit: str, entity: Entity, issues: Issues) -> None:
    """
    The transition of a bulk action: one of the workflow of the entity, without a payload
    (the items are transited in turn, with no dialog).
    """
    transition = entity.transitions.get(transit)
    if entity.workflow is None:
        problem = f'The entity `{entity.data["id"]}` has no workflow.'
    elif transition is None:
        problem = f'The workflow of `{entity.data["id"]}` has no transition `{transit}`.'
    elif 'payload' in transition:
        problem = f'The transition `{transit}` has a payload: a bulk action asks for none.'
    else:
        return
    issues.add(
        doc, path, 'S025', problem,
        'Run a transition of the workflow without a payload; one with a payload is run on the '
        'card of each item.',
    )


def _check_point_filters(doc: Document, path: tuple, section: dict, entity: Entity, issues: Issues) -> None:
    """
    No point field is a filter of the user (a point is filtered by its distance,
    `<field>__near`, which no control of the filters sends).
    """
    for i, name in enumerate(section.get('filters', [])):
        if entity.fields.get(name, {}).get('type') == POINT:
            issues.add(
                doc, (*path, 'filters', i), 'S016',
                f'The field `{name}` is a point: no filter of a list takes it.',
                'Remove it from `filters`; filter by the distance from a point in the screen '
                '(`nearFilter` of the component map, `<field>__near=<lon>,<lat>,<meters>`).',
            )


def _check_board(doc: Document, entity: Entity, issues: Issues) -> None:
    """
    A board: its entity has a workflow, its columns are statuses of it, its badge is a
    boolean field (S022).
    """
    board = doc.data['board']
    hint = 'A board shows the items of an entity with a workflow, a column for each status.'
    if entity.workflow is None:
        issues.add(doc, ('board', 'by'), 'S022', f'The entity `{entity.data["id"]}` has no workflow.', hint)
    else:
        for i, status in enumerate(board.get('columns', [])):
            if status not in entity.workflow['statuses']:
                issues.add(
                    doc, ('board', 'columns', i), 'S022',
                    f'The status `{status}` is not a status of the workflow of `{entity.data["id"]}`.', hint,
                )
    badge = board['card'].get('badge')
    if badge in entity.fields and entity.fields[badge].get('type') != 'boolean':
        issues.add(
            doc, ('board', 'card', 'badge'), 'S022', f'The badge `{badge}` is not a boolean field.',
            'Give the badge a boolean field (`is_overdue`): it is shown while the field is true.',
        )


def _check_calendar(doc: Document, entity: Entity, issues: Issues) -> None:
    """
    A calendar: its days are those of date or date-time fields, its tone by a boolean field
    (S023).
    """
    calendar = doc.data['calendar']
    for key in ('field', 'end'):
        name = calendar.get(key)
        if name in entity.fields and entity.fields[name].get('type') not in DATES:
            issues.add(
                doc, ('calendar', key), 'S023', f'The field `{name}` is not a date or a date-time.',
                'Show the items on the days of a field with `type: date` or `type: datetime`.',
            )
    tone = calendar.get('tone', {}).get('field')
    if tone in entity.fields and entity.fields[tone].get('type') != 'boolean':
        issues.add(
            doc, ('calendar', 'tone', 'field'), 'S023', f'The tone is by `{tone}`, not a boolean field.',
            'Give the tone a boolean field (`is_overdue`): its items are in the tone while it is true.',
        )


def _check_tabs(doc: Document, issues: Issues) -> None:
    """
    The tabs of a card (S024): each names sections and related sections of the card, or its
    history; each of them is in exactly one tab, and the tabs have no other.
    """
    card = doc.data['card']
    hint = 'Put each section, each related section and the history (`history: true`) in exactly one tab.'
    declared = {
        'sections': {it['id'] for it in card['sections']},
        'related': {it['id'] for it in card.get('related', [])},
    }
    placed: dict[tuple[str, str], int] = {}
    tab_ids = set()
    for i, tab in enumerate(card['tabs']):
        path = ('card', 'tabs', i)
        if tab['id'] in tab_ids:
            issues.add(doc, (*path, 'id'), 'S024', f'The tab `{tab["id"]}` is declared twice.', hint)
        tab_ids.add(tab['id'])
        if not (tab.get('sections') or tab.get('related') or tab.get('history')):
            issues.add(doc, path, 'S024', f'The tab `{tab["id"]}` is empty.', hint)
        if tab.get('history') and not card.get('history'):
            issues.add(doc, (*path, 'history'), 'S024', 'The card has no history (`history: true`).', hint)
        for key, ids in declared.items():
            for j, part in enumerate(tab.get(key, [])):
                if part not in ids:
                    problem = f'The card has no {"section" if key == "sections" else "related section"} `{part}`.'
                elif (key, part) in placed:
                    problem = f'`{part}` is also in the tab `{card["tabs"][placed[key, part]]["id"]}`.'
                else:
                    placed[key, part] = i
                    continue
                issues.add(doc, (*path, key, j), 'S024', problem, hint)
    missing = sorted(part for key, ids in declared.items() for part in ids if (key, part) not in placed)
    if missing:
        issues.add(doc, ('card', 'tabs'), 'S024', f'In no tab: {", ".join(missing)}.', hint)
    if card.get('history') and not any(it.get('history') for it in card['tabs']):
        issues.add(doc, ('card', 'tabs'), 'S024', 'The history of the card is in no tab.', hint)


def related_sections(data: dict) -> list[dict]:
    """
    The related sections of a screen (`card.related`): none on a list or a form.
    """
    return data['card'].get('related', []) if data['primitive'] == 'card' else []


def related_fields(section: dict, related: Entity) -> list[str]:
    """
    The fields of the form of "add here" of a related section: its `fields`, or every field
    of the related entity but the relationship, which is fixed.
    """
    add = section.get('add', {})
    return add['fields'] if 'fields' in add else [it for it in related.fields if it != section['relation']]


def _check_related_sections(
    doc: Document, entity: Entity, product: Product, screens: dict, contract: dict | None, issues: Issues
) -> None:
    """
    The related sections of a card (`card.related`), each checked by `_check_related`.
    """
    for i, section in enumerate(related_sections(doc.data)):
        _check_related(doc, ('card', 'related', i), section, entity, product, screens, contract, issues)


def _check_related(
    doc: Document, path: tuple, section: dict, entity: Entity, product: Product, screens: dict,
    contract: dict | None, issues: Issues,
) -> None:
    """
    A related section of a card: its entity and the fields of it that it uses, its
    relationship to the entity of the card (S015), the card that a row opens; against the
    contract, the relationship that the list is filtered by (S008) and the pickers of the
    form of "add here" (S012).
    """
    related = product.entities.get(section['entity'])
    if related is None:
        issues.add(
            doc, (*path, 'entity'), 'S004', f'The entity `{section["entity"]}` is not in spec/product.yaml.',
            'Use the id of an entity of `entities`.',
        )
        return
    names = [((*path, 'relation'), section['relation'])]
    names += [((*path, 'columns', i), name) for i, name in enumerate(section['columns'])]
    names += [((*path, 'add', 'fields', i), name) for i, name in enumerate(section.get('add', {}).get('fields', []))]
    for field_path, name in names:
        if name not in related.fields:
            issues.add(
                doc, field_path, 'S007', f'The entity `{related.data["id"]}` has no field `{name}`.',
                'Declare the field in the entity, or use one of its fields.',
            )
    relation = related.fields.get(section['relation'])
    if relation is not None and (relation.get('relation') != entity.data['id'] or relation.get('many', False)):
        issues.add(
            doc, (*path, 'relation'), 'S015',
            f'The field `{section["relation"]}` of `{related.data["id"]}` is not a to-one '
            f'relationship to `{entity.data["id"]}`, the entity of the card.',
            f'Name the relationship of `{related.data["id"]}` that references the item of the card '
            f'(`relation: {entity.data["id"]}`, not many).',
        )
    if 'open' in section:
        _check_opens(doc, (*path, 'open'), section['open'], 'card', related, screens, issues)
    resource = contract['project']['resources'].get(related.data['resource']) if contract else None
    if resource is None:
        return
    actual = resource['fields'].get(section['relation'])
    if actual is not None and 'filter' not in actual:
        issues.add(
            doc, (*path, 'relation'), 'S008',
            f'The field `{section["relation"]}` of `{related.data["resource"]}` cannot be filtered by: '
            'it has no `filter` in the contract, and the list of the related items is filtered by it.',
            'Make the field filtered by in the route set of the backend (a field of its LIST schema).',
        )
    if 'add' in section:
        listed = 'fields' in section['add']
        _check_pickers(doc, resource, [
            ((*path, 'add', 'fields', i) if listed else (*path, 'add'), name)
            for i, name in enumerate(related_fields(section, related))
        ], contract, issues)


#: where the section of each primitive names fields of its entity: the keys of a name, of a
#: list of names or of a filter (`*`: each item of a list)
FIELD_REFERENCES = {
    'list': (('columns',), ('filters',), ('sort',), ('filter',), ('highlight', 'field'), ('map', 'field')),
    'card': (('sections', '*', 'fields'),),
    'form': (('fields',),),
    'board': (('card', 'title'), ('card', 'fields'), ('card', 'badge'), ('filters',)),
    'calendar': (('field',), ('end',), ('label',), ('tone', 'field'), ('add', 'fields')),
}
#: where a part of a dashboard names fields of its entity (the field of a chart: `_check_chart`)
PART_REFERENCES = (('filter',), ('columns',), ('sort',), ('fields',))


def _references(value, path: tuple, keys: tuple):
    """
    The names at the keys of a section, with their paths: a name, each name of a list (a
    field of a sort without its `-`), each field of a filter.
    """
    if keys:
        key, rest = keys[0], keys[1:]
        if key == '*':
            for i, item in enumerate(value):
                yield from _references(item, (*path, i), rest)
        elif key in value:
            yield from _references(value[key], (*path, key), rest)
    elif isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for i, name in enumerate(value):
            yield (*path, i), name.removeprefix('-')
    else:
        for name in value:
            yield (*path, name), name


def _screen_fields(data: dict):
    """
    The fields that a screen (not a dashboard) references, with their paths.
    """
    primitive = data['primitive']
    for keys in FIELD_REFERENCES[primitive]:
        yield from _references(data[primitive], (primitive,), keys)
    for path, action in screen_actions(data):
        yield from _references(action, path, ('fields',))


def screen_actions(data: dict) -> list[tuple[tuple, dict]]:
    """
    The actions of a screen with their paths: `actions`, or those of a dashboard (the create
    forms of its entities).
    """
    if data['primitive'] == 'dashboard':
        return [(('dashboard', 'actions', i), it) for i, it in enumerate(data['dashboard'].get('actions', []))]
    return [(('actions', i), it) for i, it in enumerate(data.get('actions', []))]


def _check_screen_refs(doc: Document, screens: dict, issues: Issues) -> None:
    """
    The screens that a screen references, and its actions.
    """
    data = doc.data
    primitive = data['primitive']
    seen = set()
    for path, action in screen_actions(data):
        problem = None
        if action['id'] in seen:
            problem = f'The action `{action["id"]}` is declared twice.'
        elif action['primitive'] == 'destroy' and primitive != 'card':
            problem = 'An item is destroyed from its card: `destroy` is an action of a card.'
        elif action.get('mode') == 'update' and primitive != 'card':
            problem = 'An item is updated from its card: an update form is an action of a card.'
        seen.add(action['id'])
        if problem:
            issues.add(doc, path, 'S010', problem, 'Fix or remove the action.')
    for path, action_id in _added_actions(data):
        if action_id in seen:
            issues.add(
                doc, path, 'S010', f'The action `{action_id}` is declared twice.',
                'Give the action of "add" an id of its own.',
            )
        seen.add(action_id)
    for path, target, kind in _targets(data):
        if target not in screens:
            issues.add(
                doc, path, 'S006', f'The screen `{target}` does not exist.',
                f'Create spec/screens/{target}.yaml or use an existing screen.',
            )
        elif kind and screens[target] is not None and screens[target]['primitive'] != kind:
            issues.add(
                doc, path, 'S006', f'The screen `{target}` is not a {kind}.',
                f'Use a {kind} screen of the entity.',
            )


def _added_actions(data: dict) -> list[tuple[tuple, str]]:
    """
    The actions of "add" of a screen, with the paths of their ids: "add here" of the related
    sections of a card, the add of a calendar.
    """
    added = [
        (('card', 'related', i, 'add', 'id'), section['add']['id'])
        for i, section in enumerate(related_sections(data)) if 'add' in section
    ]
    if data['primitive'] == 'calendar' and 'add' in data['calendar']:
        added.append((('calendar', 'add', 'id'), data['calendar']['add']['id']))
    return added


def _targets(data: dict) -> list[tuple[tuple, str, str | None]]:
    """
    The screens that a screen references, with their paths and their primitive (None: any):
    the card that its items open, the list of a tile, the card of the rows of the last items
    or of a related section, the screen after a form or an action.
    """
    primitive = data['primitive']
    section = data[primitive]
    targets = [((primitive, 'open'), section['open'], 'card')] if 'open' in section else []
    if primitive == 'form' and 'then' in section:
        targets.append((('form', 'then'), section['then'], None))
    targets += [((*path, 'then'), action['then'], None) for path, action in screen_actions(data) if 'then' in action]
    parts = [('related', 'card')] if primitive == 'card' else []
    parts += [('tiles', 'list'), ('recent', 'card')] if primitive == 'dashboard' else []
    for key, kind in parts:
        for i, part in enumerate(section.get(key, [])):
            if 'open' in part:
                targets.append(((primitive, key, i, 'open'), part['open'], kind))
    return targets


#: the keys of the sections whose field lists the items by its values: the status of a board,
#: the days of a calendar, a chart by status or by date
LISTED_BY = ('by', 'field', 'end')


def _check_queries(doc: Document, path: tuple, section: dict, entity: Entity, resource: dict, issues: Issues) -> None:
    """
    The queries of the items of a list, a board, a calendar or a part of a dashboard (its
    `section` at `path`) against the resource of the contract: the fields of its filters, of
    its filter and of the columns, days or bars it lists the items by, filtered by, and of
    its sort, sorted by (S008); the values of its filter, and the highlight of a list (S014).
    """
    checks = [((*path, 'filters', i), name, 'filter') for i, name in enumerate(section.get('filters', []))]
    checks += [((*path, 'filter', name), name, 'filter') for name in section.get('filter', {})]
    checks += [((*path, key), section[key], 'filter') for key in LISTED_BY if key in section]
    checks += [((*path, 'sort', i), name.removeprefix('-'), 'order') for i, name in enumerate(section.get('sort', []))]
    for field_path, name, label in checks:
        actual = resource['fields'].get(name)
        if actual is not None and label not in actual:
            verb = 'filtered' if label == 'filter' else 'sorted'
            issues.add(
                doc, field_path, 'S008',
                f'The field `{name}` of `{entity.data["resource"]}` cannot be {verb} by: it has no '
                f'`{label}` in the contract.',
                f'Remove it, or make the field {verb} by in the route set of the backend.',
            )
    for name, value in section.get('filter', {}).items():
        actual = resource['fields'].get(name)
        if actual is not None and not filter_value_fits(value, actual):
            issues.add(
                doc, (*path, 'filter', name), 'S014',
                f'The value {value!r} does not fit the field `{name}` of '
                f'`{entity.data["resource"]}` ({_describe(actual)} in the contract).',
                'Give the filter a value of the type of the field: a boolean, a number, a '
                'text, the id of a related item.',
            )
    highlight = section.get('highlight')
    actual = resource['fields'].get(highlight['field']) if highlight else None
    if actual is not None and actual.get('type') != 'boolean':
        issues.add(
            doc, (*path, 'highlight', 'field'), 'S014',
            f'The field `{highlight["field"]}` of `{entity.data["resource"]}` is not a boolean '
            f'({_describe(actual)} in the contract): a row is highlighted when its field is true.',
            'Highlight by a boolean field of the resource (a calculated field of the route set '
            'of the backend, such as `is_overdue`).',
        )


def filter_value_fits(value, field: dict) -> bool:
    """
    Whether a value of the filter of a list fits a field of the contract: a boolean for a
    boolean, a number for a number, a text for a text, the id of a related item (a text or a
    number) for a relationship; any value for the other types (an object, an array).
    """
    if 'relation' in field:
        return isinstance(value, str | int) and not isinstance(value, bool)
    expected = {
        'boolean': (bool,), 'integer': (int,), 'number': (int, float), 'string': (str,),
    }.get(field.get('type'))
    if expected is None:
        return True
    return isinstance(value, expected) and (bool in expected or not isinstance(value, bool))


def _picker_fields(data: dict, entity: Entity):
    """
    The fields that a screen edits or filters with the picker of a related item, with their
    paths: the filters of a list or a board, the fields of a form (of the form primitive, of
    a form action, of the form of "add" of a calendar; every field of the entity when it
    lists none) and of the sections of a card with `edit`. Which of them are relationships is
    for the contract to say.
    """
    primitive = data['primitive']
    for i, name in enumerate(data[primitive].get('filters', [])):
        yield (primitive, 'filters', i), name
    if primitive == 'card' and data['card'].get('edit'):
        for i, section in enumerate(data['card']['sections']):
            for j, name in enumerate(section['fields']):
                yield ('card', 'sections', i, 'fields', j), name
    forms = [(('form',), data['form'])] if primitive == 'form' else []
    if primitive == 'calendar' and 'add' in data['calendar']:
        forms.append((('calendar', 'add'), data['calendar']['add']))
    forms += [(path, action) for path, action in screen_actions(data) if action['primitive'] == 'form']
    for path, form in forms:
        yield from form_fields(path, form, entity)


def form_fields(path: tuple, form: dict, entity: Entity):
    """
    The fields of a form with their paths: its `fields`, or every field of the entity (at
    the path of the form) when it lists none.
    """
    if 'fields' in form:
        for i, name in enumerate(form['fields']):
            yield (*path, 'fields', i), name
    else:
        for name in entity.fields:
            yield path, name


def _check_search_contract(doc: Document, entity: Entity, resource: dict, contract: dict, issues: Issues) -> None:
    """
    The search of a screen against the search fields of the contract (bazis 2.9: a route
    set without search fields answers a `search` with 400): the search of a list (S013),
    and the pickers of the related items (S012), which list the items of a resource without
    search fields without a search. In a form, a file is edited by the file field: no
    picker.
    """
    data = doc.data
    if data['primitive'] == 'list' and data['list'].get('search') and not resource['search']:
        issues.add(
            doc, ('list', 'search'), 'S013',
            f'`{entity.data["resource"]}` has no search fields in the contract: its route set '
            'answers a search with 400 `ERR_FILTER`.',
            'List the fields to search in `search_fields` of the route set of the resource '
            f'(fields of its LIST schema), and {EXPORT_HINT}; or remove `search`.',
        )
    _check_pickers(doc, resource, _picker_fields(data, entity), contract, issues)


def _check_pickers(doc: Document, resource: dict, items, contract: dict, issues: Issues) -> None:
    """
    The pickers of the related items of the fields `(path, name)` of a resource of the
    contract, in a filter of a list or a board (a path with `filters`) or in a form (where a file is edited by
    the file field; a to-many relationship has the picker of its items; a form without
    `fields` leaves out the reverse relationships): S012 when the related resource has no
    search fields, S017 when they do not cover the fields of the label of its items.
    """
    resources = contract['project']['resources']
    for path, name in items:
        schema = resource['fields'].get(name, {})
        relation = schema.get('relation')
        target = resources.get(relation) if isinstance(relation, str) else None
        in_form = 'filters' not in path
        if target is None or (in_form and is_file(schema, contract)):
            continue
        if in_form and schema.get('reverse') and 'fields' not in path:
            continue
        if not target['search']:
            issues.add(
                doc, path, 'S012',
                f'The picker of `{name}` lists `{relation}` without a search: the resource has '
                'no search fields in the contract.',
                f'List the fields to search in `search_fields` of the route set of `{relation}` '
                f'(fields of its LIST schema), and {EXPORT_HINT}.',
            )
        elif missing := [it for it in label_fields(target) if it not in target['search']]:
            fields = ', '.join(f'`{it}`' for it in missing)
            issues.add(
                doc, path, 'S017',
                f'The picker of `{name}` shows the items of `{relation}` by {fields}, which its '
                'search does not search: a search by the label shown finds nothing.',
                f'Add {fields} to `search_fields` of the route set of `{relation}`, and '
                f'{EXPORT_HINT}.',
            )


def label_fields(resource: dict) -> list[str]:
    """
    The attributes of the contract that give the label of the items of a resource in the
    pickers (its `label`), those that its LIST schema can filter by (`filter`): a calculated
    field without it is never a search field.
    """
    return [it for it in resource['label'] if 'filter' in resource['fields'][it]]
