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
`access` of an entity compiled to the permissions of bazis-permit, and compared with the
effective permissions of the permit roles in the contract.

A permission of bazis-permit is `<app>.<model>.item.<operation>.<selector>[.<more>]`. On a
statusy model (bazis-statusy) the segment after the selector is the status of the object
(`all` for any status), and a transit is the operation `transit` with the id of the transit
last:

```
tasks.task.item.view.all.all                    # view in every status
tasks.task.item.change.author.draft             # change, if the author, in `draft`
tasks.task.item.transit.all.in_progress.finish  # the transit `finish` (from `in_progress`)
```

A grant of the spec is covered by a permission of the role with the same operation whose
selector is the same or `all` and, on a statusy model, whose status is the same or `all`
(for a transit: its source status or `all`). Only what `access` grants is checked: a role
may have more permissions (of other models, of fields, `check`), and the absence of an
operation is checked by the scenarios (`expect: {action_absent: ...}`).
"""

from dataclasses import dataclass

from .issues import EXPORT_HINT, Document, Issues


CRUD = ('view', 'add', 'change', 'delete')
TRANSIT = 'transit'

#: the selector of every object, and the status of every status
ALL = 'all'
#: not granted
NONE = 'none'
#: the object is the selector source itself (`PERM_SELF` of bazis-permit), such as the user
SELF = 'self'
#: the separator of the relationships of a multi-level selector (`parent__author`)
LOOKUP_SEP = '__'


@dataclass(frozen=True)
class Grant:
    resource: str
    operation: str
    selector: str
    #: the status on a statusy model (or `all`); None on another model
    status: str | None = None
    #: the id of the transit of the operation `transit`
    transit: str | None = None

    @property
    def slug(self) -> str:
        """
        The permission that grants exactly this.
        """
        parts = [self.resource, 'item', self.operation, self.selector]
        if self.status is not None:
            parts.append(self.status)
        if self.transit is not None:
            parts.append(self.transit)
        return '.'.join(parts)

    def covered_by(self, permission: str) -> bool:
        prefix = f'{self.resource}.item.{self.operation}.'
        if not permission.startswith(prefix):
            return False
        # a selector with conditions (`author=__selector__&...`) is narrower: not covering
        rest = permission.removeprefix(prefix).split('.')
        if rest[0] not in (self.selector, ALL):
            return False
        if self.status is None:
            return True
        if len(rest) < 2 or rest[1] not in (self.status, ALL):
            return False
        return self.transit is None or rest[2:] == [self.transit]


def grants(resource: str, role_access: dict, statusy: dict | None) -> list[tuple[tuple, Grant]]:
    """
    The grants of the access of a role to a resource with their paths (relative to the
    role); `statusy` is the model of the resource in the statusy section of the contract,
    None when it has no statuses.
    """
    result = []
    for operation in CRUD:
        value = role_access.get(operation)
        if value is None:
            continue
        selector, statuses = (value, None) if isinstance(value, str) else (value['selector'], value['statuses'])
        if selector == NONE:
            continue
        if statusy is None:
            result.append(((operation,), Grant(resource, operation, selector)))
        else:
            for status in statuses or [ALL]:
                result.append(((operation,), Grant(resource, operation, selector, status)))
    if statusy is not None:
        sources = {it['id']: it['src'] for it in statusy['transits']}
        for key, transit, selector in transits(role_access.get(TRANSIT, [])):
            if selector != NONE and transit in sources:
                result.append(
                    ((TRANSIT, key), Grant(resource, TRANSIT, selector, sources[transit], transit))
                )
    return result


def transits(value: list | dict) -> list[tuple]:
    """
    `(key, transit, selector)` of the transits of an access: a list grants each to all.
    """
    if isinstance(value, list):
        return [(i, it, ALL) for i, it in enumerate(value)]
    return [(it, it, selector) for it, selector in value.items()]


def selectors(role_access: dict) -> list[tuple[tuple, str]]:
    """
    The selectors of an access other than `all` and `none`, with their paths.
    """
    result = []
    for operation in CRUD:
        value = role_access.get(operation)
        if isinstance(value, dict):
            result.append(((operation, 'selector'), value['selector']))
        elif value is not None:
            result.append(((operation,), value))
    result += [((TRANSIT, key), selector) for key, _, selector in transits(role_access.get(TRANSIT, []))]
    return [(path, it) for path, it in result if it not in (ALL, NONE)]


def selector_problem(selector: str, resource: str, contract: dict) -> str | None:
    """
    Why a selector is not one of the resource in the contract, or None. A selector is
    `self`, or a relationship of the resource that links the object to the user, or a path
    of relationships to it (`parent__author`, as bazis-permit `parse_selector` follows it):
    each hop is checked while the contract has the related resource.
    """
    if selector == SELF:
        return None
    resources = contract['project']['resources']
    current = resource
    for part in selector.split(LOOKUP_SEP):
        if current not in resources:
            return None
        field = resources[current]['fields'].get(part)
        if field is None or 'relation' not in field:
            return f'`{part}` is not a relationship of `{current}` in the contract'
        current = field['relation'] if isinstance(field['relation'], str) else None
    return None


def check(
    doc: Document, entity, statusy: dict | None, product, contract: dict, issues: Issues
) -> None:
    """
    Checks that the permit role of every role of the access of an entity (`refs.Entity`) to
    its resource has the permissions that it grants (P019); a selector that is not one of
    the resource is a warning (P020). `statusy` is the model of the resource
    in the statusy section of the contract.
    """
    data = entity.data
    permit = contract['capabilities'].get('permit')
    if permit is None:
        issues.add(
            doc, (*entity.path, 'access'), 'P010',
            'The access needs bazis-permit: the contract has no section `permit`.',
            f'Install bazis-permit with its app in BS_INSTALLED_APPS, and {EXPORT_HINT}.',
        )
        return
    roles = {it['slug']: it for it in permit['roles']}
    for role_id, role_access in data['access'].items():
        path = (*entity.path, 'access', role_id)
        for selector_path, selector in selectors(role_access):
            if problem := selector_problem(selector, data['resource'], contract):
                issues.add(
                    doc, (*path, *selector_path), 'P020',
                    f'The selector `{selector}` is not a selector of `{data["resource"]}`: {problem}.',
                    'A selector of bazis-permit is `all`, `self`, a relationship that links the '
                    'object to the user (`author`) or a path of relationships to it '
                    '(`parent__author`); check the names.',
                )
        role = product.roles.get(role_id)
        permit_role = roles.get(role['permit']) if role else None
        if permit_role is None:
            # an unknown role (P004) or permit role (P018) is reported with the role
            continue
        permissions = permit_role['permissions']
        for grant_path, grant in grants(data['resource'], role_access, statusy):
            if not any(grant.covered_by(it) for it in permissions):
                issues.add(
                    doc, (*path, *grant_path), 'P019',
                    f'The permit role `{permit_role["slug"]}` has no permission `{grant.slug}`, '
                    f'which the access of `{role_id}` to `{data["id"]}` grants.',
                    f'Add `{grant.slug}` to a permission group of the role `{permit_role["slug"]}` '
                    f'(in a data migration), and {EXPORT_HINT}; or change the access.',
                )
