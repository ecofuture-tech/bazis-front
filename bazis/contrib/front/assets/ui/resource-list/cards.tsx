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
// phone (`composition.list_phone`), where a table would scroll sideways; composed by `card` (its
// cover, its rubric, its title, its figure and its muted values), else by its first column.

import type { Tone } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { alignsDigits, fieldValue, titleFromText, type ResourceObject } from '@/bazis/ui/resource';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { cell, FOCUS, opener, PageCheckbox, RowCheckbox, type BodyProps, type CardLayout } from './rows.js';

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

/** The roles of the columns in a card: those of `card` among the columns, else the first column as the title. */
interface Roles {
  media?: string | undefined;
  eyebrow?: string | undefined;
  title?: string | undefined;
  figure?: string | undefined;
  meta: readonly string[];
  /** The other columns, pairs of a label and a value. */
  rest: readonly string[];
}

/** The column of each role of a card, by `card`; its defaults: the first column of an image is the cover, the first other one the title. */
export function cardRoles(
  columns: readonly string[],
  display: BodyProps['display'],
  card: CardLayout | undefined,
): Roles {
  if (card === undefined) {
    const [title, ...rest] = columns;
    return { title, meta: [], rest };
  }
  const shown = (name: string | undefined) => (name !== undefined && columns.includes(name) ? name : undefined);
  const media = card.media === undefined ? columns.find((name) => display[name] === 'image') : shown(card.media);
  const meta = (card.meta ?? []).filter((name) => columns.includes(name));
  const taken = new Set([media, card.eyebrow, card.figure, ...meta]);
  const title = card.title === undefined ? columns.find((name) => !taken.has(name)) : shown(card.title);
  const roles = new Set([...taken, title]);
  return {
    media,
    eyebrow: shown(card.eyebrow),
    title,
    figure: shown(card.figure),
    meta,
    rest: columns.filter((name) => !roles.has(name)),
  };
}

/** Whether a field of an item has no value: no cover then, but the icon of the entity. */
function empty(row: ResourceObject, name: string): boolean {
  const value = fieldValue(row, name);
  return value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);
}

/**
 * The rows as a grid of cards: the cover (`card-media`), the rubric (`card-eyebrow`), the title and
 * the figure (`card-figure`) of `card`, each without its label but for the readers of the screen,
 * its muted values (`card-meta`), each after its label, then the other columns as pairs of a label
 * and a value;
 * above them, when the rows are selectable, the checkbox of the page.
 */
export function CardsView(props: BodyProps) {
  const { rows, columns, fields, onOpen, selected, hidden, selection, icon: Icon } = props;
  const { t } = useLanguage();
  const { media, eyebrow, title, figure, meta, rest } = cardRoles(columns, props.display, props.card);
  // a value without its label, which the readers of the screen hear before it
  const label = (name: string) => <span className="sr-only">{fields.title(name)}: </span>;
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
                  'group flex w-full flex-col gap-4 rounded-2xl border bg-card p-(--space-card) text-card-foreground shadow-xs transition-[box-shadow,border-color]',
                  tone && CARD_TONES[tone],
                  'data-[state=selected]:border-primary',
                  onOpen && cn('cursor-pointer hover:border-primary/40 hover:shadow-md', FOCUS, 'focus-visible:ring-offset-0'),
                )}
                {...opener(row.id, onOpen)}
              >
                {media !== undefined && (
                  <div
                    data-slot="card-media"
                    data-bz={`cell:${media}`}
                    className={cn(
                      '-mx-(--space-card) -mt-(--space-card) overflow-hidden rounded-t-[inherit] border-b bg-muted',
                      // the cover comes closer under the pointer, a gesture of a shop window
                      '[&_img]:transition-transform [&_img]:duration-(--motion-slow) group-hover:[&_img]:scale-[1.03]',
                      hidden(media) && 'hidden',
                    )}
                  >
                    {empty(row, media) && !props.cells[media] ? (
                      <div className="flex aspect-[4/3] w-full items-center justify-center text-muted-foreground">
                        {Icon && <Icon className="size-10" aria-hidden="true" />}
                      </div>
                    ) : (
                      cell(props, row, media, true)
                    )}
                  </div>
                )}
                {(title !== undefined || eyebrow !== undefined || selection) && (
                  <div className="flex items-start gap-3">
                    <div className="grid min-w-0 flex-1 gap-1">
                      {eyebrow !== undefined && (
                        <p
                          data-slot="card-eyebrow"
                          className={cn(
                            'text-[0.6875rem] font-semibold tracking-[0.08em] text-brand uppercase',
                            hidden(eyebrow) && 'hidden',
                          )}
                        >
                          {label(eyebrow)}
                          <span data-bz={`cell:${eyebrow}`}>{cell(props, row, eyebrow)}</span>
                        </p>
                      )}
                      {title !== undefined && (
                        <h3 data-bz={`cell:${title}`} className="font-heading text-lg leading-snug wrap-anywhere">
                          {cell(props, row, title)}
                        </h3>
                      )}
                    </div>
                    {selection && (
                      <span className="ml-auto flex h-7 items-center">
                        <RowCheckbox id={row.id} selection={selection} onSelect={props.onSelect} />
                      </span>
                    )}
                  </div>
                )}
                {(figure !== undefined || meta.length > 0) && (
                  <div className="grid gap-0.5">
                    {figure !== undefined && (
                      <p
                        data-slot="card-figure"
                        className={cn('font-heading text-xl', hidden(figure) && 'hidden')}
                      >
                        {label(figure)}
                        <span data-bz={`cell:${figure}`}>{cell(props, row, figure)}</span>
                      </p>
                    )}
                    {meta.length > 0 && (
                      <p data-slot="card-meta" className="text-sm text-muted-foreground">
                        {meta.map((name, index) => (
                          <span key={name} className={cn(hidden(name) && 'hidden')}>
                            {index > 0 && ' · '}
                            <span className="inline-block first-letter:uppercase">{fields.title(name)}</span>{' '}
                            <span data-bz={`cell:${name}`}>{cell(props, row, name)}</span>
                          </span>
                        ))}
                      </p>
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
                          className={cn('min-w-0 truncate text-right', alignsDigits(fields.fields.get(name)) && 'tabular-nums')}
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

/** The skeleton of the cards while the list loads, with their covers (`media`). */
export function CardsSkeleton({ media = false }: { media?: boolean }) {
  return (
    <div className="@container" aria-hidden="true">
      <div className={GRID}>
        {[0, 1, 2].map((it) => (
          <div key={it} className="grid gap-4 overflow-hidden rounded-2xl border bg-card p-(--space-card)">
            {media && <Skeleton className="-mx-(--space-card) -mt-(--space-card) aspect-[4/3] rounded-none" />}
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
