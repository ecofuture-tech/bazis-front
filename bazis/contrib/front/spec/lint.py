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
The shape of a file of the specs: its YAML (or JSON) read, then checked against its JSON
Schema, with the hints of the mistakes that the agents make (a text with `: ` without quotes,
a piece of a text after the comma of a flow mapping, a key of another mapping). It is the
first step of `validate` and imports neither Django nor the core, so that a file is linted
as it is written, without the settings of the product:

    python -m bazis.contrib.front.spec.lint spec/screens/home.yaml [--json]

reports the codes of a file that cannot be read and of its shape (S001/S002, P001/P002,
D001/D002/D003) as `bazis_front check` does, and exits 1 when the file has an error.
"""

import argparse
import json
import re
import sys
from functools import cache
from importlib.resources import files
from importlib.resources.abc import Traversable
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match

from .issues import ERROR, WARNING, Document, Issues


SPEC_DIR = 'spec'

#: the files of the specs, by their path in the product root (the screens are
#: `spec/screens/<id>.yaml`)
PRODUCT_FILE = f'{SPEC_DIR}/product.yaml'
THEME_FILE = f'{SPEC_DIR}/design/theme.yaml'
TOKENS_FILE = f'{SPEC_DIR}/design/tokens.json'

#: the copies of the JSON Schemas in the specs of a product, for the editors
SCHEMA_DIR = 'schema'

#: the JSON Schema of each kind of file
PRODUCT_SCHEMA = 'product.schema.json'
SCREEN_SCHEMA = 'screen.schema.json'
DESIGN_SCHEMA = 'design.schema.json'
TOKENS_SCHEMA = 'tokens.schema.json'
SCHEMAS = (PRODUCT_SCHEMA, SCREEN_SCHEMA, DESIGN_SCHEMA, TOKENS_SCHEMA)

#: the layer, the schema and the codes (of a file that cannot be read, of a shape error) of
#: each kind of file
PRODUCT = ('product', PRODUCT_SCHEMA, ('P001', 'P002'))
SCREEN = ('screens', SCREEN_SCHEMA, ('S001', 'S002'))
THEME = ('design', DESIGN_SCHEMA, ('D001', 'D002'))
TOKENS = ('design', TOKENS_SCHEMA, ('D001', 'D003'))


def schema_files() -> dict[str, Traversable]:
    """
    The JSON Schemas of the specs shipped with the package, by file name.
    """
    directory = files(__package__) / 'schemas'
    return {name: directory / name for name in SCHEMAS}


@cache
def validator(name: str) -> Draft202012Validator:
    schema = json.loads(schema_files()[name].read_text(encoding='utf-8'))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


#: the hint by the `problem` of PyYAML: a text with `: ` in a block or in a flow mapping is read as a mapping
_QUOTE = (
    "Quote the text: a text with `: ` or a special first character (`'`, `#`, `[`, `{`) goes in quotes, "
    "`title: 'Workshop \"Spitsa\": sign up'`."
)
_SYNTAX = 'Fix its syntax; a text with `: ` or special characters goes in quotes.'
YAML_HINTS = {
    'mapping values are not allowed here': _QUOTE,
    "expected ',' or '}', but got ':'": _QUOTE,
}


def piece_of_text(error, data) -> str | None:
    """
    The key that a mapping of the data (at the path of a shape error) cannot have and that is a
    piece of a text, not an id (it has a space or a letter beyond ASCII): the text after the
    comma of a flow mapping, `{entrance_info: 1 floor, 3 rooms}`, which YAML reads as a key of
    its own. The error is that of an extra key, or of a key that is not an id (`error.instance`).
    """
    node = data
    for step in error.absolute_path:
        node = node[step]
    if not isinstance(node, dict):
        return None
    if error.validator == 'additionalProperties':
        keys = [it for it in node if it not in error.schema.get('properties', {})]
    else:
        keys = [error.instance] if isinstance(error.instance, str) and error.instance in node else []
    return next((it for it in keys if isinstance(it, str) and (' ' in it or not it.isascii())), None)


#: the parameters of the helpers of the end-to-end tests that the generator gives them, which a
#: step of a scenario does not take: what each is
_HELPER_PARAMETERS = {
    'created': (
        '`created` is a parameter of the helpers `openItem`, `select` and `move`, not a key of the step: the '
        'generator sets it when the scenario created an item with the texts of `where` before, so that its test '
        'finds the item it made. Remove it.'
    ),
    'saved': (
        '`saved` is a parameter of the helper `submit`, not a key of the step: every submit must save, but one '
        'that the next step expects to be refused (an `error`, or a `state` of a failure). Remove it.'
    ),
}

#: the hint of `filters` of a form that takes none: the filter of the field of the entity
#: narrows its picker in every form
_ENTITY_FILTER = (
    'This form has no `filters`. Declare `filter` on the field `{field}` of the entity in `spec/product.yaml` '
    '(`{{id: {field}, relation: <entity>, filter: {{<field of the related resource>: <value>}}}}`): it narrows '
    'its picker in every form of the entity, this one too.'
)

#: the hints of the shape errors by the schema and the path of the value that it refuses (`*`:
#: any item or key; a key that the mapping may not have ends the path): what the value is
#: instead of the schema to follow; `{field}` is the key of the path after `filters`
SHAPE_HINTS = {
    (PRODUCT_SCHEMA, ('roles', '*', 'title')): (
        'The `title` of a role is one text that names it for the readers of the specs (the frontend never '
        'shows it): `title: Dispatcher`, not a map of the languages.'
    ),
    # a parameter in the body of a step, `submit: {saved: true}`, or next to it, `- submit: {}` and `saved: true`
    (PRODUCT_SCHEMA, ('scenarios', '*', 'steps', '*', '*', 'created')): _HELPER_PARAMETERS['created'],
    (PRODUCT_SCHEMA, ('scenarios', '*', 'steps', '*', 'created')): _HELPER_PARAMETERS['created'],
    (PRODUCT_SCHEMA, ('scenarios', '*', 'steps', '*', '*', 'saved')): _HELPER_PARAMETERS['saved'],
    (PRODUCT_SCHEMA, ('scenarios', '*', 'steps', '*', 'saved')): _HELPER_PARAMETERS['saved'],
    (SCREEN_SCHEMA, ('dashboard', 'actions', '*', 'requires')): (
        'The button of a create form is shown to the users whose role may add the entity: remove `requires`, '
        'a key of a tile, a chart, the last items and a link of the navigation.'
    ),
    (SCREEN_SCHEMA, ('dashboard', 'actions', '*', 'filters')): _ENTITY_FILTER,
    (SCREEN_SCHEMA, ('calendar', 'add', 'filters')): _ENTITY_FILTER,
    (SCREEN_SCHEMA, ('card', 'related', '*', 'add', 'filters')): _ENTITY_FILTER,
}


def shape_hint(error, data, schema: str) -> str | None:
    """
    The hint of `SHAPE_HINTS` for a shape error: at the path of the value, or of a key that the
    mapping there may not have (`additionalProperties`; any key: `maxProperties`); else, for a
    key that the mapping may not have, the keys that it may (but those of `patternProperties`,
    and those of an alternative of a oneOf/anyOf: the closest one may be another than meant).
    """
    path = tuple(error.absolute_path)
    paths = [path]
    allowed = {}
    node = data
    if error.validator in ('additionalProperties', 'maxProperties'):
        for step in path:
            node = node[step]
        allowed = error.schema.get('properties', {}) if error.validator == 'additionalProperties' else {}
        paths = [(*path, key) for key in node if key not in allowed] if isinstance(node, dict) else []
    for (name, mask), hint in SHAPE_HINTS.items():
        found = next(
            (it for it in paths if len(it) == len(mask) and all(m in ('*', p) for m, p in zip(mask, it, strict=True))),
            None,
        )
        if name == schema and found is not None:
            return hint.format(field=_filtered_field(data, found)) if '{field}' in hint else hint
    if allowed and 'patternProperties' not in error.schema and error.parent is None:
        keys = ', '.join(f'`{key}`' for key in allowed)
        return f'The keys of this mapping are {keys}: remove the others ({SPEC_DIR}/{SCHEMA_DIR}/{schema} says what each is).'
    return None


def _filtered_field(data, path: tuple) -> str:
    """The field that `filters` at the end of a path filters, its first key (`<field>` when it has none)."""
    node = data
    for step in path:
        node = node[step]
    return next(iter(node), '<field>') if isinstance(node, dict) and node else '<field>'


class _Loader(yaml.SafeLoader):
    """
    YAML whose implicit types are those of YAML 1.2: `2026-10-07` stays a string (no
    timestamps), and only true and false are booleans (`yes`, `No`, `on`, `Off` are
    strings, as the specs mean them).
    """


_Loader.yaml_implicit_resolvers = {
    key: [
        it for it in resolvers
        if it[0] not in ('tag:yaml.org,2002:timestamp', 'tag:yaml.org,2002:bool')
    ]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}
_Loader.add_implicit_resolver(
    'tag:yaml.org,2002:bool', re.compile(r'^(?:true|True|TRUE|false|False|FALSE)$'), list('tTfF')
)


def load(
    root: Path, path: Path, layer: str, schema: str, codes: tuple[str, str], issues: Issues
) -> Document:
    """
    A file of the specs, loaded (YAML, or JSON for `.json`) and checked against its JSON
    Schema; `codes` are those of a file that cannot be read and of a shape error.
    """
    read_code, shape_code = codes
    doc = Document(layer, path.relative_to(root).as_posix())
    try:
        text = path.read_text(encoding='utf-8')
        data = json.loads(text) if path.suffix == '.json' else yaml.load(text, Loader=_Loader)
    except FileNotFoundError:
        issues.add(
            doc, (), read_code, f'{doc.file} is missing.',
            'Create it; `manage.py bazis_front init` writes a starter of spec/ when it '
            'creates the frontend.',
        )
        return doc
    except (OSError, UnicodeDecodeError, ValueError, yaml.YAMLError) as err:
        hint = YAML_HINTS.get(getattr(err, 'problem', None), _SYNTAX)
        issues.add(doc, (), read_code, f'{doc.file} cannot be read: {err}', hint)
        return doc

    doc.data = data
    errors = sorted(validator(schema).iter_errors(data), key=lambda it: it.json_path)
    for error in errors:
        # the alternative of a oneOf/anyOf that came closest, rather than "not valid under
        # any of the given schemas"
        error = best_match(error.context) if error.context else error
        piece = piece_of_text(error, data)
        if piece is not None:
            hint = (
                f'The key `{piece}` is a piece of a text: in a flow mapping `{{a: x, y}}` the text after `, ` is '
                "read as another key. Quote the text that has the comma, `{entrance_info: '1 floor, 3 rooms'}`."
            )
        else:
            hint = shape_hint(error, data, schema) or f'Follow {SPEC_DIR}/{SCHEMA_DIR}/{schema}.'
        issues.add(doc, error.absolute_path, shape_code, error.message, hint)
    doc.valid = not errors
    return doc


def kind(path: Path) -> tuple[Path, tuple[str, str, tuple[str, str]]] | None:
    """
    The product root of a file of the specs and its kind (`PRODUCT`, `SCREEN`, `THEME`,
    `TOKENS`), by its place in `spec/`; None for another file (a copy of a schema).
    """
    parts = path.parts
    for i in range(len(parts) - 1, -1, -1):
        if parts[i] != SPEC_DIR:
            continue
        rest = '/'.join(parts[i + 1:])
        root = Path(*parts[:i]) if i else Path('.')
        if rest == 'product.yaml':
            return root, PRODUCT
        if re.fullmatch(r'screens/[^/]+\.yaml', rest):
            return root, SCREEN
        if rest == 'design/theme.yaml':
            return root, THEME
        if rest == 'design/tokens.json':
            return root, TOKENS
    return None


def lint(path: Path) -> Issues | None:
    """The issues of the shape of a file of the specs (`load`); None when it is not one."""
    found = kind(path.absolute())
    if found is None:
        return None
    root, (layer, schema, codes) = found
    issues = Issues()
    load(root, path.absolute(), layer, schema, codes, issues)
    return issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog='python -m bazis.contrib.front.spec.lint',
        description='Lint a file of the specs (spec/product.yaml, spec/screens/<id>.yaml, spec/design/theme.yaml, '
        'spec/design/tokens.json): its YAML and its shape, as `bazis_front check` reports them.',
    )
    parser.add_argument('path', type=Path)
    parser.add_argument('--json', action='store_true', help='Print the result as `check --json` does.')
    options = parser.parse_args(argv)
    issues = lint(options.path)
    if issues is None:
        parser.error(f'{options.path} is not a file of the specs')
    errors = [it for it in issues.items if it.severity == ERROR]
    if options.json:
        result = {
            'contract': False,
            'errors': len(errors),
            'warnings': sum(it.severity == WARNING for it in issues.items),
            'issues': [it.as_dict() for it in issues.items],
        }
        sys.stdout.write(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False) + '\n')
    else:
        for issue in issues.items:
            sys.stdout.write(f'{issue.location}: {issue.code} {issue.severity}: {issue.message}\n    {issue.hint}\n')
        sys.stdout.write(f'{len(errors)} errors.\n')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
