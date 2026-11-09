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
The theme generated from the design (`bazis_front design`): the text of that of the sample
is the fixture of the components (`assets/ui/test/fixtures/theme.ts`; with
`BAZIS_FRONT_WRITE_FIXTURES=1` the test writes it), the CSS variables of the tokens and of
the dark mode, the layers of the starters and every combination of them, the color modes,
the fonts, the defaults of a preset and the look of a design without layers, the files and
the lock in a frontend, `--check` and `front.W005`.
"""

import json
import os
import shutil
from io import StringIO
from pathlib import Path

from django.core.management import CommandError, call_command
from django.test import override_settings

import pytest
import yaml

from bazis.contrib.front.checks import check_design
from bazis.contrib.front.spec import design, fonts, theme
from bazis.contrib.front.spec.issues import Document, Issues
from bazis.contrib.front.spec.lint import DESIGN_SCHEMA, TOKENS_SCHEMA, validator
from bazis.contrib.front.spec.validate import Specs, validate
from bazis.contrib.front.vendor.lock import digest

from .support import SAMPLE_SPEC, read_lock, write_lock


REPOSITORY = Path(__file__).resolve().parent.parent
FIXTURE = REPOSITORY / 'bazis' / 'contrib' / 'front' / 'assets' / 'ui' / 'test' / 'fixtures' / 'theme.ts'
TEMPLATE_CSS = REPOSITORY / 'bazis' / 'contrib' / 'front' / 'assets' / 'template' / 'src' / 'index.css'
TEMPLATE_PACKAGE = REPOSITORY / 'bazis' / 'contrib' / 'front' / 'assets' / 'template' / 'package.json'
STARTERS = REPOSITORY / 'bazis' / 'contrib' / 'front' / 'spec' / 'starters' / 'design'

#: the monospace fonts, the shadows and the transitions of Tailwind 4 (`tailwindcss/theme.css`),
#: which the defaults of the tokens keep for a design without the layers
TAILWIND = {
    '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    '--shadow-xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow-sm': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    '--motion-base': '150ms',
    '--motion-ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
}


def starters(directory: str) -> list[str]:
    """
    The names of the starters of a layer of the design (`spec/starters/design/<directory>/`).
    """
    return sorted(it.stem for it in (STARTERS / directory).glob('*.json'))


def generate(*args) -> str:
    out = StringIO()
    call_command('bazis_front', 'design', *args, stdout=out, stderr=StringIO())
    return out.getvalue()


def edit_theme(root: Path, change) -> None:
    path = root / 'spec' / 'design' / 'theme.yaml'
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    change(data)
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding='utf-8')


def rendered(root: Path) -> dict[str, str]:
    result = validate(root, ('design',))
    assert not [it for it in result.errors if it.layer == 'design']
    return theme.render(result.specs)


def root_block(css: str, selector: str) -> dict[str, str]:
    """
    The declarations of a block of the CSS, by property.
    """
    body = css.split(f'\n{selector} {{\n', 1)[1].split('\n}', 1)[0]
    return dict(line.strip().rstrip(';').split(': ', 1) for line in body.splitlines())


def test_the_theme_of_the_sample_is_the_fixture_of_the_components():
    text = rendered(REPOSITORY / 'sample')[theme.THEME_TS]
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        FIXTURE.write_text(text, encoding='utf-8', newline='\n')
    assert FIXTURE.read_text(encoding='utf-8') == text


@pytest.mark.parametrize('surface, layers', [
    ('lifted', {'palette': 'frost', 'fonts': 'golos', 'surface': 'lifted'}),
    ('elevated', {'palette': 'indigo', 'fonts': 'inter', 'surface': 'elevated'}),
])
def test_the_themes_of_the_surfaces_in_a_browser(surface, layers):
    # the page of the surfaces of `assets/playwright/test/shell.spec.ts` reads them
    css = theme.render(Specs(theme={'spec': 'bazis-design/1', 'preset': 'workspace', 'shape': 'soft', **layers}))[theme.THEME_CSS]
    path = FIXTURE.parent / f'theme-{surface}.css'
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        path.write_text(css, encoding='utf-8', newline='\n')
    assert path.read_text(encoding='utf-8') == css


def test_the_settings_of_the_sample():
    text = rendered(REPOSITORY / 'sample')[theme.THEME_TS]
    assert text.startswith('// Generated by `manage.py bazis_front design` from spec/design/')
    assert 'export const THEME: Theme = {' in text
    for line in (
        'list_card: "split",', 'list_phone: "cards",', 'navigation: "sidebar",', 'in_progress: "info",',
        'task: "square-check",', 'dark: true,',
    ):
        assert line in text


def test_the_variables_of_the_tokens():
    css = rendered(REPOSITORY / 'sample')[theme.THEME_CSS]
    tokens = json.loads((SAMPLE_SPEC / 'design' / 'tokens.json').read_text(encoding='utf-8'))
    light = root_block(css, ':root')
    dark = root_block(css, '.dark')
    # every token is a variable: `color.x` is `--x`, the others their name with dashes
    assert light['--primary'] == tokens['color']['primary']['$value']
    assert light['--radius'] == tokens['radius']['$value']
    assert light['--font-body'].startswith('ui-sans-serif, system-ui, -apple-system, "Segoe UI"')
    # a reference is the variable of the token, a missing token its default
    assert light['--font-heading'] == 'var(--font-body)'
    assert light['--ring'] == 'var(--primary)'
    # the dark mode overrides what differs, also by the media query of the system
    assert dark['--primary'] == tokens['dark']['color']['primary']['$value']
    assert '--radius' not in dark
    assert '@media (prefers-color-scheme: dark) {\n  :root:not(.light) {' in css
    # the spacing of the density, and the Tailwind theme over the variables
    assert light['--space-cell-y'] == theme.DENSITY['comfortable']['--space-cell-y']
    mapping = root_block(css, '@theme inline')
    assert mapping['--color-primary'] == 'var(--primary)'
    assert mapping['--color-success-soft'] == design.DERIVED['--success-soft']
    assert mapping['--font-sans'] == 'var(--font-body)'


def test_the_template_imports_the_theme():
    css = TEMPLATE_CSS.read_text(encoding='utf-8')
    # the fonts before every rule, the theme after Tailwind
    imports = [line for line in css.splitlines() if line.startswith('@import')]
    assert imports == [
        "@import './bazis/generated/fonts.css';", "@import 'tailwindcss';", "@import 'tw-animate-css';",
        "@import './bazis/generated/theme.css';",
    ]
    # the colors are those of the tokens: no variable of a color in the template
    assert ':root' not in css and '--primary' not in css


def test_the_defaults_of_a_preset_without_a_design():
    files = theme.render(Specs())
    assert 'preset: "workspace"' in files[theme.THEME_TS]
    # the starter of workspace before the layers: the palette indigo, the fonts of the system
    light = root_block(files[theme.THEME_CSS], ':root')
    assert light['--primary'] == design.layer('palettes', 'indigo')['color']['primary']['$value']
    assert light['--font-body'].startswith('ui-sans-serif, system-ui')
    assert light['--radius'] == '0.5rem'

    portal = theme.render(Specs(theme={'spec': 'bazis-design/1', 'preset': 'portal', 'density': 'compact'}))
    text = portal[theme.THEME_TS]
    for line in ('forms: "page",', 'list: "cards",', 'navigation: "topbar",', 'density: "compact",'):
        assert line in text
    css = portal[theme.THEME_CSS]
    assert 'font-size: 106.25%' in css
    # the tokens of the preset: tighter headings
    assert root_block(css, ':root')['--font-tracking-heading'] == '-0.02em'
    assert root_block(css, ':root')['--space-cell-y'] == theme.DENSITY['compact']['--space-cell-y']


def test_the_input_of_a_date():
    # localized by default, whatever the preset; native when the design says so
    for preset in design.PRESETS:
        text = theme.render(Specs(theme={'spec': 'bazis-design/1', 'preset': preset}))[theme.THEME_TS]
        assert '  controls: {\n    date: "localized",\n  },\n' in text
    data = {'spec': 'bazis-design/1', 'preset': 'workspace', 'controls': {'date': 'native'}}
    assert '    date: "native",\n' in theme.render(Specs(theme=data))[theme.THEME_TS]
    assert "readonly date: 'localized' | 'native';" in theme.TS_TYPES


@pytest.mark.django_db
def test_an_input_of_a_date_that_the_design_does_not_have(root):
    edit_theme(root, lambda data: data.update(controls={'date': 'wheel'}))
    out = StringIO()
    with pytest.raises(CommandError, match='The design has 1 errors'):
        call_command('bazis_front', 'design', stdout=out)
    assert 'D002' in out.getvalue()


def test_the_density_that_the_user_chooses():
    # the rows of a table marked with a density (`data-density`, the view of a list) have its
    # spacing, whatever the density of the theme
    for density in theme.DENSITY:
        css = theme.render(Specs(theme={'spec': 'bazis-design/1', 'preset': 'workspace', 'density': density}))[theme.THEME_CSS]
        assert root_block(css, ':root')['--space-cell-y'] == theme.DENSITY[density]['--space-cell-y']
        for name, spacing in theme.DENSITY.items():
            assert root_block(css, f"[data-density='{name}']") == {it: spacing[it] for it in theme.ROW_SPACING}
    assert theme.DENSITY['compact']['--space-cell-y'] != theme.DENSITY['comfortable']['--space-cell-y']


def test_the_surface_gives_the_shadow_of_the_cards():
    # the cards, the tables and the fields have `shadow-xs`: the token of the surface
    shadows = {}
    for surface in starters('surfaces'):
        data = {
            'spec': 'bazis-design/1', 'preset': 'workspace',
            'palette': 'indigo', 'fonts': 'system', 'shape': 'soft', 'surface': surface,
        }
        css = theme.render(Specs(theme=data))[theme.THEME_CSS]
        assert root_block(css, '@theme inline')['--shadow-xs'] == 'var(--shadow-xs)'
        shadows[surface] = (root_block(css, ':root')['--shadow-xs'], root_block(css, '.dark').get('--shadow-xs'))
    elevated, lifted = design.layer('surfaces', 'elevated'), design.layer('surfaces', 'lifted')
    assert shadows == {
        # the shadow of Tailwind, in both modes
        'bordered': (TAILWIND['--shadow-xs'], None),
        'flat': ('0 0 #0000', None),
        'elevated': (elevated['shadow']['xs']['$value'], elevated['dark']['shadow']['xs']['$value']),
        'lifted': (lifted['shadow']['xs']['$value'], lifted['dark']['shadow']['xs']['$value']),
    }


def test_without_a_dark_mode():
    tokens = design.layer('palettes', 'indigo')
    light = {key: value for key, value in tokens.items() if key != 'dark'}
    files = theme.render(Specs(tokens=light))
    assert '.dark {' not in files[theme.THEME_CSS] and 'prefers-color-scheme' not in files[theme.THEME_CSS]
    assert 'dark: false,' in files[theme.THEME_TS]


def test_a_design_without_layers_keeps_its_look():
    # the design of the sample names no layer, as that of an older version: the new tokens
    # are the shadows and the transitions of Tailwind, the headings as before: the weight and
    # the tracking of the headings of the components (`font-semibold tracking-tight` before the
    # tokens), the brand and the muted text of the sidebar those of the primary and the content
    files = rendered(REPOSITORY / 'sample')
    css = files[theme.THEME_CSS]
    light = root_block(css, ':root')
    for name, value in TAILWIND.items():
        assert light[name] == value
    assert (light['--font-weight-heading'], light['--font-weight-subheading'], light['--font-tracking-heading']) == (
        '600', '600', '-0.025em',
    )
    assert (light['--brand'], light['--brand-foreground']) == ('var(--primary)', 'var(--primary-foreground)')
    assert light['--sidebar-muted-foreground'] == 'var(--muted-foreground)'
    assert '--shadow-md' not in root_block(css, '.dark')
    assert '@import' not in files[theme.FONTS_CSS]
    mapping = root_block(css, '@theme inline')
    assert mapping['--shadow-md'] == 'var(--shadow-md)'
    assert mapping['--default-transition-duration'] == 'var(--motion-base)'
    # the surfaces, the controls and the fields as the components drew them before their tokens:
    # the borders, the background of an outline button and its hover, the border and the focus
    # ring of a field, the shadow of a card and of a popover, no shadow of the primary button, the
    # focus ring of shadcn/ui; flat backgrounds
    ring = '0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent)'
    assert {name: light[name] for name in (
        '--border-surface', '--border-control', '--control', '--control-hover', '--surface-light', '--shade',
        '--field-line', '--field-line-hover', '--field-line-focus', '--shadow-field-focus',
        '--shadow-lift-05', '--shadow-lift-05-hover', '--shadow-lift-05-active',
        '--shadow-lift-1', '--shadow-lift-2', '--shadow-lift-primary', '--shadow-ring-focus',
        '--surface-card', '--surface-control',
    )} == {
        '--border-surface': 'var(--border)', '--border-control': 'var(--border)', '--control': 'var(--background)',
        '--control-hover': 'var(--accent)', '--surface-light': 'var(--card)', '--shade': 'var(--foreground)',
        '--field-line': 'var(--input)', '--field-line-hover': 'var(--input)', '--field-line-focus': 'var(--ring)',
        '--shadow-field-focus': ring,
        '--shadow-lift-05': 'var(--shadow-xs)', '--shadow-lift-05-hover': 'var(--shadow-sm)',
        '--shadow-lift-05-active': 'var(--shadow-xs)',
        '--shadow-lift-1': 'var(--shadow-xs)', '--shadow-lift-2': 'var(--shadow-md)', '--shadow-lift-primary': '0 0 #0000',
        '--shadow-ring-focus': ring,
        '--surface-card': 'none', '--surface-control': 'none',
    }
    # no glow of the paper and no gradient of the sidebar; the current link of the sidebar on its
    # accent, without a bar or a shadow
    assert (light['--sidebar-to'], light['--glow-a']) == ('var(--sidebar)', 'transparent')
    assert (light['--nav-active'], light['--nav-active-bar'], light['--shadow-nav-active']) == (
        'var(--sidebar-accent)', 'transparent', '0 0 #0000',
    )
    assert 'body::before' not in css and 'background-image' not in css.split('\n@layer base {\n', 1)[1]
    # a field is a line, never lifted
    assert 'lift-field' not in css


#: the controls of a design without the layers in the dark mode: those of shadcn/ui
#: (`dark:bg-input/30 dark:border-input dark:hover:bg-input/50`)
DARK_CONTROLS = {
    '--border-control': 'var(--input)',
    '--control': 'color-mix(in srgb, var(--input) 30%, transparent)',
    '--control-hover': 'color-mix(in srgb, var(--input) 50%, transparent)',
}


def test_the_root_of_a_theme_of_0_12_only_gains_variables():
    # the variables of the sample as 0.12 generated them keep their values, in both modes; the
    # new ones are the tokens of 0.13 on their defaults and the flat backgrounds of the surfaces,
    # and in the dark mode the controls of shadcn/ui translucent on the input
    before = json.loads((REPOSITORY / 'tests' / 'fixtures' / 'theme' / 'sample-0.12.json').read_text(encoding='utf-8'))
    css = rendered(REPOSITORY / 'sample')[theme.THEME_CSS]
    light, dark = root_block(css, ':root'), root_block(css, '.dark')
    assert dark == {**before['.dark'], **DARK_CONTROLS}
    assert {name: light[name] for name in before[':root']} == before[':root']
    assert set(light) - set(before[':root']) == {
        '--sidebar-to', '--sidebar-glow', '--nav-active', '--nav-active-bar', '--glow-a', '--glow-b', '--shade',
        '--surface-light', '--border-surface', '--border-control', '--control', '--control-hover', '--field-line',
        '--field-line-hover', '--field-line-focus', '--shadow-lift-05', '--shadow-lift-05-hover',
        '--shadow-lift-05-active', '--shadow-lift-1', '--shadow-lift-2', '--shadow-lift-primary',
        '--shadow-lift-primary-hover', '--shadow-lift-primary-active', '--shadow-ring-focus', '--shadow-field-focus',
        '--shadow-nav-active', '--surface-card', '--surface-control',
    }


def test_the_layers_of_the_tokens():
    data = {
        'spec': 'bazis-design/1', 'preset': 'workspace',
        'palette': 'forest', 'fonts': 'ibm-plex', 'shape': 'sharp', 'surface': 'elevated',
    }
    # tokens.json over the layers
    tokens = {'color': {'primary': {'$type': 'color', '$value': '#123456'}}}
    files = theme.render(Specs(theme=data, tokens=tokens))
    css = files[theme.THEME_CSS]
    light, dark = root_block(css, ':root'), root_block(css, '.dark')
    forest, elevated = design.layer('palettes', 'forest'), design.layer('surfaces', 'elevated')
    assert light['--primary'] == '#123456'
    assert light['--background'] == forest['color']['background']['$value']
    assert dark['--background'] == forest['dark']['color']['background']['$value']
    assert light['--radius'] == '0.25rem'
    assert light['--font-body'].startswith('"IBM Plex Sans Variable", ui-sans-serif')
    assert light['--font-heading'] == '"IBM Plex Serif", ui-serif, Georgia, serif'
    assert light['--shadow-md'] == elevated['shadow']['md']['$value']
    assert dark['--shadow-md'] == elevated['dark']['shadow']['md']['$value']
    # the fonts of the pair only
    assert files[theme.FONTS_CSS].endswith(
        "*/\n\n@import '@fontsource-variable/ibm-plex-sans';\n@import '@fontsource/ibm-plex-serif/600.css';\n"
    )
    assert 'h3 {\n    font-family: var(--font-heading);\n    font-weight: var(--font-weight-heading);' in css


#: the design of the redesign: the frost paper, one grotesque, the lifted surfaces
FROST = {'spec': 'bazis-design/1', 'preset': 'workspace', 'palette': 'frost', 'fonts': 'golos', 'shape': 'soft', 'surface': 'lifted'}


def test_the_surfaces_lifted_on_the_frost_paper():
    files = theme.render(Specs(theme=FROST))
    css = files[theme.THEME_CSS]
    light, dark = root_block(css, ':root'), root_block(css, '.dark')
    frost, lifted = design.layer('palettes', 'frost'), design.layer('surfaces', 'lifted')
    # no contour: the borders transparent, the shadows of the heights in the tone of the paper
    assert (light['--border-surface'], light['--border-control'], light['--control']) == ('transparent', 'transparent', 'var(--card)')
    assert light['--shade'] == frost['color']['shade']['$value']
    assert light['--surface-light'] == 'oklch(1 0 0)'
    for name in ('lift-05', 'lift-1', 'lift-2', 'lift-primary', 'ring-focus', 'field-focus'):
        assert light[f'--shadow-{name}'] == lifted['shadow'][name]['$value']
    # the gradients of the surfaces, since the palette defines their top: that of a control ends
    # in the control
    assert (light['--surface-card'], light['--surface-control']) == (
        design.SURFACES['--surface-card'], 'linear-gradient(180deg, var(--surface-light) 0%, var(--control) 100%)',
    )
    # the fields are a bottom line of the foreground, of the primary when focused
    assert (light['--field-line'], light['--field-line-hover'], light['--field-line-focus'], light['--shadow-field-focus']) == (
        'color-mix(in srgb, var(--foreground) 32%, transparent)', 'color-mix(in srgb, var(--foreground) 58%, transparent)',
        'var(--primary)', '0 1px 0 0 var(--primary)',
    )
    assert 'var(--shade)' in light['--shadow-lift-1'] and 'var(--primary)' in light['--shadow-lift-primary']
    # black shadows in the dark mode, the same focus ring
    assert dark['--shadow-lift-1'] == lifted['dark']['shadow']['lift-1']['$value']
    assert 'rgb(0 0 0 /' in dark['--shadow-lift-1'] and '--shadow-ring-focus' not in dark
    # the utilities of the heights and of the colors of the surfaces
    mapping = root_block(css, '@theme inline')
    assert mapping['--shadow-lift-1'] == 'var(--shadow-lift-1)'
    assert mapping['--shadow-ring-focus'] == 'var(--shadow-ring-focus)'
    assert mapping['--color-border-surface'] == 'var(--border-surface)'
    assert mapping['--color-avatar-0'] == design.DERIVED['--avatar-0']
    assert mapping['--color-line-6'] == 'color-mix(in srgb, var(--foreground) 6%, transparent)'
    assert mapping['--color-line-16'] == 'color-mix(in srgb, var(--foreground) 16%, transparent)'
    # the glow of the paper and the gradient of the sidebar, drawn since the palette defines them
    base = css.split('\n@layer base {\n', 1)[1]
    # inside the sidebar the tokens of the layer are computed again on its colors: the line of
    # its foreground, the controls on the sidebar, flat; the dark lifts of the primary button,
    # black literals, in its dark mode
    sidebar = block_of(base, "[data-slot='sidebar']")
    assert (sidebar['--field-line'], sidebar['--control'], sidebar['--surface-control']) == (
        'color-mix(in srgb, var(--foreground) 32%, transparent)', 'var(--card)', 'none',
    )
    lifts = ('lift-primary', 'lift-primary-hover', 'lift-primary-active')
    assert block_of(base, ".dark [data-slot='sidebar']") == {
        f'--shadow-{name}': lifted['dark']['shadow'][name]['$value'] for name in lifts
    }
    assert block_of(base, 'body::before') == theme.GLOW
    assert block_of(base, "[data-slot='sidebar']", 2) == theme.SIDEBAR_SURFACE
    assert base.index('body::before') < base.index("[data-slot='sidebar']")
    assert (dark['--glow-a'], dark['--sidebar-to']) == (
        frost['dark']['color']['glow-a']['$value'], frost['dark']['color']['sidebar-to']['$value'],
    )
    # the current link of the sidebar: a flat light fill with a bar of the honey of the sidebar,
    # lifted by a black shadow on the dark sidebar of both modes
    assert (light['--nav-active'], light['--nav-active-bar']) == (
        'color-mix(in srgb, #fff 6.5%, var(--sidebar))', 'var(--sidebar-primary)',
    )
    assert light['--shadow-nav-active'] == lifted['shadow']['nav-active']['$value'] and '--shadow-nav-active' not in dark
    assert mapping['--shadow-nav-active'] == 'var(--shadow-nav-active)'
    # D009 computes the text of the current link on its mix with white, in both modes
    defined = design.effective_tokens(FROST, None)
    for dark in (False, True):
        ratio = design.pair_contrast(design.variables(defined, dark=dark), '--sidebar-accent-foreground', '--nav-active')
        assert ratio is not None and ratio >= 4.5
    assert 'lift-field' not in json.dumps(lifted)


@pytest.mark.parametrize('palette', ['frost', 'pine'])
def test_the_controls_and_the_fields_read_on_the_sidebar(palette):
    # lifted inside a dark sidebar, computed there: the text of the sidebar is read on a control at
    # rest and under the pointer, the focused line of a field is seen on the sidebar
    defined = design.effective_tokens({**FROST, 'palette': palette}, None)
    for dark in (False, True):
        inside = design.sidebar_scope(design.variables(defined, dark=dark))
        assert inside['--control'] == 'var(--card)' and inside['--card'] == 'var(--sidebar)'
        for text, background, minimum in design.SIDEBAR_CONTRAST:
            assert design.pair_contrast(inside, text, background) >= minimum, (text, background, dark)
    # literals of the product that the sidebar cannot read: D009 inside the sidebar in both modes,
    # at the token of the text first (the palette for its foreground)
    tokens = {'color': {
        'control-hover': {'$type': 'color', '$value': '#ffffff'},
        'field-line-focus': {'$type': 'color', '$value': 'oklch(0.3 0.05 168)'},
    }}
    issues = Issues()
    design.check(
        Document('design', 'spec/design/theme.yaml', FROST, True), Document('design', 'spec/design/tokens.json', tokens, True),
        set(), None, issues,
    )
    assert sorted((it.code, it.path, it.message.split(' has ')[0]) for it in issues.items) == [
        ('D009', '/color/field-line-focus', 'The color --field-line-focus on --sidebar inside the sidebar'),
        ('D009', '/color/field-line-focus', 'The color --field-line-focus on --sidebar inside the sidebar'),
        ('D009', '/palette', 'The color --sidebar-foreground on --control-hover inside the sidebar'),
        ('D009', '/palette', 'The color --sidebar-foreground on --control-hover inside the sidebar'),
    ]
    assert sorted(it.message.split(' mode')[0].rsplit(' ', 1)[1] for it in issues.items) == ['dark', 'dark', 'light', 'light']


def test_a_token_of_the_dark_mode_follows_the_sidebar_in_the_dark_mode():
    # a product that gives the controls another color in the dark mode: the sidebar computes it
    # again in the dark mode only, by the class and by the system
    data = {**FROST, 'surface': 'elevated'}
    tokens = {'dark': {'color': {'control': {'$type': 'color', '$value': 'var(--muted)'}}}}
    base = theme.render(Specs(theme=data, tokens=tokens))[theme.THEME_CSS].split('\n@layer base {\n', 1)[1]
    assert block_of(base, "[data-slot='sidebar']")['--control'] == 'var(--background)'
    assert block_of(base, ".dark [data-slot='sidebar']") == {**DARK_CONTROLS, '--control': 'var(--muted)'}
    media = base.split("  @media (prefers-color-scheme: dark) {\n    :root:not(.light) [data-slot='sidebar'] {\n", 1)[1]
    assert '      --control: var(--muted);' in media.split('\n    }', 1)[0].splitlines()
    # without it, the controls of the dark mode of the defaults
    base = theme.render(Specs(theme=data))[theme.THEME_CSS].split('\n@layer base {\n', 1)[1]
    assert block_of(base, ".dark [data-slot='sidebar']") == DARK_CONTROLS
    # a layer that defines them in the light mode only (lifted) defines them in both
    assert not set(DARK_CONTROLS) & set(root_block(theme.render(Specs(theme=FROST))[theme.THEME_CSS], '.dark'))


def test_the_light_of_the_surfaces_of_one_mode_draws_the_gradients_of_both():
    # a limit: `surface-light` of the dark mode only draws the gradients in both modes, the
    # light one from the card (define it in `color` or in both modes)
    data = {**FROST, 'palette': 'indigo', 'surface': 'elevated'}
    tokens = {'dark': {'color': {'surface-light': {'$type': 'color', '$value': 'oklch(0.3 0.02 270)'}}}}
    css = theme.render(Specs(theme=data, tokens=tokens))[theme.THEME_CSS]
    light = root_block(css, ':root')
    assert {name: light[name] for name in design.SURFACES} == design.SURFACES
    assert light['--surface-light'] == 'var(--card)'


def block_of(css: str, selector: str, occurrence: int = 1) -> dict[str, str]:
    """
    The declarations of an indented block of the CSS (the nth of the selector), by property.
    """
    body = css.split(f'  {selector} {{\n')[occurrence].split('\n  }', 1)[0]
    return dict(line.strip().rstrip(';').split(': ', 1) for line in body.splitlines())


def test_a_glow_defined_by_the_product_is_drawn():
    # a token of tokens.json draws the glow over a palette that has none, in the dark mode only
    # too; another surface keeps its look
    data = {**FROST, 'palette': 'indigo', 'surface': 'elevated'}
    assert 'body::before' not in theme.render(Specs(theme=data))[theme.THEME_CSS]
    tokens = {'dark': {'color': {'glow-a': {'$type': 'color', '$value': 'color-mix(in srgb, var(--primary) 12%, transparent)'}}}}
    css = theme.render(Specs(theme=data, tokens=tokens))[theme.THEME_CSS]
    assert '  body::before {' in css and theme.SIDEBAR_SURFACE['background-image'] not in css


def test_the_paper_of_frost_is_far_from_its_accent():
    # the paper reads as white: a low chroma, and a hue away from that of the primary
    colors = design.layer('palettes', 'frost')['color']

    def lch(name: str) -> list[float]:
        return [float(it) for it in colors[name]['$value'].removeprefix('oklch(').removesuffix(')').split()]

    _, chroma, hue = lch('background')
    distance = abs(hue - lch('primary')[2]) % 360
    assert chroma <= 0.008 and min(distance, 360 - distance) >= 60


def test_the_contrast_of_the_controls_of_the_product():
    # a background of the controls that the text cannot be read on (in the light mode), once
    # for each text color, at the text color as every pair (of the palette); with the default
    # (the background) the pairs of the page are not reported twice
    theme_doc = Document('design', 'spec/design/theme.yaml', FROST, True)
    tokens = {'color': {'control': {'$type': 'color', '$value': 'oklch(0.3 0.02 270)'}}}
    issues = Issues()
    design.check(theme_doc, Document('design', 'spec/design/tokens.json', tokens, True), set(), None, issues)
    assert sorted((it.code, it.path, it.message.split(' has ')[0]) for it in issues.items) == [
        ('D009', '/palette', 'The text color --foreground on --control'),
        ('D009', '/palette', 'The text color --muted-foreground on --control'),
    ]
    assert all('in the light mode' in it.message for it in issues.items)


def test_a_family_of_google_fonts():
    data = {'spec': 'bazis-design/1', 'preset': 'portal', 'palette': 'ocean', 'fonts': {'google': 'Source Sans 3:wght@400..700'}}
    files = theme.render(Specs(theme=data))
    assert files[theme.FONTS_CSS].endswith(
        "\n@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400..700&display=swap');\n"
    )
    light = root_block(files[theme.THEME_CSS], ':root')
    assert light['--font-body'].startswith('"Source Sans 3", ui-sans-serif')
    assert light['--font-heading'] == 'var(--font-body)'


@pytest.mark.parametrize('mode', ['light', 'dark'])
def test_one_color_mode(mode):
    data = {'spec': 'bazis-design/1', 'preset': 'workspace', 'palette': 'plum', 'fonts': 'system', 'mode': mode}
    files = theme.render(Specs(theme=data))
    css = files[theme.THEME_CSS]
    plum = design.layer('palettes', 'plum')
    colors = plum['dark']['color'] if mode == 'dark' else plum['color']
    # the one mode in :root, no switch
    assert root_block(css, ':root')['--primary'] == colors['primary']['$value']
    assert '.dark {' not in css and 'prefers-color-scheme' not in css
    assert f'html {{\n    color-scheme: {mode};\n  }}' in css
    assert f', the {mode} mode only. */' in css
    assert 'dark: false,' in files[theme.THEME_TS]
    # the variant `dark:` of Tailwind follows the mode
    variant = '&:is(:root *)' if mode == 'dark' else '&:is(.dark *)'
    assert f'@custom-variant dark ({variant});' in css


@pytest.mark.django_db
@pytest.mark.parametrize('mode', ['light', 'dark'])
def test_one_color_mode_of_the_specs_with_the_icons(root, mode):
    edit_theme(root, lambda data: data.update(mode=mode))
    result = validate(root)
    assert [it for it in result.issues if it.layer == 'design'] == []
    files = theme.render(result.specs)
    assert f', the {mode} mode only. */' in files[theme.THEME_CSS]
    for line in ('dark: false,', 'task: "square-check",', 'user: "users",', 'step: "list-checks",'):
        assert line in files[theme.THEME_TS]


@pytest.mark.django_db
def test_an_entity_with_a_screen_and_no_icon(root):
    edit_theme(root, lambda data: data['icons'].pop('task'))
    result = validate(root)
    [issue] = [it for it in result.issues if it.layer == 'design']
    assert (issue.code, issue.severity, issue.path) == ('D011', 'warning', '/icons')
    # a warning: the theme is generated, without the icon
    assert 'square-check' not in theme.render(result.specs)[theme.THEME_TS]


def test_the_starters_of_the_layers():
    schema = json.loads((STARTERS.parent.parent / 'schemas' / 'design.schema.json').read_text(encoding='utf-8'))
    properties = schema['properties']
    # theme.yaml names every starter, and only those
    assert sorted(properties['palette']['enum']) == starters('palettes')
    assert sorted(properties['fonts']['oneOf'][0]['enum']) == starters('fonts')
    assert sorted(properties['shape']['enum']) == starters('shapes')
    assert sorted(properties['surface']['enum']) == starters('surfaces')
    assert starters('presets') == sorted(design.PRESET_TOKENS)
    template = json.loads(TEMPLATE_PACKAGE.read_text(encoding='utf-8'))['dependencies']
    for directory in (*design.LAYERS.values(), design.PRESET_LAYER):
        for name in starters(directory):
            data = design.layer(directory, name)
            assert validator(TOKENS_SCHEMA).is_valid(data), (directory, name)
            # the fonts are packages of the template: nothing to install for a pair
            for source in design.imports(design.tokens_of(data)):
                package = '/'.join(source.split('/')[:2])
                assert package in template, (name, source)
    # a palette gives both modes
    for name in starters('palettes'):
        data = design.layer('palettes', name)
        assert set(data['color']) == set(data['dark']['color']), name


def fonts_of_layer(name: str) -> list[str]:
    """The families of a pair of fonts that the frontend serves itself (`font` of their tokens)."""
    tokens = design.tokens_of(design.layer('fonts', name))
    return [it.token['$value'][0] for it in tokens.values() if fonts.font_of(it.token) is not None]


def test_every_combination_of_the_starters():
    # every preset with every palette, pair of fonts, shape and surface: a design without
    # issues (the contrast of WCAG AA in both modes), compiled with the fonts of its pair; but
    # the headings of `source-serif-display` without the optical sizes of Source Serif 4, kept
    # as they were (D014 tells how to load them)
    for preset in design.PRESET_TOKENS:
        for palette in starters('palettes'):
            for pair in starters('fonts'):
                for shape in starters('shapes'):
                    for surface in starters('surfaces'):
                        data = {
                            'spec': 'bazis-design/1', 'preset': preset,
                            'palette': palette, 'fonts': pair, 'shape': shape, 'surface': surface,
                        }
                        assert validator(DESIGN_SCHEMA).is_valid(data)
                        issues = Issues()
                        design.check(Document('design', 'spec/design/theme.yaml', data, True), None, set(), None, issues)
                        expected = [('D014', '/fonts')] if pair == 'source-serif-display' else []
                        assert [(it.code, it.path) for it in issues.items] == expected, data
                        css = theme.render(Specs(theme=data))[theme.FONTS_CSS]
                        for source in design.imports(design.tokens_of(design.layer('fonts', pair))):
                            assert f"@import '{source}';" in css
                        for face in fonts_of_layer(pair):
                            assert f'font-family: "{face}";' in css


def test_a_token_of_the_product_is_a_variable_and_a_color():
    tokens = json.loads((SAMPLE_SPEC / 'design' / 'tokens.json').read_text(encoding='utf-8'))
    tokens['color']['brand'] = {'$type': 'color', '$value': '#123456'}
    tokens['spacing'] = {'gutter': {'$type': 'dimension', '$value': '3rem'}}
    tokens['font']['mono'] = {'$type': 'fontFamily', '$value': ['JetBrains Mono', 'monospace']}
    css = theme.render(Specs(tokens=tokens))[theme.THEME_CSS]
    light = root_block(css, ':root')
    assert light['--brand'] == '#123456'
    assert light['--spacing-gutter'] == '3rem'
    assert light['--font-mono'] == '"JetBrains Mono", monospace'
    assert root_block(css, '@theme inline')['--color-brand'] == 'var(--brand)'


@pytest.mark.django_db
def test_design_writes_the_theme_and_the_lock(root):
    frontend = root / 'frontend'
    files = rendered(root)
    # init generated it
    for path, text in files.items():
        assert (frontend / path).read_text(encoding='utf-8') == text
    lock = read_lock(root)
    assert lock['design'] == {
        'spec': theme.design_hashes(root, validate(root).specs),
        'generated': {path: digest(text.encode('utf-8')) for path, text in files.items()},
    }
    out = generate()
    assert 'Generated the theme' in out
    assert read_lock(root) == lock
    assert 'up to date' in generate('--check')
    assert check_design(None) == []


@pytest.mark.django_db
def test_check_finds_a_changed_design_and_an_edited_theme(root):
    frontend = root / 'frontend'
    edit_theme(root, lambda data: data.update(density='compact'))
    with pytest.raises(CommandError) as error:
        generate('--check')
    assert f'The theme of {frontend} is stale: {theme.THEME_CSS}, {theme.THEME_TS}.' in str(error.value)
    assert 'The design changed since it was generated: spec/design/theme.yaml.' in str(error.value)
    [warning] = check_design(None)
    assert warning.id == 'front.W005'

    generate()
    assert 'density: "compact"' in (frontend / theme.THEME_TS).read_text(encoding='utf-8')
    (frontend / theme.THEME_CSS).write_text('/* edited */\n', encoding='utf-8')
    with pytest.raises(CommandError, match=f'Edited after it was generated: {theme.THEME_CSS}'):
        generate('--check')
    # --check writes nothing
    assert (frontend / theme.THEME_CSS).read_text(encoding='utf-8') == '/* edited */\n'


@pytest.mark.django_db
def test_design_needs_a_design_without_errors(root):
    edit_theme(root, lambda data: data.update(preset='admin'))
    out = StringIO()
    with pytest.raises(CommandError, match='The design has 1 errors'):
        call_command('bazis_front', 'design', stdout=out)
    assert 'D002' in out.getvalue()
    # front.W002 reports the issues: the theme is not compared
    assert check_design(None) == []


@pytest.mark.django_db
def test_design_needs_a_frontend(tmp_path):
    with override_settings(BASE_DIR=str(tmp_path)), pytest.raises(CommandError, match='init'):
        generate()


def test_the_charts_of_shadcn():
    css = rendered(REPOSITORY / 'sample')[theme.THEME_CSS]
    assert root_block(css, ':root')['--chart-1'] == 'var(--primary)'
    assert root_block(css, '@theme inline')['--color-chart-5'] == 'var(--chart-5)'


def test_the_utilities_of_the_headings():
    # the headings and the figures of the components take the weight and the tracking of the
    # tokens, the figures in proportional lining digits; the headings of their sections the
    # weight of a subheading
    css = rendered(REPOSITORY / 'sample')[theme.THEME_CSS]
    assert root_block(css, '@utility font-heading') == {
        'font-family': 'var(--font-heading)',
        'font-weight': 'var(--font-weight-heading)',
        'letter-spacing': 'var(--font-tracking-heading)',
        'font-variant-numeric': 'lining-nums proportional-nums',
    }
    assert root_block(css, '@utility font-subheading') == {
        'font-family': 'var(--font-heading)',
        'font-weight': 'var(--font-weight-subheading)',
        'letter-spacing': 'var(--font-tracking-heading)',
    }
    # the small capitals of the titles of the blocks, in the font of the text
    assert root_block(css, '@utility font-eyebrow') == theme.EYEBROW
    assert 'font-family' not in theme.EYEBROW
    # a lifted block and a lifted control on the tokens of the surface, with their radii, their
    # shadow that of Tailwind (`--tw-shadow`) under its rings; the focus ring over it
    shadows = (
        'var(--tw-inset-shadow, 0 0 #0000), var(--tw-inset-ring-shadow, 0 0 #0000), '
        'var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow, 0 0 #0000)'
    )
    assert root_block(css, '@utility surface') == {
        'background-color': 'var(--card)', 'background-image': 'var(--surface-card)',
        'border': '1px solid var(--border-surface)', '--tw-shadow': 'var(--shadow-lift-1)', 'box-shadow': shadows,
        'border-radius': 'calc(var(--radius) + 4px)',
    }
    assert root_block(css, '@utility control') == {
        'background-color': 'var(--control)', 'background-image': 'var(--surface-control)',
        'border': '1px solid var(--border-control)', '--tw-shadow': 'var(--shadow-lift-05)', 'box-shadow': shadows,
        'border-radius': 'calc(var(--radius) - 2px)',
    }
    assert root_block(css, '@utility ring-focus') == {'--tw-ring-shadow': 'var(--shadow-ring-focus)', 'box-shadow': shadows}
    # the utilities are top-level rules of Tailwind, after its theme
    assert css.index('\n@utility font-heading {') > css.index('\n@theme inline {')


def test_the_sidebar_reads_its_own_colors():
    # inside the sidebar (and its drawer) the components read the variables of the sidebar; the
    # tokens of the surfaces, the fields and the primary lift are declared again with the values
    # of :root, computed there on the colors of the sidebar, and the surfaces are flat
    css = rendered(REPOSITORY / 'sample')[theme.THEME_CSS]
    base = css.split('\n@layer base {\n', 1)[1]
    light = root_block(css, ':root')
    follows = [design.variable(it) for it in design.SIDEBAR_FOLLOWS]
    assert block_of(base, "[data-slot='sidebar']") == {
        **design.SIDEBAR, **{it: light[it] for it in follows}, **design.SURFACES_FLAT,
    }
    assert design.SIDEBAR == {
        '--foreground': 'var(--sidebar-foreground)',
        '--muted-foreground': 'var(--sidebar-muted-foreground)',
        '--border': 'var(--sidebar-border)',
        '--input': 'var(--sidebar-border)',
        '--accent': 'var(--sidebar-accent)',
        '--accent-foreground': 'var(--sidebar-accent-foreground)',
        '--primary': 'var(--sidebar-primary)',
        '--primary-foreground': 'var(--sidebar-primary-foreground)',
        '--ring': 'var(--sidebar-ring)',
        '--background': 'var(--sidebar)',
        '--card': 'var(--sidebar)',
        '--card-foreground': 'var(--sidebar-foreground)',
        '--surface-light': 'var(--sidebar-accent)',
    }
    # the defaults follow the sidebar: a control on it, the border and the ring of the sidebar
    assert (light['--control'], light['--border-control'], light['--field-line-focus']) == (
        'var(--background)', 'var(--border)', 'var(--ring)',
    )
    assert block_of(base, ".dark [data-slot='sidebar']") == DARK_CONTROLS


def test_the_mark_of_the_brand():
    data = {'spec': 'bazis-design/1', 'preset': 'workspace', 'palette': 'forest', 'fonts': 'inter'}
    assert 'brand: null,' in theme.render(Specs(theme=data))[theme.THEME_TS]
    # a lucide icon, imported by the theme as the screens import theirs
    text = theme.render(Specs(theme={**data, 'brand': {'icon': 'mountain-snow'}}))[theme.THEME_TS]
    assert "\nimport { MountainSnowIcon } from 'lucide-react';\n" in text
    assert 'brand: {\n    icon: MountainSnowIcon,\n  },' in text
    # an image of frontend/public/, served at the root
    text = theme.render(Specs(theme={**data, 'brand': {'image': 'brand/mark.svg'}}))[theme.THEME_TS]
    assert 'lucide-react' not in text
    assert 'brand: {\n    image: "/brand/mark.svg",\n  },' in text
    # one of them, a file of the frontend and not a path out of it
    for brand in ({}, {'icon': 'tent', 'image': 'mark.svg'}, {'image': '../mark.svg'}, {'image': '/mark.svg'},
                  {'image': 'mark.txt'}, {'icon': 'Tent'}):
        assert not validator(DESIGN_SCHEMA).is_valid({**data, 'brand': brand}), brand


def test_the_colors_of_the_brand_keep_their_contrast():
    # the mark on the brand, and the brand as a text on a card (the eyebrow of a card)
    theme_doc = Document('design', 'spec/design/theme.yaml', {'spec': 'bazis-design/1', 'preset': 'workspace',
                                                                'palette': 'forest', 'fonts': 'inter', 'shape': 'soft'}, True)
    tokens = {'color': {
        'brand': {'$type': 'color', '$value': 'oklch(0.8 0.1 45)'},
        'sidebar-muted-foreground': {'$type': 'color', '$value': 'oklch(0.9 0.01 95)'},
    }}
    tokens_doc = Document('design', 'spec/design/tokens.json', tokens, True)
    issues = Issues()
    design.check(theme_doc, tokens_doc, set(), None, issues)
    found = sorted({(it.code, it.path, it.message.split(' has ')[0]) for it in issues.items})
    assert found == [
        ('D009', '/color/brand', 'The text color --brand on --card'),
        # on the sidebar, and on the plate of the user, which has the fill of the current link
        ('D009', '/color/sidebar-muted-foreground', 'The text color --sidebar-muted-foreground on --nav-active'),
        ('D009', '/color/sidebar-muted-foreground', 'The text color --sidebar-muted-foreground on --sidebar'),
        # the mark in the primary foreground of the palette (the default of brand-foreground)
        ('D009', '/palette', 'The text color --brand-foreground on --brand'),
    ]


@pytest.mark.django_db
def test_the_image_of_the_brand_is_a_file_of_the_frontend(root):
    edit_theme(root, lambda data: data.update(brand={'image': 'brand/mark.svg'}))
    [issue] = [it for it in validate(root).issues if it.layer == 'design']
    assert (issue.code, issue.severity, issue.path) == ('D017', 'warning', '/brand/image')
    mark = root / 'frontend' / 'public' / 'brand' / 'mark.svg'
    mark.parent.mkdir(parents=True)
    mark.write_text('<svg xmlns="http://www.w3.org/2000/svg"/>', encoding='utf-8')
    assert [it for it in validate(root).issues if it.layer == 'design'] == []


#: the fonts of the pair `literata-golos` for a Russian product of rubles
FONTS_FIXTURE = REPOSITORY / 'tests' / 'fixtures' / 'fonts' / 'fonts.css'
PINE = {'spec': 'bazis-design/1', 'preset': 'workspace', 'palette': 'pine', 'fonts': 'literata-golos', 'shape': 'soft'}
RUBLES = {'languages': ['ru'], 'entities': [{'id': 'item', 'fields': [{'id': 'price', 'type': 'string', 'display': {'currency': 'RUB'}}]}]}


def test_the_fonts_that_the_frontend_serves():
    files = theme.render(Specs(theme=PINE, product=RUBLES))
    css = files[theme.FONTS_CSS]
    if os.environ.get('BAZIS_FRONT_WRITE_FIXTURES') == '1':
        FONTS_FIXTURE.parent.mkdir(exist_ok=True)
        FONTS_FIXTURE.write_text(css, encoding='utf-8', newline='\n')
    assert FONTS_FIXTURE.read_text(encoding='utf-8') == css
    # a face of each subset of the language and of the ruble sign, named as the stack, then the
    # fallback faces of the metrics of each family
    assert css.count('@font-face {') == 10
    assert css.count("src: url('/fonts/literata-5.3.0/literata-") == 4
    assert css.count("src: url('/fonts/golos-text-5.3.0/golos-text-") == 4
    assert 'font-family: "Literata Fallback";\n  src: local("Georgia");\n  size-adjust: 104.95%;' in css
    assert '@import' not in css
    # the stack names the faces, the fallback face after the family
    light = root_block(files[theme.THEME_CSS], ':root')
    assert light['--font-heading'].startswith('Literata, "Literata Fallback", ui-serif')
    assert light['--font-body'].startswith('"Golos Text", "Golos Text Fallback", ui-sans-serif')
    # the text of the language is preloaded: one file
    assert 'FONT_PRELOAD: readonly string[] = [\n  "/fonts/golos-text-5.3.0/golos-text-cyrillic-wght-normal.woff2",\n];' in files[theme.FONTS_TS]
    sources = theme.font_files(Specs(theme=PINE, product=RUBLES))
    assert len(sources) == 10
    assert sorted(it.rsplit('/', 1)[1] for it in sources if it.endswith('.txt')) == ['OFL.txt', 'OFL.txt']
    # without fonts of its own, the theme has no faces and preloads nothing
    files = theme.render(Specs(theme={**PINE, 'fonts': 'inter'}, product=RUBLES))
    assert '@font-face' not in files[theme.FONTS_CSS]
    assert 'FONT_PRELOAD: readonly string[] = [];' in files[theme.FONTS_TS]
    assert theme.font_files(Specs(theme={**PINE, 'fonts': 'inter'})) == {}


def test_one_grotesque_for_the_text_and_the_headings():
    # `golos`: the faces of Golos Text only, one variable file of the weights 400–900 for each
    # subset (the 500, 600 and 650 of the components and the headings), no Literata
    files = theme.render(Specs(theme=FROST, product=RUBLES))
    css = files[theme.FONTS_CSS]
    assert css.count('@font-face {') == 5
    assert css.count("src: url('/fonts/golos-text-5.3.0/golos-text-") == 4
    assert css.count('font-weight: 400 900;') == 4
    assert 'Literata' not in css and 'Literata' not in files[theme.THEME_CSS]
    light = root_block(files[theme.THEME_CSS], ':root')
    assert light['--font-heading'] == 'var(--font-body)'
    assert (light['--font-weight-heading'], light['--font-weight-subheading'], light['--font-tracking-heading']) == (
        '650', '600', '-0.02em',
    )
    assert 'FONT_PRELOAD: readonly string[] = [\n  "/fonts/golos-text-5.3.0/golos-text-cyrillic-wght-normal.woff2",\n];' in files[theme.FONTS_TS]
    sources = theme.font_files(Specs(theme=FROST, product=RUBLES))
    assert {it.split('/')[2] for it in sources} == {'golos-text-5.3.0'} and len(sources) == 5


@pytest.mark.parametrize(('product', 'subsets', 'preload'), [
    # no product.yaml: Latin only
    (None, ('latin',), 'latin'),
    ({'languages': ['en']}, ('latin',), 'latin'),
    # the Polish letters with the Latin of most of the text
    ({'languages': ['pl']}, ('latin-ext', 'latin'), 'latin'),
    # Russian with the letters of its neighbours, the text in Cyrillic
    ({'languages': ['ru', 'en']}, ('cyrillic-ext', 'cyrillic', 'latin-ext', 'latin'), 'cyrillic'),
    ({'languages': ['en', 'ru']}, ('cyrillic-ext', 'cyrillic', 'latin-ext', 'latin'), 'latin'),
    # the signs of the currencies: the hryvnia, the ruble, the złoty; the euro is Latin
    ({'languages': ['en'], 'entities': [{'fields': [{'display': {'currency': 'UAH'}}]}]}, ('cyrillic-ext', 'latin'), 'latin'),
    (RUBLES | {'languages': ['en']}, ('latin-ext', 'latin'), 'latin'),
    ({'languages': ['en-gb'], 'entities': [{'fields': [{'display': {'currency': 'EUR'}}]}]}, ('latin',), 'latin'),
])
def test_the_subsets_of_the_product(product, subsets, preload):
    [body, _] = fonts.faces(design.effective_tokens(PINE, None), product, None)
    assert (body.name, body.subsets, body.preload) == ('Golos Text', subsets, preload)


def test_the_subsets_and_the_preload_of_a_token():
    tokens = design.layer('fonts', 'literata-golos')
    tokens['font']['body']['$extensions']['bazis']['font'].update(subsets=['latin', 'cyrillic'], preload=False)
    tokens['font']['heading']['$extensions']['bazis']['font'].update(preload=True)
    body, heading = fonts.faces(design.effective_tokens(None, tokens), RUBLES, None)
    assert (body.subsets, body.preload) == (('cyrillic', 'latin'), None)
    assert (heading.subsets, heading.preload) == (('cyrillic-ext', 'cyrillic', 'latin-ext', 'latin'), 'cyrillic')


def test_the_schema_of_a_font():
    def valid(font, value=None):
        token = {'$type': 'fontFamily', '$value': value or ['Brand', 'sans-serif'], '$extensions': {'bazis': {'font': font}}}
        return validator(TOKENS_SCHEMA).is_valid({'font': {'body': token}})

    assert valid({'starter': 'literata', 'subsets': ['latin', 'cyrillic'], 'preload': True})
    assert valid({'package': '@fontsource-variable/brand-sans', 'axes': ['opsz', 'wght'], 'subsets': 'auto', 'fallback': {
        'local': 'Arial', 'size_adjust': '104.5%', 'ascent_override': '93.78%', 'descent_override': '21.05%',
        'line_gap_override': '0%'}})
    for font in (
        {'starter': 'inter'},  # not a starter font
        {'starter': 'literata', 'axes': ['wght']},  # the axes of a starter are those of its files
        {'starter': 'literata', 'subsets': ['greek']},  # nor are its subsets
        {'package': '@fontsource/brand-sans'},  # a variable font only
        {'package': '@fontsource-variable/brand-sans', 'axes': ['opsz']},  # with the weight
        {'package': '@fontsource-variable/brand-sans', 'axes': ['opsz', 'wdth', 'wght']},
        {'package': '@fontsource-variable/brand-sans', 'fallback': {'local': 'Arial'}},
        {'starter': 'literata', 'package': '@fontsource-variable/literata'},
    ):
        assert not valid(font), font
    # the stack is a list, whose first family names the faces; never with an import
    assert not valid({'starter': 'literata'}, '{font.body}')
    token = {'$type': 'fontFamily', '$value': ['Literata'], '$extensions': {'bazis': {
        'font': {'starter': 'literata'}, 'import': '@fontsource-variable/literata'}}}
    assert not validator(TOKENS_SCHEMA).is_valid({'font': {'body': token}})
    assert not validator(TOKENS_SCHEMA).is_valid({'radius': {'$type': 'dimension', '$value': '1rem', '$extensions': {
        'bazis': {'font': {'starter': 'literata'}}}}})


@pytest.mark.django_db
def test_design_copies_the_fonts_and_check_finds_them_stale(root):
    frontend = root / 'frontend'
    edit_theme(root, lambda data: data.update(palette='pine', fonts='literata-golos', shape='soft'))
    (root / 'spec' / 'design' / 'tokens.json').unlink()
    old = frontend / 'public' / 'fonts' / 'literata-5.2.0' / 'literata-latin-opsz-normal.woff2'
    old.parent.mkdir(parents=True)
    old.write_bytes(b'the font of an older version')
    out = generate()
    assert 'Copied the fonts: public/fonts/golos-text-5.3.0, public/fonts/literata-5.3.0.' in out
    lock = read_lock(root)
    sources = theme.font_files(validate(root, ('design',)).specs, frontend)
    # the sample is in English and Russian: four subsets of each family, with its license
    assert len(sources) == 10
    assert lock['design']['fonts'] == {path: digest(it.read_bytes()) for path, it in sources.items()}
    for path, source in sources.items():
        assert (frontend / path).read_bytes() == source.read_bytes()
    assert (frontend / 'public' / 'fonts' / 'literata-5.3.0' / 'OFL.txt').read_text(encoding='utf-8').startswith(
        'Copyright 2017 The Literata Project Authors')
    assert 'up to date' in generate('--check')
    assert check_design(None) == []
    # the files of another version are the product's
    assert old.read_bytes() == b'the font of an older version'

    # a missing or a changed file: stale, without Node and the database
    changed = frontend / 'public' / 'fonts' / 'golos-text-5.3.0' / 'golos-text-latin-wght-normal.woff2'
    changed.write_bytes(b'edited')
    (frontend / 'public' / 'fonts' / 'literata-5.3.0' / 'OFL.txt').unlink()
    message = ('The fonts of the theme are stale: public/fonts/golos-text-5.3.0/golos-text-latin-wght-normal.woff2, '
               'public/fonts/literata-5.3.0/OFL.txt.')
    with pytest.raises(CommandError) as error:
        generate('--check')
    assert message in str(error.value)
    assert f'The theme of {frontend} is stale' not in str(error.value)
    [warning] = check_design(None)
    assert warning.id == 'front.W005' and message in warning.msg
    generate()
    assert 'up to date' in generate('--check')


def write_package(frontend: Path, axes: dict[str, dict]) -> None:
    """A package of @fontsource-variable installed in the frontend, with the files of its weight."""
    package = frontend / 'node_modules' / '@fontsource-variable' / 'brand-sans'
    (package / 'files').mkdir(parents=True)
    (package / 'package.json').write_text(json.dumps({'name': '@fontsource-variable/brand-sans', 'version': '5.1.0'}), encoding='utf-8')
    (package / 'metadata.json').write_text(json.dumps({
        'id': 'brand-sans', 'family': 'Brand Sans', 'subsets': ['cyrillic', 'latin'], 'variable': axes,
    }), encoding='utf-8')
    (package / 'unicode.json').write_text(json.dumps({'cyrillic': 'U+0400-045F', 'latin': 'U+0000-00FF,U+2000-206F'}), encoding='utf-8')
    (package / 'LICENSE').write_text('SIL Open Font License', encoding='utf-8')
    for subset in ('cyrillic', 'latin'):
        (package / 'files' / f'brand-sans-{subset}-wght-normal.woff2').write_bytes(subset.encode())


@pytest.mark.django_db
def test_a_font_package_of_the_frontend(root):
    frontend = root / 'frontend'
    tokens_path = root / 'spec' / 'design' / 'tokens.json'
    tokens = json.loads(tokens_path.read_text(encoding='utf-8'))
    tokens['font']['body'] = {
        '$type': 'fontFamily', '$value': ['Brand Sans', 'Brand Sans Fallback', 'sans-serif'],
        '$extensions': {'bazis': {'font': {'package': '@fontsource-variable/brand-sans', 'subsets': ['latin', 'cyrillic'],
                                           'fallback': {'local': ['Arial'], 'size_adjust': '101%', 'ascent_override': '90%',
                                                        'descent_override': '22%', 'line_gap_override': '0%'}}}},
    }
    generated = json.dumps(tokens)
    tokens_path.write_text(generated, encoding='utf-8')
    assert [it for it in validate(root).issues if it.layer == 'design'] == []
    # not installed: the command tells to install it
    with pytest.raises(CommandError, match='npm install @fontsource-variable/brand-sans'):
        generate()
    write_package(frontend, {'wght': {'min': '300', 'max': '800'}})
    generate()
    css = (frontend / theme.FONTS_CSS).read_text(encoding='utf-8')
    assert ('  font-family: "Brand Sans";\n  font-style: normal;\n  font-display: swap;\n  font-weight: 300 800;\n'
            "  src: url('/fonts/brand-sans-5.1.0/brand-sans-latin-wght-normal.woff2') format('woff2');\n"
            '  unicode-range: U+0000-00FF, U+2000-206F;\n') in css
    assert 'font-family: "Brand Sans Fallback";\n  src: local("Arial");\n  size-adjust: 101%;' in css
    assert sorted(it.name for it in (frontend / 'public' / 'fonts' / 'brand-sans-5.1.0').iterdir()) == [
        'LICENSE', 'brand-sans-cyrillic-wght-normal.woff2', 'brand-sans-latin-wght-normal.woff2',
    ]
    assert check_design(None) == []
    # an axis or a subset that the package does not have
    tokens['font']['body']['$extensions']['bazis']['font'].update(axes=['opsz', 'wght'])
    tokens_path.write_text(json.dumps(tokens), encoding='utf-8')
    with pytest.raises(CommandError, match='has no axis opsz'):
        generate()
    tokens['font']['body']['$extensions']['bazis']['font'].update(axes=['wght'], subsets=['latin', 'cyrillic', 'greek'])
    tokens_path.write_text(json.dumps(tokens), encoding='utf-8')
    with pytest.raises(CommandError, match='has no subset greek'):
        generate()
    # not installed (a check without `npm install`): the theme and the fonts by the hashes of the lock
    tokens_path.write_text(generated, encoding='utf-8')
    shutil.rmtree(frontend / 'node_modules')
    assert check_design(None) == []
    assert 'up to date' in generate('--check')
    served = frontend / 'public' / 'fonts' / 'brand-sans-5.1.0' / 'brand-sans-latin-wght-normal.woff2'
    served.write_bytes(b'edited')
    [warning] = check_design(None)
    assert warning.id == 'front.W005'
    assert warning.msg == 'The fonts of the theme are stale: public/fonts/brand-sans-5.1.0/brand-sans-latin-wght-normal.woff2.'
    served.write_bytes(b'latin')
    css_path = frontend / theme.FONTS_CSS
    css_path.write_text(css + '\n', encoding='utf-8')
    [warning] = check_design(None)
    assert warning.msg == (f'The theme of {frontend} is stale: {theme.FONTS_CSS}. '
                           f'Edited after it was generated: {theme.FONTS_CSS}.')
    css_path.write_text(css, encoding='utf-8')
    assert check_design(None) == []
    # of product.yaml, only the languages and the currencies choose the fonts
    product_path = root / 'spec' / 'product.yaml'
    product_text = product_path.read_text(encoding='utf-8')
    product_path.write_text(product_text.replace('summary: The tasks', 'summary: All the tasks'), encoding='utf-8')
    assert check_design(None) == []
    assert 'up to date' in generate('--check')
    # the first language is preloaded
    product_path.write_text(product_text.replace('languages: [en, ru]', 'languages: [ru, en]'), encoding='utf-8')
    [warning] = check_design(None)
    assert warning.msg == 'The design changed since it was generated: spec/product.yaml.'
    product_path.write_text(product_text, encoding='utf-8')
    assert check_design(None) == []
    tokens['font']['body']['$extensions']['bazis']['font'].update(subsets=['latin'])
    tokens_path.write_text(json.dumps(tokens), encoding='utf-8')
    [warning] = check_design(None)
    assert warning.msg == 'The design changed since it was generated: spec/design/tokens.json.'
    with pytest.raises(CommandError, match='The design changed since it was generated'):
        generate('--check')
    with pytest.raises(CommandError, match='npm install @fontsource-variable/brand-sans'):
        generate()


@pytest.mark.django_db
def test_a_frontend_without_a_theme(root):
    lock = read_lock(root)
    # an `init` whose design had errors: components, and no theme in its lock
    del lock['design']
    write_lock(root, lock)
    [warning] = check_design(None)
    assert warning.id == 'front.W005'
    assert 'has no theme' in warning.msg and 'bazis_front design' in warning.hint
    # without components there is nothing to style
    lock['assets'] = {name: entry for name, entry in lock['assets'].items() if name in ('client', 'react', 'template')}
    write_lock(root, lock)
    assert check_design(None) == []
    generate()
    assert check_design(None) == []
