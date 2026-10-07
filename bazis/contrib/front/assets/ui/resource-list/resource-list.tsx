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

// A list of a resource over `useList`: the columns of the screen with the titles of the list
// schema, search, filters and the actions in a toolbar, sort, pages and the actions the
// backend allows; a table or a grid of cards (`composition.list` of the theme). Marked
// `list:<entity>`, its rows `row:<id>` with their cells `cell:<column>`, its states
// `state:<state>` (the loading one is the skeleton of the rows).

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react';

import { nextPage, pagination, prevPage, type Filter } from '@/bazis/client';
import { RESOURCES } from '@/bazis/generated/contract';
import { THEME } from '@/bazis/generated/theme';
import type { ListPath } from '@/bazis/react';
import { useBesideCard } from '@/bazis/ui/app-shell';
import {
  FieldValue,
  fieldValue,
  isNumeric,
  permitted,
  useAnyList,
  useListFields,
  type Fields,
  type ResourceObject,
} from '@/bazis/ui/resource';
import { queryState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { FilterBar, type ListFilter } from './filters.js';

/** An action of the list, a button `action:<id>`; `add` shows it when the user may create. */
export interface ListAction {
  id: string;
  label: ReactNode;
  onClick: () => void;
  permission?: 'add';
  /** Its icon, such as an icon of lucide-react. */
  icon?: ComponentType<{ className?: string }>;
}

/** An action of a row, a button `action:<id>` in it, shown when the user may do it on the item. */
export interface RowAction {
  id: string;
  label: ReactNode;
  onClick: (id: string) => void;
  permission?: 'change' | 'delete';
}

export interface ResourceListProps {
  /** The route set (`ROUTES` of the contract). */
  path: ListPath;
  /** The entity of the screen: `list:<entity>`. */
  entity: string;
  /** The fields of the columns: attributes and relationships of the list; the first is the name of a row. */
  columns: readonly string[];
  /** The filter fields (`route_filter_fields/`), with their options. */
  filters?: readonly (string | ListFilter)[];
  /** The initial order: the sort labels of the contract, `-` for descending. */
  sort?: readonly string[];
  /** A search field (`field:$search`). */
  search?: boolean;
  pageSize?: number;
  /** Called with the id of the row the user opens. */
  onOpen?: (id: string) => void;
  /** The id of the open item (the card next to the list): its row is selected. */
  selected?: string | undefined;
  actions?: readonly ListAction[];
  rowActions?: readonly RowAction[];
  /** The content of the cells of a column, instead of the formatted value. */
  cells?: Readonly<Record<string, (row: ResourceObject) => ReactNode>>;
  /** The message of the empty list. */
  emptyMessage?: ReactNode;
  /** A table or a grid of cards; `composition.list` of the theme by default. */
  layout?: 'table' | 'cards';
  /**
   * The columns of the table while it is next to an open card (`ListCardLayout`, `split`):
   * the first two by default; the others are hidden (their cells stay, for the scenarios).
   */
  compactColumns?: readonly string[];
}

interface ContractResource {
  path: string;
  fields: Readonly<Record<string, { order?: string }>>;
}

/** The sort labels of the fields of the route set (`order` in the contract). */
function orderLabels(path: string): ReadonlyMap<string, string> {
  const resource = Object.values(RESOURCES as Readonly<Record<string, ContractResource>>).find(
    (it) => it.path === path,
  );
  return new Map(
    Object.entries(resource?.fields ?? {}).flatMap(([name, field]) => (field.order ? [[name, field.order]] : [])),
  );
}

const META = ['pagination', 'for_create', 'for_change', 'for_delete'];
const SEARCH_DELAY = 300;

/** The props of a row that opens its item, by a click or Enter. */
function opener(id: string, onOpen: ((id: string) => void) | undefined) {
  if (!onOpen) return {};
  return {
    tabIndex: 0,
    onClick: () => {
      onOpen(id);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      // not the Enter of a control of the row (its actions), which bubbles
      if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(id);
    },
  };
}

interface BodyProps {
  rows: readonly ResourceObject[];
  columns: readonly string[];
  fields: Fields;
  cells: Readonly<Record<string, (row: ResourceObject) => ReactNode>>;
  onOpen: ((id: string) => void) | undefined;
  selected: string | undefined;
  rowActions: (row: ResourceObject) => ReactNode;
}

function cell(props: BodyProps, row: ResourceObject, name: string): ReactNode {
  return props.cells[name]?.(row) ?? <FieldValue field={props.fields.fields.get(name)} value={fieldValue(row, name)} />;
}

const FOCUS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset';

function SortButton({ label, direction, onClick }: { label: ReactNode; direction: 'ascending' | 'descending' | undefined; onClick: () => void }) {
  const Icon = direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      className={cn(
        '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        direction && 'text-foreground',
      )}
      onClick={onClick}
    >
      <span className="first-letter:uppercase">{label}</span>
      <Icon className={cn('size-3.5', !direction && 'opacity-40')} aria-hidden="true" />
    </button>
  );
}

/**
 * The rows as a table in its own scroll area (as high as the screen under its header): its
 * header stays at the top of it, and a table wider than the screen (a phone, the list next to
 * a card) scrolls sideways instead of losing columns.
 */
function TableView(
  props: BodyProps & {
    header: (name: string) => ReactNode;
    sorted: (name: string) => 'ascending' | 'descending' | undefined;
    actionsColumn: boolean;
    /** Whether a column is hidden (next to an open card). */
    hidden: (name: string) => boolean;
  },
) {
  const { rows, columns, fields, onOpen, selected, header, sorted, actionsColumn, hidden } = props;
  return (
    <table data-slot="table" className="w-full caption-bottom text-sm">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((name) => (
            <TableHead
              key={name}
              aria-sort={sorted(name)}
              className={cn(
                'sticky top-0 z-10 h-10 bg-muted px-(--space-cell-x) text-xs font-medium text-muted-foreground',
                isNumeric(fields.fields.get(name)) && 'text-right',
                hidden(name) && 'hidden',
              )}
            >
              {header(name)}
            </TableHead>
          ))}
          {actionsColumn && (
            <TableHead className="sticky top-0 z-10 bg-muted">
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            data-bz={`row:${row.id}`}
            data-state={row.id === selected ? 'selected' : undefined}
            aria-selected={selected === undefined ? undefined : row.id === selected}
            className={cn(
              'border-border/70 data-[state=selected]:bg-primary-soft data-[state=selected]:shadow-[inset_3px_0_0_var(--primary)]',
              onOpen && cn('cursor-pointer', FOCUS),
            )}
            {...opener(row.id, onOpen)}
          >
            {columns.map((name, index) => {
              const field = fields.fields.get(name);
              return (
                <TableCell
                  key={name}
                  data-bz={`cell:${name}`}
                  className={cn(
                    'px-(--space-cell-x) py-(--space-cell-y)',
                    index === 0 ? 'min-w-48 font-medium whitespace-normal text-foreground' : 'text-muted-foreground',
                    isNumeric(field) && 'text-right tabular-nums',
                    field?.kind === 'attribute' && field.format === 'date-time' && 'tabular-nums',
                    hidden(name) && 'hidden',
                  )}
                >
                  {cell(props, row, name)}
                </TableCell>
              );
            })}
            {actionsColumn && <TableCell className="px-(--space-cell-x) py-1 text-right">{props.rowActions(row)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </table>
  );
}

/** The rows as a grid of cards: the first column is the title, the others pairs of a label and a value. */
function CardsView(props: BodyProps) {
  const { rows, columns, fields, onOpen, selected } = props;
  const [first, ...rest] = columns;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <li key={row.id} className="flex">
          <article
            data-bz={`row:${row.id}`}
            data-state={row.id === selected ? 'selected' : undefined}
            className={cn(
              'flex w-full flex-col gap-4 rounded-2xl border bg-card p-(--space-card) text-card-foreground shadow-xs transition-[box-shadow,border-color] data-[state=selected]:border-primary',
              onOpen && cn('cursor-pointer hover:border-primary/40 hover:shadow-md', FOCUS, 'focus-visible:ring-offset-0'),
            )}
            {...opener(row.id, onOpen)}
          >
            {first !== undefined && (
              <h3 data-bz={`cell:${first}`} className="font-display text-lg leading-snug font-semibold">
                {cell(props, row, first)}
              </h3>
            )}
            {rest.length > 0 && (
              <dl className="grid gap-2 text-sm">
                {rest.map((name) => (
                  <div key={name} className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground first-letter:uppercase">{fields.title(name)}</dt>
                    <dd
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
      ))}
    </ul>
  );
}

/** The skeleton of the rows while the list loads. */
function ListSkeleton({ layout, columns }: { layout: 'table' | 'cards'; columns: number }) {
  if (layout === 'cards') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((it) => (
          <div key={it} className="grid gap-4 rounded-2xl border bg-card p-(--space-card)">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs" aria-hidden="true">
      <div className="h-10 border-b bg-muted/60" />
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-center gap-6 border-b border-border/70 px-(--space-cell-x) py-(--space-cell-y) last:border-0">
          {Array.from({ length: Math.max(columns, 1) }, (_, index) => (
            <Skeleton key={index} className={cn('h-4', index === 0 ? 'w-1/3' : 'w-1/6')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A list of a resource, with its states, filters, sort, pages and actions. */
export function ResourceList({
  path,
  entity,
  columns,
  filters = [],
  sort: initialSort = [],
  search: searchable = false,
  pageSize = 20,
  onOpen,
  selected,
  actions = [],
  rowActions = [],
  cells = {},
  emptyMessage,
  layout = THEME.composition.list,
  compactColumns = columns.slice(0, 2),
}: ResourceListProps) {
  const besideCard = useBesideCard();
  const fields = useListFields(path);
  const order = orderLabels(path);
  const [filter, setFilter] = useState<Filter | undefined>();
  const [sort, setSort] = useState<readonly string[]>(initialSort);
  const [offset, setOffset] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setOffset(0);
    }, SEARCH_DELAY);
    return () => {
      clearTimeout(timer);
    };
  }, [searchText]);

  const query = {
    ...(filter ? { filter } : {}),
    ...(search ? { search } : {}),
    ...(sort.length ? { sort } : {}),
    page: { limit: pageSize, offset },
    meta: META,
  };
  const list = useAnyList(path, query);
  const document = list.data;
  const rows = document?.data ?? [];
  const meta = document?.meta;
  const count = document ? pagination(document)?.count : undefined;
  const toolbar = actions.filter((action) => document && (!action.permission || permitted(meta, action.permission)));
  const filterList = filters.map((it) => (typeof it === 'string' ? { field: it } : it));
  const sortable = columns.filter((name) => order.has(name));
  // the rows wait for the titles of their columns
  const loaded = queryState(list, rows.length === 0);
  const state = loaded === 'loaded' && !fields.ready ? 'loading' : loaded;
  const filtered = Boolean(search || filter);

  function toggle(name: string) {
    const label = order.get(name);
    if (label === undefined) return;
    setSort(sort[0] === label ? [`-${label}`] : [label]);
    setOffset(0);
  }

  function direction(name: string): 'ascending' | 'descending' | undefined {
    const label = order.get(name);
    if (label === undefined) return undefined;
    return sort[0] === label ? 'ascending' : sort[0] === `-${label}` ? 'descending' : undefined;
  }

  const body: BodyProps = {
    rows,
    columns,
    fields,
    cells,
    onOpen,
    selected,
    rowActions: (row) =>
      rowActions
        .filter((action) => !action.permission || permitted(meta, action.permission, row.id))
        .map((action) => (
          <Button
            key={action.id}
            type="button"
            size="sm"
            variant="ghost"
            data-bz={`action:${action.id}`}
            onClick={(event) => {
              event.stopPropagation();
              action.onClick(row.id);
            }}
          >
            {action.label}
          </Button>
        )),
  };

  return (
    <div data-bz={`list:${entity}`} className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {(searchable || filterList.length > 0 || actions.length > 0 || (layout === 'cards' && sortable.length > 0)) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {searchable && (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search"
                placeholder="Search"
                data-bz="field:$search"
                className="bg-card pl-9"
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                }}
              />
            </div>
          )}
          {filterList.length > 0 && (
            <FilterBar
              path={path}
              filters={filterList}
              ready={fields.ready}
              title={fields.title}
              onFilter={(next) => {
                setFilter(next);
                setOffset(0);
              }}
            />
          )}
          {layout === 'cards' && sortable.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground" aria-hidden="true">
                Sort
              </span>
              <NativeSelect
                aria-label="Sort"
                value={sort[0] ?? ''}
                onChange={(event) => {
                  setSort(event.target.value ? [event.target.value] : []);
                  setOffset(0);
                }}
              >
                <NativeSelectOption value="">Default</NativeSelectOption>
                {sortable.flatMap((name) => {
                  const label = order.get(name) ?? name;
                  return [
                    <NativeSelectOption key={label} value={label}>
                      {fields.title(name)} ↑
                    </NativeSelectOption>,
                    <NativeSelectOption key={`-${label}`} value={`-${label}`}>
                      {fields.title(name)} ↓
                    </NativeSelectOption>,
                  ];
                })}
              </NativeSelect>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            {toolbar.map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.id} type="button" data-bz={`action:${action.id}`} onClick={action.onClick}>
                  {Icon && <Icon />}
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      <StatePanel
        state={state}
        error={list.error}
        {...(state === 'empty'
          ? filtered
            ? { message: 'Nothing matches the search and the filters.', description: 'Change or clear them to see more.' }
            : { message: emptyMessage }
          : {})}
        onRetry={() => void list.refetch()}
        skeleton={<ListSkeleton layout={layout} columns={columns.length} />}
      >
        <div
          aria-busy={list.isPlaceholderData || undefined}
          className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}
        >
          {layout === 'cards' ? (
            <CardsView {...body} />
          ) : (
            <div
              data-slot="table-scroll"
              className="max-h-[calc(100dvh-var(--sticky-top)-var(--space-section))] overflow-auto rounded-xl border bg-card shadow-xs"
            >
              <TableView
                {...body}
                actionsColumn={rowActions.length > 0}
                sorted={direction}
                hidden={(name) => besideCard && !compactColumns.includes(name)}
                header={(name) =>
                  order.has(name) ? (
                    <SortButton
                      label={fields.title(name)}
                      direction={direction(name)}
                      onClick={() => {
                        toggle(name);
                      }}
                    />
                  ) : (
                    <span className="inline-block first-letter:uppercase">{fields.title(name)}</span>
                  )
                }
              />
            </div>
          )}
        </div>
      </StatePanel>
      {document && rows.length > 0 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {offset + 1}–{offset + rows.length}
            {count === undefined ? '' : ` of ${String(count)}`}
          </span>
          <span className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-bz="action:prev-page"
              disabled={offset === 0 || prevPage(document) === null}
              onClick={() => {
                setOffset(Math.max(0, prevPage(document)?.offset ?? 0));
              }}
            >
              <ChevronLeft />
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-bz="action:next-page"
              disabled={nextPage(document) === null}
              onClick={() => {
                setOffset(nextPage(document)?.offset ?? offset);
              }}
            >
              Next
              <ChevronRight />
            </Button>
          </span>
        </nav>
      )}
    </div>
  );
}
