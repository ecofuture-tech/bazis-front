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

import json
import shutil
import subprocess
import sys
from pathlib import Path

from django.test import override_settings

import pytest

from bazis.contrib.front.spec.lint import lint, main
from bazis.contrib.front.spec.validate import validate

from .support import SAMPLE_SPEC


LIST, PRODUCT = 'spec/screens/task-list.yaml', 'spec/product.yaml'


@pytest.fixture
def root(tmp_path):
    """A product root with the specs of the sample only: the lint reads one file, nothing else."""
    shutil.copytree(SAMPLE_SPEC, tmp_path / 'spec')
    return tmp_path


def replace(root: Path, name: str, old: str, new: str) -> None:
    path = root / name
    text = path.read_text(encoding='utf-8')
    assert old in text
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def found(issues) -> list[tuple]:
    return [(it.code, it.location, it.message, it.hint) for it in issues]


@pytest.mark.parametrize(('name', 'old', 'new', 'code'), [
    # a `?` that starts a value, a `: ` in a plain text, a comma of a flow mapping in a text
    (LIST, 'title: {en: Tasks', 'title: {en: ? Tasks', 'S001'),
    (LIST, 'title: {en: Tasks', 'title: {en: Tasks: all', 'S001'),
    (PRODUCT, "summary: The tasks of a team, started and finished with a report",
     "name: {en: Tasks, ru: Задачи, the tasks of the team}", 'P002'),
    # a key that the mapping does not take, and a value of another type
    (LIST, 'primitive: list', 'primitive: list\ncolor: red', 'S002'),
    (PRODUCT, 'languages: [en, ru]', 'languages: en', 'P002'),
])
def test_the_lint_of_a_file_is_the_check_of_its_shape(root, name, old, new, code):
    """
    The lint of a file reports its YAML and its shape as `check` does (the same codes,
    locations, messages and hints), and nothing else of it.
    """
    replace(root, name, old, new)
    linted = found(lint(root / name).items)
    assert {it[0] for it in linted} == {code}
    with override_settings(BASE_DIR=str(root)):
        checked = [it for it in found(validate(root).issues) if it[1].split('#')[0] == name]
    assert linted == [it for it in checked if it[0] == code]


def test_a_valid_file_and_a_file_that_is_not_of_the_specs(root, tmp_path, capsys):
    assert lint(root / LIST).items == []
    assert main([str(root / LIST)]) == 0
    assert capsys.readouterr().out == '0 errors.\n'
    other = tmp_path / 'notes.yaml'
    other.write_text('a: b\n', encoding='utf-8')
    assert lint(other) is None
    with pytest.raises(SystemExit):
        main([str(other)])


def test_the_output_of_the_lint(root, capsys):
    """Its JSON is that of `check --json` without a contract; an error exits 1."""
    replace(root, LIST, 'primitive: list', 'primitive: list\ncolor: red')
    assert main([str(root / LIST), '--json']) == 1
    result = json.loads(capsys.readouterr().out)
    assert {key: result[key] for key in ('contract', 'errors', 'warnings')} == {'contract': False, 'errors': 1, 'warnings': 0}
    assert [(it['code'], it['file'], it['path']) for it in result['issues']] == [('S002', LIST, '')]
    assert main([str(root / LIST)]) == 1
    assert capsys.readouterr().out.startswith(f'{LIST}: S002 error: ')


def test_the_lint_imports_neither_django_nor_the_core(root):
    """It runs as a file is written, in a fresh interpreter, without the settings of a project."""
    code = (
        'import sys\n'
        'from bazis.contrib.front.spec.lint import main\n'
        f'status = main([{str(root / LIST)!r}])\n'
        "loaded = sorted(it for it in sys.modules if it.split('.')[0] == 'django' or it.startswith('bazis.core'))\n"
        'print(loaded, status)\n'
    )
    run = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, check=True, env={})
    assert run.stdout.splitlines()[-1] == '[] 0'
