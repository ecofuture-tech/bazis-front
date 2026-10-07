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
The design of a product: the preset of `theme.yaml` with its options, and the tokens of
`tokens.json`. Every token is a CSS variable of the generated theme
(`frontend/src/bazis/generated/theme.css`, `theme.py`): `color.<name>` is `--<name>`, any
other the dotted name with dashes (`radius` is `--radius`, `font.body` is `--font-body`).
A preset requires some tokens (`PRESET_TOKENS`); the other tokens that the components use
have defaults (`DEFAULTS`), mostly derived from the required ones. The tokens of the group
`dark` are the values of the dark mode (`dark.color.background`).
"""

import json
import re
from functools import cache
from importlib.resources import files

from . import color
from .issues import Document, Issues


#: the tokens that every preset requires: {name: type}
BASE_TOKENS = {
    'color.background': 'color',
    'color.foreground': 'color',
    'color.primary': 'color',
    'color.primary-foreground': 'color',
    'color.muted': 'color',
    'color.muted-foreground': 'color',
    'color.border': 'color',
    'color.destructive': 'color',
    'radius': 'dimension',
    'font.body': 'fontFamily',
}

#: the tokens of each preset
PRESET_TOKENS = {
    # the shell of a working application, with the colors of its sidebar
    'workspace': {**BASE_TOKENS, 'color.sidebar': 'color', 'color.sidebar-foreground': 'color'},
    # a public shell, with headings and accents
    'portal': {**BASE_TOKENS, 'color.accent': 'color', 'font.heading': 'fontFamily'},
}

#: the other tokens that the components use, with the value of each when tokens.json does
#: not define it: {name: (type, the value, the value of the dark mode or None for the same)}
DEFAULTS = {
    'color.card': ('color', 'var(--background)', None),
    'color.card-foreground': ('color', 'var(--foreground)', None),
    'color.popover': ('color', 'var(--card)', None),
    'color.popover-foreground': ('color', 'var(--card-foreground)', None),
    'color.secondary': ('color', 'var(--muted)', None),
    'color.secondary-foreground': ('color', 'var(--foreground)', None),
    'color.accent': ('color', 'var(--muted)', None),
    'color.accent-foreground': ('color', 'var(--foreground)', None),
    'color.input': ('color', 'var(--border)', None),
    'color.ring': ('color', 'var(--primary)', None),
    'color.success': ('color', 'oklch(0.52 0.13 152)', 'oklch(0.74 0.14 152)'),
    'color.warning': ('color', 'oklch(0.58 0.13 65)', 'oklch(0.8 0.13 75)'),
    'color.info': ('color', 'oklch(0.52 0.15 245)', 'oklch(0.74 0.12 240)'),
    'color.sidebar': ('color', 'var(--background)', None),
    'color.sidebar-foreground': ('color', 'var(--foreground)', None),
    'color.sidebar-primary': ('color', 'var(--primary)', None),
    'color.sidebar-primary-foreground': ('color', 'var(--primary-foreground)', None),
    'color.sidebar-accent': ('color', 'color-mix(in srgb, var(--primary) 10%, var(--sidebar))', None),
    'color.sidebar-accent-foreground': ('color', 'var(--sidebar-foreground)', None),
    'color.sidebar-border': ('color', 'var(--border)', None),
    'color.sidebar-ring': ('color', 'var(--ring)', None),
    # the series of the charts of shadcn/ui (`npx shadcn add chart`)
    'color.chart-1': ('color', 'var(--primary)', None),
    'color.chart-2': ('color', 'var(--info)', None),
    'color.chart-3': ('color', 'var(--success)', None),
    'color.chart-4': ('color', 'var(--warning)', None),
    'color.chart-5': ('color', 'var(--destructive)', None),
    'font.heading': ('fontFamily', 'var(--font-body)', None),
}

#: the tones of the statuses (`statuses` of theme.yaml) and the variable of the color of each
TONES = {
    'neutral': '--muted-foreground',
    'primary': '--primary',
    'info': '--info',
    'success': '--success',
    'warning': '--warning',
    'danger': '--destructive',
}

#: the colors that the theme derives for each tone: a soft background and the text on it
#: (`bg-<tone>-soft text-<tone>-ink`), mixed so that the text keeps its contrast in both modes
DERIVED = {
    **{f'--{tone}-soft': f'color-mix(in srgb, var({source}) 13%, var(--card))' for tone, source in TONES.items()},
    **{f'--{tone}-ink': f'color-mix(in srgb, var({source}) 72%, var(--foreground))' for tone, source in TONES.items()},
}

#: the text colors and the background each is read on: their contrast is at least AA
CONTRAST = [
    ('--foreground', '--background'),
    ('--card-foreground', '--card'),
    ('--muted-foreground', '--background'),
    ('--muted-foreground', '--card'),
    ('--muted-foreground', '--muted'),
    ('--primary-foreground', '--primary'),
    ('--primary', '--card'),
    ('--accent-foreground', '--accent'),
    ('--sidebar-foreground', '--sidebar'),
    ('--sidebar-accent-foreground', '--sidebar-accent'),
    ('--destructive', '--card'),
    *((f'--{tone}-ink', f'--{tone}-soft') for tone in TONES),
]

#: the group of the tokens of the dark mode
DARK = 'dark'

ALIAS = re.compile(r'^\{(.+)\}$')

#: the generic families of CSS, never quoted
GENERIC_FONTS = {
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
    'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong',
}


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


def known_type(name: str) -> str | None:
    """
    The type of a token that a preset requires or that has a default, None for another.
    """
    for tokens in PRESET_TOKENS.values():
        if name in tokens:
            return tokens[name]
    return DEFAULTS[name][0] if name in DEFAULTS else None


def light_name(name: str) -> str:
    """
    The name of the token that a token of the dark mode overrides (`dark.color.x` is
    `color.x`); the name itself for another.
    """
    return name.removeprefix(f'{DARK}.')


def variable(name: str) -> str:
    """
    The CSS variable of a token: `color.primary` is `--primary`, `font.body` `--font-body`.
    """
    parts = light_name(name).split('.')
    if parts[0] == 'color' and len(parts) > 1:
        parts = parts[1:]
    return '--' + '-'.join(parts)


def font(value: str | list[str]) -> str:
    if isinstance(value, str):
        return value
    return ', '.join(
        it if it in GENERIC_FONTS or not re.search(r'[^\w-]', it) else json.dumps(it) for it in value
    )


def css_value(token: dict) -> str:
    """
    The CSS value of a token: a reference is the variable of the token it references.
    """
    if (target := alias(token)) is not None:
        return f'var({variable(target)})'
    value = token['$value']
    if token['$type'] == 'fontFamily':
        return font(value)
    return str(value)


@cache
def starter(preset: str) -> dict:
    """
    The tokens of the starter of a preset (`spec/starters/design/<preset>/tokens.json`).
    """
    path = files(__package__) / 'starters' / 'design' / preset / 'tokens.json'
    return json.loads(path.read_text(encoding='utf-8'))


def effective_tokens(preset: str, data: dict | None) -> dict[str, tuple[tuple, dict]]:
    """
    The tokens of a product: those of tokens.json, or of the starter of the preset without
    one; a token that the preset requires and tokens.json does not define is that of the
    starter (only without theme.yaml: with it, D005).
    """
    defined = tokens_of(starter(preset) if data is None else data)
    for name, (path, token) in tokens_of(starter(preset)).items():
        if name in PRESET_TOKENS[preset]:
            defined.setdefault(name, (path, token))
    return defined


def has_dark(defined: dict) -> bool:
    return any(name.startswith(f'{DARK}.') for name in defined)


def variables(defined: dict, dark: bool = False) -> dict[str, str]:
    """
    The CSS variables of the tokens in the light mode, or in the dark mode with the tokens of
    `dark` over the others; the defaults for the tokens that are not defined, and the colors
    derived for the tones.
    """
    result = {}
    for name, (_, token) in defined.items():
        if not name.startswith(f'{DARK}.'):
            result[variable(name)] = css_value(token)
    for name, (_, light, night) in DEFAULTS.items():
        result.setdefault(variable(name), night if dark and night is not None else light)
    if dark:
        for name, (_, token) in defined.items():
            if name.startswith(f'{DARK}.'):
                result[variable(name)] = css_value(token)
    return {**result, **DERIVED}


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


def check_dark(tokens: Document, defined: dict, issues: Issues) -> None:
    """
    A token of `dark` overrides a token of the same name and type: one of tokens.json, or one
    that a preset requires or that has a default.
    """
    for name, (path, token) in defined.items():
        if not name.startswith(f'{DARK}.'):
            continue
        light = light_name(name)
        kind = defined[light][1]['$type'] if light in defined else known_type(light)
        if kind != token['$type']:
            issues.add(
                tokens, path, 'D007',
                f'The token `{name}` of the dark mode overrides '
                + (f'`{light}` of type {kind}, not {token["$type"]}.' if kind else f'no token `{light}`.'),
                f'Name a token of the light mode after `{DARK}.` and give it its type.',
            )


def check_statuses(theme: Document, contract: dict | None, issues: Issues) -> None:
    """
    The statuses that `statuses` gives a tone are statuses of the contract (when it has the
    section of bazis-statusy).
    """
    statusy = (contract or {}).get('capabilities', {}).get('statusy')
    if not statusy:
        return
    models = statusy.get('models', {})
    known = {status['id'] for model in models.values() for status in model.get('statuses', [])}
    for status in theme.data.get('statuses', {}):
        if status not in known:
            issues.add(
                theme, ('statuses', status), 'D008',
                f'The status `{status}` is not a status of a statusy model of the contract.',
                'Name the id of a status (`statuses` of a model in the statusy section of '
                'contract/contract.json), or remove it.',
            )


def source(name: str, values: dict[str, str]) -> str:
    """
    The variable that gives a variable its value through its default (`--card-foreground` is
    `var(--foreground)` without a token of its own).
    """
    seen = {name}
    while (match := re.fullmatch(r'var\((--[\w-]+)\)', values.get(name, ''))) and match.group(1) not in seen:
        name = match.group(1)
        seen.add(name)
    return name


def check_contrast(tokens: Document, defined: dict, issues: Issues) -> None:
    """
    The text colors have a contrast of at least 4.5:1 (WCAG AA) on their backgrounds, in the
    light mode and, with tokens of `dark`, in the dark mode; the colors that `color` cannot
    compute are not checked.
    """
    # the colors of a tone are reported at the token of the tone
    owners = {key: TONES[key[2:].rsplit('-', 1)[0]] for key in DERIVED}
    by_variable = {variable(name): path for name, (path, _) in defined.items() if not name.startswith(f'{DARK}.')}
    dark = {variable(name): path for name, (path, _) in defined.items() if name.startswith(f'{DARK}.')}
    for mode in ('light', 'dark') if has_dark(defined) else ('light',):
        values = variables(defined, dark=mode == 'dark')
        for text, background in CONTRAST:
            first, second = color.parse(values[text], values), color.parse(values[background], values)
            if first is None or second is None:
                continue
            ratio = color.contrast(first, second)
            if ratio >= color.AA:
                continue
            candidates = [source(owners.get(text, text), values), source(owners.get(background, background), values)]
            places = [dark, by_variable] if mode == 'dark' else [by_variable]
            path = next((it[name] for name in candidates for it in places if name in it), ())
            issues.add(
                tokens, path, 'D009',
                f'The text color {text} on {background} has a contrast of {ratio:.2f}:1 in the '
                f'{mode} mode, below {color.AA}:1 (WCAG AA).',
                'Make the text darker or lighter than its background (the lightness of oklch()).',
            )


def check(theme: Document | None, tokens: Document | None, contract: dict | None, issues: Issues) -> None:
    defined = tokens_of(tokens.data) if tokens is not None and tokens.valid else None
    if defined is not None:
        check_aliases(tokens, defined, issues)
        check_dark(tokens, defined, issues)
        check_contrast(tokens, defined, issues)
    if theme is not None and theme.valid:
        check_statuses(theme, contract, issues)

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
