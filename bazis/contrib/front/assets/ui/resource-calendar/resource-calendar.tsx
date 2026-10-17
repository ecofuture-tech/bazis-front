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

// The calendar of a route set (`primitive: calendar` of the specs): its items on the days of a
// date or a date-time field (to the day of its `end`, an item that spans days), a month or a
// week at a time, `calendar:<entity>` with the days it shows in `data-from` and `data-to`,
// moved by `action:previous-period`, `action:next-period` and `action:today`. A day
// `day:<YYYY-MM-DD>` has the number of its items in `data-count` and its first items
// `row:<id>` (a cell `cell:<field>` per field of its label); a click on a day selects it, and
// the list of the selected day (today at first) shows all its items, `row:<id>` again. A month
// at the width of a phone has a dot on the days with items, which only the list of the day
// shows: no hidden copy of a row is in the page. The
// action that creates an item (`action:<id>`) is given the selected day. One list of the
// period (its first `LIMIT` items, the days of a date-time in the time zone of the browser).

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useState, type ComponentType, type ReactNode } from 'react';

import { Filter, pagination } from '@/bazis/client';
import type { Tone } from '@/bazis/generated/theme';
import { formatNumber, isoDate, useLanguage, weekStart } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import { useWide } from '@/bazis/ui/app-shell';
import {
  type FieldDisplay,
  type Fields,
  fieldValue,
  itemLabel,
  ItemValue,
  permitted,
  resourceAt,
  type ResourceObject,
  SOFT_TONES,
  text,
  titleFromText,
  useAnyLists,
  useListFields,
} from '@/bazis/ui/resource';
import { errorState, StatePanel, type ViewState } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** A month or a week at a time. */
export type CalendarView = 'month' | 'week';

/** The action that creates an item on the selected day, a button `action:<id>`, shown when the user may create. */
export interface CalendarAdd {
  id: string;
  label: ReactNode;
  /** Called with the selected day (`YYYY-MM-DD`): the form of the screen fills the field with it. */
  onAdd: (day: string) => void;
  icon?: ComponentType<{ className?: string }>;
}

export interface ResourceCalendarProps {
  /** The route set (`ROUTES` of the contract). */
  path: ListPath;
  /** The entity of the screen: `calendar:<entity>`. */
  entity: string;
  /** The date or date-time field of the day of an item. */
  field: string;
  /** The date or date-time field of the last day of an item that spans days. */
  end?: string | undefined;
  /** The fields that an item shows; the label of the resource of the contract by default. */
  label?: readonly string[] | undefined;
  /** The items whose boolean field is true, in a tone of the theme. */
  tone?: { field: string; tone: Tone } | undefined;
  /** The views the user switches between, the first shown at first: a month by default. */
  views?: readonly CalendarView[];
  /** The items of the calendar (the filter of the screen). */
  filter?: Filter | undefined;
  /** Called with the id of the item the user opens. */
  onOpen?: ((id: string) => void) | undefined;
  add?: CalendarAdd | undefined;
  /** How the values of fields are shown (`display` of the fields of the entity of the specs). */
  display?: Readonly<Record<string, FieldDisplay>>;
  /** The current moment (the tests); the moment of the first render by default. */
  now?: Date | undefined;
}

/** The items of a period read at most: a month of a busy calendar. */
const LIMIT = 500;
/** The items of a day of a month shown in its cell; the others in the list of the day. */
const SHOWN = 3;
const META = ['pagination', 'for_create'];
const FOCUS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** The local midnight of a day `YYYY-MM-DD`. */
function parseDay(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The first day of the week of a day (`firstDay` of `Intl`: Monday 1 … Sunday 7). */
function startOfWeek(date: Date, firstDay: number): Date {
  return addDays(date, -((date.getDay() - (firstDay % 7) + 7) % 7));
}

/** The days a view of the period of a day shows: whole weeks. */
function periodDays(anchor: Date, view: CalendarView, firstDay: number): Date[] {
  const first = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : anchor;
  const start = startOfWeek(first, firstDay);
  const last = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : anchor;
  const end = addDays(startOfWeek(last, firstDay), 6);
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** The day of a value of a date (as it is) or of a date-time (in the time zone of the browser). */
function dayOf(value: unknown, date: boolean): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (date) return value.slice(0, 10);
  const moment = new Date(value);
  return Number.isNaN(moment.getTime()) ? null : isoDate(moment);
}

/** The items of each day shown, in the order of their field. */
function byDay(
  rows: readonly ResourceObject[],
  days: readonly string[],
  field: string,
  end: string | undefined,
  date: boolean,
): Map<string, ResourceObject[]> {
  const result = new Map(days.map((it) => [it, [] as ResourceObject[]]));
  const sorted = [...rows].sort((a, b) =>
    text(fieldValue(a, field)).localeCompare(text(fieldValue(b, field))),
  );
  for (const row of sorted) {
    const first = dayOf(fieldValue(row, field), date);
    if (first === null) continue;
    const lastDay = end === undefined ? null : dayOf(fieldValue(row, end), date);
    const last = lastDay !== null && lastDay > first ? lastDay : first;
    for (const day of days) if (day >= first && day <= last) result.get(day)?.push(row);
  }
  return result;
}

interface ItemProps {
  item: ResourceObject;
  /** The fields of its label; its label of the contract (or its id) without them. */
  label: readonly string[];
  meta: Fields;
  display: Readonly<Record<string, FieldDisplay>>;
  tone: Tone | undefined;
  onOpen: ((id: string) => void) | undefined;
  /** The time of a date-time before the label (the list of a day). */
  time?: string | undefined;
  className?: string;
}

/** An item: its label, a button that opens it. */
function Item({ item, label, meta, display, tone, onOpen, time, className }: ItemProps) {
  const content = (
    <>
      {time !== undefined && <span className="shrink-0 text-muted-foreground tabular-nums">{time}</span>}
      {label.length > 0 ? (
        label.map((name) => (
          <span key={name} ref={titleFromText} data-bz={`cell:${name}`} className="min-w-0 truncate">
            <ItemValue item={item} name={name} fields={meta} display={display[name]} />
          </span>
        ))
      ) : (
        <span title={itemLabel(item)} className="min-w-0 truncate">
          {itemLabel(item)}
        </span>
      )}
    </>
  );
  const look = cn(
    'flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left',
    tone ? SOFT_TONES[tone] : 'bg-primary-soft text-primary-ink',
    className,
  );
  return (
    <div data-bz={`row:${item.id}`} className="min-w-0">
      {onOpen ? (
        <button
          type="button"
          className={cn(look, FOCUS, 'transition-opacity hover:opacity-80')}
          onClick={() => {
            onOpen(item.id);
          }}
        >
          {content}
        </button>
      ) : (
        <div className={look}>{content}</div>
      )}
    </div>
  );
}

/** The calendar of the items of a route set by day, with the list of the selected day. */
export function ResourceCalendar({
  path,
  entity,
  field,
  end,
  label,
  tone,
  views = ['month'],
  filter,
  onOpen,
  add,
  display = {},
  now,
}: ResourceCalendarProps) {
  const { language, t } = useLanguage();
  const listId = useId();
  const [today] = useState(() => isoDate(now ?? new Date()));
  const [view, setView] = useState<CalendarView>(views[0] ?? 'month');
  // the day whose period is shown, and the day whose items are listed (a day of the next month in the grid of a month)
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const wide = useWide();
  const meta = useListFields(path);
  const firstDay = weekStart(language);
  const days = periodDays(parseDay(anchor), view, firstDay);
  const keys = days.map((it) => isoDate(it));
  const from = keys[0] ?? today;
  const to = keys[keys.length - 1] ?? today;
  const labels = label ?? resourceAt(path)?.label ?? [];

  // the format of the bounds is that of the field: the list waits for its schema
  const spec = meta.fields.get(field);
  const date = spec?.kind === 'attribute' && spec.format === 'date';
  const bound = (day: string) => (date ? day : parseDay(day).toISOString());
  const after = isoDate(addDays(parseDay(to), 1));
  const starts = Filter.where(`${field}__lt`, bound(after));
  // an item that spans days is shown from its first day to its end
  const reaches =
    end === undefined
      ? Filter.where(`${field}__gte`, bound(from))
      : Filter.or(Filter.where(`${field}__gte`, bound(from)), Filter.where(`${end}__gte`, bound(from)));
  const conditions = Filter.and(...(filter ? [filter] : []), reaches, starts);
  const [list] = useAnyLists(path, meta.ready ? [{ filter: conditions, page: { limit: LIMIT }, meta: META }] : []);
  const document = list?.data;
  const rows = document?.data ?? [];
  const total = document ? pagination(document)?.count : undefined;
  const items = byDay(rows, keys, field, end, date);
  const state: ViewState =
    list?.status === 'error'
      ? errorState(list.error)
      : list?.status !== 'success'
        ? 'loading'
        : rows.length === 0
          ? 'empty'
          : 'loaded';

  // the previous or the next month or week; the first day of a month selected, today in its period
  function shift(step: number) {
    const current = parseDay(anchor);
    const next =
      view === 'month'
        ? new Date(current.getFullYear(), current.getMonth() + step, 1)
        : addDays(startOfWeek(current, firstDay), 7 * step);
    const shown = periodDays(next, view, firstDay).map((it) => isoDate(it));
    const inPeriod = view === 'month' ? today.slice(0, 7) === isoDate(next).slice(0, 7) : shown.includes(today);
    const day = inPeriod ? today : isoDate(next);
    setAnchor(day);
    setSelected(day);
  }

  const monthTitle = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' });
  const weekTitle = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' });
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' });
  const fullDay = new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' });
  const title =
    view === 'month' ? monthTitle.format(parseDay(anchor)) : weekTitle.formatRange(parseDay(from), parseDay(to));
  const month = parseDay(anchor).getMonth();
  const Add = add?.icon;
  const canAdd = add !== undefined && document !== undefined && permitted(document.meta, 'add');
  const selectedItems = items.get(selected) ?? [];
  const toneOf = (item: ResourceObject) => (tone && fieldValue(item, tone.field) === true ? tone.tone : undefined);

  function cell(day: Date) {
    const key = isoDate(day);
    const dayItems = items.get(key) ?? [];
    const isSelected = key === selected;
    const outside = view === 'month' && day.getMonth() !== month;
    const shown = view === 'month' ? dayItems.slice(0, SHOWN) : dayItems;
    // a month at the width of a phone: a dot, the items in the list of the day
    const dot = view === 'month' && !wide;
    return (
      <div
        key={key}
        data-bz={`day:${key}`}
        data-count={dayItems.length}
        className={cn(
          'grid min-w-0 content-start gap-1 bg-card',
          dot ? 'min-h-16 p-0.5' : view === 'month' ? 'min-h-28 p-1.5' : 'min-h-40 p-1.5',
          outside && 'bg-muted text-muted-foreground',
        )}
      >
        <div className="flex items-center gap-1.5">
          {view === 'week' && (
            <span aria-hidden="true" className="text-xs text-muted-foreground first-letter:uppercase">
              {weekday.format(day)}
            </span>
          )}
          <button
            type="button"
            aria-pressed={isSelected}
            aria-label={fullDay.format(day)}
            aria-controls={listId}
            className={cn(
              FOCUS,
              // a month at the width of a phone: the whole day is the button, with the dot of its items
              dot ? 'grid w-full justify-items-center gap-1 rounded-md py-1' : 'flex size-7 items-center justify-center rounded-full pointer-coarse:size-11',
              'text-sm tabular-nums',
            )}
            onClick={() => {
              setSelected(key);
            }}
          >
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted',
                key === today && 'font-semibold text-primary',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
              )}
            >
              {day.getDate()}
            </span>
            {dot && (
              <span
                aria-hidden="true"
                // in the tone of its first item that has one (an overdue item)
                className={cn('size-1.5 rounded-full', dayItems.length === 0 && 'invisible', SOFT_TONES[dayItems.map(toneOf).find(Boolean) ?? 'primary'], 'bg-current')}
              />
            )}
          </button>
        </div>
        {dot ? null : (
          <div className="grid min-w-0 gap-1 text-xs">
            {shown.map((item) => (
              <Item key={item.id} item={item} label={labels} meta={meta} display={display} tone={toneOf(item)} onOpen={onOpen} />
            ))}
            {dayItems.length > shown.length && (
              <button
                type="button"
                aria-controls={listId}
                className={cn(FOCUS, 'justify-self-start rounded px-1.5 text-muted-foreground hover:text-foreground')}
                onClick={() => {
                  setSelected(key);
                }}
              >
                {t('calendar.more', { count: formatNumber(dayItems.length - shown.length, language) })}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-bz={`calendar:${entity}`} data-from={from} data-to={to} className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            data-bz="action:previous-period"
            aria-label={t('calendar.previous')}
            onClick={() => {
              shift(-1);
            }}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            data-bz="action:next-period"
            aria-label={t('calendar.next')}
            onClick={() => {
              shift(1);
            }}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-bz="action:today"
            onClick={() => {
              setAnchor(today);
              setSelected(today);
            }}
          >
            {t('calendar.today')}
          </Button>
        </div>
        <h2 aria-live="polite" className="min-w-0 flex-1 text-lg font-semibold first-letter:uppercase max-sm:order-first max-sm:basis-full">
          {title}
        </h2>
        {views.length > 1 && (
          <div role="group" aria-label={t('calendar.view')} className="flex rounded-md border p-0.5">
            {views.map((it) => (
              <Button
                key={it}
                type="button"
                variant={it === view ? 'secondary' : 'ghost'}
                size="sm"
                data-bz={`view:${it}`}
                aria-pressed={it === view}
                onClick={() => {
                  setView(it);
                  setAnchor(selected);
                }}
              >
                {t(`calendar.${it}`)}
              </Button>
            ))}
          </div>
        )}
        {canAdd && (
          <Button
            type="button"
            data-bz={`action:${add.id}`}
            onClick={() => {
              add.onAdd(selected);
            }}
          >
            {Add && <Add />}
            {add.label}
          </Button>
        )}
      </div>
      {state === 'loaded' || state === 'empty' ? (
        <div data-bz={`state:${state}`} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="grid min-w-0 gap-2">
            {state === 'empty' && <p className="text-sm text-muted-foreground">{t('calendar.empty')}</p>}
            {total !== undefined && total > rows.length && (
              <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-ink">
                {t('calendar.truncated', { count: formatNumber(rows.length, language) })}
              </p>
            )}
            <div className="overflow-hidden rounded-xl border">
              {view === 'month' && (
                <div aria-hidden="true" className="grid grid-cols-7 border-b bg-muted/60 text-xs text-muted-foreground">
                  {days.slice(0, 7).map((day) => (
                    <span key={isoDate(day)} className="truncate px-2 py-1.5 first-letter:uppercase">
                      {weekday.format(day)}
                    </span>
                  ))}
                </div>
              )}
              <div className={cn('grid gap-px bg-border', view === 'month' ? 'grid-cols-7' : 'grid-cols-1 sm:grid-cols-7')}>
                {days.map((day) => cell(day))}
              </div>
            </div>
          </div>
          <section id={listId} aria-label={fullDay.format(parseDay(selected))} className="grid content-start gap-3 rounded-xl border bg-card p-(--space-card)">
            <h3 className="font-medium first-letter:uppercase">{fullDay.format(parseDay(selected))}</h3>
            {selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('calendar.no_items')}</p>
            ) : (
              <ul className="grid gap-1.5 text-sm">
                {selectedItems.map((item) => {
                  const moment = date ? null : fieldValue(item, field);
                  const at = typeof moment === 'string' && dayOf(moment, false) === selected ? time.format(new Date(moment)) : undefined;
                  return (
                    <li key={item.id}>
                      <Item item={item} label={labels} meta={meta} display={display} tone={toneOf(item)} onOpen={onOpen} time={at} className="py-1.5 pointer-coarse:min-h-11" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <StatePanel
          state={state}
          error={list?.error}
          onRetry={() => {
            void list?.refetch();
          }}
          skeleton={<Skeleton className="h-96 w-full rounded-xl" />}
        />
      )}
    </div>
  );
}
