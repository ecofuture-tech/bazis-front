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

from ..contract.export import CONTRACT_DIR, CONTRACT_FORMAT
from ..vendor import lock as frontend_lock
from ..vendor import registry
from . import design, refs, scenarios
from .issues import CONTRACT, ERROR, WARNING, Document, Issue, Issues
from .scenarios import Step


SPEC_DIR = 'spec'

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


def validate(root: Path, layers: tuple[str, ...] = LAYERS) -> Result:
    """
    Checks `spec/` of the product root against itself and `contract/contract.json`. The
    issues of the other layers are left out (the layers are checked together, because they
    reference each other); those of the contract are always reported.
    """
    spec = root / SPEC_DIR
    issues = Issues()
    contract = load_contract(root, issues)
    if contract is not None:
        check_assets(root, contract, issues)

    product_doc = load(root, spec / 'product.yaml', 'product', PRODUCT_SCHEMA, ('P001', 'P002'), issues)
    screen_docs = [
        load(root, path, 'screens', SCREEN_SCHEMA, ('S001', 'S002'), issues)
        for path in sorted((spec / 'screens').glob('*.yaml'))
    ]
    theme_path, tokens_path = spec / 'design' / 'theme.yaml', spec / 'design' / 'tokens.json'
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
    walked = scenarios.check(product_doc, product, screens, issues)
    design.check(theme_doc, tokens_doc, contract, issues)

    return Result(
        [it for it in issues.items if it.layer in layers or it.layer == CONTRACT],
        contract is not None,
        Specs(
            product_doc.data if product_doc.valid else None, screens, walked,
            theme_doc.data if theme_doc is not None and theme_doc.valid else None,
            tokens_doc.data if tokens_doc is not None and tokens_doc.valid else None,
        ),
    )
