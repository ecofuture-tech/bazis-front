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

// Dates and numbers in the language of the interface (`useLanguage().language`), with
// `Intl`: never in the language of the browser, so that a page is in one language.

const DATE: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };
const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** A number: `1,234.5` in English, `1 234,5` in Russian. */
export function formatNumber(value: number, language: string, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(language, options);
}

/** A decimal as the backend writes it: digits, and the digits after the point. */
const DECIMAL = /^[+-]?\d+(?:\.(\d+))?$/;

/**
 * A decimal of the backend: a `DecimalField` is a string in the API and in the contract
 * (`"45000.10"`, its exact digits), formatted exactly with the digits after the point that it
 * has (`45,000.10` in English, `45 000,10` in Russian) unless `options` sets them; a sum is
 * `{style: 'currency', currency: 'RUB'}` (`45 000,10 ₽`). It takes the value of a field as it
 * is (`fieldValue(row, 'total')`): a number is formatted as `formatNumber` does, no value
 * (null, undefined, '') is `—` as `FieldValue` shows it, another value its text.
 */
export function formatDecimal(value: unknown, language: string, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return formatNumber(value, language, options);
  if (typeof value !== 'string') return JSON.stringify(value);
  const text = value.trim();
  const match = DECIMAL.exec(text);
  if (!match) return value;
  const digits = Math.min(match[1]?.length ?? 0, 20);
  const precision =
    options?.minimumFractionDigits === undefined && options?.maximumFractionDigits === undefined
      ? { minimumFractionDigits: digits, maximumFractionDigits: digits }
      : {};
  // Intl formats the string itself (ES2023), never rounded to a double first
  return new Intl.NumberFormat(language, { ...precision, ...options }).format(text as unknown as number);
}

/**
 * A date of the backend (`2026-10-08`, read as that day wherever the user is) or a Date;
 * the text when it is not a date.
 */
export function formatDate(value: string | Date, language: string): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString(language, DATE);
  const [year, month, day] = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').map(Number) : [];
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(language, DATE);
}

/** A date-time of the backend (ISO) or a Date, with the date and the time; the text when it is not one. */
export function formatDateTime(value: string | Date, language: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value instanceof Date ? '' : value;
  return date.toLocaleString(language, DATE_TIME);
}

/** The time of a Date: hours and minutes. */
export function formatTime(value: Date, language: string): string {
  return value.toLocaleTimeString(language, TIME);
}
