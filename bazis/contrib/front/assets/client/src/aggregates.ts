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

// The aggregates of a list of the core (bazis 2.17): `meta: ['aggregates']` with
// `aggregate` (the terms: `count`, `sum(<field>)`, `avg(…)`, `min(…)`, `max(…)`, `count(…)`)
// and `group` (`<field>` or `<date field>:day|week|month`), over the objects of the list with
// its filter and search, never its page. Without `group` the meta is the values by term,
// with it the groups in the order of their values, the group null (the objects without a
// value) last.

/**
 * The value of a term: a count an integer, an average a number, a sum of a decimal field
 * its digits as a string (`"60.50"`), a minimum or a maximum of a date ISO 8601; null over
 * no object (a count is 0).
 */
export type AggregateValue = number | string | null;

/** The values of the terms by term, as written in `aggregate` (`sum(amount)`). */
export type AggregateValues = Readonly<Record<string, AggregateValue>>;

/** A group of `group`: its value as a string (a choice, `true`, the id of a related item, the first day of a bucket), null for the objects without one. */
export interface AggregatesGroup {
  group: string | null;
  values: AggregateValues;
}

/** `meta.aggregates`: the values without `group`, the groups with it. */
export type AggregatesMeta = AggregateValues | readonly AggregatesGroup[];

interface ListDocument {
  meta?: { aggregates?: AggregatesMeta | null } | null;
}

/** The values of the terms of a list asked for without `group`; null without the meta. */
export function aggregateValues(document: ListDocument): AggregateValues | null {
  const meta = document.meta?.aggregates;
  return meta && !Array.isArray(meta) ? (meta as AggregateValues) : null;
}

/** The groups of a list asked for with `group`; null without the meta. */
export function aggregateGroups(document: ListDocument): readonly AggregatesGroup[] | null {
  const meta = document.meta?.aggregates;
  return Array.isArray(meta) ? meta : null;
}
