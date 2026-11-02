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
  base styles of the preset;
- `theme.ts`, `THEME`: the options of the preset (navigation, density, composition, the
  tones of the statuses, the icons of the entities, whether the user switches to a dark
  mode) that the components read.

Without spec/design/ the theme is that of the starter of the preset `workspace` before the
layers (`design.WITHOUT_THEME`). The text
depends on the specs only (the subsets of the fonts and the file to preload on the languages
and the currencies of product.yaml): `--check` and `front.W005` render it again and compare
it byte for byte, and the font files with their sources, without Node and the database; the
lock records the hashes of the specs and of the files (`design`).
"""

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

#: the files of the design in the product root (product.yaml: the languages and the currencies
#: of the subsets of the fonts)
DESIGN_FILES = (THEME_FILE, TOKENS_FILE, PRODUCT_FILE)

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
}

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
        'statuses': dict(theme.get('statuses', {})),
        'icons': dict(theme.get('icons', {})),
        'brand': theme.get('brand'),
    }


def block(selector: str, values: dict[str, str], indent: str = '') -> str:
    lines = [f'{indent}{selector} {{']
    lines += [f'{indent}  {name}: {value};' for name, value in values.items()]
    lines.append(f'{indent}}}')
    return '\n'.join(lines)


def theme_mapping(defined: dict) -> dict[str, str]:
    """
    The Tailwind theme over the variables: a color utility for every color token and tone,
    the fonts, the radii, the shadows and the transitions.
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
        '--shadow-xs': 'var(--shadow-xs)',
        '--shadow-sm': 'var(--shadow-sm)',
        '--shadow-md': 'var(--shadow-md)',
        '--shadow-lg': 'var(--shadow-lg)',
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
    parts = [
        CSS_HEADER,
        f'/* The preset `{settings["preset"]}`, density {settings["density"]}'
        + (f', the {only} mode only. */' if only else '. */'),
        '',
        # the variant `dark:` of Tailwind: always on in a theme of the dark mode only
        f'@custom-variant dark ({"&:is(:root *)" if only == design.DARK else "&:is(.dark *)"});',
        '',
        block(':root', {**first, **DENSITY[settings['density']]}),
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
        '  /* the components inside the sidebar and its drawer read the colors of the sidebar */',
        block("[data-slot='sidebar']", SIDEBAR, '  '),
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
    settings = options(specs.theme)
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


def stale_fonts(frontend: Path, sources: dict[str, Traversable]) -> list[str]:
    """The font files that are missing in the frontend or differ from their sources."""
    return [
        path for path, source in sources.items()
        if not (target := frontend / path).is_file() or target.read_bytes() != source.read_bytes()
    ]


def stale(root: Path, frontend: Path, lock: dict, rendered: dict[str, str], sources: dict[str, Traversable]) -> list[str]:
    """
    Why the theme of the frontend differs from that of the specs, one message for each;
    empty when it is current. The files are compared byte for byte.
    """
    names = frontend_lock.stale_files(frontend, rendered)
    copies = stale_fonts(frontend, sources)
    if not names and not copies:
        return []
    problems = [f'The theme of {frontend} is stale: {", ".join(names)}.'] if names else []
    if copies:
        problems.append(f'The fonts of the theme are stale: {", ".join(copies)}.')
    changed, edited = frontend_lock.generation_changes(
        lock.get('design', {}), frontend_lock.file_hashes(root, DESIGN_FILES), frontend, names
    )
    if changed:
        problems.append(f'The design changed since it was generated: {", ".join(changed)}.')
    if edited:
        problems.append(f'Edited after it was generated: {", ".join(edited)}.')
    return problems


def write(root: Path, frontend: Path, lock: dict, rendered: dict[str, str], sources: dict[str, Traversable]) -> None:
    """
    Writes the theme and copies the font files that are missing or differ from their sources
    (those of the other versions of a family are kept: the product may serve them), and records
    the hashes of the design, of the files and of the fonts in the lock.
    """
    frontend_lock.write_files(frontend, rendered)
    for path in stale_fonts(frontend, sources):
        target = frontend / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(sources[path].read_bytes())
    lock['design'] = frontend_lock.generation(frontend_lock.file_hashes(root, DESIGN_FILES), rendered)
    if sources:
        lock['design']['fonts'] = {path: frontend_lock.digest(source.read_bytes()) for path, source in sources.items()}
    frontend_lock.write(frontend, lock)
