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

// The errors of the backend in the language of the interface.

import { errorText, type ErrorObject } from '@/bazis/client';

import type { Translate } from './translate.js';

/** The key of the text of the validation errors of Pydantic by their type (`validation.<key>`). */
const VALIDATION: Readonly<Record<string, string>> = {
  missing: 'required',
  string_type: 'text',
  string_too_short: 'min_length',
  string_too_long: 'max_length',
  too_short: 'min_items',
  too_long: 'max_items',
  int_parsing: 'integer',
  int_type: 'integer',
  int_from_float: 'integer',
  float_parsing: 'number',
  float_type: 'number',
  decimal_parsing: 'number',
  decimal_type: 'number',
  decimal_max_digits: 'max_digits',
  decimal_max_places: 'max_places',
  greater_than: 'gt',
  greater_than_equal: 'ge',
  less_than: 'lt',
  less_than_equal: 'le',
  bool_parsing: 'boolean',
  bool_type: 'boolean',
  date_parsing: 'date',
  date_type: 'date',
  date_from_datetime_parsing: 'date',
  datetime_parsing: 'datetime',
  datetime_type: 'datetime',
  datetime_from_date_parsing: 'datetime',
  time_parsing: 'time',
  time_type: 'time',
  enum: 'choice',
  literal_error: 'choice',
  url_parsing: 'url',
  url_type: 'url',
  url_scheme: 'url',
  uuid_parsing: 'id',
  uuid_type: 'id',
};

/** The keys whose text has the limit of the error (`at least {count} characters`). */
const LIMITED: ReadonlySet<string> = new Set(['min_length', 'max_length', 'min_items', 'max_items', 'max_digits', 'max_places', 'gt', 'ge', 'lt', 'le']);

/**
 * The limit in the message of a validation error, a number of its own (`at least 3
 * characters`, `greater than -1.5`), never a part of a date or a time (`2020-01-01`).
 */
const LIMIT = /(?<![\w.:-])-?\d+(?:\.\d+)?(?![\w:-])/;

/**
 * The text of an error of the backend in the language of the interface: a validation error of
 * Pydantic (`ERR_VALIDATE`, its type in `title`: `missing`, `string_too_short`…) by the key
 * `validation.<key>` of the dictionaries, its limit as `count`; else, and when its limit is
 * not a number (a date), its text (`errorText`: a validator of the product says it in the
 * language of the request). `BazisProvider` gives it to the hooks (`errorMessage`).
 */
export function errorMessage(error: ErrorObject, t: Translate): string {
  const key = error.code === 'ERR_VALIDATE' && error.title ? VALIDATION[error.title] : undefined;
  if (key === undefined) return errorText(error);
  if (!LIMITED.has(key)) return t(`validation.${key}`);
  const limit = LIMIT.exec(error.detail ?? '')?.[0];
  return limit === undefined ? errorText(error) : t(`validation.${key}`, { count: Number(limit) });
}
