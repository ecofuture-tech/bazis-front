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
The design of a product: the preset of `theme.yaml` and the tokens of `tokens.json` that it
requires. The names of the tokens follow the CSS variables of shadcn/ui in the template
(`color.primary` is `--primary`, `radius.md` is `--radius`).
"""

import re

from .issues import Document, Issues


#: the tokens that every preset requires, with their type
BASE_TOKENS = {
    'color.background': 'color',
    'color.foreground': 'color',
    'color.primary': 'color',
    'color.primary-foreground': 'color',
    'color.muted': 'color',
    'color.muted-foreground': 'color',
    'color.border': 'color',
    'color.destructive': 'color',
    'radius.md': 'dimension',
    'font.body': 'fontFamily',
}

#: the tokens of each preset
PRESET_TOKENS = {
    # the shell of a working application, with the colors of its sidebar
    'workspace': {**BASE_TOKENS, 'color.sidebar': 'color', 'color.sidebar-foreground': 'color'},
    # a public shell, with headings and accents
    'portal': {**BASE_TOKENS, 'color.accent': 'color', 'font.heading': 'fontFamily'},
}

ALIAS = re.compile(r'^\{(.+)\}$')


def tokens_of(data: dict, path: tuple = ()) -> dict[str, tuple[tuple, dict]]:
    """
    The tokens of a valid tokens.json by their dotted name, with their paths.
    """
    result = {}
    for key, value in data.items():
        if key.startswith('$'):
            continue
        if '$value' in value:
            result['.'.join((*path, key))] = ((*path, key), value)
        else:
            result.update(tokens_of(value, (*path, key)))
    return result


def check(theme: Document | None, tokens: Document | None, issues: Issues) -> None:
    defined = tokens_of(tokens.data) if tokens is not None and tokens.valid else None
    if defined is not None:
        for name, (path, token) in defined.items():
            value = token['$value']
            match = ALIAS.match(value) if isinstance(value, str) else None
            if match and match.group(1) not in defined:
                issues.add(
                    tokens, (*path, '$value'), 'D004',
                    f'The token `{name}` references the undefined token `{match.group(1)}`.',
                    'Define the token, or reference a defined one.',
                )

    if theme is None or not theme.valid or (tokens is not None and not tokens.valid):
        return
    preset = theme.data['preset']
    for name, kind in PRESET_TOKENS[preset].items():
        if defined is None or name not in defined:
            issues.add(
                theme, ('preset',), 'D005',
                f'The preset `{preset}` requires the token `{name}` ({kind}), which '
                'spec/design/tokens.json does not define.',
                f'Define `{name}` with `$type: {kind}` in spec/design/tokens.json.',
            )
        elif defined[name][1]['$type'] != kind:
            path, token = defined[name]
            issues.add(
                tokens, (*path, '$type'), 'D005',
                f'The preset `{preset}` requires the token `{name}` of type {kind}, not '
                f'{token["$type"]}.',
                f'Give `{name}` the type {kind}.',
            )
