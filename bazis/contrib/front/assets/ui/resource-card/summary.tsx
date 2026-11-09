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

// The summary of an item under the heading of its card (`card.summary` of the spec), marked
// `data-slot="card-summary"`: its days as one range of the language with their number, its muted
// values under them and its figure large, each value marked `field:<name>` as those of the
// sections.

import type { ReactNode } from 'react';

import { useLanguage } from '@/bazis/i18n';
import { FieldValue, fieldValue, type FieldDisplay, type Fields, type ResourceObject } from '@/bazis/ui/resource';
import { cn } from '@/lib/utils';

/** The summary of a card: fields of the item, which need no section. */
export interface CardSummary {
  /** The first and the last day (date or date-time fields), shown as one range with the number of its days. */
  range?: readonly [string, string];
  /** The main value (a number, a sum, a date), shown large in the heading font. */
  figure?: string;
  /** Values in a muted line under the range, each without its label. */
  meta?: readonly string[];
}

/** The fields of a summary, in the order of the edit of the card. */
export function summaryFields(summary: CardSummary | undefined): readonly string[] {
  if (summary === undefined) return [];
  return [...(summary.range ?? []), ...(summary.figure === undefined ? [] : [summary.figure]), ...(summary.meta ?? [])];
}

const DAY = 86_400_000;
const LABEL = 'text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase';

/** A date (at its midnight in the browser) or a date-time of the contract; null for none. */
function day(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The days as one range of the language (`2–4 ноября`), with the year when one of them is not in
 * this one, and the number of the days between them, one at least.
 */
function dayRange(from: Date, to: Date, language: string): { text: string; days: number } {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  const year = new Date().getFullYear();
  if (from.getFullYear() !== year || to.getFullYear() !== year) options.year = 'numeric';
  return {
    text: new Intl.DateTimeFormat(language, options).formatRange(from, to),
    days: Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY)),
  };
}

export interface SummaryProps {
  summary: CardSummary;
  item: ResourceObject;
  fields: Fields;
  values: Readonly<Record<string, (item: ResourceObject) => ReactNode>>;
  display: Readonly<Record<string, FieldDisplay>>;
}

/** The summary of the fields that the user may see in the item; nothing without any. */
export function Summary({ summary, item, fields, values, display }: SummaryProps) {
  const { language, t } = useLanguage();
  const range = summary.range?.every((name) => fields.has(name)) ? summary.range : undefined;
  const figure = summary.figure !== undefined && fields.has(summary.figure) ? summary.figure : undefined;
  const meta = (summary.meta ?? []).filter((name) => fields.has(name));
  if (range === undefined && figure === undefined && !meta.length) return null;
  const value = (name: string) =>
    values[name]?.(item) ?? <FieldValue field={fields.fields.get(name)} value={fieldValue(item, name)} type={item.type} display={display[name]} />;
  const [from, to] = range ? [day(fieldValue(item, range[0])), day(fieldValue(item, range[1]))] : [null, null];
  const days = from && to ? dayRange(from, to, language) : null;
  const left = range !== undefined || meta.length > 0;
  return (
    <div
      data-slot="card-summary"
      className={cn(
        // one surface, a line between its two parts: under the first on a phone, beside it wider
        'surface grid divide-line-10',
        left && figure !== undefined && 'max-sm:divide-y sm:grid-cols-[1.4fr_1fr] sm:divide-x',
      )}
    >
      {left && (
        <div className="grid content-start gap-1 p-(--space-card)">
          {range && (
            <>
              <span className={LABEL}>{t('card.range')}</span>
              {/* the range shows both of its fields */}
              <span data-bz={`field:${range[0]}`}>
                <span data-bz={`field:${range[1]}`} className="font-heading text-2xl">
                  {days?.text ?? '—'}
                </span>
              </span>
            </>
          )}
          {(days !== null || meta.length > 0) && (
            <p className="text-sm text-muted-foreground">
              {days !== null && t('card.range_days', { count: days.days })}
              {meta.map((name, index) => (
                <span key={name}>
                  {(index > 0 || days !== null) && ' · '}
                  <span className="sr-only">{fields.title(name)}: </span>
                  <span data-bz={`field:${name}`}>{value(name)}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
      {figure !== undefined && (
        <div className="grid content-start gap-1 p-(--space-card)">
          <span className={LABEL}>{fields.title(figure)}</span>
          <span data-bz={`field:${figure}`} className="font-heading text-3xl">
            {value(figure)}
          </span>
        </div>
      )}
    </div>
  );
}
