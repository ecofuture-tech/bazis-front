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

// The translation of the texts of the interface: flat dictionaries by language, keyed by
// stable ids (`state.error.title`), with parameters (`{name}`) and plural forms chosen by
// `Intl.PluralRules` (`<key>.one`, `<key>.few`, `<key>.other`, … with the parameter
// `count`). The dictionaries of the product are merged over those of the package.

import { formatNumber } from './format.js';

/** A dictionary: the text of each key in one language. */
export type Messages = Readonly<Record<string, string>>;

/** The parameters of a text: `{name}` in the text is replaced by `params.name`. */
export type Params = Readonly<Record<string, string | number>>;

/** A translation of a key with its parameters in the current language: `t('list.page', {from, to})`. */
export type Translate = (key: string, params?: Params) => string;

const PARAM = /\{(\w+)\}/g;

/** The plural rules of a language, built once (they are not free). */
const rules = new Map<string, Intl.PluralRules>();

function pluralRules(locale: string): Intl.PluralRules {
  let rule = rules.get(locale);
  if (rule === undefined) {
    rule = new Intl.PluralRules(locale);
    rules.set(locale, rule);
  }
  return rule;
}

/**
 * The text of a key in the first dictionary that has it (the product's, then the package's,
 * then those of the default language), its parameters replaced; the key itself when no
 * dictionary has it, so that a missing text shows where it is missing. With a number
 * `count`, the plural form of `locale` (`<key>.one`, `<key>.other`, …) comes first.
 */
export function translate(dictionaries: readonly Messages[], locale: string, key: string, params?: Params): string {
  const count = params?.count;
  const keys = typeof count === 'number' ? [`${key}.${pluralRules(locale).select(count)}`, `${key}.other`, key] : [key];
  let text: string | undefined;
  for (const candidate of keys) {
    text = dictionaries.find((it) => candidate in it)?.[candidate];
    if (text !== undefined) break;
  }
  if (text === undefined) return key;
  if (params === undefined) return text;
  return text.replace(PARAM, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? formatNumber(value, locale) : value;
  });
}
