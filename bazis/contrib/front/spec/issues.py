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

#: the layer of the issues of contract/contract.json, reported whatever layers are checked
CONTRACT = 'contract'

#: {code: (severity, what it means)}; documented in the table of the codes of AGENTS.md
CODES: dict[str, tuple[str, str]] = {
    'C001': (ERROR, 'contract/contract.json cannot be read'),
    'C002': (ERROR, 'contract/contract.json has another format: it was exported by another version of bazis-front'),
    'C003': (WARNING, 'the assets of the frontend (its lock) differ from the capabilities of the contract: the hooks of a package are missing, or assets of a package are there without it'),
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
    'P020': (WARNING, 'a selector of `access` is not a relationship (or a path of relationships) of the resource in the contract'),
    'P021': (ERROR, 'a scenario step references an unknown screen'),
    'P022': (ERROR, 'a scenario step is not possible on the current screen'),
    'P023': (ERROR, 'a scenario step references a field that the entity of the screen does not declare'),
    'P024': (ERROR, 'a scenario step references an unknown status or transition, or its payload differs'),
    'P025': (ERROR, 'the role of a scenario has no `test_user`, and the product logs in (`packages` has `users`)'),
    'S001': (ERROR, 'a screen file is not valid YAML'),
    'S002': (ERROR, 'a screen does not follow screen.schema.json'),
    'S003': (ERROR, 'the id of a screen differs from its file name, or its route is taken'),
    'S004': (ERROR, 'a screen references an unknown entity'),
    'S005': (ERROR, 'a screen references an unknown role'),
    'S006': (ERROR, 'a screen references an unknown screen, or one of another primitive'),
    'S007': (ERROR, 'a screen references a field that its entity does not declare'),
    'S008': (ERROR, 'a filter or a sort field cannot be filtered or sorted by in the contract'),
    'S009': (ERROR, 'a state required by the primitive is missing'),
    'S010': (ERROR, 'an action is not valid: a duplicate id, or not possible on the primitive'),
    'S011': (ERROR, 'transitions or history on a card whose entity has no workflow'),
    'D001': (ERROR, 'a design file is not valid YAML or JSON'),
    'D002': (ERROR, 'spec/design/theme.yaml does not follow design.schema.json'),
    'D003': (ERROR, 'spec/design/tokens.json does not follow tokens.schema.json'),
    'D004': (ERROR, 'a token references an undefined token, or references itself through other tokens'),
    'D005': (ERROR, 'a token required by the preset is undefined or of another type'),
    'D006': (ERROR, 'a token references a token of another type'),
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
