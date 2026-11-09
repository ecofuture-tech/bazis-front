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
The colors of the tokens as the browser computes them, for the contrast of the text tokens
(WCAG 2): `oklch()`, `#rgb`/`#rrggbb` and `rgb()` values, `var(--name)` of other variables
and `color-mix(in srgb|oklab, A p%, B)`, the mix of the variables that the theme derives
(`design.DERIVED`); a mix with `transparent` over an opaque color (`over`). Any other value is
not computed: its contrast is not checked.
"""

import math
import re


#: the minimum contrast of text in WCAG 2 AA
AA = 4.5

NUMBER = r'[-+]?(?:\d+\.?\d*|\.\d+)'
OKLCH = re.compile(rf'^oklch\(\s*({NUMBER})(%?)\s+({NUMBER})\s+({NUMBER})(?:deg)?\s*(?:/\s*({NUMBER})(%?))?\s*\)$')
RGB = re.compile(rf'^rgba?\(\s*({NUMBER})\s*,?\s*({NUMBER})\s*,?\s*({NUMBER})\s*(?:[,/]\s*({NUMBER})(%?))?\s*\)$')
HEX = re.compile(r'^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')
VAR = re.compile(r'^var\(\s*(--[\w-]+)\s*\)$')
MIX = re.compile(r'^color-mix\(\s*in (srgb|oklab)\s*,\s*(.+?)\s+(' + NUMBER + r')%\s*,\s*(.+)\)$')

#: an opaque color: red, green and blue in sRGB, from 0 to 1
Color = tuple[float, float, float]


def oklch(lightness: float, chroma: float, hue: float) -> Color:
    """
    An OKLCH color in sRGB (clipped to its gamut, as a browser shows it).
    """
    return from_oklab(lightness, chroma * math.cos(math.radians(hue)), chroma * math.sin(math.radians(hue)))


def from_oklab(lightness: float, a: float, b: float) -> Color:
    """
    An OKLab color in sRGB (clipped to its gamut).
    """
    l_ = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3
    linear = (
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    )
    return tuple(encode(min(1.0, max(0.0, it))) for it in linear)


def to_oklab(color: Color) -> tuple[float, float, float]:
    """
    An sRGB color in OKLab.
    """
    red, green, blue = (decode(it) for it in color)
    l_ = (0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue) ** (1 / 3)
    m_ = (0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue) ** (1 / 3)
    s_ = (0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue) ** (1 / 3)
    return (
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    )


def encode(linear: float) -> float:
    return 12.92 * linear if linear <= 0.0031308 else 1.055 * linear ** (1 / 2.4) - 0.055


def decode(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def opaque(alpha: str | None, percent: str | None) -> bool:
    return alpha is None or float(alpha) / (100 if percent else 1) >= 1


def parse(value: str, variables: dict[str, str] | None = None, seen: frozenset = frozenset()) -> Color | None:
    """
    The color of a CSS value, with the variables it references; None when it is not one of
    the forms above, is not opaque, or references an unknown variable.
    """
    value = value.strip()
    if match := VAR.match(value):
        name = match.group(1)
        if variables is None or name not in variables or name in seen:
            return None
        return parse(variables[name], variables, seen | {name})
    if match := MIX.match(value):
        space = match.group(1)
        first = parse(match.group(2), variables, seen)
        second = parse(match.group(4), variables, seen)
        if first is None or second is None:
            return None
        weight = float(match.group(3)) / 100
        if space == 'oklab':
            first, second = to_oklab(first), to_oklab(second)
        mixed = tuple(weight * a + (1 - weight) * b for a, b in zip(first, second, strict=True))
        return from_oklab(*mixed) if space == 'oklab' else mixed
    if match := OKLCH.match(value):
        lightness = float(match.group(1)) / (100 if match.group(2) else 1)
        if not opaque(match.group(5), match.group(6)):
            return None
        return oklch(lightness, float(match.group(3)), float(match.group(4)))
    if match := RGB.match(value):
        if not opaque(match.group(4), match.group(5)):
            return None
        return tuple(min(1.0, max(0.0, float(match.group(i)) / 255)) for i in (1, 2, 3))
    if match := HEX.match(value):
        digits = match.group(1)
        if len(digits) == 3:
            digits = ''.join(it * 2 for it in digits)
        return tuple(int(digits[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return None


def over(value: str, base: Color | None, variables: dict[str, str] | None = None) -> Color | None:
    """
    The color of a CSS value drawn over an opaque color: a mix with `transparent` (a background
    of the dark mode of shadcn/ui, `bg-input/30`) is its color at its part over the base, as the
    browser composes it; another value its color.
    """
    value = value.strip()
    while (match := VAR.match(value)) and variables is not None and match.group(1) in variables:
        value = variables[match.group(1)].strip()
    match = MIX.match(value)
    if match is None or match.group(4).strip() != 'transparent':
        return parse(value, variables)
    first = parse(match.group(2), variables)
    if first is None or base is None:
        return None
    weight = float(match.group(3)) / 100
    return tuple(weight * a + (1 - weight) * b for a, b in zip(first, base, strict=True))


def luminance(color: Color) -> float:
    red, green, blue = (decode(it) for it in color)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast(first: Color, second: Color) -> float:
    """
    The contrast ratio of WCAG 2, from 1 to 21.
    """
    light, dark = sorted((luminance(first), luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)
