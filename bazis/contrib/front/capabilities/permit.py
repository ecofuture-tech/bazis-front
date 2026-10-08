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
bazis-permit: the roles with their permission groups and their effective permissions, from
the database. A role has permissions only through its groups (Role.groups_permission ->
GroupPermission.permissions), the same chain PermitService reads for the current role. The
name of a role is in every language of the project (a translated field). The selectors of
the permission models, by their JSON:API type, are those bazis-permit resolves.
"""

from django.apps import apps

from bazis.contrib.permit.models_abstract import PermitModelMixin, PermitSelectorMixin
from bazis.contrib.permit.schemas import PERM_SELF

from . import translated


def section() -> dict:
    roles = apps.get_model('permit.Role').objects.prefetch_related('groups_permission__permissions')
    return {
        'selectors': selectors(),
        'roles': [
            {
                'slug': role.slug,
                'name': translated(lambda role=role: role.name),
                'for_anonymous': role.for_anonymous,
                'groups': sorted(group.slug for group in role.groups_permission.all()),
                'permissions': sorted(
                    {
                        permission.slug
                        for group in role.groups_permission.all()
                        for permission in group.permissions.all()
                    }
                ),
            }
            for role in roles.order_by('slug')
        ],
    }


def selectors() -> dict[str, dict[str, str]]:
    """
    `{type: {selector: type of its source}}` of every permission model: the selectors of
    `get_selector_fields` (its relations to a selector source: a foreign key, a many-to-many
    field, a reverse relation by its accessor, whether the route shows them or not), and
    `self` when the model is a selector source itself, as `get_selector_model` resolves the
    last name of a selector.
    """
    result = {}
    for model in apps.get_models():
        if not issubclass(model, PermitModelMixin):
            continue
        names = {
            name: field.model.get_resource_label()
            for name, field in model.get_selector_fields().items()
        }
        if issubclass(model, PermitSelectorMixin):
            names[PERM_SELF] = model.get_resource_label()
        result[model.get_resource_label()] = dict(sorted(names.items()))
    return dict(sorted(result.items()))

