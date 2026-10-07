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
requires. Each required token is a CSS variable of `:root` in `src/index.css` of the
template (the variables of shadcn/ui, and `--font-body`, `--font-heading`).
"""

import re

from .issues import Document, Issues


#: the tokens that every preset requires: {name: (type, the CSS variable of the template)}
BASE_TOKENS = {
    'color.background': ('color', '--background'),
    'color.foreground': ('color', '--foreground'),
    'color.primary': ('color', '--primary'),
    'color.primary-foreground': ('color', '--primary-foreground'),
    'color.muted': ('color', '--muted'),
    'color.muted-foreground': ('color', '--muted-foreground'),
    'color.border': ('color', '--border'),
    'color.destructive': ('color', '--destructive'),
    'radius': ('dimension', '--radius'),
    'font.body': ('fontFamily', '--font-body'),
}

#: the tokens of each preset
PRESET_TOKENS = {
    # the shell of a working application, with the colors of its sidebar
    'workspace': {
        **BASE_TOKENS,
        'color.sidebar': ('color', '--sidebar'),
        'color.sidebar-foreground': ('color', '--sidebar-foreground'),
    },
    # a public shell, with headings and accents
    'portal': {
        **BASE_TOKENS,
        'color.accent': ('color', '--accent'),
        'font.heading': ('fontFamily', '--font-heading'),
    },
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


def alias(token: dict) -> str | None:
    """
    The name of the token that a token references (`{group.token}`), or None.
    """
    value = token['$value']
    match = ALIAS.match(value) if isinstance(value, str) else None
    return match.group(1) if match else None


def check_aliases(tokens: Document, defined: dict, issues: Issues) -> None:
    """
    A reference names a defined token of the same type, and no chain of references comes
    back to the token it starts from.
    """
    for name, (path, token) in defined.items():
        target = alias(token)
        if target is None:
            continue
        if target not in defined:
            issues.add(
                tokens, (*path, '$value'), 'D004',
                f'The token `{name}` references the undefined token `{target}`.',
                'Define the token, or reference a defined one.',
            )
            continue
        if defined[target][1]['$type'] != token['$type']:
            issues.add(
                tokens, (*path, '$value'), 'D006',
                f'The token `{name}` ({token["$type"]}) references `{target}` '
                f'({defined[target][1]["$type"]}).',
                'Reference a token of the same type.',
            )
        chain = [name, target]
        while (target := alias(defined[target][1])) in defined and target not in chain:
            chain.append(target)
        if target == name:
            issues.add(
                tokens, (*path, '$value'), 'D004',
                f'The token `{name}` references itself: {" → ".join([*chain, name])}.',
                'Give one of these tokens a value.',
            )


def check(theme: Document | None, tokens: Document | None, issues: Issues) -> None:
    defined = tokens_of(tokens.data) if tokens is not None and tokens.valid else None
    if defined is not None:
        check_aliases(tokens, defined, issues)

    if theme is None or not theme.valid or (tokens is not None and not tokens.valid):
        return
    preset = theme.data['preset']
    for name, (kind, _) in PRESET_TOKENS[preset].items():
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
