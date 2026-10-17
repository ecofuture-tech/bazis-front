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
from .issues import DECLARE_ROLES, DECLARE_WORKFLOWS, EXPORT_HINT, Document, Issues


#: the field of an entity with a workflow: its status (bazis-statusy)
STATUS_FIELD = 'status'

#: the states that a screen of a primitive must render (its `data-bz="state:<state>"`)
REQUIRED_STATES = {
    'list': ('loading', 'empty', 'error', 'forbidden'),
    'card': ('loading', 'error', 'forbidden', 'not_found'),
    'form': ('loading', 'error', 'forbidden', 'invalid'),
}

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
    if actual['title'] == item['id']:
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
    return screens


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
    if product is None:
        return
    for i, role in enumerate(data.get('roles', [])):
        if role not in product.roles:
            issues.add(
                doc, ('roles', i), 'S005', f'The role `{role}` is not in spec/product.yaml.',
                'Use the id of a role of `roles`.',
            )
    entity = product.entities.get(data['entity'])
    if entity is None:
        issues.add(
            doc, ('entity',), 'S004', f'The entity `{data["entity"]}` is not in spec/product.yaml.',
            'Use the id of an entity of `entities`.',
        )
        return
    for path, name in _screen_fields(data):
        if name not in entity.fields:
            issues.add(
                doc, path, 'S007', f'The entity `{entity.data["id"]}` has no field `{name}`.',
                'Declare the field in the entity, or use one of its fields.',
            )
    target = screens.get(data['list'].get('open')) if primitive == 'list' else None
    if target is not None and target['primitive'] == 'card' and target['entity'] != data['entity']:
        issues.add(
            doc, ('list', 'open'), 'S006',
            f'The card `{data["list"]["open"]}` is a card of `{target["entity"]}`, not of '
            f'`{data["entity"]}`.',
            'Open a card of the entity of the list.',
        )
    if primitive == 'card' and entity.workflow is None:
        for key in ('transitions', 'history'):
            if data['card'].get(key):
                issues.add(
                    doc, ('card', key), 'S011', f'The entity `{entity.data["id"]}` has no workflow.',
                    'Declare the workflow of the entity, or remove it from the card.',
                )
    if primitive == 'list':
        _check_list(doc, entity, issues)
    if contract is not None and primitive == 'list':
        _check_list_contract(doc, entity, contract, issues)
    if contract is not None:
        _check_search_contract(doc, entity, contract, issues)
    _check_related_sections(doc, entity, product, screens, contract, issues)


def _check_list(doc: Document, entity: Entity, issues: Issues) -> None:
    """
    A list without the contract: its highlight has a label; its map is by a point field of
    the entity, and no point field is a filter of the user (a point is filtered by its
    distance, `<field>__near`, which no control of the filters sends).
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
    places = [(('list', 'filters', i), name) for i, name in enumerate(lst.get('filters', []))]
    for path, name in places:
        if entity.fields.get(name, {}).get('type') == POINT:
            issues.add(
                doc, path, 'S016',
                f'The field `{name}` is a point: no filter of a list takes it.',
                'Remove it from `filters`; filter by the distance from a point in the screen '
                '(`nearFilter` of the component map, `<field>__near=<lon>,<lat>,<meters>`).',
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
    target = screens.get(section.get('open'))
    if target is not None and target['primitive'] == 'card' and target['entity'] != related.data['id']:
        issues.add(
            doc, (*path, 'open'), 'S006',
            f'The card `{section["open"]}` is a card of `{target["entity"]}`, not of `{related.data["id"]}`.',
            'Open a card of the related entity.',
        )
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


def _screen_fields(data: dict):
    """
    The fields that a screen references, with their paths.
    """
    if data['primitive'] == 'list':
        for key in ('columns', 'filters'):
            for i, name in enumerate(data['list'].get(key, [])):
                yield ('list', key, i), name
        for i, name in enumerate(data['list'].get('sort', [])):
            yield ('list', 'sort', i), name.removeprefix('-')
        for name in data['list'].get('filter', {}):
            yield ('list', 'filter', name), name
        if 'highlight' in data['list']:
            yield ('list', 'highlight', 'field'), data['list']['highlight']['field']
        if 'map' in data['list']:
            yield ('list', 'map', 'field'), data['list']['map']['field']
    elif data['primitive'] == 'card':
        for i, section in enumerate(data['card']['sections']):
            for j, name in enumerate(section['fields']):
                yield ('card', 'sections', i, 'fields', j), name
    else:
        for i, name in enumerate(data['form'].get('fields', [])):
            yield ('form', 'fields', i), name
    for i, action in enumerate(data.get('actions', [])):
        for j, name in enumerate(action.get('fields', [])):
            yield ('actions', i, 'fields', j), name


def _check_screen_refs(doc: Document, screens: dict, issues: Issues) -> None:
    """
    The screens that a screen references, and its actions.
    """
    data = doc.data
    targets = []
    if data['primitive'] == 'list' and 'open' in data['list']:
        targets.append((('list', 'open'), data['list']['open'], 'card'))
    if data['primitive'] == 'form' and 'then' in data['form']:
        targets.append((('form', 'then'), data['form']['then'], None))
    seen = set()
    for i, action in enumerate(data.get('actions', [])):
        if 'then' in action:
            targets.append((('actions', i, 'then'), action['then'], None))
        problem = None
        if action['id'] in seen:
            problem = f'The action `{action["id"]}` is declared twice.'
        elif action['primitive'] == 'destroy' and data['primitive'] != 'card':
            problem = 'An item is destroyed from its card: `destroy` is an action of a card.'
        elif action.get('mode') == 'update' and data['primitive'] != 'card':
            problem = 'An item is updated from its card: an update form is an action of a card.'
        seen.add(action['id'])
        if problem:
            issues.add(doc, ('actions', i), 'S010', problem, 'Fix or remove the action.')
    targets += _related_refs(doc, seen, issues)
    for path, target, primitive in targets:
        if target not in screens:
            issues.add(
                doc, path, 'S006', f'The screen `{target}` does not exist.',
                f'Create spec/screens/{target}.yaml or use an existing screen.',
            )
        elif primitive and screens[target] is not None and screens[target]['primitive'] != primitive:
            issues.add(
                doc, path, 'S006', f'The screen `{target}` is not a {primitive}.',
                f'Use a {primitive} screen of the entity.',
            )


def _related_refs(doc: Document, actions: set[str], issues: Issues) -> list[tuple]:
    """
    The related sections of a card: the action of "add here" of each, among the actions of
    the screen (`actions`, their ids); returns the cards that their rows open.
    """
    targets = []
    for i, section in enumerate(related_sections(doc.data)):
        if 'open' in section:
            targets.append((('card', 'related', i, 'open'), section['open'], 'card'))
        if 'add' not in section:
            continue
        if section['add']['id'] in actions:
            issues.add(
                doc, ('card', 'related', i, 'add', 'id'), 'S010',
                f'The action `{section["add"]["id"]}` is declared twice.',
                'Give the action of the related section an id of its own.',
            )
        actions.add(section['add']['id'])
    return targets


def _check_list_contract(doc: Document, entity: Entity, contract: dict, issues: Issues) -> None:
    resource = contract['project']['resources'].get(entity.data['resource'])
    if resource is None:
        return
    lst = doc.data['list']
    checks = [(('list', 'filters', i), name, 'filter') for i, name in enumerate(lst.get('filters', []))]
    checks += [(('list', 'filter', name), name, 'filter') for name in lst.get('filter', {})]
    checks += [(('list', 'sort', i), name.removeprefix('-'), 'order') for i, name in enumerate(lst.get('sort', []))]
    for path, name, label in checks:
        actual = resource['fields'].get(name)
        if actual is not None and label not in actual:
            verb = 'filtered' if label == 'filter' else 'sorted'
            issues.add(
                doc, path, 'S008',
                f'The field `{name}` of `{entity.data["resource"]}` cannot be {verb} by: it has no '
                f'`{label}` in the contract.',
                f'Remove it, or make the field {verb} by in the route set of the backend.',
            )
    for name, value in lst.get('filter', {}).items():
        actual = resource['fields'].get(name)
        if actual is not None and not filter_value_fits(value, actual):
            issues.add(
                doc, ('list', 'filter', name), 'S014',
                f'The value {value!r} does not fit the field `{name}` of '
                f'`{entity.data["resource"]}` ({_describe(actual)} in the contract).',
                'Give the filter a value of the type of the field: a boolean, a number, a '
                'text, the id of a related item.',
            )
    highlight = lst.get('highlight')
    actual = resource['fields'].get(highlight['field']) if highlight else None
    if actual is not None and actual.get('type') != 'boolean':
        issues.add(
            doc, ('list', 'highlight', 'field'), 'S014',
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
    paths: the filters of a list, the fields of a form (of the form primitive, of a form
    action; every field of the entity when it lists none) and of the sections of a card
    with `edit`. Which of them are relationships is for the contract to say.
    """
    if data['primitive'] == 'list':
        for i, name in enumerate(data['list'].get('filters', [])):
            yield ('list', 'filters', i), name
    elif data['primitive'] == 'card' and data['card'].get('edit'):
        for i, section in enumerate(data['card']['sections']):
            for j, name in enumerate(section['fields']):
                yield ('card', 'sections', i, 'fields', j), name
    forms = [(('form',), data['form'])] if data['primitive'] == 'form' else []
    forms += [
        (('actions', i), action)
        for i, action in enumerate(data.get('actions', []))
        if action['primitive'] == 'form'
    ]
    for path, form in forms:
        if 'fields' in form:
            for i, name in enumerate(form['fields']):
                yield (*path, 'fields', i), name
        else:
            for name in entity.fields:
                yield path, name


def _check_search_contract(doc: Document, entity: Entity, contract: dict, issues: Issues) -> None:
    """
    The search of a screen against the search fields of the contract (bazis 2.9: a route
    set without search fields answers a `search` with 400): the search of a list (S013),
    and the pickers of the related items (S012), which list the items of a resource without
    search fields without a search. In a form, a file is edited by the file field: no
    picker.
    """
    resource = contract['project']['resources'].get(entity.data['resource'])
    if resource is None:
        return
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
    contract, in a filter of a list (a path in `list`) or in a form (where a file is edited by
    the file field; a to-many relationship has the picker of its items; a form without
    `fields` leaves out the reverse relationships): S012 when the related resource has no
    search fields, S017 when they do not cover the fields of the label of its items.
    """
    resources = contract['project']['resources']
    for path, name in items:
        schema = resource['fields'].get(name, {})
        relation = schema.get('relation')
        target = resources.get(relation) if isinstance(relation, str) else None
        in_form = path[0] != 'list'
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
