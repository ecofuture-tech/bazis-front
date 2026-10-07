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
The three-way merge of the lines of a text (diff3), on `difflib.SequenceMatcher`.

The base is aligned with each side by the matching blocks of `SequenceMatcher`. A line of
the base that both sides keep is stable: the merge walks the base from stable line to
stable line, and each stretch between two of them is a region where the base, the local
side and the upstream side may differ. A region that only one side changed takes that
side; one that both changed in the same way takes it once; one that they changed in
different ways is a conflict, written with the markers of git, after the lines that both
sides begin and end it with. As in git, changes of the two sides that touch (adjacent lines,
or insertions at the same place) are a conflict: only an unchanged line between them keeps
them apart.
"""

from difflib import SequenceMatcher


def lines(text: str) -> list[str]:
    """
    The lines of a text with their ends, split at '\n' only; the last one has no end when
    the text does not end with one.
    """
    parts = text.split('\n')
    return [f'{it}\n' for it in parts[:-1]] + ([parts[-1]] if parts[-1] else [])


def kept(base: list[str], side: list[str]) -> dict[int, int]:
    """
    The lines of the base that the side keeps: the index of each in the side, by its index
    in the base (increasing in both).
    """
    matcher = SequenceMatcher(None, base, side, autojunk=False)
    return {
        i + offset: j + offset
        for i, j, size in matcher.get_matching_blocks()
        for offset in range(size)
    }


def ended(chunk: list[str]) -> list[str]:
    """
    The lines of a side of a conflict, the last one ended so that a marker follows on a line
    of its own.
    """
    if chunk and not chunk[-1].endswith('\n'):
        return [*chunk[:-1], chunk[-1] + '\n']
    return chunk


def merge_lines(
    base: list[str],
    local: list[str],
    upstream: list[str],
    local_name: str,
    upstream_name: str,
) -> tuple[list[str], bool]:
    """
    The merged lines and whether they have a conflict.
    """
    in_local, in_upstream = kept(base, local), kept(base, upstream)
    # the stable lines, and the ends of the three texts as the last one
    stable = [
        (i, in_local[i], in_upstream[i]) for i in range(len(base))
        if i in in_local and i in in_upstream
    ]
    stable.append((len(base), len(local), len(upstream)))

    result: list[str] = []
    conflict = False
    previous = (-1, -1, -1)
    for current in stable:
        region = [
            text[start + 1:end]
            for text, start, end in zip((base, local, upstream), previous, current, strict=True)
        ]
        old, mine, theirs = region
        if mine == old or mine == theirs:
            result += theirs
        elif theirs == old:
            result += mine
        else:
            # the lines that both sides begin and end the region with are not in conflict
            head = 0
            while head < min(len(mine), len(theirs)) and mine[head] == theirs[head]:
                head += 1
            tail = 0
            while (
                tail < min(len(mine), len(theirs)) - head
                and mine[len(mine) - 1 - tail] == theirs[len(theirs) - 1 - tail]
            ):
                tail += 1
            conflict = True
            result += mine[:head]
            result.append(f'<<<<<<< {local_name}\n')
            result += ended(mine[head:len(mine) - tail])
            result.append('=======\n')
            result += ended(theirs[head:len(theirs) - tail])
            result.append(f'>>>>>>> {upstream_name}\n')
            result += mine[len(mine) - tail:]
        if current[0] < len(base):
            result.append(base[current[0]])
        previous = current
    return result, conflict
