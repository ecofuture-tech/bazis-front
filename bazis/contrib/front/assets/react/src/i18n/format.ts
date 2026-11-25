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

/**
 * The first day of the week in a language, `1` (Monday) to `7` (Sunday), as `Intl.Locale`
 * gives it (`7` in American English); Monday where the browser does not tell.
 */
export function weekStart(language: string): number {
  const locale = new Intl.Locale(language) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  return (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay ?? 1;
}

/** The day of a Date in the time zone of the browser as the backend writes a date: `2026-10-07`. */
export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A number rounded to zero has no sign (`-0.0001` → `0`, never `-0`): `signDisplay` of ES2023,
 * which the lib of the template (ES2022) does not type; `options` may set another.
 */
const SIGN: Intl.NumberFormatOptions = { signDisplay: 'negative' as Intl.NumberFormatOptions['signDisplay'] };

/**
 * The digits grouped by thousands from five digits, as most languages write a number (a year
 * `2020`, `1234.5`, `12,345`), unless `options` sets `useGrouping`.
 */
function grouping(value: number, options?: Intl.NumberFormatOptions): Intl.NumberFormatOptions | undefined {
  return options?.useGrouping !== undefined || Math.abs(value) >= 10_000 ? options : { ...options, useGrouping: false };
}

/**
 * A number: `12,345.5` in English, `12 345,5` in Russian, grouped by thousands from five
 * digits (`1234.5`); `{useGrouping: false}` never groups it. One rounded to zero has no sign.
 */
export function formatNumber(value: number, language: string, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(language, grouping(value, { ...SIGN, ...options }));
}

/**
 * A decimal as the backend writes it: digits, the digits after the point and an exponent
 * (Python writes a small one so, `0E-8`, `1.0E-7`, for a field with 7 decimal places or more).
 */
const DECIMAL = /^[+-]?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

/** The digits of the cents of a currency as `Intl` writes its sums (2 of RUB and EUR); none of a code that it refuses. */
function centsOf(currency: string | undefined, language: string): number | undefined {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return undefined;
  }
}

/**
 * The digits after the point of a value whose options set none: of a decimal those that are
 * significant (`12.000` → 0, `19.50` → 1), of a sum at least its cents unless it is whole
 * (`3600.00` → 0, `250.5` → 2) and those written with them when they are always shown; of a
 * number those of `Intl` (undefined), a whole sum without its cents.
 */
function fractionDigits(value: number | RegExpExecArray, cents: number | undefined, always: boolean): number | undefined {
  if (typeof value === 'number') return cents === undefined ? undefined : Number.isInteger(value) && !always ? 0 : cents;
  const [, whole = '', point = '', exponent = '0'] = value;
  // those written and those without the zeros at the end, shifted by the exponent
  const written = point.length - Number(exponent);
  const significant = (whole + point).replace(/0+$/, '');
  const digits = /[1-9]/.test(significant) ? Math.max(0, written - (whole + point).length + significant.length) : 0;
  if (cents === undefined) return digits;
  if (always) return Math.max(written, cents);
  return digits === 0 ? 0 : Math.max(digits, cents);
}

/**
 * A decimal of the backend: a `DecimalField` is a string in the API and in the contract
 * (`"45000.10"`, its exact digits), formatted with its significant digits after the point
 * (`45,000.1` in English, `45 000,1` in Russian, `12.000` is `12`, grouped as `formatNumber`
 * groups, a zero without a sign: `-0.00` is `0`), never rounded, unless `options` sets them. A
 * sum is `{style: 'currency', currency: 'RUB'}`: a whole one without its cents (`3600 ₽`), else
 * with at least the digits of its cents (`250,50 ₽`, `12,505 ₽`), and with all its digits and
 * cents with `trailingZeroDisplay: 'auto'` of `Intl` given (`3600,00 ₽`); a code that `Intl`
 * refuses (not of ISO 4217) after the number, as a unit (`45 000,10 euro`). It takes the value
 * of a field as it is (`fieldValue(row, 'total')`): a number is formatted as `formatNumber`
 * does (a whole sum without its cents), no value (null, undefined, '') is `—` as `FieldValue`
 * shows it, another value its text.
 */
export function formatDecimal(value: unknown, language: string, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'number' && typeof value !== 'string') return JSON.stringify(value);
  const text = String(value).trim();
  const match = typeof value === 'number' ? null : DECIMAL.exec(text);
  if (typeof value === 'string' && !match) return value;
  const currency = options?.style === 'currency' ? options.currency : undefined;
  const cents = currency === undefined ? undefined : centsOf(currency, language);
  // `trailingZeroDisplay` is of ES2023, which the lib of the template (ES2022) does not type
  const always = (options as { trailingZeroDisplay?: string } | undefined)?.trailingZeroDisplay === 'auto';
  const digits =
    options?.minimumFractionDigits === undefined && options?.maximumFractionDigits === undefined
      ? fractionDigits(match ?? Number(text), currency === undefined ? undefined : (cents ?? 2), always)
      : undefined;
  const places = digits === undefined ? undefined : Math.min(digits, 20);
  const refused = currency !== undefined && cents === undefined;
  const format: Intl.NumberFormatOptions = {
    ...SIGN,
    ...options,
    ...(places !== undefined && { minimumFractionDigits: places, maximumFractionDigits: places }),
    ...(refused && { style: 'decimal', currency: undefined }),
  };
  // Intl formats the string itself, its exponent too (ES2023), never rounded to a double first
  const shown = new Intl.NumberFormat(language, grouping(Number(text), format)).format(text as unknown as number);
  return refused ? `${shown}\u00a0${currency}` : shown;
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
