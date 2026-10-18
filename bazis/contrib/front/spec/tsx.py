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
TypeScript and TSX code as prettier formats it, for the screens generated from the specs
(`screens.py`): the expressions and the statements that they use, printed with the
algorithm of prettier (its documents: groups that break when their content does not fit
in the width of a line, the indentation of what they break) and the layouts that it gives
each kind of node, in the style of the template (single quotes, 120 columns, the trailing
commas of every list). The code is written without Node, the same for the same specs, and
`prettier --check` leaves it as it is.
"""

import json
import re
import unicodedata
from dataclasses import dataclass, field


WIDTH = 120
INDENT = 2


# The documents of prettier: a text, a list of documents, a group (printed on one line when
# it fits, else broken), an indentation, a line (a space or nothing on one line, a new line
# when its group breaks; a hard line always breaks), the contents of a broken or a flat
# group, and a group of alternatives, the first that fits.


@dataclass
class Group:
    contents: object
    broken: bool = False
    #: the alternatives of a conditional group, from the flattest
    states: list | None = None


@dataclass
class Indent:
    contents: object
    #: spaces added to the indentation (an alignment) instead of one level
    align: int = 0


@dataclass(frozen=True)
class Line:
    soft: bool = False
    hard: bool = False


@dataclass
class IfBreak:
    broken: object
    flat: object = ''
    #: the group whose mode decides, that of the enclosing group by default
    of: Group | None = None


class BreakParent:
    """Breaks the groups around it, printing nothing."""


LINE, SOFTLINE, HARDLINE, BREAK_PARENT = Line(), Line(soft=True), Line(hard=True), BreakParent()


def group(*contents, broken: bool = False) -> Group:
    return Group(list(contents), broken)


def indent(*contents) -> Indent:
    return Indent(list(contents))


def align(spaces: int, *contents) -> Indent:
    return Indent(list(contents), spaces)


def join(separator, docs) -> list:
    result = []
    for i, doc in enumerate(docs):
        if i:
            result.append(separator)
        result.append(doc)
    return result


def _propagate(doc) -> bool:
    """
    Breaks the groups that contain a hard line, as prettier does before it prints; whether
    the document contains one. A conditional group is not broken: its alternatives decide.
    """
    if isinstance(doc, list):
        found = False
        for it in doc:
            found = _propagate(it) or found
        return found
    if isinstance(doc, Line):
        return doc.hard
    if isinstance(doc, BreakParent):
        return True
    if isinstance(doc, Group):
        if doc.states is not None:
            for state in doc.states:
                _propagate(state)
            return False
        found = _propagate(doc.contents)
        doc.broken = doc.broken or found
        return doc.broken
    if isinstance(doc, Indent):
        return _propagate(doc.contents)
    if isinstance(doc, IfBreak):
        return _propagate(doc.broken) | _propagate(doc.flat)
    return False


def width(text: str) -> int:
    """The columns of a text: two for a wide character, as prettier counts them."""
    return sum(2 if unicodedata.east_asian_width(it) in 'WF' else 1 for it in text)


BREAK, FLAT = 'break', 'flat'


def _fits(next_command, rest: list, remaining: int, modes: dict, must_be_flat: bool = False) -> bool:
    commands, rest_index = [next_command], len(rest)
    while remaining >= 0:
        if not commands:
            if rest_index == 0:
                return True
            rest_index -= 1
            commands.append(rest[rest_index])
            continue
        level, mode, doc = commands.pop()
        if isinstance(doc, str):
            remaining -= width(doc)
        elif isinstance(doc, list):
            commands.extend((level, mode, it) for it in reversed(doc))
        elif isinstance(doc, Indent):
            commands.append((level, mode, doc.contents))
        elif isinstance(doc, Group):
            if must_be_flat and doc.broken:
                return False
            group_mode = BREAK if doc.broken else mode
            contents = doc.states[-1] if doc.states is not None and group_mode == BREAK else doc.contents
            commands.append((level, group_mode, contents))
        elif isinstance(doc, IfBreak):
            group_mode = modes.get(id(doc.of), FLAT) if doc.of is not None else mode
            commands.append((level, mode, doc.broken if group_mode == BREAK else doc.flat))
        elif isinstance(doc, Line):
            if mode == BREAK or doc.hard:
                return True
            if not doc.soft:
                remaining -= 1
    return False


def _choose(doc: Group, level: int, mode: str, rest: list, remaining: int, modes: dict) -> tuple:
    """The command printing a group: flat when it fits, else its first state that fits, else broken."""
    broken = (level, BREAK, doc.states[-1] if doc.states is not None else doc.contents)
    if doc.broken:
        return broken
    if mode == FLAT or _fits((level, FLAT, doc.contents), rest, remaining, modes):
        return (level, FLAT, doc.contents)
    if doc.states is None:
        return broken
    states = (state for state in doc.states[1:-1] if _fits((level, FLAT, state), rest, remaining, modes))
    return next(((level, FLAT, state) for state in states), broken)


def render(doc) -> str:
    """The text of a document, as `printDocToString` of prettier prints it."""
    _propagate(doc)
    out: list[str] = []
    position = 0
    commands = [(0, BREAK, doc)]
    # the mode that each group was printed in, for the contents that depend on it
    modes: dict[int, str] = {}
    while commands:
        level, mode, doc = commands.pop()
        if isinstance(doc, str):
            out.append(doc)
            position += width(doc)
        elif isinstance(doc, list):
            commands.extend((level, mode, it) for it in reversed(doc))
        elif isinstance(doc, Indent):
            commands.append((level + (doc.align or INDENT), mode, doc.contents))
        elif isinstance(doc, Group):
            command = _choose(doc, level, mode, commands, WIDTH - position, modes)
            modes[id(doc)] = command[1]
            commands.append(command)
        elif isinstance(doc, IfBreak):
            group_mode = modes.get(id(doc.of), FLAT) if doc.of is not None else mode
            commands.append((level, mode, doc.broken if group_mode == BREAK else doc.flat))
        elif isinstance(doc, BreakParent):
            continue
        elif isinstance(doc, Line):
            if mode == FLAT and not doc.hard:
                if not doc.soft:
                    out.append(' ')
                    position += 1
                continue
            while out and out[-1].endswith((' ', '\t')):
                out[-1] = out[-1].rstrip(' \t')
                if not out[-1]:
                    out.pop()
            out.append('\n' + ' ' * level)
            position = level
    return ''.join(out)


# The expressions, each printed as prettier prints its kind of node.


class Expr:
    def doc(self, **context):
        raise NotImplementedError


@dataclass
class Raw(Expr):
    """An expression printed as it is, on one line: a name, a member, a number, `undefined`."""

    code: str

    def doc(self, **context):
        return self.code

    @property
    def member_chain(self) -> bool:
        """`a.b`, `a['b']`: the layout of an assignment of a chain of members."""
        return re.fullmatch(r"[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\['[^']*'\])+", self.code) is not None


def quote(value: str, preferred: str = "'") -> str:
    """
    A string literal in the quotes that need the fewest escapes, the preferred ones when as
    many, as prettier writes it.
    """
    other = '"' if preferred == "'" else "'"
    chosen = other if value.count(preferred) > value.count(other) else preferred
    inner = json.dumps(value, ensure_ascii=False)[1:-1].replace('\\"', '"')
    return chosen + inner.replace(chosen, '\\' + chosen) + chosen


@dataclass
class Str(Expr):
    value: str

    def doc(self, **context):
        return quote(self.value)


@dataclass
class Call(Expr):
    callee: str
    args: list = field(default_factory=list)

    def doc(self, **context):
        return [self.callee, arguments(self.args)]


@dataclass
class As(Expr):
    """`expression as type`: `as const`."""

    expression: Expr
    type: str

    def doc(self, **context):
        return [self.expression.doc(), f' as {self.type}']


@dataclass
class Void(Expr):
    argument: Expr

    def doc(self, **context):
        return ['void ', self.argument.doc()]


@dataclass
class Obj(Expr):
    #: the properties (key, value), a value None for a shorthand
    props: list

    def doc(self, **context):
        if not self.props:
            return '{}'
        return group(
            '{', indent(LINE, join([',', LINE], [prop(key, value) for key, value in self.props])),
            IfBreak(','), LINE, '}',
        )


@dataclass
class Arr(Expr):
    items: list

    def doc(self, **context):
        if not self.items:
            return '[]'
        # prettier breaks an array of more than one object (or array) of more than one entry
        broken = len(self.items) > 1 and all(
            (isinstance(it, Obj) and len(it.props) > 1) or (isinstance(it, Arr) and len(it.items) > 1)
            for it in self.items
        ) and len({type(it) for it in self.items}) == 1
        return group(
            '[', indent(SOFTLINE, join([',', LINE], [it.doc() for it in self.items])),
            IfBreak(','), SOFTLINE, ']', broken=broken,
        )


@dataclass
class Cond(Expr):
    test: Expr
    consequent: Expr
    alternate: Expr

    def doc(self, **context):
        return group(
            self.test.doc(),
            indent(LINE, '? ', align(2, self.consequent.doc()), LINE, ': ', align(2, self.alternate.doc())),
        )


@dataclass
class Block:
    """The block of statements of a function: each on its line."""

    statements: list

    def doc(self):
        if not self.statements:
            return '{}'
        return ['{', indent(HARDLINE, join(HARDLINE, [statement(it) for it in self.statements])), HARDLINE, '}']


@dataclass
class If:
    """`if (test) consequent`, a statement without a block."""

    test: Expr
    consequent: object

    def doc(self):
        return group('if (', self.test.doc(), ')', indent(LINE, statement(self.consequent)))


@dataclass
class Arrow(Expr):
    params: list
    body: object

    def doc(self, expand_last: bool = False, in_jsx: bool = False, **context):
        head = '(' + ', '.join(self.params) + ') =>'
        body = self.body
        if isinstance(body, Block):
            return group(head, ' ', body.doc())
        if isinstance(body, (Obj, Arr, Arrow, Jsx)):
            return group(head, ' ', body.doc(parent='arrow'))
        soft = expand_last or in_jsx
        parens = isinstance(body, Cond)
        return group(
            head,
            group(
                indent(LINE, IfBreak('', '(') if parens else '', body.doc(), IfBreak('', ')') if parens else ''),
                [IfBreak(',' if expand_last else ''), SOFTLINE] if soft else '',
            ),
        )


def huggable(arg: Expr) -> bool:
    """Whether a last argument is printed hugged by the parentheses of its call."""
    if isinstance(arg, Obj):
        return bool(arg.props)
    if isinstance(arg, Arr):
        return bool(arg.items)
    if isinstance(arg, Arrow):
        return isinstance(arg.body, (Block, Arrow, Obj, Arr, Call, Cond, Jsx))
    return False


def _expanded(arg: Expr):
    return arg.doc(expand_last=True) if isinstance(arg, Arrow) else arg.doc()


def arguments(args: list):
    """
    The arguments of a call, as `printCallArguments` of prettier prints them: on one line,
    else the last one hugged by the parentheses (an object, an array, a function), broken in
    its own content, else one per line.
    """
    if not args:
        return '()'
    printed = [it.doc() for it in args]

    def broken_out():
        return group('(', indent(LINE, join([',', LINE], [it.doc() for it in args])), ',', LINE, ')', broken=True)

    last, penultimate = args[-1], args[-2] if len(args) > 1 else None
    if not huggable(last) or (penultimate is not None and type(penultimate) is type(last)):
        return group('(', indent(SOFTLINE, join([',', LINE], printed)), IfBreak(','), SOFTLINE, ')')
    head = [[it, ', '] for it in printed[:-1]]
    if any(_propagate(it) for it in printed[:-1]):
        return broken_out()
    expanded = _expanded(last)
    states = [['(', *head, expanded, ')'], ['(', *head, group(_expanded(last), broken=True), ')'], broken_out()]
    return [BREAK_PARENT if _propagate(expanded) else '', Group(states[0], states=states)]


def prop(key: str, value: Expr | None):
    """
    A property of an object, `key: value` (`key` alone for a shorthand), in the layout of
    prettier for an assignment.
    """
    name = key if re.fullmatch(r'[A-Za-z_$][\w$]*', key) else quote(key)
    if value is None:
        return name
    return assignment(name, ':', value)


def assignment(left: str, operator: str, value: Expr):
    """
    `left operator value`, as prettier lays out an assignment: after the operator a string
    or a chain of members breaks to the next line (but after a short key), a function or a
    template literal stays, the others break in their own content first (`fluid`).
    """
    short_key = operator == ':' and width(left) < INDENT + 3
    right = value.doc(parent='assignment') if isinstance(value, Jsx) else value.doc()
    if not short_key and (isinstance(value, Str) or (isinstance(value, Raw) and value.member_chain)):
        return group(left, operator, group(indent(LINE, right)))
    if short_key or (isinstance(value, Arrow) and isinstance(value.body, Arrow)):
        return group(left, operator, ' ', right)
    line = group(indent(LINE))
    return group(left, operator, line, IfBreak(indent(right), right, of=line))


# the JSX


#: the name of a spread attribute, `{...value}`
SPREAD = '...'


@dataclass
class Attr:
    """
    An attribute of a JSX element: a string (`name="value"`), an expression, true (`name`),
    or the spread of an expression (named `SPREAD`).
    """

    name: str
    value: object = True


@dataclass
class Jsx(Expr):
    name: str
    attrs: list = field(default_factory=list)
    #: the elements and the expressions (`{expression}`) inside it
    children: list = field(default_factory=list)

    def opening(self):
        attrs = [attribute(it) for it in self.attrs]
        end = ' />' if not self.children else '>'
        if not attrs:
            return f'<{self.name}{end}'
        if len(self.attrs) == 1 and isinstance(self.attrs[0].value, str):
            return group(f'<{self.name} ', attrs[0], end)
        tail = [LINE, '/>'] if not self.children else [SOFTLINE, '>']
        return group(f'<{self.name}', indent(*[[LINE, it] for it in attrs]), *tail)

    def element(self):
        """
        The element, its children one per line; on one line when it fits, unless it has an
        element among them, more than one attribute, or more than one expression.
        """
        if not self.children:
            return self.opening()
        opening, closing = self.opening(), f'</{self.name}>'
        children = [it.doc() if isinstance(it, Jsx) else container(it) for it in self.children]
        lines = group(opening, indent(HARDLINE, join(HARDLINE, children)), HARDLINE, closing)
        expressions = [it for it in self.children if not isinstance(it, Jsx)]
        if len(expressions) < len(self.children) or len(self.attrs) > 1 or len(expressions) > 1 or _propagate(opening):
            return lines
        return Group([opening, *children, closing], states=[[opening, *children, closing], lines])

    def doc(self, parent: str | None = None, **context):
        """
        The element; in parentheses when it breaks as the body of a function, the value of
        a return or of an assignment (but in an attribute, a child, an array or an argument).
        """
        element = self.element()
        if parent not in ('arrow', 'return', 'assignment'):
            return element
        return group(IfBreak('('), indent(SOFTLINE, element), SOFTLINE, IfBreak(')'))


def attribute(attr: Attr):
    if attr.name == SPREAD:
        return ['{...', attr.value.doc(), '}']
    if attr.value is True:
        return attr.name
    if isinstance(attr.value, str):
        return f'{attr.name}={quote(attr.value, chr(34))}'
    return [attr.name, '=', container(attr.value)]


def container(expression: Expr):
    """
    An expression in JSX, `{expression}`: an object, an array, a function or a call hugged by
    the braces, the others (an element among them) indented when they break.
    """
    if isinstance(expression, (Obj, Arr, Arrow, Call)):
        return group('{', expression.doc(in_jsx=True) if isinstance(expression, Arrow) else expression.doc(), '}')
    return group('{', indent(SOFTLINE, expression.doc()), SOFTLINE, '}')


# the statements


def statement(it) -> object:
    """A statement: a text (`const x = y;`, printed as it is), a call or an `if`."""
    if isinstance(it, str):
        return it
    if isinstance(it, If):
        return it.doc()
    if isinstance(it, Return):
        return it.doc()
    if isinstance(it, Const):
        return it.doc()
    return [it.doc(), ';']


@dataclass
class Return:
    value: Expr

    def doc(self):
        if isinstance(self.value, Jsx):
            return ['return ', self.value.doc(parent='return'), ';']
        return ['return ', self.value.doc(), ';']


@dataclass
class Const:
    """`const name = value;`, exported or with a type."""

    name: str
    value: Expr
    exported: bool = False
    type: str | None = None

    def doc(self):
        left = ('export ' if self.exported else '') + 'const ' + self.name + (f': {self.type}' if self.type else '')
        return [assignment(left, ' =', self.value), ';']


@dataclass
class Function:
    """`function name(params): type { ... }`, exported."""

    name: str
    params: str
    body: Block
    returns: str | None = None
    exported: bool = True

    def doc(self):
        head = ('export ' if self.exported else '') + f'function {self.name}({self.params})'
        return [head + (f': {self.returns}' if self.returns else '') + ' ', self.body.doc()]


def imports(entries: dict[str, list[str]]) -> list[str]:
    """
    The import declarations of the names of each module (`type X` for a type), sorted as
    the template sorts them: the packages, then the modules of `@/`, then those next to the
    file, each group by module, the names case-insensitively.
    """
    groups: list[list[str]] = [[], [], []]
    for module in sorted(entries):
        names = sorted(set(entries[module]), key=lambda it: it.removeprefix('type ').lower())
        kind = 2 if module.startswith('.') else 1 if module.startswith('@/') else 0
        if all(it.startswith('type ') for it in names):
            text = render(_import('import type ', [it.removeprefix('type ') for it in names], module))
        else:
            text = render(_import('import ', names, module))
        groups[kind].append(text)
    return ['\n'.join(it) for it in groups if it]


def _import(keyword: str, names: list[str], module: str):
    return [
        keyword, group('{', indent(LINE, join([',', LINE], names)), IfBreak(','), LINE, '}'),
        ' from ', quote(module), ';',
    ]


def module(*parts) -> str:
    """
    A module: its parts (texts already printed, or documents) separated by an empty line,
    ending with a new line.
    """
    return '\n\n'.join(it if isinstance(it, str) else render(it) for it in parts if it) + '\n'
