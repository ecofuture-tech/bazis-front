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
The layout of the guide (`bazis/contrib/front/AGENTS.md`) that bazis-mcp serves section by
section: its handwritten sections fit in one retrieval, and the names of sections that the
introduction and the template `AGENTS.md` refer to are its `## ` headings.
"""

import json
import re
from pathlib import Path

import pytest


FRONT = Path(__file__).resolve().parent.parent / 'bazis' / 'contrib' / 'front'
GUIDE = (FRONT / 'AGENTS.md').read_text(encoding='utf-8')
TEMPLATE = (FRONT / 'assets' / 'template' / 'AGENTS.md').read_text(encoding='utf-8')

#: `GUIDE_LIMIT` of bazis-mcp (`bazis.contrib.mcp.catalog`): the most bytes of the JSON
#: string of a section that `package_guide` returns whole; a longer one is cut into parts
GUIDE_LIMIT = 30_000
#: the generated end of the guide (`scripts/gen_api_reference.mjs`), cut by bazis-mcp
#: into parts as needed
API = 'API: '


def split(text: str) -> tuple[str, dict[str, str]]:
    """The introduction and the `## ` sections by title, as bazis-mcp splits a guide."""
    introduction, found, title, fenced = '', {}, None, False
    for line in text.splitlines(keepends=True):
        if line.startswith('```'):
            fenced = not fenced
        elif not fenced and line.startswith('## '):
            title = line[3:].strip()
            found[title] = ''
        if title is None:
            introduction += line
        else:
            found[title] += line
    return introduction, found


INTRODUCTION, SECTIONS = split(GUIDE)
HANDWRITTEN = [title for title in SECTIONS if not title.startswith(API)]


def subsection(text: str, heading: str) -> str:
    """The text of a `### ` subsection, up to the next heading."""
    match = re.search(rf'^### {re.escape(heading)}\n(.*?)(?=^#|\Z)', text, re.M | re.S)
    assert match, heading
    return match.group(1)


def without_code(text: str) -> str:
    return re.sub(r'`[^`\n]*`', '', text)


def test_handwritten_sections_precede_the_api_reference():
    assert HANDWRITTEN
    assert list(SECTIONS)[: len(HANDWRITTEN)] == HANDWRITTEN


@pytest.mark.parametrize('title', HANDWRITTEN)
def test_handwritten_section_fits_in_one_retrieval(title):
    size = len(json.dumps(SECTIONS[title], ensure_ascii=False).encode('utf-8')) - 2
    assert size <= GUIDE_LIMIT, f'"{title}": {size} bytes of JSON, over {GUIDE_LIMIT}: split it'


def test_steps_name_existing_sections():
    steps = without_code(subsection(INTRODUCTION, 'Building the frontend of a product'))
    named = {' '.join(it.split()) for it in re.findall(r'"([^"]+)"', steps)}
    assert named
    assert named <= set(HANDWRITTEN), named - set(HANDWRITTEN)


def test_map_lists_every_section():
    rows = re.findall(r'^\| ([^|]+?) \|', subsection(INTRODUCTION, 'The sections'), re.M)
    named = [it for it in rows if it != 'Section']
    assert named[-1] == '`API: …` (generated)'
    assert named[:-1] == HANDWRITTEN


def test_template_names_existing_sections():
    cells = re.findall(r'^\| .+? \| (.+?) \|$', TEMPLATE, re.M)[1:]
    assert cells
    named = {it.strip() for cell in cells for it in cell.split(';')}
    assert 'the `API:` sections' in named
    assert any(title.startswith(API) for title in SECTIONS)
    named.discard('the `API:` sections')
    assert named <= set(HANDWRITTEN), named - set(HANDWRITTEN)
