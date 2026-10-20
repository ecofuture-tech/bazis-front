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

// The board of a statusy model (`primitive: board` of the specs): a column `column:<status>`
// per status of its workflow (the number of its items in `data-count`), its items as cards
// `row:<id>` with a cell `cell:<field>` per field, more of them by `action:more`. With `move`, a
// card moves to another column by a transit of bazis-statusy: the list of each column gives the
// transits that the user may run on its cards now (`for_transit`, bazis-statusy 2.13), a card
// with one has the menu `action:move` of them (`move:<status>`, the status it leads to, in the
// order of the specs) and is dragged, one without has neither; a card dropped on a column
// (`BoardDragProvider`, board-dnd) runs its transit to it; a transit whose action takes a payload
// (the JSON Schema of the contract) asks for it in a dialog, one that the specs confirm asks for
// its confirmation (`useRunTransit` of transit-bar); the refusal of a transit (the validators of
// the backend, which `for_transit` does not call: 422) is shown above the columns
// (`error:move`). A list of one page per column, refetched after a transit.

import { ArrowRightLeft, SearchX } from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';

import { Filter, pagination } from '@/bazis/client';
import { formatNumber, useLanguage } from '@/bazis/i18n';
import type { Transit, TransitPath } from '@/bazis/react/statusy';
import { EmptyState } from '@/bazis/ui/empty-state';
import type { Tone } from '@/bazis/generated/theme';
import {
  type FieldDisplay,
  type Fields,
  fieldValue,
  ItemValue,
  itemName,
  type ResourceObject,
  SOFT_TONES,
  StatusLabel,
  titleFromText,
  typeAt,
  useAnyLists,
  useListFields,
  workflowStatuses,
} from '@/bazis/ui/resource';
import { statusName, statusOf, transitName, transitTarget } from '@/bazis/ui/status-badge';
import { errorState, StatePanel, toast, type ViewState } from '@/bazis/ui/state-panel';
import { FilterBar, listFilters, type ListFilter } from '@/bazis/ui/resource-list';
import { inDeclaredOrder, listedTransit, useRunTransit, type DeclaredTransit, type TransitRun } from '@/bazis/ui/transit-bar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useBoardDrag } from './drag.js';

export interface ResourceBoardProps {
  /** The route set of a statusy model (`ROUTES` of the contract). */
  path: TransitPath;
  /** The entity of the screen: `board:<entity>`. */
  entity: string;
  /** The statuses of the columns, in this order; those of the workflow by default. */
  columns?: readonly string[];
  /** The field that titles a card (`card.title` of the spec). */
  title: string;
  /** The other fields of a card (`card.fields`). */
  fields?: readonly string[];
  /** A boolean field: a badge of its title on a card while it is true (`card.badge`, such as `is_overdue`). */
  badge?: string;
  /** The tone of the badge; warning by default. */
  badgeTone?: Tone;
  /** The items of the board (the filter of the screen); every item that the user may view without. */
  filter?: Filter | undefined;
  /** The filters of the user, as those of a list (`FilterBar` of resource-list), above the columns. */
  filters?: readonly (string | ListFilter)[];
  /** The order of the cards in a column. */
  sort?: readonly string[];
  /** Whether a card moves to another column by a transit (`move: true` of the spec); not by default. */
  move?: boolean;
  /** The transits of the workflow of the specs (`transits` of the generated entities): the order of the moves, those confirmed first. */
  transits?: readonly DeclaredTransit[];
  /** Called with the id of the card the user opens. */
  onOpen?: (id: string) => void;
  /** The cards of a column at first, and the more shown each time. */
  pageSize?: number;
  /** How the values of fields are shown (`display` of the fields of the entity of the specs). */
  display?: Readonly<Record<string, FieldDisplay>>;
  /** The message of an empty board, with the icon of the entity. */
  emptyMessage?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}

/** The menu of the moves of a card (`action:move`): the transits that the user may run on its item now. */
function MoveMenu({ item, moves, run }: { item: ResourceObject; moves: readonly Transit[]; run: TransitRun }) {
  const { language, t } = useLanguage();
  return (
    // modal: false, so that the dialog of a payload opens as the menu closes
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-bz="action:move"
          aria-label={t('board.move')}
          className="relative -my-1 -mr-1 text-muted-foreground"
        >
          <ArrowRightLeft />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {moves.map((transit) => {
          const target = transitTarget(item.type, transit.id);
          return (
            <DropdownMenuItem
              key={transit.id}
              data-bz={`move:${target ?? transit.id}`}
              onSelect={() => {
                run.start(item.id, transit);
              }}
            >
              {target === null ? transitName(item.type, transit.id, language) : statusName(item.type, target, language)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CardProps {
  item: ResourceObject;
  title: string;
  fields: readonly string[];
  meta: Fields;
  /** The badge of the card while its field is true. */
  badge: ReactNode;
  display: Readonly<Record<string, FieldDisplay>>;
  onOpen: ((id: string) => void) | undefined;
  /** The moves of the card; none when it does not move. */
  moves: ReactNode;
}

/** A card of an item: its title (a button that opens it), its badge, its menu of moves and its fields. */
function BoardCard({ item, title, fields, meta, badge, display, onOpen, moves }: CardProps) {
  const heading = (
    <span data-bz={`cell:${title}`} className="min-w-0 font-medium wrap-anywhere">
      <ItemValue item={item} name={title} fields={meta} display={display[title]} />
    </span>
  );
  return (
    <article
      data-bz={`row:${item.id}`}
      className="relative grid grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xs transition-shadow has-[button[data-open]:hover]:shadow-md"
    >
      <div className="flex items-start gap-2">
        {onOpen ? (
          // the whole card opens it: the title is a button stretched over it
          <button
            type="button"
            data-open=""
            className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
            onClick={() => {
              onOpen(item.id);
            }}
          >
            {heading}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{heading}</div>
        )}
        {badge}
        {moves}
      </div>
      {fields.length > 0 && (
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-1 text-sm">
          {fields.map((name) => (
            // the value beside its term while it keeps 6rem, else on the line under it; a long term wraps
            <div key={name} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <dt className="min-w-0 text-muted-foreground first-letter:uppercase">{meta.title(name)}</dt>
              <dd ref={titleFromText} data-bz={`cell:${name}`} className="min-w-0 grow basis-24 truncate">
                <ItemValue item={item} name={name} fields={meta} display={display[name]} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function and(filter: Filter | undefined, condition: Filter): Filter {
  return filter ? Filter.and(filter, condition) : condition;
}

/** The board of the items of a statusy model by status, with their moves. */
export function ResourceBoard({
  path,
  entity,
  columns,
  title,
  fields = [],
  badge,
  badgeTone = 'warning',
  filter: screenFilter,
  filters = [],
  sort,
  move = false,
  transits: declared = [],
  onOpen,
  pageSize = 20,
  display = {},
  emptyMessage,
  icon,
}: ResourceBoardProps) {
  const { language, t } = useLanguage();
  const type = typeAt(path) ?? '';
  const statuses = columns ?? workflowStatuses(type);
  const [limits, setLimits] = useState<Readonly<Record<string, number>>>({});
  const [userFilter, setUserFilter] = useState<Filter | undefined>();
  const filter = screenFilter && userFilter ? Filter.and(screenFilter, userFilter) : (screenFilter ?? userFilter);
  const meta = useListFields(path);
  const filterList = listFilters(filters, meta);
  const lists = useAnyLists(
    path,
    statuses.map((status) => ({
      filter: and(filter, Filter.where('status', status)),
      ...(sort ? { sort } : {}),
      page: { limit: limits[status] ?? pageSize },
      meta: move ? ['pagination', 'for_transit'] : ['pagination'],
    })),
  );
  const run = useRunTransit(path, undefined, declared);
  const { Area, Column, Card } = useBoardDrag(move);

  const failed = lists.find((it) => it.status === 'error');
  const rows = lists.map((it) => it.data?.data ?? []);
  const state: ViewState = failed
    ? errorState(failed.error)
    : lists.some((it) => it.status === 'pending') || !meta.ready
      ? 'loading'
      : rows.every((it) => it.length === 0)
        ? 'empty'
        : 'loaded';

  // the transits that the user may run on each card now, by its id: those of its column
  const forTransit = lists.reduce<Readonly<Record<string, readonly string[]>>>(
    (all, it) => ({ ...all, ...it.data?.meta?.for_transit }),
    {},
  );
  const movesOf = (item: ResourceObject) =>
    inDeclaredOrder((forTransit[item.id] ?? []).map((id) => listedTransit(item, id)), declared);

  // a card dropped on a column: the transit of the item to its status, if the user may run it now
  function drop(id: string, status: string) {
    const item = rows.flat().find((it) => it.id === id);
    if (!item || statusOf(item) === status) return;
    const transit = movesOf(item).find((it) => (transitTarget(item.type, it.id) ?? it.id) === status);
    if (transit) run.start(id, transit);
    else toast({ title: t('board.no_transit', { status: statusName(type, status, language) }), tone: 'danger' });
  }

  return (
    <div data-bz={`board:${entity}`} className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {filterList.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <FilterBar
            path={path}
            filters={filterList}
            ready={meta.ready}
            title={meta.title}
            onFilter={(next) => {
              setUserFilter(next);
              setLimits({});
            }}
          />
        </div>
      )}
      {run.open === null && run.mutation.isError && (
        <div data-bz="error:move">
          <StatePanel
            inline
            state={errorState(run.mutation.error)}
            error={run.mutation.error}
            message={run.mutation.error.message}
          />
        </div>
      )}
      {state === 'empty' ? (
        <EmptyState
          icon={userFilter ? SearchX : icon}
          title={userFilter ? t('list.no_match') : emptyMessage}
          {...(userFilter ? { description: t('list.no_match_hint') } : {})}
        />
      ) : (
        <StatePanel
          state={state}
          error={failed?.error}
          onRetry={() => {
            for (const it of lists) void it.refetch();
          }}
          skeleton={
            <div className="flex gap-4 overflow-hidden" aria-hidden="true">
              {statuses.map((status) => (
                <Skeleton key={status} className="h-64 w-72 shrink-0 rounded-xl" />
              ))}
            </div>
          }
        >
          <Area onDrop={drop}>
            <div className="flex snap-x gap-4 overflow-x-auto pb-2">
              {statuses.map((status, index) => {
                const items = rows[index] ?? [];
                const list = lists[index]?.data;
                const count = (list ? pagination(list)?.count : undefined) ?? items.length;
                return (
                  <Column key={status} status={status} label={statusName(type, status, language)}>
                    <section
                      data-bz={`column:${status}`}
                      data-count={count}
                      aria-label={statusName(type, status, language)}
                      className="flex w-72 shrink-0 snap-start flex-col gap-3 rounded-xl bg-muted/60 p-3"
                    >
                      <header className="flex items-center justify-between gap-2">
                        <StatusLabel type={type} status={status} />
                        <span className="text-sm text-muted-foreground tabular-nums">{formatNumber(count, language)}</span>
                      </header>
                      {items.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                          {t('board.empty_column')}
                        </p>
                      ) : (
                        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                          {items.map((item) => {
                            const moves = move ? movesOf(item) : [];
                            const card = (
                              <BoardCard
                                item={item}
                                title={title}
                                fields={fields}
                                meta={meta}
                                badge={
                                  badge !== undefined &&
                                  fieldValue(item, badge) === true && (
                                    <span
                                      className={cn(
                                        'relative shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                                        SOFT_TONES[badgeTone],
                                      )}
                                    >
                                      {meta.title(badge)}
                                    </span>
                                  )
                                }
                                display={display}
                                onOpen={onOpen}
                                moves={moves.length > 0 && <MoveMenu item={item} moves={moves} run={run} />}
                              />
                            );
                            return (
                              // a card without a transit is not dragged
                              <li key={item.id}>
                                {moves.length > 0 ? (
                                  <Card id={item.id} label={itemName(item)}>
                                    {card}
                                  </Card>
                                ) : (
                                  card
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {items.length < count && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-bz="action:more"
                          disabled={lists[index]?.isFetching}
                          onClick={() => {
                            setLimits({ ...limits, [status]: items.length + pageSize });
                          }}
                        >
                          {t('board.more')}
                        </Button>
                      )}
                    </section>
                  </Column>
                );
              })}
            </div>
          </Area>
        </StatePanel>
      )}
      {run.dialog}
    </div>
  );
}
