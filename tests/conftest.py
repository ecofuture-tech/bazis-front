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

import shutil
from io import StringIO

from django.core.management import call_command
from django.test import override_settings

import pytest

from .support import SAMPLE_SPEC, copy_custom_screens, write_contract


@pytest.fixture
def sample_app():
    from sample.main import app

    return app


@pytest.fixture
def product(tmp_path):
    """
    A product with a frontend made by `init` (with bazis-statusy) and a contract that has
    the capabilities `users` and `permit`.
    """
    with override_settings(BASE_DIR=str(tmp_path)):
        call_command('bazis_front', 'init', '--no-node', stdout=StringIO())
        write_contract(tmp_path, 'permit', 'users')
        yield tmp_path


@pytest.fixture
def root(tmp_path):
    """
    A product root with the specs of the sample and a frontend made by `init`, with the code
    of the custom screens of the sample; its screens are not generated (`init` refuses the
    specs before that code is there).
    """
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    with override_settings(BASE_DIR=str(tmp_path)):
        call_command('bazis_front', 'init', '--no-node', stdout=StringIO(), stderr=StringIO())
        copy_custom_screens(tmp_path)
        yield tmp_path

