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

An operation may have several grants, a list (`view: [author, participants]`): bazis-permit
unites the permissions of a role, so the role may do it on the objects of any of them, and
each is a permission of its own (`tasks.task.item.view.author.all`,
`tasks.task.item.view.participants.all`). A grant of the spec is covered by a permission of
the role with the same operation whose selector is the same or `all` and, on a statusy
model, whose status is the same or `all` (for a transit: its source status or `all`). Only
what `access` grants is checked: a role may have more permissions (of other models, of
fields, `check`), and the absence of an operation is checked by the scenarios
(`expect: {action_absent: ...}`).
"""

from dataclasses import dataclass

from .issues import DECLARE_ROLES, EXPORT_HINT, Document, Issues


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


def listed(value) -> list[tuple[tuple, object]]:
    """
    The grants of an operation (or the selectors of a transit) with their paths relative to
    the operation: those of a list, else the value itself.
    """
    return [((i,), it) for i, it in enumerate(value)] if isinstance(value, list) else [((), value)]


def grants(resource: str, role_access: dict, statusy: dict | None) -> list[tuple[tuple, Grant]]:
    """
    The grants of the access of a role to a resource with their paths (relative to the
    role); `statusy` is the model of the resource in the statusy section of the contract,
    None when it has no statuses.
    """
    result = []
    for operation in CRUD:
        for key, value in listed(role_access.get(operation, [])):
            selector, statuses = (value, None) if isinstance(value, str) else (value['selector'], value['statuses'])
            if selector == NONE:
                continue
            path = (operation, *key)
            if statusy is None:
                result.append((path, Grant(resource, operation, selector)))
            else:
                for status in statuses or [ALL]:
                    result.append((path, Grant(resource, operation, selector, status)))
    if statusy is not None:
        sources = {it['id']: it['src'] for it in statusy['transits']}
        for path, transit, selector in transits(role_access.get(TRANSIT, [])):
            if selector != NONE and transit in sources:
                result.append(
                    ((TRANSIT, *path), Grant(resource, TRANSIT, selector, sources[transit], transit))
                )
    return result


def transits(value: list | dict) -> list[tuple]:
    """
    `(path, transit, selector)` of the transits of an access, the path relative to `transit`:
    a list grants each to all, a map each to its selector or to each of its selectors.
    """
    if isinstance(value, list):
        return [((i,), it, ALL) for i, it in enumerate(value)]
    return [
        ((transit, *key), transit, selector)
        for transit, selectors_of in value.items()
        for key, selector in listed(selectors_of)
    ]


def selectors(role_access: dict) -> list[tuple[tuple, str]]:
    """
    The selectors of an access other than `all` and `none`, with their paths.
    """
    result = []
    for operation in CRUD:
        for key, value in listed(role_access.get(operation, [])):
            if isinstance(value, dict):
                result.append(((operation, *key, 'selector'), value['selector']))
            else:
                result.append(((operation, *key), value))
    result += [((TRANSIT, *path), selector) for path, _, selector in transits(role_access.get(TRANSIT, []))]
    return [(path, it) for path, it in result if it not in (ALL, NONE)]


@dataclass(frozen=True)
class Walk:
    """
    The relations of the path of a selector (all its names but the last) followed in the
    contract.
    """

    #: the resource of its last name; None when the path is not followed to the end
    resource: str | None
    #: why a relation of the path is not one, else None
    problem: str | None = None
    #: the name of the path that the contract does not describe, neither a field of its
    #: resource nor one of its selectors (a relation that its route set does not show)
    undescribed: str | None = None


def walk(selector: str, resource: str, contract: dict) -> Walk:
    """
    Follows the relations of the path of a selector from the resource, as bazis-permit
    resolves it (`parse_selector`): a relation is a relationship of the resource in the
    contract or one of its selectors. The walk stops at a resource that the contract does
    not describe and at a name that it does not describe (`undescribed`): bazis-permit
    follows every relation of the model, also those that no route set shows (the reverse
    relation `registrations` of the user to the registrations of the events), and checks
    the selectors of the declared permissions itself (permit.E005).
    """
    resources = contract['project']['resources']
    known = contract['capabilities']['permit'].get('selectors', {})
    *hops, _last = selector.split(LOOKUP_SEP)
    current = resource
    for part in hops:
        if current not in resources and current not in known:
            return Walk(None)
        field = resources.get(current, {}).get('fields', {}).get(part)
        target = known.get(current, {}).get(part) if field is None else field.get('relation')
        if field is None and target is None:
            return Walk(None, undescribed=part)
        if target is None:
            return Walk(None, problem=f'`{part}` is not a relationship of `{current}` in the contract')
        if not isinstance(target, str):
            return Walk(None)
        current = target
    return Walk(current)


def selector_problem(selector: str, resource: str, contract: dict) -> str | None:
    """
    Why a selector is not one of the resource in the contract, or None. A selector is
    `self` (on a selector source), a selector of the resource (a relation that links the
    object to a selector source, such as the user), or such a selector at the end of a path
    of relations (`parent__author`, followed by `walk`), as bazis-permit resolves it
    (`parse_selector`, `get_selector_model`). The selectors of a permission model are those
    of the section `permit` of the contract, also the relations its route does not show (a
    reverse relation, `members`). What the contract does not describe is not checked: a
    resource that is not in it, a relation of the path that it does not describe (`walk`),
    and of a resource that is not a permission model the last name is only checked to be a
    relationship.
    """
    resources = contract['project']['resources']
    known = contract['capabilities']['permit'].get('selectors', {})
    followed = walk(selector, resource, contract)
    if followed.resource is None:
        return followed.problem
    current, last = followed.resource, selector.split(LOOKUP_SEP)[-1]
    if last == SELF and LOOKUP_SEP in selector:
        return '`self` is the object itself, never the end of a path of relations'
    if current in known:
        if last not in known[current]:
            return f'`{last}` is not a selector of `{current}`'
        return None
    if last == SELF or current not in resources:
        return None
    if 'relation' not in resources[current]['fields'].get(last, {}):
        return f'`{last}` is not a relationship of `{current}` in the contract'
    return None


def check(
    doc: Document, entity, statusy: dict | None, product, contract: dict, issues: Issues
) -> None:
    """
    Checks that the permit role of every role of the access of an entity (`refs.Entity`) to
    its resource has the permissions that it grants (P019); a selector that is not one of
    the resource is a warning (P020); an anonymous role grants with `all` only, through a
    permit role (P030). `statusy` is the model of the resource
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
        role = product.roles.get(role_id)
        anonymous = bool(role and role.get('anonymous'))
        if anonymous and 'permit' not in role:
            issues.add(
                doc, path, 'P030',
                f'The anonymous role `{role_id}` has no permit role: bazis-permit gives the users '
                'who do not log in only the permissions of the roles `for_anonymous`.',
                'Give the role a permit role `for_anonymous`, or remove its access (the public '
                'routes and actions need none).',
            )
            continue
        for selector_path, selector in selectors(role_access):
            if anonymous:
                issues.add(
                    doc, (*path, *selector_path), 'P030',
                    f'The selector `{selector}` of the anonymous role `{role_id}` matches nothing: '
                    'a user who does not log in matches no selector but `all` (bazis-permit).',
                    'Grant the anonymous role `all`, or remove the grant.',
                )
                continue
            if problem := selector_problem(selector, data['resource'], contract):
                issues.add(
                    doc, (*path, *selector_path), 'P020',
                    f'The selector `{selector}` is not a selector of `{data["resource"]}`: {problem}.',
                    'A selector of bazis-permit is `all`, `self` (on a selector source, such as '
                    'the user), a relation that links the object to the user (`author`, a '
                    'many-to-many field, a reverse relation by its `related_name`) or such a '
                    'relation at the end of a path of relations (`parent__author`); check the '
                    f'names against the `selectors` of the section `permit`, and {EXPORT_HINT}.',
                )
        permit_role = roles.get(role['permit']) if role else None
        if permit_role is None:
            # an unknown role (P004) or permit role (P018) is reported with the role
            continue
        permissions = permit_role['permissions']
        for grant_path, grant in grants(data['resource'], role_access, statusy):
            if not any(grant.covered_by(it) for it in permissions):
                undescribed = walk(grant.selector, data['resource'], contract).undescribed
                if undescribed is None:
                    hint = (
                        f'Add `{grant.slug}` to a permission group of the role '
                        f'`{permit_role["slug"]}` ({DECLARE_ROLES}), migrate, and {EXPORT_HINT}; '
                        'or change the access.'
                    )
                else:
                    # a path through a relation that check cannot see: never copied as it is
                    hint = (
                        f'Check the path of the selector `{grant.selector}` first: `{undescribed}` '
                        'is not in the contract (a relation that the route set does not show, '
                        'or a wrong name), so check cannot tell that it is a relation of the '
                        'model. Once the path is that of the relations of the models (bazis-permit '
                        'refuses another one, permit.E005), grant it in a permission group of the '
                        f'role `{permit_role["slug"]}` ({DECLARE_ROLES}), migrate, and '
                        f'{EXPORT_HINT}; or change the access.'
                    )
                issues.add(
                    doc, (*path, *grant_path), 'P019',
                    f'The permit role `{permit_role["slug"]}` has no permission `{grant.slug}`, '
                    f'which the access of `{role_id}` to `{data["id"]}` grants.',
                    hint,
                )
