// Copyright 2026 EcoFuture Technology Services LLC and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** A value of a filter condition; `null` is sent as `null`, booleans as `true`/`false`. */
export type FilterValue = string | number | boolean | null;

type FilterNode =
  | { readonly kind: 'condition'; readonly key: string; readonly value: string }
  | { readonly kind: 'group'; readonly op: '&' | '|'; readonly parts: readonly Filter[] };

// A key is a field path with an optional lookup (`price__gte`, `children__exists`), the
// full-text key `$search` or a model label (`entity.child_entity`).
const KEY = /^[A-Za-z0-9_.$]+$/;

/**
 * The `filter` expression of a Bazis list, as parsed by `bazis.core.utils.query_complex`:
 * conditions `key=value` combined with `&` and `|`, grouped with parentheses and negated
 * with `~`.
 *
 * The server decodes the expression twice before it parses it (`unquote_plus` of the query
 * parameter) and decodes every value once more, so every value is percent-encoded twice
 * inside the expression; the client encodes the expression once more as the query
 * parameter.
 */
export class Filter {
  private constructor(
    private readonly node: FilterNode,
    private readonly negated: boolean,
  ) {}

  /**
   * The condition `key=value`. An array is sent as a comma-separated list: the overlap of
   * an array field, a range `[start, end]`, a point or the ids of a model label.
   */
  static where(key: string, value: FilterValue | readonly FilterValue[]): Filter {
    if (!KEY.test(key)) {
      throw new TypeError(`Invalid filter key: ${JSON.stringify(key)}`);
    }
    let encoded: string;
    if (Array.isArray(value)) {
      if (!value.length) {
        throw new RangeError(`Empty list of values for the filter key ${key}`);
      }
      encoded = value.map((item: FilterValue) => encodeListItem(key, item)).join(',');
    } else {
      encoded = encodeValue(value as FilterValue);
    }
    return new Filter({ kind: 'condition', key, value: encoded }, false);
  }

  /** All the filters must match. */
  static and(...filters: readonly Filter[]): Filter {
    return Filter.group('&', filters);
  }

  /** At least one of the filters must match. */
  static or(...filters: readonly Filter[]): Filter {
    return Filter.group('|', filters);
  }

  /** The filter must not match. */
  static not(filter: Filter): Filter {
    return new Filter(filter.node, !filter.negated);
  }

  private static group(op: '&' | '|', filters: readonly Filter[]): Filter {
    const [first, ...rest] = filters;
    if (!first) {
      throw new RangeError('A filter group needs at least one filter');
    }
    return rest.length ? new Filter({ kind: 'group', op, parts: filters }, false) : first;
  }

  /** The expression, before it is encoded as the `filter` query parameter. */
  toString(): string {
    return this.render(false);
  }

  private render(nested: boolean): string {
    const neg = this.negated ? '~' : '';
    const { node } = this;
    if (node.kind === 'condition') {
      return `${neg}${node.key}=${node.value}`;
    }
    const inner = node.parts.map((part) => part.render(true)).join(node.op);
    return this.negated || nested ? `${neg}(${inner})` : inner;
  }
}

// Every character but [A-Za-z0-9-_.] is percent-encoded: `~ ( ) '` are left as is by
// encodeURIComponent but are operators of the grammar.
function encodeOnce(text: string): string {
  return encodeURIComponent(text).replace(
    /[!'()*~]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeValue(value: FilterValue): string {
  return encodeOnce(encodeOnce(value === null ? 'null' : String(value)));
}

function encodeListItem(key: string, item: FilterValue): string {
  // the server splits the list after it decodes the value
  if (typeof item === 'string' && item.includes(',')) {
    throw new RangeError(`A list value of the filter key ${key} cannot contain a comma`);
  }
  return encodeValue(item);
}
