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
    and permissions, and the statuses and transits of the tasks. They are those of the specs
    of the sample (`sample/spec/`): the permissions of the roles cover their `access`. The
    command `sample_data` of the sample creates the same for its end-to-end tests.
    """
    from tasks.workflow import create_workflow

    create_workflow()
