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
The fonts that the frontend serves itself: a fontFamily token with
`$extensions: {bazis: {font: …}}` names a family, a starter of the package
(`assets/fonts/<id>/`, written by `scripts/gen_font_starter.py`) or an npm package of
@fontsource-variable installed in the frontend, and `bazis_front design` copies the files of its
subsets into `frontend/public/fonts/<id>-<version>/` with its license, and writes their
`@font-face` (with the unicode-range of each subset, so that a page downloads only those of
its characters), the fallback face of the family (a local font with its metrics, so that the
swap moves no line) and the file to preload, that of the text of the language of the product.

The subsets of `subsets: auto` are those of the languages of the product and of the signs of
its currencies, by the tables below (the characters are not read from the files: the
starters are checked once by their script).
"""

import json
from dataclasses import dataclass
from functools import cache
from importlib.resources import files
from importlib.resources.abc import Traversable
from pathlib import Path

from .issues import Document, Issues


#: the files of the fonts in the frontend, served at `/fonts/`
FONTS_DIR = 'public/fonts'

#: the subsets in the order of their faces: the later face wins the characters that two have,
#: as in the stylesheets of Fontsource
SUBSETS = ('cyrillic-ext', 'cyrillic', 'greek-ext', 'greek', 'vietnamese', 'latin-ext', 'latin')

#: the subset of the letters of a language, by its code; another language is written in `latin`
LETTERS = {
    **dict.fromkeys(('be', 'bg', 'kk', 'ky', 'mk', 'mn', 'ru', 'sr', 'tg', 'uk'), 'cyrillic'),
    **dict.fromkeys(('cs', 'et', 'hr', 'hu', 'lt', 'lv', 'pl', 'ro', 'sk', 'sl', 'tr'), 'latin-ext'),
    'el': 'greek',
    'vi': 'vietnamese',
}

#: what `subsets: auto` adds to the letters of a language: the letters of its neighbours in the
#: names that the users type (the extended Cyrillic of Kazakh or Tatar, the Latin with diacritics)
NEIGHBOURS = {'cyrillic': ('cyrillic-ext', 'latin-ext')}

#: the subset of the sign of a currency (`display: {currency}` of product.yaml); another is in
#: `latin` (its code, or a sign of Latin-1)
CURRENCY_SUBSET = {
    **dict.fromkeys(('AZN', 'GEL', 'ILS', 'INR', 'KRW', 'KZT', 'NGN', 'PHP', 'PLN', 'RUB', 'TRY', 'CZK', 'VND'), 'latin-ext'),
    'UAH': 'cyrillic-ext',
}

#: the families of @fontsource-variable that have the axis `opsz`, which the default import of
#: their package leaves out (D014 for an `import` of one of them as the heading font)
OPTICAL_SIZE_PACKAGES = frozenset({
    '@fontsource-variable/source-serif-4', '@fontsource-variable/literata',
    '@fontsource-variable/fraunces', '@fontsource-variable/newsreader',
})

#: the token of the text, whose font is preloaded unless its `font` says otherwise
BODY = 'font.body'
HEADING = 'font.heading'

FALLBACK = ' Fallback'


class FontError(Exception):
    """
    A font of the tokens cannot be served: its package is not installed in the frontend, or
    has no file of its axes or subsets.
    """


class FontNotInstalledError(FontError):
    """
    The package of a font is not installed in the frontend (no `npm install`): `design` cannot
    copy its files, while its checks compare the theme by the hashes of the lock.
    """


@dataclass(frozen=True)
class Family:
    """
    A family whose files the frontend serves: its id and version (the directory of its files),
    the ranges of its axes, the file and the unicode-range of each subset, the directory of the
    files, its license file, and the metrics of its fallback face (None when it has none).
    """

    id: str
    version: str
    axes: dict[str, list[float]]
    subsets: dict[str, tuple[str, str]]
    directory: Traversable
    license: Traversable
    fallback: dict | None

    @property
    def target(self) -> str:
        return f'{self.id}-{self.version}'


@dataclass(frozen=True)
class Face:
    """
    The font of a token: the name of its family in the stack (the first one), the family, the
    subsets it serves, the one it preloads and its fallback face.
    """

    name: str
    family: Family
    subsets: tuple[str, ...]
    preload: str | None
    fallback: dict | None

    def url(self, subset: str) -> str:
        return f'/fonts/{self.family.target}/{self.family.subsets[subset][0]}'


def font_of(token: dict) -> dict | None:
    """The `font` of the extensions of a token, None without one."""
    return token.get('$extensions', {}).get('bazis', {}).get('font')


@cache
def starter(name: str) -> Family:
    """A starter font of the package, `assets/fonts/<name>/`."""
    directory = files('bazis.contrib.front') / 'assets' / 'fonts' / name
    data = json.loads((directory / 'metadata.json').read_text(encoding='utf-8'))
    return Family(
        name, data['version'], data['axes'],
        {subset: (it['file'], it['unicode']) for subset, it in data['subsets'].items()},
        directory, directory / 'OFL.txt', data['fallback'],
    )


def axis_file(axes: list[str]) -> str:
    """The axes in the name of a file of @fontsource-variable: `wght`, or another with the weight."""
    others = sorted(set(axes) - {'wght'})
    return others[0] if len(others) == 1 else 'wght'


def package(frontend: Path, name: str, axes: list[str], fallback: dict | None) -> Family:
    """
    A family of @fontsource-variable installed in the frontend, with the files of its axes.
    """
    directory = frontend / 'node_modules' / name
    try:
        version = json.loads((directory / 'package.json').read_text(encoding='utf-8'))['version']
        metadata = json.loads((directory / 'metadata.json').read_text(encoding='utf-8'))
        ranges = json.loads((directory / 'unicode.json').read_text(encoding='utf-8'))
    except (OSError, ValueError, KeyError) as err:
        raise FontNotInstalledError(
            f'The font package {name} is not installed in {frontend}/node_modules: run `npm install {name}` '
            'in the frontend, then generate the theme again.'
        ) from err
    variable = metadata.get('variable', {})
    if missing := [it for it in axes if it not in variable]:
        raise FontError(f'{name} has no axis {", ".join(missing)}: its axes are {", ".join(sorted(variable))}.')
    kind = axis_file(axes)
    subsets = {
        subset: (f'{metadata["id"]}-{subset}-{kind}-normal.woff2', ranges[subset].replace(',', ', '))
        for subset in metadata.get('subsets', []) if subset in ranges
    }
    return Family(
        metadata['id'], version,
        {axis: [float(variable[axis]['min']), float(variable[axis]['max'])] for axis in axes},
        subsets, directory / 'files', directory / 'LICENSE', fallback,
    )


def family_of(font: dict, frontend: Path | None) -> Family:
    if 'starter' in font:
        return starter(font['starter'])
    if frontend is None:
        raise FontNotInstalledError(f'The font package {font["package"]} is read from the frontend, which there is none of.')
    return package(frontend, font['package'], font.get('axes', ['wght']), font.get('fallback'))


def languages(product: dict | None) -> list[str]:
    """The base codes of the languages of the product (`pt-br` is `pt`); none without product.yaml."""
    return [it.split('-')[0].lower() for it in (product or {}).get('languages', [])]


def currencies(value) -> set[str]:
    """The currencies of the `display` of the fields of product.yaml."""
    if isinstance(value, list):
        return set().union(*(currencies(it) for it in value))
    if not isinstance(value, dict):
        return set()
    found = {value['display']['currency']} if isinstance(value.get('display'), dict) and 'currency' in value['display'] else set()
    return found.union(*(currencies(it) for it in value.values()))


def needed(product: dict | None) -> set[str]:
    """
    The subsets that the text of the product needs: `latin` (the digits, the punctuation), the
    letters of each language and the sign of each currency.
    """
    return {
        'latin', *(LETTERS.get(it, 'latin') for it in languages(product)),
        *(CURRENCY_SUBSET.get(it, 'latin') for it in currencies(product)),
    }


def auto(product: dict | None) -> set[str]:
    """The subsets of `subsets: auto`: those needed, with the neighbours of the letters."""
    found = needed(product)
    return found.union(*(NEIGHBOURS.get(it, ()) for it in set(found)))


def first_subset(product: dict | None) -> str:
    """The subset of most of the text: the letters of the first language, but Latin with diacritics."""
    first = (languages(product) or ['en'])[0]
    letters = LETTERS.get(first, 'latin')
    return 'latin' if letters == 'latin-ext' else letters


def stack_name(token: dict) -> str | None:
    """The first family of the stack of a token (a list), None for a reference or a CSS string."""
    value = token['$value']
    return value[0] if isinstance(value, list) else None


def faces(defined: dict, product: dict | None, frontend: Path | None) -> list[Face]:
    """
    The fonts of the tokens that the frontend serves, by the name of the token. Raises a
    `FontError` for a package that cannot be read.
    """
    found = []
    for name, entry in sorted(defined.items()):
        font = font_of(entry.token)
        if font is None or name.startswith('dark.'):
            continue
        family = family_of(font, frontend)
        listed = font.get('subsets', 'auto')
        if listed != 'auto' and (missing := sorted(set(listed) - set(family.subsets))):
            raise FontError(f'The font of `{name}` has no subset {", ".join(missing)}.')
        # `auto` takes the subsets of the product that the family has
        wanted = auto(product) if listed == 'auto' else set(listed)
        subsets = tuple(it for it in SUBSETS if it in wanted and it in family.subsets)
        first = first_subset(product)
        preload = first if font.get('preload', name == BODY) and first in subsets else None
        face = Face(stack_name(entry.token), family, subsets, preload, family.fallback)
        if face not in found:
            found.append(face)
    return found


def quoted(name: str) -> str:
    return json.dumps(name, ensure_ascii=False)


def render_faces(found: list[Face]) -> list[str]:
    """
    The rules of the fonts: the `@font-face` of each subset, then the fallback faces.
    """
    rules = []
    for face in found:
        weight = face.family.axes.get('wght')
        for subset in face.subsets:
            declarations = [
                f'font-family: {quoted(face.name)};',
                'font-style: normal;',
                'font-display: swap;',
                *([f'font-weight: {weight[0]:g} {weight[1]:g};'] if weight else []),
                f"src: url('{face.url(subset)}') format('woff2');",
                f'unicode-range: {face.family.subsets[subset][1]};',
            ]
            rules.append('@font-face {\n' + ''.join(f'  {it}\n' for it in declarations) + '}')
    for face in found:
        if face.fallback is None:
            continue
        local = face.fallback['local']
        names = [local] if isinstance(local, str) else local
        declarations = [
            f'font-family: {quoted(face.name + FALLBACK)};',
            f'src: {", ".join(f"local({quoted(it)})" for it in names)};',
            *(f'{key.replace("_", "-")}: {face.fallback[key]};'
              for key in ('size_adjust', 'ascent_override', 'descent_override', 'line_gap_override')),
        ]
        rules.append('@font-face {\n' + ''.join(f'  {it}\n' for it in declarations) + '}')
    return rules


def preloads(found: list[Face]) -> list[str]:
    """The URLs of the files that index.html preloads."""
    return [face.url(face.preload) for face in found if face.preload is not None]


def font_files(found: list[Face]) -> dict[str, Traversable]:
    """
    The files that the frontend serves, by their path in the frontend: those of the subsets and
    the license of each family.
    """
    result = {}
    for face in found:
        target = f'{FONTS_DIR}/{face.family.target}'
        for subset in face.subsets:
            name = face.family.subsets[subset][0]
            result[f'{target}/{name}'] = face.family.directory / name
        result[f'{target}/{face.family.license.name}'] = face.family.license
    return dict(sorted(result.items()))


def check(tokens: Document | None, theme: Document | None, defined: dict, product: dict | None,
          place, issues: Issues) -> None:
    """
    The fonts of the tokens: the heading font with the optical sizes of its family (D014), the
    subsets listed against the languages and the currencies of the product (D015), and no
    fallback face in a stack that the generator does not make (D016). `place` is where an
    issue of a token is reported (`design.place`).
    """
    heading = defined.get(HEADING)
    if heading is not None and heading.token['$type'] == 'fontFamily':
        check_optical_size(heading, theme, tokens, place, issues)
    for name, entry in defined.items():
        if entry.token['$type'] != 'fontFamily' or name.startswith('dark.'):
            continue
        font = font_of(entry.token)
        listed = (font or {}).get('subsets', 'auto')
        if listed != 'auto' and (missing := sorted(needed(product) - set(listed))):
            issues.add(
                *place(theme, tokens, entry, ('$extensions', 'bazis', 'font', 'subsets')), 'D015',
                f'The subsets of the font of `{name}` leave out {", ".join(missing)}, which the languages or the '
                'currencies of spec/product.yaml need: those characters are drawn in a fallback font.',
                f'Add {", ".join(missing)} to `subsets`, or remove `subsets` (`auto`: those of the product).',
            )
        stack = entry.token['$value'] if isinstance(entry.token['$value'], list) else []
        made = f'{stack[0]}{FALLBACK}' if font is not None and (
            'starter' in font or 'fallback' in font) and stack else None
        if strays := [it for it in stack if it.endswith(FALLBACK) and it != made]:
            issues.add(
                *place(theme, tokens, entry, ('$value',)), 'D016',
                f'The stack of `{name}` names {", ".join(f"`{it}`" for it in strays)}, a fallback face that the '
                'generator does not make' + (f' (it makes `{made}`).' if made else '.'),
                'Give the `font` of the token the metrics of its fallback (`fallback`) and name '
                '`<the first family> Fallback` after the first family, or remove the name.',
            )


def check_optical_size(entry, theme: Document | None, tokens: Document | None, place, issues: Issues) -> None:
    font = font_of(entry.token)
    source = entry.token.get('$extensions', {}).get('bazis', {}).get('import')
    if font is not None and 'package' in font:
        lacks, hint = 'opsz' not in font.get('axes', ['wght']) and font['package'] in OPTICAL_SIZE_PACKAGES, (
            f'Load it with `font: {{package: {font["package"]}, axes: [opsz, wght]}}`'
        )
    elif font is None and source in OPTICAL_SIZE_PACKAGES:
        lacks, hint = True, f'Load it with `font: {{package: {source}, axes: [opsz, wght]}}` in place of `import`'
    else:
        return
    if lacks:
        issues.add(
            *place(theme, tokens, entry, ('$extensions', 'bazis')), 'D014',
            f'The heading font {source or font["package"]} is loaded without its axis `opsz`: the large '
            'headings (26–44 px) are drawn at the size of a text, heavy and wide.',
            f'{hint}: the headings take the drawing of their size.',
        )
