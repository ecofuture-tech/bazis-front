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
The three-way merge of `bazis_front update` (`vendor/merge.py`).
"""

import pytest

from bazis.contrib.front.vendor.merge import lines, merge_lines


BASE = ''.join(f'line {it}\n' for it in range(1, 11))


def merge(base, local, upstream):
    merged, conflict = merge_lines(lines(base), lines(local), lines(upstream), 'frontend', 'bazis-front 2')
    return ''.join(merged), conflict


def edit(text, **changes):
    """
    The text with its lines `line <n>` replaced: `n=None` deletes it.
    """
    result = []
    for it in lines(text):
        key = f'n{it.split()[1]}' if it.startswith('line ') else None
        if key in changes:
            if changes[key] is not None:
                result.append(changes[key])
        else:
            result.append(it)
    return ''.join(result)


def conflict(mine, theirs):
    return f'<<<<<<< frontend\n{mine}=======\n{theirs}>>>>>>> bazis-front 2\n'


def test_lines():
    assert lines('') == []
    assert lines('a\nb\n') == ['a\n', 'b\n']
    assert lines('a\nb') == ['a\n', 'b']
    assert lines('a\r\nb c\n') == ['a\r\n', 'b c\n']


def test_no_change():
    assert merge(BASE, BASE, BASE) == (BASE, False)


@pytest.mark.parametrize('line', [1, 5, 10])
def test_a_change_of_one_side(line):
    changed = edit(BASE, **{f'n{line}': 'changed\n'})
    assert merge(BASE, changed, BASE) == (changed, False)
    assert merge(BASE, BASE, changed) == (changed, False)


@pytest.mark.parametrize('text', ['first\n' + BASE, BASE.replace('line 5\n', 'line 5\nnew\n'), BASE + 'last\n'])
def test_an_insertion_of_one_side(text):
    assert merge(BASE, text, BASE) == (text, False)
    assert merge(BASE, BASE, text) == (text, False)


def test_the_same_change_of_both():
    changed = edit(BASE, n3='changed\n', n7=None)
    assert merge(BASE, changed, changed) == (changed, False)


def test_changes_of_both_apart():
    local = edit(BASE, n2='mine\n', n9=None)
    upstream = edit(BASE, n5='theirs\n') + 'last\n'
    assert merge(BASE, local, upstream) == (
        edit(BASE, n2='mine\n', n5='theirs\n', n9=None) + 'last\n', False,
    )
    # one unchanged line between them is enough
    assert merge(BASE, edit(BASE, n4='mine\n'), edit(BASE, n6='theirs\n')) == (
        edit(BASE, n4='mine\n', n6='theirs\n'), False,
    )


def test_adjacent_changes_conflict():
    merged, conflicted = merge(BASE, edit(BASE, n4='mine\n'), edit(BASE, n5='theirs\n'))
    assert conflicted
    assert merged == BASE.replace(
        'line 4\nline 5\n', conflict('mine\nline 5\n', 'line 4\ntheirs\n'),
    )


def test_a_conflict_of_the_same_lines():
    merged, conflicted = merge(BASE, edit(BASE, n5='mine\n'), edit(BASE, n5='theirs\n'))
    assert conflicted
    assert merged == BASE.replace('line 5\n', conflict('mine\n', 'theirs\n'))


def test_a_conflict_keeps_out_what_both_sides_have():
    # both sides replace lines 4 to 6 with the same first and last line
    local = BASE.replace('line 4\nline 5\nline 6\n', 'same\nmine\nend\n')
    upstream = BASE.replace('line 4\nline 5\nline 6\n', 'same\ntheirs\nend\n')
    merged, conflicted = merge(BASE, local, upstream)
    assert conflicted
    assert merged == BASE.replace('line 4\nline 5\nline 6\n', f'same\n{conflict("mine\n", "theirs\n")}end\n')


def test_insertions_at_the_same_place():
    local = BASE.replace('line 5\n', 'line 5\nmine\n')
    upstream = BASE.replace('line 5\n', 'line 5\ntheirs\n')
    merged, conflicted = merge(BASE, local, upstream)
    assert conflicted
    assert merged == BASE.replace('line 5\n', f'line 5\n{conflict("mine\n", "theirs\n")}')
    # the same insertion is taken once
    assert merge(BASE, local, local) == (local, False)


def test_a_deletion_and_an_edit():
    deleted, changed = edit(BASE, n5=None), edit(BASE, n5='theirs\n')
    merged, conflicted = merge(BASE, deleted, changed)
    assert conflicted
    assert merged == BASE.replace('line 5\n', conflict('', 'theirs\n'))
    merged, conflicted = merge(BASE, changed, deleted)
    assert conflicted
    assert merged == BASE.replace('line 5\n', conflict('theirs\n', ''))
    # a deletion of one side
    assert merge(BASE, deleted, BASE) == (deleted, False)
    assert merge(BASE, BASE, deleted) == (deleted, False)


def test_empty_texts():
    assert merge('', '', '') == ('', False)
    assert merge('', 'mine\n', '') == ('mine\n', False)
    assert merge('', '', 'theirs\n') == ('theirs\n', False)
    assert merge('', 'mine\n', 'theirs\n') == (conflict('mine\n', 'theirs\n'), True)
    # emptied by one side
    assert merge(BASE, '', BASE) == ('', False)
    merged, conflicted = merge(BASE, '', edit(BASE, n5='theirs\n'))
    assert conflicted


def test_the_end_of_the_last_line():
    base = 'a\nb'
    # the end added by one side, a line by the other
    assert merge(base, 'a\nb\n', 'z\na\nb') == ('z\na\nb\n', False)
    assert merge(base, 'z\na\nb', 'a\nb\n') == ('z\na\nb\n', False)
    # a conflict on a last line without its end: the markers are on lines of their own
    merged, conflicted = merge(base, 'a\nmine', 'a\ntheirs')
    assert conflicted
    assert merged == 'a\n' + conflict('mine\n', 'theirs\n')
    assert merge(base, base, base) == (base, False)


def test_repeated_lines():
    # the lines that a text repeats (blank lines, braces) align with the right ones
    base = 'a\n}\n\nb\n}\n\nc\n}\n'
    local = 'a\n}\n\nb2\n}\n\nc\n}\n'
    upstream = 'a\n}\n\nb\n}\n\nc\n}\n\nd\n}\n'
    assert merge(base, local, upstream) == ('a\n}\n\nb2\n}\n\nc\n}\n\nd\n}\n', False)
