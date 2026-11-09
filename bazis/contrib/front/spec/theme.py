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
The theme of the frontend (`bazis_front design`): spec/design/theme.yaml and tokens.json
compiled into `frontend/src/bazis/generated/`:

- `fonts.css`, imported first by `src/index.css`: the imports of the fonts of the tokens
  (an @import after a rule is dropped, the stylesheet of Google Fonts among them), then the
  `@font-face` of the fonts that the frontend serves itself (`fonts.py`: their files copied
  into `frontend/public/fonts/`, recorded in the lock with their hashes);
- `fonts.ts`, `FONT_PRELOAD`: the font files that the plugin of `vite.config.ts` preloads in
  index.html;
- `theme.css`, imported by `src/index.css` after Tailwind: the
  tokens as CSS variables of `:root` and of the dark mode (the class `dark` of `<html>`, or
  the system's unless it has the class `light`; with `mode: light` or `dark` the one mode
  in `:root`), the spacing of the density (and that of the rows of a table whose density
  the user chooses, `data-density`), the Tailwind theme over them (`bg-primary`,
  `bg-success-soft text-success-ink`, `font-display`, `rounded-lg`, `shadow-md`) and the
  base styles of the preset (with the glow of the paper and the gradient of the sidebar
  once a layer defines their tokens);
- `theme.ts`, `THEME`: the options of the preset (navigation, density, composition, the
  tones of the statuses, the icons of the entities, whether the user switches to a dark
  mode) that the components read.

Without spec/design/ the theme is that of the starter of the preset `workspace` before the
layers (`design.WITHOUT_THEME`). The text
depends on the specs only (the subsets of the fonts and the file to preload on the languages
and the currencies of product.yaml): `--check` and `front.W005` render it again and compare
it byte for byte, and the font files with their sources, without Node and the database; the
lock records the hashes of the design (`design_hashes`) and of the files (`design`).
"""

import json
from importlib.resources.abc import Traversable
from pathlib import Path

from ..contract.generated import GENERATED_DIR
from ..contract.typescript import Constant, literal
from ..vendor import lock as frontend_lock
from . import design, fonts
from .screens import icon_name
from .validate import PRODUCT_FILE, THEME_FILE, TOKENS_FILE, Specs


FONTS_CSS = f'{GENERATED_DIR}/fonts.css'
FONTS_TS = f'{GENERATED_DIR}/fonts.ts'
THEME_CSS = f'{GENERATED_DIR}/theme.css'
THEME_TS = f'{GENERATED_DIR}/theme.ts'

#: the spacing of each density: the padding of the page, the gap between the sections of a
#: screen, the padding of the cards, of the cells of the tables, the gap between the fields
DENSITY = {
    'comfortable': {
        '--space-page-x': '2rem',
        '--space-page-y': '1.75rem',
        '--space-section': '1.5rem',
        '--space-card': '1.5rem',
        '--space-cell-x': '1rem',
        '--space-cell-y': '0.75rem',
        '--space-field': '1.25rem',
    },
    'compact': {
        '--space-page-x': '1.25rem',
        '--space-page-y': '1.25rem',
        '--space-section': '1rem',
        '--space-card': '1rem',
        '--space-cell-x': '0.75rem',
        '--space-cell-y': '0.4rem',
        '--space-field': '0.875rem',
    },
}

#: the spacing of the rows of a table, which the user chooses (`data-density` of the table of
#: resource-list) over the density of the theme
ROW_SPACING = ('--space-cell-x', '--space-cell-y')

#: the base styles of each preset, after those of both
PRESET_BASE = {
    'workspace': [],
    'portal': [
        # larger type and more air: every rem grows
        'html {\n    font-size: 106.25%;\n  }',
    ],
}

#: the utilities of the headings over the tokens of the fonts (the figures in proportional
#: lining digits: a number is read as a heading, not in a column)
HEADING = {
    'font-family': 'var(--font-heading)',
    'font-weight': 'var(--font-weight-heading)',
    'letter-spacing': 'var(--font-tracking-heading)',
    'font-variant-numeric': 'lining-nums proportional-nums',
}
SUBHEADING = {
    'font-family': 'var(--font-heading)',
    'font-weight': 'var(--font-weight-subheading)',
    'letter-spacing': 'var(--font-tracking-heading)',
}
#: the utility of the small capitals over a block: the title of a card or a chart, the label of
#: a group (11 px, in the font of the text)
EYEBROW = {
    'font-size': '0.6875rem',
    'line-height': '1rem',
    'font-weight': '600',
    'letter-spacing': '0.07em',
    'text-transform': 'uppercase',
}

#: the shadow of an element as Tailwind composes it: the rings (`ring-*`, `ring-focus`) over its
#: shadow (`--tw-shadow`, of `shadow-*`, `surface` and `control`), each nothing until it is set
SHADOWS = ', '.join(
    f'var(--tw-{it}, 0 0 #0000)' for it in ('inset-shadow', 'inset-ring-shadow', 'ring-offset-shadow', 'ring-shadow', 'shadow')
)
#: the utilities of a lifted block (a card, a panel, a menu) and of a lifted control (a button,
#: a chip, a segment) on the tokens of the surface: the components take them instead of listing
#: the classes, an exception is a class of the element (a dialog `shadow-(--shadow-lift-2)`)
SURFACE = {
    'background-color': 'var(--card)',
    'background-image': 'var(--surface-card)',
    'border': '1px solid var(--border-surface)',
    '--tw-shadow': 'var(--shadow-lift-1)',
    'box-shadow': SHADOWS,
    'border-radius': 'calc(var(--radius) + 4px)',
}
CONTROL = {
    'background-color': 'var(--control)',
    'background-image': 'var(--surface-control)',
    'border': '1px solid var(--border-control)',
    '--tw-shadow': 'var(--shadow-lift-05)',
    'box-shadow': SHADOWS,
    'border-radius': 'calc(var(--radius) - 2px)',
}
#: the focus ring (`focus-visible:ring-focus`): `shadow.ring-focus` over the shadow of the element
RING_FOCUS = {'--tw-ring-shadow': 'var(--shadow-ring-focus)', 'box-shadow': SHADOWS}

#: the glow of the paper, two radial lights at the top corners of the page under its content,
#: only when a layer defines `color.glow-a` or `color.glow-b` (a design without them draws
#: nothing over the page)
GLOW = {
    'content': "''",
    'position': 'fixed',
    'inset': '0',
    'z-index': '-1',
    'pointer-events': 'none',
    'background': 'radial-gradient(900px 620px at 0% 0%, var(--glow-a), transparent 70%), '
                  'radial-gradient(820px 520px at 100% 0%, var(--glow-b), transparent 70%)',
}
GLOW_TOKENS = ('color.glow-a', 'color.glow-b')

#: the gradient of the sidebar and the glow of its top, when a layer defines `color.sidebar-to`
#: or `color.sidebar-glow`; under the background color of the sidebar (`bg-sidebar`)
SIDEBAR_SURFACE = {
    'background-image': 'radial-gradient(460px 320px at 0% 0%, var(--sidebar-glow), transparent 70%), '
                        'linear-gradient(180deg, var(--sidebar), var(--sidebar-to))',
}
SIDEBAR_SURFACE_TOKENS = ('color.sidebar-to', 'color.sidebar-glow')

CSS_HEADER = (
    '/*\n'
    '  Generated by `manage.py bazis_front design` from spec/design/: never edit it, change the\n'
    '  specs and generate it again. Imported by src/index.css.\n'
    '*/\n'
)

FONTS_HEADER = (
    '/*\n'
    '  Generated by `manage.py bazis_front design` from spec/design/: never edit it, change the\n'
    '  specs and generate it again. Imported first by src/index.css: the fonts of the design.\n'
    '*/\n'
)

TS_HEADER = (
    '// Generated by `manage.py bazis_front design` from spec/design/: never edit it, change the\n'
    '// specs and generate it again.\n'
)

TS_TYPES = """\
/** The tone of a status badge (`statuses` of spec/design/theme.yaml). */
export type Tone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger';

/** The design of the frontend: the preset of spec/design/theme.yaml with its options. */
export interface Theme {
  /** workspace: a working application; portal: a public shell. */
  readonly preset: 'workspace' | 'portal';
  readonly navigation: 'sidebar' | 'topbar';
  readonly density: 'comfortable' | 'compact';
  readonly composition: {
    /** A list as a table or a grid of cards. */
    readonly list: 'table' | 'cards';
    /** A list on a phone: cards, or the table of a wide screen, scrolled sideways. */
    readonly list_phone: 'table' | 'cards';
    /** split: the list and the card side by side on a wide screen; pages: the card replaces the list. */
    readonly list_card: 'split' | 'pages';
    /** Forms in a dialog, or in place of the content of the screen. */
    readonly forms: 'dialog' | 'page';
  };
  readonly controls: {
    /** localized: a text as the language of the product writes a date, with a calendar; native: `<input type="date">`. */
    readonly date: 'localized' | 'native';
  };
  /** The tone of the badge of a status by its id; neutral for another. */
  readonly statuses: Readonly<Record<string, Tone>>;
  /** The name of the lucide icon of each entity, by the id of the entity. */
  readonly icons: Readonly<Record<string, string>>;
  /** The mark of the brand in the shell, on `color.brand`; null: the first letter of the name. */
  readonly brand: BrandMark | null;
  /** Whether the user switches to a dark mode: tokens of the group `dark` and `mode: both`. */
  readonly dark: boolean;
}

/** The mark of the brand (`brand` of spec/design/theme.yaml): a lucide icon, or the URL of an image of frontend/public/. */
export type BrandMark = { readonly icon: ComponentType<{ className?: string }> } | { readonly image: string };
"""


def block(selector: str, values: dict[str, str], indent: str = '') -> str:
    lines = [f'{indent}{selector} {{']
    lines += [f'{indent}  {name}: {value};' for name, value in values.items()]
    lines.append(f'{indent}}}')
    return '\n'.join(lines)


def theme_mapping(defined: dict) -> dict[str, str]:
    """
    The Tailwind theme over the variables: a color utility for every color token and derived
    color, the fonts, the radii, the shadows and the transitions.
    """
    colors = sorted(
        {design.variable(name) for name, entry in defined.items() if entry.token['$type'] == 'color'}
        | {design.variable(name) for name, (kind, _, _) in design.DEFAULTS.items() if kind == 'color'}
    )
    mapping = {
        '--font-sans': 'var(--font-body)',
        '--font-display': 'var(--font-heading)',
        '--font-mono': 'var(--font-mono)',
        '--radius-sm': 'calc(var(--radius) - 4px)',
        '--radius-md': 'calc(var(--radius) - 2px)',
        '--radius-lg': 'var(--radius)',
        '--radius-xl': 'calc(var(--radius) + 4px)',
        '--radius-2xl': 'calc(var(--radius) + 8px)',
        **{
            design.variable(name): f'var({design.variable(name)})'
            for name, (kind, _, _) in design.DEFAULTS.items() if kind == 'shadow'
        },
        '--ease-standard': 'var(--motion-ease)',
        '--default-transition-duration': 'var(--motion-base)',
        '--default-transition-timing-function': 'var(--motion-ease)',
    }
    mapping.update({f'--color-{name[2:]}': f'var({name})' for name in colors})
    mapping.update({f'--color-{tone}': f'var({source})' for tone, source in design.TONES.items() if f'--color-{tone}' not in mapping})
    mapping.update({f'--color-{name[2:]}': value for name, value in design.DERIVED.items()})
    return mapping


def render_fonts(defined: dict, faces: list[fonts.Face]) -> str:
    """
    The imports of the fonts: the stylesheets of other origins first, then the npm packages
    (whose rules Tailwind inlines in their place); then the faces of the fonts that the
    frontend serves.
    """
    sources = sorted(design.imports(defined), key=lambda it: not it.startswith('https://'))
    lines = [f"@import url('{it}');" if it.startswith('https://') else f"@import '{it}';" for it in sources]
    rules = fonts.render_faces(faces)
    if not lines and not rules:
        lines = ['/* No fonts to import. */']
    return '\n'.join([FONTS_HEADER, *lines, *(['', *rules] if lines and rules else rules)]) + '\n'


def render_preload(faces: list[fonts.Face]) -> str:
    return '\n'.join([
        TS_HEADER,
        '/** The font files that index.html preloads (`bazisFonts` of vite.config.ts): the text in the language of the product. */',
        f'export const FONT_PRELOAD: readonly string[] = {literal(fonts.preloads(faces))};',
        '',
    ])


def render_css(settings: dict, theme: dict | None, defined: dict) -> str:
    modes = design.modes(theme, defined)
    # `mode: light` or `dark`: the one mode, whatever the tokens have
    only = None if (theme or {}).get('mode', 'both') == 'both' else modes[0]
    first = {k: v for k, v in design.variables(defined, dark=modes[0] == design.DARK).items() if k not in design.DERIVED}
    night = {
        k: v for k, v in design.variables(defined, dark=True).items()
        if k not in design.DERIVED and first.get(k) != v
    } if len(modes) == 2 else None
    named = {design.light_name(it) for it in defined}
    surfaces = design.SURFACES if named.intersection(design.SURFACE_TOKENS) else design.SURFACES_FLAT
    follows = [design.variable(it) for it in design.SIDEBAR_FOLLOWS]
    # the tokens that follow the sidebar with another value in the dark mode
    sidebar_night = {it: night[it] for it in follows if it in night} if night is not None else {}
    parts = [
        CSS_HEADER,
        f'/* The preset `{settings["preset"]}`, density {settings["density"]}'
        + (f', the {only} mode only. */' if only else '. */'),
        '',
        # the variant `dark:` of Tailwind: always on in a theme of the dark mode only
        f'@custom-variant dark ({"&:is(:root *)" if only == design.DARK else "&:is(.dark *)"});',
        '',
        block(':root', {**first, **surfaces, **DENSITY[settings['density']]}),
        '',
        '/* The density of the rows of a table that the user chooses: `data-density`. */',
        *(
            block(f"[data-density='{name}']", {it: spacing[it] for it in ROW_SPACING}) + '\n'
            for name, spacing in DENSITY.items()
        ),
    ]
    if night is not None:
        parts += [
            '/* The dark mode: the class `dark` of <html>, or the system\'s unless <html> has the class `light`. */',
            block('.dark', night),
            '',
            '@media (prefers-color-scheme: dark) {',
            block(':root:not(.light)', night, '  '),
            '}',
            '',
        ]
    parts += [
        block('@theme inline', theme_mapping(defined)),
        '',
        '/* The headings, the figures and the titles of the components; the headings of their sections. */',
        block('@utility font-heading', HEADING),
        block('@utility font-subheading', SUBHEADING),
        '/* The small capitals over a block: the title of a card or a chart, the label of a group. */',
        block('@utility font-eyebrow', EYEBROW),
        '/* The lifted blocks and the lifted controls on the tokens of the surface. */',
        block('@utility surface', SURFACE),
        block('@utility control', CONTROL),
        '/* The focus ring over the shadow of the element. */',
        block('@utility ring-focus', RING_FOCUS),
        '',
        '@layer base {',
        '  * {\n    @apply border-border outline-ring/50;\n  }',
        f'  html {{\n    color-scheme: {modes[0]};\n  }}',
    ]
    if night is not None:
        parts += [
            '  html.dark {\n    color-scheme: dark;\n  }',
            '  @media (prefers-color-scheme: dark) {\n    html:not(.light) {\n      color-scheme: dark;\n    }\n  }',
        ]
    parts += [
        '  body {\n    @apply bg-background font-sans text-foreground antialiased;\n  }',
        *(
            ['  /* the glow of the paper */', block('body::before', GLOW, '  ')]
            if named.intersection(GLOW_TOKENS) else []
        ),
        '  /* the components inside the sidebar and its drawer read the colors of the sidebar */',
        block("[data-slot='sidebar']", {**design.SIDEBAR, **{it: first[it] for it in follows}, **design.SURFACES_FLAT}, '  '),
        *(
            [
                block(".dark [data-slot='sidebar']", sidebar_night, '  '),
                '  @media (prefers-color-scheme: dark) {',
                block(":root:not(.light) [data-slot='sidebar']", sidebar_night, '    '),
                '  }',
            ]
            if sidebar_night else []
        ),
        *(
            ['  /* the gradient and the glow of the sidebar */', block("[data-slot='sidebar']", SIDEBAR_SURFACE, '  ')]
            if named.intersection(SIDEBAR_SURFACE_TOKENS) else []
        ),
        '  h1,\n  h2,\n  h3 {\n    font-family: var(--font-heading);\n    font-weight: var(--font-weight-heading);\n'
        '    letter-spacing: var(--font-tracking-heading);\n  }',
        '  ::selection {\n    background-color: color-mix(in srgb, var(--primary) 22%, transparent);\n  }',
        *(f'  {it}' for it in PRESET_BASE[settings['preset']]),
        '}',
    ]
    return '\n'.join(parts) + '\n'


def render_ts(settings: dict, dark: bool) -> str:
    brand = settings['brand']
    imports = ["import type { ComponentType } from 'react';"]
    if brand is not None and 'icon' in brand:
        imports.append(f"import {{ {icon_name(brand['icon'])} }} from 'lucide-react';")
        brand = {'icon': Constant(icon_name(brand['icon']))}
    elif brand is not None:
        # a file of frontend/public/ is served at the root
        brand = {'image': f"/{brand['image']}"}
    value = {**settings, 'brand': brand, 'dark': dark}
    return '\n'.join([
        TS_HEADER,
        *imports,
        '',
        TS_TYPES,
        '/** The design of spec/design/theme.yaml, with the defaults of its preset. */',
        f'export const THEME: Theme = {literal(value)};',
        '',
    ])


def faces(specs: Specs, frontend: Path | None) -> list[fonts.Face]:
    """
    The fonts that the frontend serves; a `fonts.FontError` when a package of the frontend
    cannot be read.
    """
    return fonts.faces(design.effective_tokens(specs.theme, specs.tokens), specs.product, frontend)


def render(specs: Specs, frontend: Path | None = None) -> dict[str, str]:
    """
    The generated files by their path in the frontend, from specs whose design has no errors
    (the packages of its fonts read from the frontend).
    """
    settings = design.options(specs.theme)
    defined = design.effective_tokens(specs.theme, specs.tokens)
    served = faces(specs, frontend)
    return {
        FONTS_CSS: render_fonts(defined, served),
        FONTS_TS: render_preload(served),
        THEME_CSS: render_css(settings, specs.theme, defined),
        THEME_TS: render_ts(settings, len(design.modes(specs.theme, defined)) == 2),
    }


def font_files(specs: Specs, frontend: Path | None = None) -> dict[str, Traversable]:
    """The font files that the frontend serves, by their path in the frontend, from their sources."""
    return fonts.font_files(faces(specs, frontend))


def font_hashes(sources: dict[str, Traversable]) -> dict[str, str]:
    """The hashes of the font files that the frontend serves, by their path in the frontend."""
    return {path: frontend_lock.digest(source.read_bytes()) for path, source in sources.items()}


def design_hashes(root: Path, specs: Specs) -> dict[str, str]:
    """
    The hashes of the design, by path in the product root: those of the files of spec/design/,
    and of product.yaml that of its languages and currencies only, which choose the subsets of
    the fonts and the file to preload (another change of it leaves the theme current).
    """
    hashes = frontend_lock.file_hashes(root, (THEME_FILE, TOKENS_FILE))
    if specs.product is not None:
        fonts_input = {'languages': fonts.languages(specs.product), 'currencies': sorted(fonts.currencies(specs.product))}
        hashes[PRODUCT_FILE] = frontend_lock.digest(json.dumps(fonts_input).encode('utf-8'))
    return hashes


def stale(root: Path, frontend: Path, lock: dict, specs: Specs) -> list[str]:
    """
    Why the theme of the frontend differs from that of the specs, one message for each;
    empty when it is current. The generated files are compared byte for byte, the font files by
    the hashes of their sources. Without a font package in the frontend (a check without
    `npm install`) both are compared by the hashes of the lock, and a change of the design since
    it was generated is stale; an update of the generator or of the package is not seen then.
    """
    recorded = lock.get('design', {})
    try:
        rendered: dict[str, str] | None = render(specs, frontend)
        expected = font_hashes(font_files(specs, frontend))
    except fonts.FontNotInstalledError:
        rendered, expected = None, recorded.get('fonts', {})
    except fonts.FontError as err:
        return [str(err)]
    names = (
        frontend_lock.stale_hashes(frontend, recorded.get('generated', {})) if rendered is None
        else frontend_lock.stale_files(frontend, rendered)
    )
    copies = frontend_lock.stale_hashes(frontend, expected)
    changed, edited = frontend_lock.generation_changes(
        recorded, design_hashes(root, specs), frontend, names
    )
    if not names and not copies and (rendered is not None or not changed):
        return []
    problems = [f'The theme of {frontend} is stale: {", ".join(names)}.'] if names else []
    if copies:
        problems.append(f'The fonts of the theme are stale: {", ".join(copies)}.')
    if changed:
        problems.append(f'The design changed since it was generated: {", ".join(changed)}.')
    if edited:
        problems.append(f'Edited after it was generated: {", ".join(edited)}.')
    return problems


def write(
    root: Path, frontend: Path, lock: dict, specs: Specs, rendered: dict[str, str], sources: dict[str, Traversable]
) -> None:
    """
    Writes the theme and copies the font files that are missing or differ from their sources
    (those of the other versions of a family are kept: the product may serve them), and records
    the hashes of the design, of the files and of the fonts in the lock.
    """
    frontend_lock.write_files(frontend, rendered)
    hashes = font_hashes(sources)
    for path in frontend_lock.stale_hashes(frontend, hashes):
        target = frontend / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(sources[path].read_bytes())
    lock['design'] = frontend_lock.generation(design_hashes(root, specs), rendered)
    if hashes:
        lock['design']['fonts'] = hashes
    frontend_lock.write(frontend, lock)
