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
    and permissions, and the statuses and transits of the tasks, those of the specs of the
    sample (`sample/spec/`). The data migration `tasks.0005_workflow` creates them; a test
    with `transaction=True` flushes the tables, so the fixture runs the function of the
    migration again, with the models of the project (data that exists is kept).
    """
    import importlib

    from django.apps import apps
    from django.contrib.contenttypes.models import ContentType

    from bazis.contrib.statusy.models import StatusyContentType

    # the cached content types of a test before a flush would no longer exist
    ContentType.objects.clear_cache()
    StatusyContentType.objects.clear_cache()
    importlib.import_module('tasks.migrations.0005_workflow').create_workflow(apps)
