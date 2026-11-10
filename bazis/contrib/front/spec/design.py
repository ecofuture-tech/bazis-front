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
The design of a product: the preset of `theme.yaml` with its options, and the tokens. Every
token is a CSS variable of the generated theme (`frontend/src/bazis/generated/theme.css`,
`theme.py`): `color.<name>` is `--<name>`, any other the dotted name with dashes (`radius`
is `--radius`, `font.body` is `--font-body`, `shadow.md` is `--shadow-md`).

The tokens are layers, from the lowest: those of the preset, then those of the starters
that theme.yaml names (`palette`, `fonts`, `shape`, `surface`: `spec/starters/design/
<directory>/<name>.json` of the package, in the format of tokens.json), then
`spec/design/tokens.json`; a token of a higher layer replaces that of a lower one. A preset
requires some tokens (`PRESET_TOKENS`); the other tokens that the components use have
defaults (`DEFAULTS`), mostly derived from the required ones, which keep the look of a
design that names no layer. The tokens of the group `dark` are the values of the dark mode
(`dark.color.background`).
"""

import json
import re
from functools import cache
from importlib.resources import files
from pathlib import Path
from typing import NamedTuple

from . import color, fonts
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

#: the options of each preset, when theme.yaml does not give them
PRESETS = {
    'workspace': {
        'navigation': 'sidebar',
        'density': 'comfortable',
        'composition': {'list': 'table', 'list_phone': 'cards', 'list_card': 'split', 'forms': 'dialog'},
    },
    'portal': {
        'navigation': 'topbar',
        'density': 'comfortable',
        'composition': {'list': 'cards', 'list_phone': 'cards', 'list_card': 'pages', 'forms': 'page'},
    },
}

#: the controls of the forms by default, whatever the preset (`controls` of theme.yaml)
CONTROLS = {'date': 'localized'}


def options(theme: dict | None) -> dict:
    """
    The options of theme.yaml with the defaults of its preset (`workspace` without one).
    """
    theme = theme or {'preset': 'workspace'}
    preset = theme['preset']
    defaults = PRESETS[preset]
    return {
        'preset': preset,
        'navigation': theme.get('navigation', defaults['navigation']),
        'density': theme.get('density', defaults['density']),
        'composition': {**defaults['composition'], **theme.get('composition', {})},
        'controls': {**CONTROLS, **theme.get('controls', {})},
        'statuses': dict(theme.get('statuses', {})),
        'icons': dict(theme.get('icons', {})),
        'brand': theme.get('brand'),
    }


#: the other tokens that the components use, with the value of each when no layer defines
#: it: {name: (type, the value, the value of the dark mode or None for the same)}
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
    # the muted text inside the sidebar, which takes the variables of the sidebar
    # (`[data-slot='sidebar']` of the theme): that of the content until a palette darkens the
    # sidebar
    'color.sidebar-muted-foreground': ('color', 'var(--muted-foreground)', None),
    # the bottom of the gradient of the sidebar and the glow of its top: a plain sidebar until a
    # layer defines one of them (`[data-slot='sidebar']` of the theme)
    'color.sidebar-to': ('color', 'var(--sidebar)', None),
    'color.sidebar-glow': ('color', 'transparent', None),
    # the current link of the sidebar: its background and the bar at its start (none before the
    # tokens); its shadow is `shadow.nav-active`
    'color.nav-active': ('color', 'var(--sidebar-accent)', None),
    'color.nav-active-bar': ('color', 'transparent', None),
    # the glow of the paper (`body::before` of the theme, once a layer defines one of them)
    'color.glow-a': ('color', 'transparent', None),
    'color.glow-b': ('color', 'transparent', None),
    # the color of the shadows of the lifted surfaces
    'color.shade': ('color', 'var(--foreground)', None),
    # the top of the gradient of a surface (`--surface-card`, `--surface-control`): the card, a
    # plain surface
    'color.surface-light': ('color', 'var(--card)', None),
    # the borders of the surfaces (cards, tables, menus, dialogs) and of the controls (outline
    # buttons, chips), the background of the controls at rest and under the pointer: those of the
    # components before the tokens: an outline button of shadcn/ui, translucent on the input in
    # the dark mode (`dark:bg-input/30 dark:border-input dark:hover:bg-input/50`)
    'color.border-surface': ('color', 'var(--border)', None),
    'color.border-control': ('color', 'var(--border)', 'var(--input)'),
    'color.control': ('color', 'var(--background)', 'color-mix(in srgb, var(--input) 30%, transparent)'),
    'color.control-hover': ('color', 'var(--accent)', 'color-mix(in srgb, var(--input) 50%, transparent)'),
    # the bottom line of a field at rest, under the pointer and focused (`shadow.field-focus` the
    # shadow of the focus): a cold grey pencil line of the muted text, about 2.7:1 on the card at
    # rest in the light mode (3.6:1 in the dark one; the input of shadcn/ui was too pale for a line,
    # the foreground too black), about 4.7:1 under the pointer; the ring of the fields before the
    # tokens when focused
    'color.field-line': ('color', 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)', None),
    'color.field-line-hover': ('color', 'color-mix(in srgb, var(--muted-foreground) 85%, transparent)', None),
    'color.field-line-focus': ('color', 'var(--ring)', None),
    # the accent of the brand: its mark, the eyebrow of a card; never a button or a badge
    'color.brand': ('color', 'var(--primary)', None),
    'color.brand-foreground': ('color', 'var(--primary-foreground)', None),
    # the series of the charts of shadcn/ui (`npx shadcn add chart`)
    'color.chart-1': ('color', 'var(--primary)', None),
    'color.chart-2': ('color', 'var(--info)', None),
    'color.chart-3': ('color', 'var(--success)', None),
    'color.chart-4': ('color', 'var(--warning)', None),
    'color.chart-5': ('color', 'var(--destructive)', None),
    'color.chart-6': ('color', 'var(--muted-foreground)', None),
    'font.heading': ('fontFamily', 'var(--font-body)', None),
    # the weight and the tracking of the headings, the figures and the titles of the components
    # (`font-heading`), and of the headings of their sections (`font-subheading`): those of the
    # components before the tokens, `font-semibold tracking-tight`
    'font.weight-heading': ('fontWeight', '600', None),
    'font.weight-subheading': ('fontWeight', '600', None),
    'font.tracking-heading': ('dimension', '-0.025em', None),
    # the monospace fonts, the shadows and the transitions of Tailwind, which a design without
    # the layers keeps
    'font.mono': (
        'fontFamily', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        None,
    ),
    'shadow.xs': ('shadow', '0 1px 2px 0 rgb(0 0 0 / 0.05)', None),
    'shadow.sm': ('shadow', '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', None),
    'shadow.md': ('shadow', '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', None),
    'shadow.lg': ('shadow', '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', None),
    # the heights of the lifted elements: the controls at rest, under the pointer and pressed,
    # the surfaces (cards), the menus and the dialogs, the primary button, the focus ring and the
    # focus of a field; those of the components before the tokens
    'shadow.lift-05': ('shadow', 'var(--shadow-xs)', None),
    'shadow.lift-05-hover': ('shadow', 'var(--shadow-sm)', None),
    'shadow.lift-05-active': ('shadow', 'var(--shadow-xs)', None),
    'shadow.lift-1': ('shadow', 'var(--shadow-xs)', None),
    'shadow.lift-2': ('shadow', 'var(--shadow-md)', None),
    'shadow.lift-primary': ('shadow', '0 0 #0000', None),
    'shadow.lift-primary-hover': ('shadow', '0 0 #0000', None),
    'shadow.lift-primary-active': ('shadow', '0 0 #0000', None),
    'shadow.ring-focus': ('shadow', '0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent)', None),
    'shadow.field-focus': ('shadow', '0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent)', None),
    'shadow.nav-active': ('shadow', '0 0 #0000', None),
    'motion.fast': ('duration', '100ms', None),
    'motion.base': ('duration', '150ms', None),
    'motion.slow': ('duration', '300ms', None),
    'motion.ease': ('cubicBezier', 'cubic-bezier(0.4, 0, 0.2, 1)', None),
}

#: the layers of the starters that theme.yaml names, from the lowest, and the directory of
#: their files in `spec/starters/design/`; the tokens of the preset are below them
LAYERS = {'palette': 'palettes', 'fonts': 'fonts', 'shape': 'shapes', 'surface': 'surfaces'}
PRESET_LAYER = 'presets'

#: the layers of a design without theme.yaml: the starter of the preset workspace before
#: the layers
WITHOUT_THEME = {'palette': 'indigo', 'fonts': 'system', 'shape': 'soft'}

#: the key of the extensions of a token (`$extensions`) that bazis-front reads: the CSS
#: import of a font (`{"import": "@fontsource-variable/inter"}`)
EXTENSION = 'bazis'

#: the stylesheet of a font of Google Fonts (`fonts: {google: <family>}`)
GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?family={family}&display=swap'

#: the tones of the statuses (`statuses` of theme.yaml) and the variable of the color of each
TONES = {
    'neutral': '--muted-foreground',
    'primary': '--primary',
    'info': '--info',
    'success': '--success',
    'warning': '--warning',
    'danger': '--destructive',
}

#: the tints of the avatars of the initials (`bg-avatar-<n> text-avatar-<n>-fg`), the variable
#: of each and the parts of it in its background (over the card) and in its text (over the
#: foreground); the last one's text is the foreground at 72 % over its background. Colors of the
#: content, checked on it: never inside the sidebar, where the tones of the content stay and
#: its foreground and card are those of the sidebar (the user there has `bg-sidebar-primary`)
AVATARS = (('--primary', 16, 80), ('--brand', 20, 55), ('--info', 16, 70), ('--success', 16, 65), ('--muted-foreground', 18, None))


def avatar(source: str, background: int, text: int | None) -> tuple[str, str]:
    tint = f'color-mix(in oklab, var({source}) {background}%, var(--card))'
    if text is None:
        return tint, f'color-mix(in srgb, var(--foreground) 72%, {tint})'
    return tint, f'color-mix(in oklab, var({source}) {text}%, var(--foreground))'


#: the colors that the theme derives, each with the variable it derives from (where D009 reports
#: it): for each tone a soft background and the text on it (`bg-<tone>-soft text-<tone>-ink`),
#: mixed so that the text keeps its contrast in both modes; the avatars; the lines between the
#: rows of a surface (`border-line-6`, `line-10`; the bottom of the header of a table `line-16`).
#: They are colors of the Tailwind theme, computed where they are used (inside the sidebar from
#: its colors)
DERIVED_FROM = {
    **{f'--{tone}-soft': (f'color-mix(in srgb, var({source}) 13%, var(--card))', source) for tone, source in TONES.items()},
    **{f'--{tone}-ink': (f'color-mix(in srgb, var({source}) 72%, var(--foreground))', source) for tone, source in TONES.items()},
    **{
        name: (value, source)
        for number, (source, background, text) in enumerate(AVATARS)
        for name, value in zip((f'--avatar-{number}', f'--avatar-{number}-fg'), avatar(source, background, text), strict=True)
    },
    **{f'--line-{part}': (f'color-mix(in srgb, var(--foreground) {part}%, transparent)', '--foreground') for part in (6, 10, 16)},
}
DERIVED = {name: value for name, (value, _) in DERIVED_FROM.items()}

#: the background images of the surfaces (`bg-card bg-(image:--surface-card)`) and of the
#: controls (over `bg-control`), variables of `:root`: gradients from `color.surface-light` to
#: the card and to the control once a layer defines one of `SURFACE_TOKENS`; without such a layer
#: the surfaces are flat (the look of 0.12)
SURFACES = {
    '--surface-card': 'linear-gradient(170deg, var(--surface-light) 0%, var(--card) 55%)',
    '--surface-control': 'linear-gradient(180deg, var(--surface-light) 0%, var(--control) 100%)',
}
SURFACES_FLAT = {'--surface-card': 'none', '--surface-control': 'none'}
SURFACE_TOKENS = ('color.surface-light',)

#: the text colors and the background each is read on: their contrast is at least AA; a text
#: color that a component makes translucent (`text-sidebar-foreground/80`) has its opacity, the
#: color over its background as the browser draws it (`tests/test_design.py` finds them)
CONTRAST: list[tuple[str, str] | tuple[str, str, float]] = [
    ('--foreground', '--background'),
    ('--card-foreground', '--card'),
    ('--muted-foreground', '--background'),
    ('--muted-foreground', '--card'),
    ('--muted-foreground', '--muted'),
    ('--primary-foreground', '--primary'),
    ('--primary', '--card'),
    ('--accent-foreground', '--accent'),
    ('--sidebar-foreground', '--sidebar'),
    ('--sidebar-foreground', '--sidebar', 0.8),
    ('--sidebar-accent-foreground', '--sidebar-accent'),
    ('--sidebar-accent-foreground', '--nav-active'),
    ('--sidebar-muted-foreground', '--sidebar'),
    # the detail of the user on his plate, which has the fill of the current link
    ('--sidebar-muted-foreground', '--nav-active'),
    ('--sidebar-primary-foreground', '--sidebar-primary'),
    ('--brand-foreground', '--brand'),
    ('--brand', '--card'),
    ('--destructive', '--card'),
    ('--foreground', '--control'),
    ('--muted-foreground', '--control'),
    # the header and the cells of a table
    ('--foreground', '--card', 0.75),
    ('--foreground', '--card', 0.8),
    *((f'--{tone}-ink', f'--{tone}-soft') for tone in TONES),
    *((f'--avatar-{number}-fg', f'--avatar-{number}') for number in range(len(AVATARS))),
]

#: the variables of the content that the sidebar replaces with its own inside it (the buttons,
#: the toggles, the focus rings, the borders and the muted text of the components there)
SIDEBAR = {
    '--foreground': 'var(--sidebar-foreground)',
    '--muted-foreground': 'var(--sidebar-muted-foreground)',
    '--border': 'var(--sidebar-border)',
    '--input': 'var(--sidebar-border)',
    '--accent': 'var(--sidebar-accent)',
    '--accent-foreground': 'var(--sidebar-accent-foreground)',
    '--primary': 'var(--sidebar-primary)',
    '--primary-foreground': 'var(--sidebar-primary-foreground)',
    '--ring': 'var(--sidebar-ring)',
    # the surfaces of the sidebar: a control or a card inside it rests on the sidebar, its light
    # on the accent
    '--background': 'var(--sidebar)',
    '--card': 'var(--sidebar)',
    '--card-foreground': 'var(--sidebar-foreground)',
    '--surface-light': 'var(--sidebar-accent)',
}
#: the tokens of the surfaces, the fields and the primary lift are expressions of the role colors:
#: declared again inside the sidebar, they are computed on the colors of the sidebar (`SIDEBAR`),
#: the value of a layer and the default alike (a `var()` of `:root` is computed there and
#: inherited computed); a literal of a layer stays the same everywhere. `color.shade` is not one
#: of them: the shadows inside the sidebar keep the dark tone of the content
SIDEBAR_FOLLOWS = (
    'color.border-surface', 'color.border-control', 'color.control', 'color.control-hover',
    'color.field-line', 'color.field-line-hover', 'color.field-line-focus',
    'shadow.ring-focus', 'shadow.field-focus',
    'shadow.lift-primary', 'shadow.lift-primary-hover', 'shadow.lift-primary-active',
)
#: the colors read inside the sidebar, computed there (`sidebar_scope`), with their minimum
#: contrast: its text on a control at rest and under the pointer, the focused line of a field (a
#: line, not a text: 3:1)
SIDEBAR_CONTRAST = [
    ('--sidebar-foreground', '--control', color.AA),
    ('--sidebar-foreground', '--control-hover', color.AA),
    ('--field-line-focus', '--sidebar', 3.0),
]

#: the group of the tokens of the dark mode
DARK = 'dark'

ALIAS = re.compile(r'^\{(.+)\}$')

#: the generic families of CSS, never quoted
GENERIC_FONTS = {
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
    'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong',
}


class Entry(NamedTuple):
    """
    A token: its path in its file, the token, and the layer of theme.yaml that gives it
    (`palette`, `fonts`, `shape`, `surface`, `preset`), None for one of tokens.json.
    """

    path: tuple
    token: dict
    layer: str | None = None


def tokens_of(data: dict, layer: str | None = None, path: tuple = ()) -> dict[str, Entry]:
    """
    The tokens of a valid tokens.json (or of a layer) by their dotted name.
    """
    result = {}
    for key, value in data.items():
        if key.startswith('$'):
            continue
        if '$value' in value:
            result['.'.join((*path, key))] = Entry((*path, key), value, layer)
        else:
            result.update(tokens_of(value, layer, (*path, key)))
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
def layer(directory: str, name: str) -> dict:
    """
    The tokens of a starter of a layer (`spec/starters/design/<directory>/<name>.json`).
    """
    path = files(__package__) / 'starters' / 'design' / directory / f'{name}.json'
    return json.loads(path.read_text(encoding='utf-8'))


def google(family: str) -> dict:
    """
    The tokens of the fonts of a family of Google Fonts (`Inter:wght@400..700`): the text and
    the headings in it, over the system fonts, with the import of its stylesheet.
    """
    url = GOOGLE_FONTS.format(family=family.replace(' ', '+'))
    stack = layer(LAYERS['fonts'], 'system')['font']['body']['$value']
    return {'font': {
        'body': {
            '$type': 'fontFamily', '$value': [family.split(':', 1)[0], *stack],
            '$extensions': {EXTENSION: {'import': url}},
        },
        'heading': {'$type': 'fontFamily', '$value': '{font.body}'},
    }}


def named_layer(kind: str, name: str | dict) -> dict:
    """
    The tokens of the layer that theme.yaml names: a starter, or a family of Google Fonts.
    """
    return google(name['google']) if isinstance(name, dict) else layer(LAYERS[kind], name)


def effective_tokens(theme: dict | None, tokens: dict | None) -> dict[str, Entry]:
    """
    The tokens of a product, its layers merged: those of the preset, of the starters that
    theme.yaml names and of tokens.json. Without theme.yaml the layers are those of the
    starter of the preset workspace (`WITHOUT_THEME`), and with tokens.json they give only
    the tokens that the preset requires and tokens.json does not define (with theme.yaml,
    such a token is D005).
    """
    named = theme or {'preset': 'workspace', **WITHOUT_THEME}
    layered = tokens_of(layer(PRESET_LAYER, named['preset']), 'preset')
    for kind in LAYERS:
        if (name := named.get(kind)) is not None:
            layered.update(tokens_of(named_layer(kind, name), kind))
    if tokens is None:
        return layered
    defined = tokens_of(tokens)
    if theme is not None:
        return {**layered, **defined}
    required = PRESET_TOKENS[named['preset']]
    return {**defined, **{name: it for name, it in layered.items() if name in required and name not in defined}}


def imports(defined: dict[str, Entry]) -> list[str]:
    """
    The imports of the fonts of the tokens (`$extensions`: `{"bazis": {"import": ...}}` of a
    fontFamily token: an npm package of the font, or the URL of a stylesheet), each once.
    """
    found = []
    for entry in defined.values():
        if entry.token['$type'] == 'fontFamily':
            source = entry.token.get('$extensions', {}).get(EXTENSION, {}).get('import')
            if source is not None and source not in found:
                found.append(source)
    return found


def has_dark(defined: dict) -> bool:
    return any(name.startswith(f'{DARK}.') for name in defined)


def modes(theme: dict | None, defined: dict[str, Entry]) -> tuple[str, ...]:
    """
    The color modes of the theme: light and dark with the tokens of `dark` and `mode: both`
    (the default; light only without them), or the one mode of `mode: light` or `dark`.
    """
    mode = (theme or {}).get('mode', 'both')
    if mode != 'both':
        return (mode,)
    return ('light', DARK) if has_dark(defined) else ('light',)


def variables(defined: dict[str, Entry], dark: bool = False) -> dict[str, str]:
    """
    The CSS variables of the tokens in the light mode, or in the dark mode with the tokens of
    `dark` over the others; the defaults for the tokens that are not defined, and the colors
    derived for the tones.
    """
    result = {}
    for name, entry in defined.items():
        if not name.startswith(f'{DARK}.'):
            result[variable(name)] = css_value(entry.token)
    for name, (_, light, night) in DEFAULTS.items():
        result.setdefault(variable(name), night if dark and night is not None else light)
    if dark:
        for name, entry in defined.items():
            if name.startswith(f'{DARK}.'):
                result[variable(name)] = css_value(entry.token)
    return {**result, **DERIVED}


def place(theme: Document | None, tokens: Document | None, entry: Entry, path: tuple = ()) -> tuple[Document, tuple]:
    """
    Where an issue of a token is reported: at the token in tokens.json, or at the layer of
    theme.yaml that gives it (at the root of tokens.json for a layer of a design without
    theme.yaml).
    """
    if entry.layer is None:
        return tokens, (*entry.path, *path)
    return (theme, (entry.layer,)) if theme is not None else (tokens, ())


def check_aliases(theme: Document | None, tokens: Document | None, defined: dict[str, Entry], issues: Issues) -> None:
    """
    A reference names a defined token of the same type, and no chain of references comes
    back to the token it starts from.
    """
    for name, entry in defined.items():
        target = alias(entry.token)
        if target is None:
            continue
        where = place(theme, tokens, entry, ('$value',))
        if target not in defined:
            issues.add(
                *where, 'D004',
                f'The token `{name}` references the undefined token `{target}`.',
                'Define the token, or reference a defined one.',
            )
            continue
        if defined[target].token['$type'] != entry.token['$type']:
            issues.add(
                *where, 'D006',
                f'The token `{name}` ({entry.token["$type"]}) references `{target}` '
                f'({defined[target].token["$type"]}).',
                'Reference a token of the same type.',
            )
        chain = [name, target]
        while (target := alias(defined[target].token)) in defined and target not in chain:
            chain.append(target)
        if target == name:
            issues.add(
                *where, 'D004',
                f'The token `{name}` references itself: {" → ".join([*chain, name])}.',
                'Give one of these tokens a value.',
            )


def check_dark(theme: Document | None, tokens: Document | None, defined: dict[str, Entry], issues: Issues) -> None:
    """
    A token of `dark` overrides a token of the same name and type: one of the layers or of
    tokens.json, or one that a preset requires or that has a default.
    """
    for name, entry in defined.items():
        if not name.startswith(f'{DARK}.'):
            continue
        light = light_name(name)
        kind = defined[light].token['$type'] if light in defined else known_type(light)
        if kind != entry.token['$type']:
            issues.add(
                *place(theme, tokens, entry), 'D007',
                f'The token `{name}` of the dark mode overrides '
                + (f'`{light}` of type {kind}, not {entry.token["$type"]}.' if kind else f'no token `{light}`.'),
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


#: the names of the icons of lucide-react that the frontend imports, by the version of the
#: template (`npm run lucide-icons` writes it from the workspace of the components)
LUCIDE_ICONS = 'lucide-icons.json'


@cache
def lucide_icons() -> tuple[str, frozenset[str]]:
    """
    The version of lucide-react and the names of its icons, in kebab-case.
    """
    data = json.loads((files(__package__) / LUCIDE_ICONS).read_text(encoding='utf-8'))
    return data['lucide-react'], frozenset(data['icons'])


def check_icon(doc: Document, path: tuple, name: str, issues: Issues) -> None:
    """
    An icon of the specs is an icon of lucide-react (D013), which the frontend imports by its
    name in PascalCase (`book-open`: `BookOpen`).
    """
    version, names = lucide_icons()
    if name not in names:
        issues.add(
            doc, path, 'D013', f'`{name}` is not an icon of lucide-react {version}: the screens cannot import it.',
            'Name an icon of lucide.dev in kebab-case (`book-open`, `building-2`), as "Icons" of the '
            'guide of bazis-front says.',
        )


def check_icons(theme: Document, entities: set[str], issues: Issues) -> None:
    """
    Every entity with a screen has an icon in `icons`, one of lucide-react.
    """
    for entity, name in theme.data.get('icons', {}).items():
        check_icon(theme, ('icons', entity), name, issues)
    for entity in sorted(entities - set(theme.data.get('icons', {}))):
        issues.add(
            theme, ('icons',), 'D011',
            f'The entity `{entity}` has a screen and no icon in `icons`.',
            f'Give it the name of a lucide icon in `icons` (`{entity}: file-text`), as "The design" '
            'of the guide of bazis-front says.',
        )


#: the files that the frontend serves at its root (`brand.image` of theme.yaml)
PUBLIC_DIR = 'frontend/public'


def check_brand(theme: Document, root: Path | None, issues: Issues) -> None:
    """
    The mark of the brand is an icon of lucide-react, or an image that the frontend serves
    (a file of `frontend/public/`: D017, a warning, the shell showing a broken image).
    """
    brand = theme.data.get('brand', {})
    if 'icon' in brand:
        check_icon(theme, ('brand', 'icon'), brand['icon'], issues)
    if 'image' in brand and root is not None and not (root / PUBLIC_DIR / brand['image']).is_file():
        issues.add(
            theme, ('brand', 'image'), 'D017',
            f'{PUBLIC_DIR}/{brand["image"]} is missing: the shell shows the mark of the brand from there.',
            f'Put the image of the mark at {PUBLIC_DIR}/{brand["image"]}, or name a lucide icon in '
            '`brand: {icon: …}`.',
        )


def check_hidden_layers(theme: Document, tokens: Document | None, issues: Issues) -> None:
    """
    tokens.json replaces no more than half of the tokens of a layer that theme.yaml names (a
    brand over a palette); more hides the layer, as a tokens.json of 0.1.0 that defines every
    color and font.
    """
    defined = tokens_of(tokens.data) if tokens is not None else {}
    for kind in LAYERS:
        if (name := theme.data.get(kind)) is None:
            continue
        given = tokens_of(named_layer(kind, name))
        hidden = sorted(it for it in given if it in defined)
        if len(hidden) * 2 > len(given):
            shown = name['google'] if isinstance(name, dict) else name
            issues.add(
                theme, (kind,), 'D012',
                f'spec/design/tokens.json replaces {len(hidden)} of the {len(given)} tokens of `{kind}: {shown}`: '
                f'{", ".join(f"`{it}`" for it in hidden)}.',
                f'Remove these tokens from spec/design/tokens.json to take them from the layer (keep there '
                f'only what the product changes, such as its brand), or remove `{kind}` from theme.yaml.',
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


def pair_contrast(values: dict[str, str], text: str, background: str, alpha: float = 1) -> float | None:
    """
    The contrast of the text color on its background (the text at `alpha` over it; a translucent
    background over the page), None when `color` cannot compute one of them.
    """
    page = color.parse(values['--background'], values) if '--background' in values else None
    first, second = color.parse(values[text], values), color.over(values[background], page, values)
    if first is None or second is None:
        return None
    return color.contrast(tuple(alpha * a + (1 - alpha) * b for a, b in zip(first, second, strict=True)), second)


def sidebar_scope(values: dict[str, str]) -> dict[str, str]:
    """
    The variables that a component inside the sidebar reads (`[data-slot='sidebar']` of the
    theme): those of :root computed there and inherited as colors, under those that the sidebar
    declares again (`SIDEBAR`, `SIDEBAR_FOLLOWS` with their values of :root).
    """
    inherited = {}
    for name, value in values.items():
        parsed = color.parse(value, values)
        inherited[name] = value if parsed is None else 'rgb({} {} {})'.format(*(255 * it for it in parsed))
    return {**inherited, **SIDEBAR, **{variable(it): values[variable(it)] for it in SIDEBAR_FOLLOWS}}


def check_contrast(
    theme: Document | None, tokens: Document | None, defined: dict[str, Entry], issues: Issues
) -> None:
    """
    The text colors have a contrast of at least 4.5:1 (WCAG AA) on their backgrounds, in
    every mode of the theme, and the colors read inside the sidebar theirs there
    (`SIDEBAR_CONTRAST`); the colors that `color` cannot compute are not checked.
    """
    # a derived color is reported at the token it derives from
    owners = {name: source for name, (_, source) in DERIVED_FROM.items()}
    by_variable = {variable(name): it for name, it in defined.items() if not name.startswith(f'{DARK}.')}
    dark = {variable(name): it for name, it in defined.items() if name.startswith(f'{DARK}.')}

    def report(values: dict[str, str], mode: str, text: str, background: str, ratio: float, problem: str) -> None:
        candidates = [source(owners.get(text, text), values), source(owners.get(background, background), values)]
        places = [dark, by_variable] if mode == DARK else [by_variable]
        entry = next((it[name] for name in candidates for it in places if name in it), None)
        issues.add(
            *(place(theme, tokens, entry) if entry is not None else (tokens or theme, ())), 'D009', problem,
            'Make the text darker or lighter than its background (the lightness of oklch()).',
        )

    for mode in modes(theme.data if theme is not None else None, defined):
        values = variables(defined, dark=mode == DARK)
        # a pair whose colors are those of a pair before it (`--control` is the background by
        # default) is reported once
        seen = set()
        for text, background, *opacity in CONTRAST:
            alpha = opacity[0] if opacity else 1
            colors = (source(text, values), source(background, values), alpha)
            if colors in seen:
                continue
            seen.add(colors)
            ratio = pair_contrast(values, text, background, alpha)
            if ratio is not None and ratio < color.AA:
                report(values, mode, text, background, ratio, (
                    f'The text color {text}{f" at {alpha:.0%}" if alpha < 1 else ""} on {background} has a contrast of {ratio:.2f}:1 in the '
                    f'{mode} mode, below {color.AA}:1 (WCAG AA).'
                ))
        inside = sidebar_scope(values)
        for text, background, minimum in SIDEBAR_CONTRAST:
            ratio = pair_contrast(inside, text, background)
            if ratio is not None and ratio < minimum:
                report(values, mode, text, background, ratio, (
                    f'The color {text} on {background} inside the sidebar has a contrast of {ratio:.2f}:1 in the {mode} mode, '
                    f'below {minimum}:1 (WCAG AA).'
                ))


def check(
    theme: Document | None, tokens: Document | None, entities: set[str], contract: dict | None, issues: Issues,
    root: Path | None = None, product: dict | None = None,
) -> None:
    """
    The design: the tokens of its layers (checked only when its files follow their schemas),
    the tokens that its preset requires, its mode, its fonts against the languages and the
    currencies of the product (`product`, the data of a valid product.yaml), the layers that
    tokens.json hides, the statuses of theme.yaml, the icons of the entities of the product
    that have a screen (`entities`) and the mark of the brand (its image in the product root,
    `root`).
    """
    usable = (theme is None or theme.valid) and (tokens is None or tokens.valid) and (theme or tokens) is not None
    defined = effective_tokens(theme and theme.data, tokens and tokens.data) if usable else {}
    if usable:
        check_aliases(theme, tokens, defined, issues)
        check_dark(theme, tokens, defined, issues)
        check_contrast(theme, tokens, defined, issues)
        fonts.check(tokens, theme, defined, product, place, issues)
    if theme is None or not theme.valid:
        return
    check_statuses(theme, contract, issues)
    check_icons(theme, entities, issues)
    check_brand(theme, root, issues)
    if not usable:
        return
    check_hidden_layers(theme, tokens, issues)
    preset = theme.data['preset']
    for name, kind in PRESET_TOKENS[preset].items():
        if name not in defined:
            issues.add(
                theme, ('preset',), 'D005',
                f'The preset `{preset}` requires the token `{name}` ({kind}), which neither the '
                'layers of theme.yaml (palette, fonts, shape, surface) nor spec/design/tokens.json define.',
                f'Name a palette, fonts and a shape in theme.yaml, or define `{name}` with `$type: {kind}` in '
                'spec/design/tokens.json.',
            )
        elif (entry := defined[name]).token['$type'] != kind:
            issues.add(
                *place(theme, tokens, entry, ('$type',)), 'D005',
                f'The preset `{preset}` requires the token `{name}` of type {kind}, not '
                f'{entry.token["$type"]}.',
                f'Give `{name}` the type {kind}.',
            )
    if theme.data.get('mode') == DARK and not has_dark(defined):
        issues.add(
            theme, ('mode',), 'D010',
            '`mode: dark` needs the values of the dark mode, and neither the layers of theme.yaml '
            'nor spec/design/tokens.json have tokens of the group `dark`.',
            'Name a palette (each has both modes), or define the tokens of the group `dark` in '
            'spec/design/tokens.json; or choose `mode: both` or `mode: light`.',
        )
