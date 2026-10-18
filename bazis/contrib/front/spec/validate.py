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
The validation of the specs of a product: each file is loaded and checked against its JSON
Schema (Draft 2020-12), then the valid ones are checked against each other and, when the
product has one, against `contract/contract.json`. `bazis_front check` and the system
checks run `validate`; the result is a list of issues with stable codes (`issues.CODES`).
"""

import json
import re
from dataclasses import dataclass, field
from functools import cache
from importlib.resources import files
from importlib.resources.abc import Traversable
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match

from ..capabilities import outdated
from ..contract.export import CONTRACT_DIR, CONTRACT_FORMAT
from ..vendor import lock as frontend_lock
from ..vendor import registry
from . import design, refs, scenarios
from .issues import CONTRACT, ERROR, WARNING, Document, Issue, Issues
from .names import component_name
from .scenarios import Step


SPEC_DIR = 'spec'

#: the files of the specs, by their path in the product root (the screens are
#: `screen_files`)
PRODUCT_FILE = f'{SPEC_DIR}/product.yaml'
THEME_FILE = f'{SPEC_DIR}/design/theme.yaml'
TOKENS_FILE = f'{SPEC_DIR}/design/tokens.json'

#: the copies of the JSON Schemas in the specs of a product, for the editors
SCHEMA_DIR = 'schema'

LAYERS = ('product', 'screens', 'design')

CONTRACT_FILE = f'{CONTRACT_DIR}/contract.json'

#: the JSON Schema of each kind of file
PRODUCT_SCHEMA = 'product.schema.json'
SCREEN_SCHEMA = 'screen.schema.json'
DESIGN_SCHEMA = 'design.schema.json'
TOKENS_SCHEMA = 'tokens.schema.json'
SCHEMAS = (PRODUCT_SCHEMA, SCREEN_SCHEMA, DESIGN_SCHEMA, TOKENS_SCHEMA)


@dataclass(frozen=True)
class Specs:
    """
    The specs as the validation read them, for the generators of the end-to-end tests and
    of the theme: the data of product.yaml (None when it does not follow its schema), the
    screens by id (None for one that does not follow its schema), the steps of each scenario
    as the walk of `scenarios.py` understood them, and the data of theme.yaml and tokens.json
    (None when the file is missing or does not follow its schema). Only those of specs
    without errors are meant to be used.
    """

    product: dict | None = None
    screens: dict[str, dict | None] = field(default_factory=dict)
    scenarios: dict[str, list[Step]] = field(default_factory=dict)
    theme: dict | None = None
    tokens: dict | None = None


@dataclass(frozen=True)
class Result:
    issues: list[Issue]
    #: whether the specs were checked against contract/contract.json
    contract: bool
    specs: Specs = field(default_factory=Specs)

    @property
    def errors(self) -> list[Issue]:
        return [it for it in self.issues if it.severity == ERROR]

    @property
    def warnings(self) -> list[Issue]:
        return [it for it in self.issues if it.severity == WARNING]

    def as_dict(self) -> dict:
        return {
            'contract': self.contract,
            'errors': len(self.errors),
            'warnings': len(self.warnings),
            'issues': [it.as_dict() for it in self.issues],
        }


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
        issues.add(doc, (), read_code, f'{doc.file} cannot be read: {err}', 'Fix its syntax.')
        return doc

    doc.data = data
    errors = sorted(validator(schema).iter_errors(data), key=lambda it: it.json_path)
    for error in errors:
        # the alternative of a oneOf/anyOf that came closest, rather than "not valid under
        # any of the given schemas"
        error = best_match(error.context) if error.context else error
        issues.add(
            doc, error.absolute_path, shape_code, error.message,
            f'Follow {SPEC_DIR}/{SCHEMA_DIR}/{schema}.',
        )
    doc.valid = not errors
    return doc


#: what `update` says of a contract of another format (C002), exported by an older version
CONTRACT_OUTDATED = (
    f'{CONTRACT_FILE} is of a format of another version: export it again with `manage.py bazis_front '
    'contract` (after `npm install` in frontend/); `check` reports C002 until then.'
)


def contract_outdated(root: Path) -> bool:
    """
    Whether `load_contract` refuses contract/contract.json for its format (C002): not when the
    product has none or it cannot be read (C001).
    """
    issues = Issues()
    load_contract(root, issues)
    return any(it.code == 'C002' for it in issues.items)


def load_contract(root: Path, issues: Issues) -> dict | None:
    """
    contract/contract.json, or None when the product has none (or it cannot be used).
    """
    path = root / CONTRACT_FILE
    if not path.is_file():
        return None
    doc = Document(CONTRACT, CONTRACT_FILE)
    hint = 'Export it with `manage.py bazis_front contract`; never edit it by hand.'
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, UnicodeDecodeError, ValueError) as err:
        issues.add(doc, (), 'C001', f'{CONTRACT_FILE} cannot be read: {err}', hint)
        return None
    if not isinstance(data, dict) or data.get('format') != CONTRACT_FORMAT:
        issues.add(
            doc, ('format',), 'C002',
            f'{CONTRACT_FILE} is not a contract of format {CONTRACT_FORMAT}.', hint,
        )
        return None
    return data


def check_assets(root: Path, contract: dict, issues: Issues) -> None:
    """
    The assets of the frontend (recorded in its lock) follow the capabilities of the
    contract: `init` copies a vendored asset that requires a capability, such as the hooks of
    bazis-statusy, only when the product has it; no asset (a component neither) is there
    without its capabilities. The components are added when the product needs them: their
    absence is not an issue.
    """
    frontend = root / frontend_lock.FRONTEND_DIR
    try:
        lock = frontend_lock.read(frontend)
    except frontend_lock.LockError:
        # front.W001 reports it
        return
    if lock is None:
        return
    doc = Document(CONTRACT, f'{frontend_lock.FRONTEND_DIR}/{frontend_lock.LOCK_FILE}')
    present = set(lock.get('assets', {}))
    capabilities = set(contract.get('capabilities', {}))
    for asset in registry.load().values():
        if not asset.capabilities:
            continue
        required = ', '.join(asset.capabilities)
        target = f'{frontend_lock.FRONTEND_DIR}/{asset.target}/'
        if asset.kind == registry.VENDORED and asset.wanted(capabilities) and asset.name not in present:
            issues.add(
                doc, ('assets',), 'C003',
                f'The contract has the capability {required}, but the frontend does not have '
                f'the asset {asset.name} ({target}).',
                f'Copy it with `manage.py bazis_front add {asset.name}` (`init` copies it when '
                'the package is installed).',
            )
        elif not asset.wanted(capabilities) and asset.name in present:
            issues.add(
                doc, ('assets', asset.name), 'C003',
                f'The frontend has the asset {asset.name} ({target}), but the contract does not '
                f'have the capability {required}.',
                f'Install the package and export the contract again, or delete {target}, its '
                f'pristine copy in {frontend_lock.FRONTEND_DIR}/{frontend_lock.BASE_DIR}/ and its '
                'entry in the lock.',
            )


def check_packages(contract: dict, issues: Issues) -> None:
    """
    The installed packages of the capabilities of the contract are not older than the
    versions whose protocol the assets follow (`minimum` of `capabilities.CAPABILITIES`).
    An error of `check`, so that `bazis_front e2e` generates nothing and `front.W003`
    compares nothing until it is upgraded; the system checks report it once, as the warning
    `front.W006` (`front.W002` leaves it out).
    """
    doc = Document(CONTRACT, CONTRACT_FILE)
    for name, capability, version in outdated(sorted(contract.get('capabilities', {}))):
        issues.add(
            doc, ('capabilities', name), 'C004',
            f'{capability.distribution} {version} is installed; the frontend needs '
            f'{capability.distribution}>={capability.minimum}: {capability.needs}.',
            f"Upgrade it (`pip install -U '{capability.distribution}>={capability.minimum}'`), "
            'then export the contract again.',
        )


#: a key of the dictionaries of the frontend, as a text of the specs (`tiles.on_hand`), rather
#: than a text in words
TEXT_KEY = re.compile(r'[a-z][a-z0-9_]*(\.[a-z0-9_-]+)+')
TEXT = '#/$defs/text'


@cache
def text_paths(name: str) -> tuple[tuple, ...]:
    """
    The paths of the texts (`$defs/text`) in the documents of a JSON Schema, `*` for each item
    of a list.
    """
    schema = validator(name).schema
    found: dict[tuple, None] = {}

    def walk(node, path: tuple, refs: frozenset) -> None:
        if not isinstance(node, dict):
            return
        ref = node.get('$ref')
        if ref == TEXT:
            found[path] = None
            return
        if ref is not None and ref not in refs:
            walk(schema['$defs'][ref.removeprefix('#/$defs/')], path, refs | {ref})
        for key, value in node.get('properties', {}).items():
            walk(value, (*path, key), refs)
        walk(node.get('items'), (*path, '*'), refs)
        for key in ('allOf', 'anyOf', 'oneOf'):
            for value in node.get(key, []):
                walk(value, path, refs)
        for key in ('then', 'else'):
            walk(node.get(key), path, refs)

    walk(schema, (), frozenset())
    return tuple(found)


def text_values(data, path: tuple, at: tuple = ()):
    """
    The values at a path of `text_paths` in a document, with their paths.
    """
    if not path:
        yield at, data
    elif path[0] == '*':
        for i, item in enumerate(data if isinstance(data, list) else []):
            yield from text_values(item, path[1:], (*at, i))
    elif isinstance(data, dict) and path[0] in data:
        yield from text_values(data[path[0]], path[1:], (*at, path[0]))


def document_texts(data: dict, schema: str):
    """
    The texts of a document of a schema that the frontend shows, with their paths: all but the
    title of a generated card, which the label of its item heads.
    """
    shown_title = schema != SCREEN_SCHEMA or data['primitive'] != 'card' or data.get('custom')
    for path in text_paths(schema):
        if path != ('title',) or shown_title:
            yield from text_values(data, path)


def check_texts(doc: Document, schema: str, languages: list[str], issues: Issues) -> None:
    """
    Every text of a document is in each language of the product (S027): a map of them, or a
    key of the dictionaries of the frontend (which have every language); a text in words is in
    one language.
    """
    prefix = screen_prefix(doc.data['id']) if schema == SCREEN_SCHEMA else ''
    for at, value in document_texts(doc.data, schema):
        if isinstance(value, str):
            if len(languages) < 2 or TEXT_KEY.fullmatch(value):
                continue
            problem = f'The text `{value}` is in one language; the product has {", ".join(languages)}.'
        else:
            missing = [it for it in languages if it not in value]
            if not missing:
                continue
            problem = f'The text has no {", ".join(f"`{it}`" for it in missing)}.'
        issues.add(
            doc, at, 'S027', problem,
            f'Give it in every language of the product: `{{{", ".join(f"{it}: ..." for it in languages)}}}`; '
            f'or a key of the dictionaries of the frontend (`{text_key(prefix, doc.data, at)}`).',
        )


def text_key(prefix: str, data, path: tuple) -> str:
    """
    The key of the text at a path of a document: the path from the prefix, an item of a list
    by its id (`group` for a group of the navigation, `screen` for a link).
    """
    parts, node = [prefix] if prefix else [], data
    for step in path:
        if isinstance(step, int):
            item = node[step]
            name = item.get('id', item.get('group', item.get('screen', step))) if isinstance(item, dict) else step
            parts.append(str(name))
        else:
            parts.append(step)
        node = node[step]
    return '.'.join(parts)


def screen_prefix(screen_id: str) -> str:
    """The prefix of the keys of the texts of a screen: `screens.<id>`."""
    return f'screens.{screen_id}'


#: the dictionaries of the product in its frontend, `<language>.ts` (`index.ts` merges them)
DICTIONARIES_DIR = 'src/i18n'
#: the dictionaries of the components (the copy of the asset `i18n`)
PACKAGE_DICTIONARIES_DIR = 'src/bazis/i18n/messages'
#: a key of a dictionary as the dictionaries write them, one per line: `'tasks.count': 'Count',`
DICTIONARY_KEY = re.compile(r"""^\s*(?:'([^'\n]+)'|"([^"\n]+)"|([A-Za-z_$][\w$]*))\s*:(?!:)""", re.M)


def dictionary_keys(path: Path) -> set[str]:
    """The keys of a dictionary of the frontend."""
    return {next(it for it in found if it) for found in DICTIONARY_KEY.findall(path.read_text(encoding='utf-8'))}


def check_dictionaries(root: Path, docs: list[tuple[Document, str]], issues: Issues) -> None:
    """
    The texts of the specs against the dictionaries of the frontend, once it has them: a text
    that is a key is in one of them, the product's or those of the components (S036, else the
    screen shows the key; a warning: the dictionaries are read as text, and a key that the
    product builds or keeps elsewhere is not seen, so it never stops `screens`); a key of the texts of the specs in a dictionary of the product
    (`screens.<id>...`) is that of a text that the specs have (S037, a warning: a key of a
    screen, a section, a tab or an action that is not there, or of a text that the spec does not
    give, shows nowhere).
    """
    frontend = root / frontend_lock.FRONTEND_DIR
    if not (frontend / PACKAGE_DICTIONARIES_DIR).is_dir():
        return
    product = {
        path: dictionary_keys(path) for path in sorted((frontend / DICTIONARIES_DIR).glob('*.ts'))
        if path.name != 'index.ts'
    }
    known = set().union(*product.values(), *(
        dictionary_keys(it) for it in sorted((frontend / PACKAGE_DICTIONARIES_DIR).glob('*.ts'))
    ))
    used: set[str] = set()
    for doc, schema in docs:
        if not doc.valid:
            continue
        prefix = screen_prefix(doc.data['id']) if schema == SCREEN_SCHEMA else ''
        for at, value in document_texts(doc.data, schema):
            if not (isinstance(value, str) and TEXT_KEY.fullmatch(value)):
                used.add(text_key(prefix, doc.data, at))
                continue
            used.add(value)
            if value not in known:
                issues.add(
                    doc, at, 'S036',
                    f'The text is the key `{value}`, which no dictionary of the frontend has.',
                    f'Add `{value}` to {frontend_lock.FRONTEND_DIR}/{DICTIONARIES_DIR}/<language>.ts of every '
                    'language of the product, or give the text itself, in every language: `{en: ...}`.',
                )
    for path, keys in product.items():
        doc = Document('screens', path.relative_to(root).as_posix())
        for key in sorted(keys):
            if key.startswith('screens.') and key not in used:
                issues.add(
                    doc, (), 'S037',
                    f'`{key}` is the key of a text that the specs do not have: it shows nowhere.',
                    'Delete it, or give the spec the text that it replaces; the texts of a custom screen or of '
                    'an extension have keys of their own, outside `screens.`.',
                )


#: the code of the screens of the product in its frontend: `custom`, `extend`
SCREENS_DIR = 'src/screens'
GENERATED_DIR = f'{SCREENS_DIR}/generated'
#: the router of the template, which imports the generated screens since they are generated
ROUTER_TSX = 'src/app/router.tsx'
#: the extension of a generated screen, in `<SCREENS_DIR>/<id>/`
EXTEND_FILE = 'extend.tsx'
EXTENSION = 'extension'
#: the module of `custom` (`@/screens/<path>`) is one of these files of `src/screens/<path>`
MODULE_FILES = ('.tsx', '.ts', '/index.tsx', '/index.ts')


def exports(path: Path, name: str) -> bool:
    """
    Whether a module of TypeScript exports a declaration, or lists it among its exports.
    """
    text = path.read_text(encoding='utf-8')
    declared = rf'^export\s+(?:async\s+)?(?:function|const|let|class)\s+{name}\b'
    listed = rf'^export\s*\{{[^}}]*\b{name}\b'
    return re.search(declared, text, re.M) is not None or re.search(listed, text, re.M) is not None


def needs_screens(frontend: Path, lock: dict) -> bool:
    """
    Whether the frontend lacks the generated screens that its router imports: a frontend made
    before `bazis_front screens`, whose template is updated since (before the update, its
    router is its own, and the screens are not generated yet).
    """
    router = frontend / ROUTER_TSX
    return (
        'screens' not in lock and router.is_file()
        and f"from '@/{GENERATED_DIR.removeprefix('src/')}/" in router.read_text(encoding='utf-8')
    )


def check_screen_code(root: Path, docs: list[Document], issues: Issues, generating: bool) -> None:
    """
    The code of the screens in `frontend/src/screens/`, once the frontend exists: a `custom`
    screen exports its component (S028), a screen with `extend` its extension (S031); once the
    frontend generates its screens (the lock has `screens`, `generating`: `screens` is
    about to write them, or `needs_screens`: the router imports the generated screens before
    the lock has them), no screen but a custom one has `<id>/index.tsx` (S029), unless it is
    the module of another custom screen. A custom screen is never extended (S031).
    """
    frontend = root / frontend_lock.FRONTEND_DIR
    screens, code = frontend / SCREENS_DIR, (frontend / 'src').is_dir()
    try:
        lock = frontend_lock.read(frontend) or {}
        generated = generating or 'screens' in lock or needs_screens(frontend, lock)
    except frontend_lock.LockError:
        # front.W001 reports it
        generated = generating
    # the files of the modules of the custom screens: none is a screen of its own
    modules = {
        _module_file(screens, it.data['custom']) for it in docs if it.valid and isinstance(it.data.get('custom'), dict)
    }
    for doc in docs:
        if not doc.valid:
            continue
        screen_id, custom, extend = Path(doc.file).stem, doc.data.get('custom', False), doc.data.get('extend', False)
        if custom and extend:
            issues.add(
                doc, ('extend',), 'S031',
                f'The screen `{screen_id}` is custom: it is not generated, and nothing takes its extension.',
                'Remove `extend` and write what it adds in the code of the screen, or remove `custom`.',
            )
        if not code:
            continue
        if custom:
            _check_custom(root, doc, screens, screen_id, custom, issues)
        elif generated and (own := screens / screen_id / 'index.tsx').is_file() and own not in modules:
            file = f'{frontend_lock.FRONTEND_DIR}/{SCREENS_DIR}/{screen_id}/index.tsx'
            issues.add(
                doc, (), 'S029',
                f'{file} is a screen `{screen_id}` of its own, and the frontend generates the screen from its spec.',
                f'Delete {file} to keep the generated screen (what it adds beyond the spec goes to '
                f'`extend`), or declare the screen `custom: true` to keep it.',
            )
        if extend and not custom:
            path = screens / screen_id / EXTEND_FILE
            file = path.relative_to(root).as_posix()
            if not path.is_file() or not exports(path, EXTENSION):
                issues.add(
                    doc, ('extend',), 'S031',
                    f'{file} ' + ('does not export `extension`.' if path.is_file() else 'is missing.'),
                    f'Write it, `export const {EXTENSION}` with the type of the extension of the primitive '
                    f'(`ScreenExtension<ResourceListProps>` of `@/bazis/ui/screens`...), or remove `extend`.',
                )


def _module_file(screens: Path, custom: dict) -> Path | None:
    """
    The file of the module `custom.module` of a screen: `<path>.tsx`, `.ts`, `<path>/index.tsx`
    or `.ts` in `src/screens`; None when there is none.
    """
    base = custom['module'].removeprefix('@/screens')
    return next((it for it in (Path(f'{screens}{base}{end}') for end in MODULE_FILES) if it.is_file()), None)


def _check_custom(root: Path, doc: Document, screens: Path, screen_id: str, custom, issues: Issues) -> None:
    if custom is True:
        path, name = screens / screen_id / 'index.tsx', component_name(screen_id)
        path = path if path.is_file() else None
    else:
        path, name = _module_file(screens, custom), custom['export']
    if path is not None and exports(path, name):
        return
    if path is not None:
        problem = f'{path.relative_to(root).as_posix()} does not export `{name}`.'
    elif custom is True:
        problem = f'{(screens / screen_id / "index.tsx").relative_to(root).as_posix()} is missing.'
    else:
        module = Path(f'{screens}{custom["module"].removeprefix("@/screens")}').relative_to(root).as_posix()
        problem = f'The module `{custom["module"]}` is missing: no {module}.tsx nor {module}/index.tsx (or .ts).'
    issues.add(
        doc, ('custom',), 'S028', problem,
        f'Write the screen there, `export function {name}()`, or remove `custom` to generate it.',
    )


def screen_files(root: Path) -> list[str]:
    """
    The specs of the screens, `spec/screens/<id>.yaml`, by their path in the product root.
    """
    return [
        it.relative_to(root).as_posix() for it in sorted((root / SPEC_DIR / 'screens').glob('*.yaml'))
    ]


def validate(root: Path, layers: tuple[str, ...] = LAYERS, generating: bool = False) -> Result:
    """
    Checks `spec/` of the product root against itself and `contract/contract.json`. The
    issues of the other layers are left out (the layers are checked together, because they
    reference each other); those of the contract are always reported. `generating`: the
    screens are about to be generated, so a screen of its own beside a generated one is
    refused (S029) although the lock has no `screens` yet.
    """
    issues = Issues()
    contract = load_contract(root, issues)
    if contract is not None:
        check_assets(root, contract, issues)
        check_packages(contract, issues)

    product_doc = load(root, root / PRODUCT_FILE, 'product', PRODUCT_SCHEMA, ('P001', 'P002'), issues)
    screen_docs = [
        load(root, root / path, 'screens', SCREEN_SCHEMA, ('S001', 'S002'), issues)
        for path in screen_files(root)
    ]
    theme_path, tokens_path = root / THEME_FILE, root / TOKENS_FILE
    theme_doc = (
        load(root, theme_path, 'design', DESIGN_SCHEMA, ('D001', 'D002'), issues)
        if theme_path.exists() else None
    )
    tokens_doc = (
        load(root, tokens_path, 'design', TOKENS_SCHEMA, ('D001', 'D003'), issues)
        if tokens_path.exists() else None
    )

    product = refs.check_product(product_doc, contract, issues)
    screens = refs.check_screens(screen_docs, product, contract, issues)
    refs.check_navigation(product_doc, screens, product, contract, issues)
    check_screen_code(root, screen_docs, issues, generating)
    languages = product_doc.data.get('languages', []) if product_doc.valid else []
    documents = [(product_doc, PRODUCT_SCHEMA), *((it, SCREEN_SCHEMA) for it in screen_docs)]
    for doc, schema in documents:
        if doc.valid:
            check_texts(doc, schema, languages, issues)
    check_dictionaries(root, documents, issues)
    walked = scenarios.check(product_doc, product, screens, issues)
    screened = {
        data['entity'] for data in screens.values()
        if data is not None and product is not None and data.get('entity') in product.entities
    }
    design.check(theme_doc, tokens_doc, screened, contract, issues)

    return Result(
        [it for it in issues.items if it.layer in layers or it.layer == CONTRACT],
        contract is not None,
        Specs(
            product_doc.data if product_doc.valid else None, screens, walked,
            theme_doc.data if theme_doc is not None and theme_doc.valid else None,
            tokens_doc.data if tokens_doc is not None and tokens_doc.valid else None,
        ),
    )
