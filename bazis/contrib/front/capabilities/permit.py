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
GroupPermission.permissions), the same chain PermitService reads for the current role.
"""

from django.apps import apps


def section() -> dict:
    roles = apps.get_model('permit.Role').objects.prefetch_related('groups_permission__permissions')
    return {
        'roles': [
            {
                'slug': role.slug,
                'name': role.name,
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
