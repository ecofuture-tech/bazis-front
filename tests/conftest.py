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

import pytest


@pytest.fixture
def sample_app():
    from sample.main import app

    return app


@pytest.fixture
def workflow(db):
    """
    The data that the contract reads from the database: roles with their permission groups
    and permissions, and the statuses and transits of the tasks (created in an order other than the
    sorted one). They are those of the specs of the sample (`sample/spec/`): the permissions
    of the roles cover their `access`.
    """
    from django.apps import apps

    from bazis.contrib.statusy.models import Status, StatusyContentType, Transit

    group_model = apps.get_model('permit.GroupPermission')
    role_model = apps.get_model('permit.Role')
    permission_model = apps.get_model('permit.Permission')
    permissions = {
        slug: permission_model.objects.create(slug=slug)
        for slug in (
            'tasks.task.item.view.all.all',
            'tasks.task.item.add.all.all',
            'tasks.task.item.change.all.draft',
            'tasks.task.item.transit.all.draft.start',
            'tasks.task.item.transit.all.in_progress.finish',
            # on a statusy model the status follows the selector also for the fields
            'tasks.task.field.view.all.all.report.enable',
            # in no group: no role has it
            'tasks.task.item.delete.all.all',
        )
    }
    group_permissions = {
        'tasks_view': ['tasks.task.item.view.all.all', 'tasks.task.field.view.all.all.report.enable'],
        # shares a permission with tasks_view: the role lists it once
        'tasks_change': [
            'tasks.task.item.view.all.all', 'tasks.task.item.add.all.all',
            'tasks.task.item.change.all.draft',
        ],
        'tasks_transit': [
            'tasks.task.item.transit.all.draft.start',
            'tasks.task.item.transit.all.in_progress.finish',
        ],
    }
    groups = {}
    for slug, slugs in group_permissions.items():
        groups[slug] = group_model.objects.create(slug=slug, name_en=slug.title())
        groups[slug].permissions.add(*(permissions[it] for it in slugs))
    # a role without groups has no permissions
    role_model.objects.create(slug='guest', name_en='Guest')
    viewer = role_model.objects.create(slug='viewer', name_en='Viewer', for_anonymous=True)
    viewer.groups_permission.add(groups['tasks_view'])
    manager = role_model.objects.create(slug='manager', name_en='Manager')
    manager.groups_permission.add(*groups.values())

    statuses = {
        # the initial status may already exist: it is created with the first task
        pk: Status.objects.update_or_create(id=pk, defaults={'name_en': name})[0]
        for pk, name in (('draft', 'Draft'), ('in_progress', 'In progress'), ('done', 'Done'))
    }
    model = StatusyContentType.objects.get_for_model(apps.get_model('tasks.Task'))
    Transit.objects.create(
        id='start', name_en='Start', model=model,
        status_src=statuses['draft'], status_dst=statuses['in_progress'],
    )
    Transit.objects.create(
        id='finish', name_en='Finish', model=model,
        status_src=statuses['in_progress'], status_dst=statuses['done'],
        actions_before=['before_finish'],
    )
