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
Writes a starter font of the package (`bazis/contrib/front/assets/fonts/<id>/`, the
`font: {starter: <id>}` of a token) from an unpacked npm package of @fontsource-variable
(`npm pack @fontsource-variable/<id>@<version>`, then `tar xzf`): the woff2 files of its
subsets for the axes given, unchanged, its license as `OFL.txt` (only an OFL font is a
starter) and `metadata.json` (`spec/fonts.py` reads it): the family, the version of the
package, the ranges of the axes, the file and the unicode-range of each subset, and the
metrics of the fallback face, a local font with the size and the vertical metrics of the web
font, so that the swap moves no line.

The metrics are those of fontaine and next/font: `size-adjust` is the width of a Russian and
Polish sample in the web font (at the default instance, or at the weight given) over its
width in the local font, counting only the characters that both have (a letter missing from
the subsets would count for one side only); the ascent, the descent and the line gap of the
web font are divided by it. The files must have the Russian and the Polish alphabets and the
ruble sign.

A tool of the maintainer: fontTools is in the `dev` extra, never a dependency of the package.

    python scripts/gen_font_starter.py <package dir> bazis/contrib/front/assets/fonts/literata \\
        --axes opsz,wght --fallback /System/Library/Fonts/Supplemental/Georgia.ttf --local Georgia --wght 500
"""

import argparse
import json
import shutil
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


#: the subsets of a starter: those of the languages of the products of Bazis (`fonts.LETTERS`)
SUBSETS = ('cyrillic-ext', 'cyrillic', 'latin-ext', 'latin')

#: the text whose width the metrics compare (Russian and Polish)
SAMPLE = 'Брони по неделям: Алексей Кравцов, 2 нояб. 2026 г., Палатка Нева 3 × 1. Zażółć gęślą jaźń 1234567890'
#: the characters that the files must have: the Russian and the Polish alphabets, the ruble sign
COVERAGE = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯąćęłńóśźżĄĆĘŁŃÓŚŹŻ₽'


# the same naming as `axis_file` of bazis/contrib/front/spec/fonts.py, which reads the packages of a product
def axis_file(axes: list[str]) -> str:
    """The axes of a file of @fontsource-variable: `wght`, or another axis with the weight."""
    others = [it for it in axes if it != 'wght']
    if 'wght' not in axes or len(others) > 1:
        raise SystemExit(f'the files of @fontsource-variable have the weight and at most one other axis: {axes}')
    return others[0] if others else 'wght'


def instance(path: Path, wght: float | None) -> TTFont:
    font = TTFont(path)
    if wght is not None:
        location = {it.axisTag: it.defaultValue for it in font['fvar'].axes}
        font = instantiateVariableFont(font, {**location, 'wght': wght})
    return font


def width(fonts: list[TTFont], text: str) -> float:
    total = 0.0
    for char in text:
        font = next(it for it in fonts if ord(char) in it.getBestCmap())
        total += font['hmtx'][font.getBestCmap()[ord(char)]][0] / font['head'].unitsPerEm
    return total


def percent(value: float) -> str:
    return f'{value * 100:.2f}'.rstrip('0').rstrip('.') + '%'


def fallback_metrics(web: list[TTFont], local: TTFont, names: list[str]) -> dict:
    covered = [it for it in SAMPLE if any(ord(it) in font.getBestCmap() for font in web) and ord(it) in local.getBestCmap()]
    size = width(web, ''.join(covered)) / width([local], ''.join(covered))
    font = web[0]
    os2, hhea, units = font['OS/2'], font['hhea'], font['head'].unitsPerEm
    typo = bool(os2.fsSelection & (1 << 7))
    ascent, descent, gap = (
        (os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap) if typo else (hhea.ascent, hhea.descent, hhea.lineGap)
    )
    return {
        'local': names,
        'size_adjust': percent(size),
        'ascent_override': percent(ascent / units / size),
        'descent_override': percent(abs(descent) / units / size),
        'line_gap_override': percent(gap / units / size),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('package', type=Path)
    parser.add_argument('target', type=Path)
    parser.add_argument('--axes', default='wght')
    parser.add_argument('--fallback', type=Path, required=True, help='the file of the local font of the fallback')
    parser.add_argument('--local', required=True, help='its names for local(), separated by commas')
    parser.add_argument('--wght', type=float, help='the weight the metrics are measured at (the default instance without it)')
    args = parser.parse_args()

    package = json.loads((args.package / 'package.json').read_text(encoding='utf-8'))
    metadata = json.loads((args.package / 'metadata.json').read_text(encoding='utf-8'))
    unicode = json.loads((args.package / 'unicode.json').read_text(encoding='utf-8'))
    if metadata['license']['type'] != 'OFL-1.1':
        raise SystemExit(f'{package["name"]} is not under the SIL Open Font License: {metadata["license"]["type"]}')
    axes = sorted(args.axes.split(','))
    kind = axis_file(axes)
    if args.target.exists():
        shutil.rmtree(args.target)
    args.target.mkdir(parents=True)
    subsets = {}
    for subset in SUBSETS:
        name = f'{metadata["id"]}-{subset}-{kind}-normal.woff2'
        shutil.copyfile(args.package / 'files' / name, args.target / name)
        subsets[subset] = {'file': name, 'unicode': unicode[subset].replace(',', ', ')}
    shutil.copyfile(args.package / 'LICENSE', args.target / 'OFL.txt')

    fonts = [TTFont(args.target / it['file']) for it in subsets.values()]
    found = {it.axisTag: (it.minValue, it.maxValue) for it in fonts[0]['fvar'].axes}
    if sorted(found) != axes:
        raise SystemExit(f'the files have the axes {sorted(found)}, not {axes}')
    missing = sorted({it for it in COVERAGE if not any(ord(it) in font.getBestCmap() for font in fonts)})
    if missing:
        raise SystemExit(f'the subsets lack {missing}')
    # the metrics of the text: the Latin and the Cyrillic subsets
    web = [instance(args.target / subsets[it]['file'], args.wght) for it in ('latin', 'cyrillic')]
    data = {
        'family': metadata['family'],
        'version': package['version'],
        'source': package['name'],
        'license': metadata['license']['type'],
        'axes': {tag: [int(low) if low.is_integer() else low, int(high) if high.is_integer() else high] for tag, (low, high) in sorted(found.items())},
        'subsets': subsets,
        'fallback': fallback_metrics(web, TTFont(args.fallback), args.local.split(',')),
    }
    (args.target / 'metadata.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{args.target}: {len(subsets)} subsets of {metadata["family"]} {package["version"]}, fallback {data["fallback"]}')


if __name__ == '__main__':
    main()
