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

// The rows of a list as a grid of cards: the list of `composition.list: cards`, and that of a
// phone (`composition.list_phone`), where a table would scroll sideways.

import type { Tone } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { isNumeric, titleFromText } from '@/bazis/ui/resource';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { cell, FOCUS, opener, PageCheckbox, RowCheckbox, type BodyProps } from './rows.js';

/** The colors of a highlighted card, by its tone. */
const CARD_TONES: Readonly<Record<Tone, string>> = {
  neutral: 'border-neutral bg-neutral-soft',
  primary: 'border-primary bg-primary-soft',
  info: 'border-info bg-info-soft',
  success: 'border-success bg-success-soft',
  warning: 'border-warning bg-warning-soft',
  danger: 'border-danger bg-danger-soft',
};

/**
 * The columns of the grid of cards by its own width, not that of the page: one in a card next to
 * its list as on a phone, two from 36rem, three from 56rem.
 */
const GRID = 'grid grid-cols-[minmax(0,1fr)] gap-4 @xl:grid-cols-2 @4xl:grid-cols-3';

/**
 * The rows as a grid of cards: the first column is the title, the others pairs of a label and
 * a value; above them, when the rows are selectable, the checkbox of the page.
 */
export function CardsView(props: BodyProps) {
  const { rows, columns, fields, onOpen, selected, hidden, selection } = props;
  const { t } = useLanguage();
  const [first, ...rest] = columns;
  return (
    <div className="@container grid grid-cols-[minmax(0,1fr)] gap-3">
      {selection && (
        <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <PageCheckbox rows={rows} selection={selection} onSelect={props.onSelect} />
          {t('list.select_all')}
        </label>
      )}
      <ul className={GRID}>
        {rows.map((row) => {
          const tone = props.rowTone(row);
          return (
            <li key={row.id} className="flex">
              <article
                data-bz={`row:${row.id}`}
                data-state={row.id === selected ? 'selected' : undefined}
                data-tone={tone}
                aria-description={tone && props.rowToneLabel(row)}
                className={cn(
                  'flex w-full flex-col gap-4 rounded-2xl border bg-card p-(--space-card) text-card-foreground shadow-xs transition-[box-shadow,border-color]',
                  tone && CARD_TONES[tone],
                  'data-[state=selected]:border-primary',
                  onOpen && cn('cursor-pointer hover:border-primary/40 hover:shadow-md', FOCUS, 'focus-visible:ring-offset-0'),
                )}
                {...opener(row.id, onOpen)}
              >
                {(first !== undefined || selection) && (
                  <div className="flex items-start gap-3">
                    {first !== undefined && (
                      <h3 data-bz={`cell:${first}`} className="min-w-0 flex-1 font-display text-lg leading-snug font-semibold wrap-anywhere">
                        {cell(props, row, first)}
                      </h3>
                    )}
                    {selection && (
                      <span className="ml-auto flex h-7 items-center">
                        <RowCheckbox id={row.id} selection={selection} onSelect={props.onSelect} />
                      </span>
                    )}
                  </div>
                )}
                {rest.length > 0 && (
                  <dl className="grid grid-cols-[minmax(0,1fr)] gap-2 text-sm">
                    {rest.map((name) => (
                      <div key={name} className={cn('flex items-center justify-between gap-4', hidden(name) && 'hidden')}>
                        <dt className="text-muted-foreground first-letter:uppercase">{fields.title(name)}</dt>
                        <dd
                          ref={titleFromText}
                          data-bz={`cell:${name}`}
                          className={cn('min-w-0 truncate text-right', isNumeric(fields.fields.get(name)) && 'tabular-nums')}
                        >
                          {cell(props, row, name)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mt-auto flex justify-end gap-1 empty:hidden">{props.rowActions(row)}</div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The skeleton of the cards while the list loads. */
export function CardsSkeleton() {
  return (
    <div className="@container" aria-hidden="true">
      <div className={GRID}>
        {[0, 1, 2].map((it) => (
          <div key={it} className="grid gap-4 rounded-2xl border bg-card p-(--space-card)">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
