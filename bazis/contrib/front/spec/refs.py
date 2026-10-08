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
from .issues import EXPORT_HINT, Document, Issues


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
    if spec_type == 'json':
        return kind in ('object', 'array')
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
    The references inside product.yaml: relations, the workflow and the access.
    """
    path = entity.path
    for i, item in enumerate(entity.data['fields']):
        if 'relation' in item and item['relation'] not in product.entities:
            issues.add(
                doc, (*path, 'fields', i, 'relation'), 'P005',
                f'The field `{item["id"]}` references the unknown entity `{item["relation"]}`.',
                'Declare the entity in `entities`, with its resource.',
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
    if isinstance(grant, str):
        return
    for i, status in enumerate(grant['statuses']):
        if workflow is None:
            issues.add(doc, (*path, 'statuses'), 'P006', 'The entity has no workflow: it has no statuses.', hint)
            return
        if status not in workflow['statuses']:
            _unknown_status(doc, (*path, 'statuses', i), status, issues)


def _check_packages(doc: Document, data: dict, contract: dict, issues: Issues) -> None:
    for i, package in enumerate(data.get('packages', [])):
        if package not in contract['capabilities']:
            issues.add(
                doc, ('packages', i), 'P010',
                f'The contract has no section `{package}`: bazis-{package} is not installed.',
                f'Install bazis-{package} with its app in BS_INSTALLED_APPS, and {EXPORT_HINT}.',
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
    slugs = {it['slug'] for it in permit['roles']}
    for i, role in enumerate(doc.data['roles']):
        if role['permit'] not in slugs:
            issues.add(
                doc, ('roles', i, 'permit'), 'P018',
                f'The permit role `{role["permit"]}` of the role `{role["id"]}` is not in the contract.',
                f'Create the Role `{role["permit"]}` of bazis-permit (in a data migration), and {EXPORT_HINT}.',
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
    issues.add(
        doc, path, 'P013',
        f'The field `{item["id"]}` of `{name}` is {_describe(actual)} in the contract, '
        + (f'the spec declares {_describe(expected)}.' if expected else f'the spec declares the type `{item["type"]}`.'),
        'Make the spec follow the contract, or change the model.'
        + (' A relationship to the uploaded files of bazis-uploadable is `type: file`.' if is_file(actual, contract) else ''),
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
    hint = f'Create the Status and Transit rows of `{data["resource"]}` (in a data migration), and {EXPORT_HINT}.'
    if workflow['initial'] != model['initial']:
        issues.add(
            doc, (*path, 'workflow', 'initial'), 'P015',
            f'The initial status is `{model["initial"]}` in the contract, not `{workflow["initial"]}`.',
            'Use the initial status of the backend (BAZIS_STATUS_INITIAL).',
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
    if contract is not None and primitive == 'list':
        _check_list_contract(doc, entity, contract, issues)


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


def _check_list_contract(doc: Document, entity: Entity, contract: dict, issues: Issues) -> None:
    resource = contract['project']['resources'].get(entity.data['resource'])
    if resource is None:
        return
    lst = doc.data['list']
    checks = [(('list', 'filters', i), name, 'filter') for i, name in enumerate(lst.get('filters', []))]
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
