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
The resources of the contract: the route sets of the OpenAPI grouped by the JSON:API type
of their model. Everything is read from the OpenAPI (the `x-bazis` of the operations and
the schemas of their responses), so that the contract describes exactly the API that the
OpenAPI describes; what `filter`, `sort` and `search` reach is read from the route set
(`QueryScope` of the core, the LIST schema of the route set, and `route_search_fields`), which
the OpenAPI does not tell (the schema of an item may have fields that the LIST schema does
not, every list has the parameter `search`).
"""

import os
import pydoc

from django.apps import apps

from bazis.core.introspect import models_info
from bazis.core.routes_abstract.jsonapi import JsonapiRouteBase
from bazis.core.utils.query_complex import QueryScope, route_search_fields


#: the kinds of the operations whose response describes the fields of the resource, in the
#: order of preference
FIELDS_KINDS = ('item', 'collection')


def resources(openapi: dict) -> dict:
    """
    `{type: {model, route_set, path, actions, fields, search[, other_routes]}}`. A resource
    is described by the route set the core uses as the default route of its model (the last
    one declared); other route sets of the same model are listed in `other_routes`.
    """
    route_sets = _route_sets(openapi)
    models = {it['resource']: it['model'] for it in models_info()}

    by_resource: dict[str, list[dict]] = {}
    for route_set in route_sets:
        by_resource.setdefault(route_set['resource'], []).append(route_set)

    result = {}
    for resource, items in sorted(by_resource.items()):
        default_cls = _default_route(models.get(resource))
        default = _qualified_name(default_cls) if default_cls else None
        items.sort(key=lambda it: (it['route_set'] != default, it['path'], it['route_set']))
        main, others = items[0], items[1:]
        main_cls = default_cls if main['route_set'] == default else pydoc.locate(main['route_set'])
        scope = _scope(main_cls)
        entry = {
            'model': models.get(resource),
            'route_set': main['route_set'],
            'path': main['path'],
            'actions': main['actions'],
            'fields': _fields(openapi, main['operations'], scope),
            # the search fields that its LIST schema reaches, as declared: those the core
            # searches (`bazis.W007` reports the others); none, a `search` is 400
            'search': route_search_fields(main_cls) if scope is not None else [],
        }
        if others:
            entry['other_routes'] = [
                {'path': it['path'], 'route_set': it['route_set']} for it in others
            ]
        result[resource] = entry
    return result


def _route_sets(openapi: dict) -> list[dict]:
    """
    The route sets with a model: their operations, actions and collection path.
    """
    operations: dict[str, list[tuple[str, dict]]] = {}
    for path, item in openapi.get('paths', {}).items():
        for operation in item.values():
            meta = isinstance(operation, dict) and operation.get('x-bazis')
            if meta and meta.get('resource'):
                operations.setdefault(meta['route_set'], []).append((path, operation))

    return [
        {
            'resource': items[0][1]['x-bazis']['resource'],
            'route_set': route_set,
            'path': _collection_path(items),
            'actions': {op['x-bazis']['action']: op['x-bazis']['kind'] for _, op in items},
            'operations': [op for _, op in sorted(items, key=_key)],
        }
        for route_set, items in sorted(operations.items())
    ]


def _key(item: tuple[str, dict]) -> tuple:
    path, operation = item
    return path, operation['x-bazis']['action']


def _collection_path(items: list[tuple[str, dict]]) -> str:
    """
    The path of the collection: the path of the list or the create route, else the part
    of an item route before `{item_id}`, else the common part of the paths.
    """
    paths = sorted(path for path, op in items if op['x-bazis']['kind'] in ('collection', 'create'))
    paths = paths or sorted(path.split('{item_id}', 1)[0] for path, _ in items if '{item_id}' in path)
    if paths:
        return paths[0]
    common = os.path.commonprefix([path for path, _ in items])
    return common[: common.rfind('/') + 1]


def _default_route(model_label: str | None) -> type | None:
    """
    The route set of the default route of a JSON:API model.
    """
    return apps.get_model(model_label).get_default_route() if model_label else None


def _qualified_name(route_cls: type) -> str:
    """The name of a route set as `x-bazis` gives it."""
    return f'{route_cls.__module__}.{route_cls.__qualname__}'


def _scope(route_cls) -> QueryScope | None:
    """
    What `filter` and `sort` of the route set reach (bazis 2.9): the fields of its LIST
    schema that can filter and order, those of the route set itself (`query_fields` of the
    core, not the fields a package gives per user). None for a route set that is not a
    JSON:API route set of the project (it has no search either).
    """
    if not (isinstance(route_cls, type) and issubclass(route_cls, JsonapiRouteBase)):
        return None
    return QueryScope.for_route(route_cls, schema=True)


def _fields(openapi: dict, operations: list[dict], scope: QueryScope | None) -> dict:
    """
    The attributes and relationships of the resource in the response of the item route
    (else of the list route): `{name: {type[, format] | relation, many[, filter][, order]}}`.
    `filter` and `order` are the labels of the field in `filter` and `sort` (the
    `filterLabel` and `orderLabel` of the schema), absent when the scope of the route set
    does not take them (a field the LIST schema does not have, or cannot filter or order
    by: 400 `ERR_FILTER`; any field without a scope).
    """
    resource = None
    for kind in FIELDS_KINDS:
        operation = next((op for op in operations if op['x-bazis']['kind'] == kind), None)
        if operation is not None and (resource := _response_resource(openapi, operation)):
            break
    if not resource:
        return {}

    props = resource.get('properties', {})
    fields = {}
    for name, prop in _resolve(openapi, props.get('attributes', {})).get('properties', {}).items():
        schema = _not_null(openapi, prop)
        fields[name] = {'type': schema.get('type', 'object')}
        if 'format' in schema:
            fields[name]['format'] = schema['format']
        fields[name].update(_labels(prop, scope))
    for name, prop in _resolve(openapi, props.get('relationships', {})).get('properties', {}).items():
        data = _not_null(openapi, _not_null(openapi, prop).get('properties', {}).get('data', {}))
        many = data.get('type') == 'array'
        identifiers = _alternatives(openapi, data['items'] if many else data)
        types = sorted({it.get('properties', {}).get('type', {}).get('default') for it in identifiers} - {None})
        fields[name] = {'relation': types[0] if len(types) == 1 else types, 'many': many}
        fields[name].update(_labels(prop, scope))
    return fields


def _response_resource(openapi: dict, operation: dict) -> dict | None:
    """
    The schema of the resource in the successful JSON:API response of an operation.
    """
    for status in sorted(operation.get('responses', {})):
        if not status.startswith('2'):
            continue
        for content in operation['responses'][status].get('content', {}).values():
            document = _resolve(openapi, content.get('schema', {}))
            data = _not_null(openapi, document.get('properties', {}).get('data', {}))
            if data.get('type') == 'array':
                data = _not_null(openapi, data.get('items', {}))
            if 'attributes' in data.get('properties', {}):
                return data
    return None


def _labels(prop: dict, scope: QueryScope | None) -> dict:
    """
    The labels of a field of the item schema (its source) that the scope of the route set
    takes: in its fields that can filter, in those that can order.
    """
    if scope is None:
        return {}
    labels = {}
    if prop.get('filterLabel') in scope.fields:
        labels['filter'] = prop['filterLabel']
    if prop.get('orderLabel') in scope.order_fields:
        labels['order'] = prop['orderLabel']
    return labels


def _resolve(openapi: dict, schema: dict) -> dict:
    """
    The schema with its `$ref` (`#/components/schemas/<name>`) followed.
    """
    while '$ref' in schema:
        schema = openapi['components']['schemas'][schema['$ref'].rsplit('/', 1)[-1]]
    return schema


def _alternatives(openapi: dict, schema: dict) -> list[dict]:
    """
    The alternatives of `anyOf`/`oneOf` other than `null`, resolved.
    """
    schema = _resolve(openapi, schema)
    items = schema.get('anyOf') or schema.get('oneOf') or [schema]
    return [_resolve(openapi, it) for it in items if it.get('type') != 'null']


def _not_null(openapi: dict, schema: dict) -> dict:
    """
    The first alternative of the schema other than `null` (a decimal is a number or a
    string: the number comes first), resolved.
    """
    alternatives = _alternatives(openapi, schema)
    return alternatives[0] if alternatives else {}
