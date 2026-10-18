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
// schema, search, filters, the view (the columns shown, the density of the rows) and the
// actions in a toolbar, sort, pages and the actions the backend allows; a table or a grid of
// cards (`composition.list` of the theme), cards on a phone; the rows that the user selects.
// Marked `list:<entity>` (`aria-busy` until its rows are those of its search and its page,
// their search in `data-search`), its rows `row:<id>` (with `data-tone` and the label of the
// tone as their `aria-description` when highlighted) with their cells `cell:<column>` and
// their checkboxes `select:<id>` (`select:all` for the page), its states `state:<state>` (the
// loading one is the skeleton of the rows, the empty one with the creation of an item).

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, SearchX } from 'lucide-react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';

import { Filter, nextPage, pagination, prevPage } from '@/bazis/client';
import { THEME, type Theme, type Tone } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import { useBesideCard, useWide } from '@/bazis/ui/app-shell';
import { EmptyState } from '@/bazis/ui/empty-state';
import {
  choiceOptions,
  fieldValue,
  isNumeric,
  permitted,
  resourceAt,
  useAnyList,
  useListFields,
  type FieldDisplay,
  type ResourceObject,
} from '@/bazis/ui/resource';
import { queryState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { BulkBar, type BulkAction } from './bulk.js';
import { CardsSkeleton, CardsView } from './cards.js';
import { ViewMenu } from './columns.js';
import { EVERY, FilterBar, type ListFilter } from './filters.js';
import { cell, FOCUS, opener, PageCheckbox, RowCheckbox, type BodyProps } from './rows.js';

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
  /**
   * The fields of the columns: attributes and relationships of the list; the first is the
   * name of a row. A column whose field no row of the page has (hidden by the field
   * permissions of the user) is left out.
   */
  columns: readonly string[];
  /**
   * The filter fields (`route_filter_fields/`), with their options: a control each, but for
   * a field the backend does not offer the user to filter by (its filter would be a 400). A
   * field with choices has the select of its choices, by their labels (the list schema).
   */
  filters?: readonly (string | ListFilter)[];
  /**
   * The filter of the screen itself (`list.filter` of the spec: a report of some of the
   * items), combined (AND) with the filters and the search of the user.
   */
  filter?: Filter | undefined;
  /**
   * The initial order: the sort labels of the contract, `-` for descending, or other terms of
   * the core (`nearSort` of map: the distance from a point); a new one replaces the order the
   * user chose.
   */
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
  /** How the values of fields are shown (`display` of the fields of the entity of the specs). */
  display?: Readonly<Record<string, FieldDisplay>>;
  /**
   * The tone of the theme that highlights a row (`list.highlight` of the spec), undefined
   * for none: its soft color and a bar of the tone, marked `data-tone`.
   */
  rowTone?: (row: ResourceObject) => Tone | undefined;
  /**
   * What the tone of a highlighted row means, in words (`label` of `list.highlight`): its
   * `aria-description`, so that the highlight is not told by its color alone.
   */
  rowToneLabel?: (row: ResourceObject) => string | undefined;
  /** The message of the empty list. */
  emptyMessage?: ReactNode;
  /** The icon of the entity (such as an icon of lucide-react), in the empty state. */
  icon?: ComponentType<{ className?: string }>;
  /** A table or a grid of cards; `composition.list` of the theme by default. */
  layout?: 'table' | 'cards';
  /**
   * The list on a phone, below the breakpoint `md` (cards, where a table would scroll
   * sideways); `composition.list_phone` of the theme by default.
   */
  phoneLayout?: 'table' | 'cards';
  /** The density of the rows of the table, which the user may change; that of the theme by default. */
  density?: Theme['density'];
  /** The ids of the selected rows (`selection` of `onSelectionChange`). */
  selection?: readonly string[];
  /**
   * Makes the rows selectable, a checkbox each (`select:<id>`, and `select:all` for the rows
   * of the page): called with the ids selected, also those of other pages.
   */
  onSelectionChange?: (ids: readonly string[]) => void;
  /**
   * The actions on the selected rows (`list.bulk` of the spec), in a bar over them once a row
   * is selected (`bulk:<id>`): the rows are selectable, the list keeping their selection
   * unless `onSelectionChange` does.
   */
  bulk?: readonly BulkAction[];
  /**
   * The columns of the table while it is next to an open card (`ListCardLayout`, `split`):
   * the first two by default; the others are hidden (their cells stay, for the scenarios).
   */
  compactColumns?: readonly string[];
}

/** The sort labels of the fields of the route set (`order` in the contract). */
function orderLabels(path: string): ReadonlyMap<string, string> {
  const resource = resourceAt(path);
  return new Map(
    Object.entries(resource?.fields ?? {}).flatMap(([name, field]) => (field.order ? [[name, field.order]] : [])),
  );
}

const META = ['pagination', 'for_create', 'for_change', 'for_delete'];
const SEARCH_DELAY = 300;

/**
 * The first column of the table stays at the left of a table wider than its list (after the
 * checkboxes of the selection, a column of 2.5rem whatever the density, its `min-width`: a table
 * wider than its list gives a column no more than its content otherwise): the rows are opaque, the
 * hover mixed with the card, so that its cells take the color of their row (`bg-inherit`) over
 * the columns that scroll under them, and draw the focus ring of their row, which they cover;
 * the leftmost one draws the mark of a tone or of the selection of its row (`--row-mark`).
 */
const ROW = 'bg-card hover:bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-card))] has-aria-expanded:bg-[color-mix(in_oklab,var(--color-muted)_50%,var(--color-card))]';
const STICKY = 'sticky z-[1] bg-inherit [tr:focus-visible>&]:shadow-[inset_0_3px_0_color-mix(in_oklab,var(--color-ring)_50%,transparent),inset_0_-3px_0_color-mix(in_oklab,var(--color-ring)_50%,transparent)]';
const LEFTMOST =
  'shadow-[inset_3px_0_0_var(--row-mark,transparent)] [tr:focus-visible>&]:shadow-[inset_3px_0_0_color-mix(in_oklab,var(--color-ring)_50%,transparent),inset_0_3px_0_color-mix(in_oklab,var(--color-ring)_50%,transparent),inset_0_-3px_0_color-mix(in_oklab,var(--color-ring)_50%,transparent)]';

/** The colors of a highlighted row of a table, by its tone: the soft colors of the theme. */
const ROW_TONES: Readonly<Record<Tone, string>> = {
  neutral: 'bg-neutral-soft [--row-mark:var(--color-neutral)]',
  primary: 'bg-primary-soft [--row-mark:var(--color-primary)]',
  info: 'bg-info-soft [--row-mark:var(--color-info)]',
  success: 'bg-success-soft [--row-mark:var(--color-success)]',
  warning: 'bg-warning-soft [--row-mark:var(--color-warning)]',
  danger: 'bg-danger-soft [--row-mark:var(--color-danger)]',
};

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
 * header stays at the top of it, and a table wider than the screen (the list next to a card)
 * scrolls sideways instead of losing columns.
 */
function TableView(
  props: BodyProps & {
    header: (name: string) => ReactNode;
    sorted: (name: string) => 'ascending' | 'descending' | undefined;
    actionsColumn: boolean;
  },
) {
  const { rows, columns, fields, onOpen, selected, header, sorted, actionsColumn, hidden, selection } = props;
  const { t } = useLanguage();
  return (
    <table data-slot="table" className="w-full caption-bottom text-sm">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {selection && (
            <TableHead className="sticky top-0 left-0 z-20 w-10 min-w-10 bg-muted px-0 text-center">
              <PageCheckbox rows={rows} selection={selection} onSelect={props.onSelect} />
            </TableHead>
          )}
          {columns.map((name, index) => (
            <TableHead
              key={name}
              aria-sort={sorted(name)}
              className={cn(
                'sticky top-0 z-10 h-10 bg-muted px-(--space-cell-x) text-xs font-medium text-muted-foreground',
                index === 0 && (selection ? 'left-10 z-20' : 'left-0 z-20'),
                isNumeric(fields.fields.get(name)) && 'text-right',
                hidden(name) && 'hidden',
              )}
            >
              {header(name)}
            </TableHead>
          ))}
          {actionsColumn && (
            <TableHead className="sticky top-0 z-10 bg-muted">
              <span className="sr-only">{t('list.actions')}</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const tone = props.rowTone(row);
          return (
            <TableRow
              key={row.id}
              data-bz={`row:${row.id}`}
              data-state={row.id === selected ? 'selected' : undefined}
              data-tone={tone}
              aria-description={tone && props.rowToneLabel(row)}
              aria-selected={selected === undefined ? undefined : row.id === selected}
              className={cn(
                'border-border/70',
                ROW,
                tone && ROW_TONES[tone],
                'data-[state=selected]:bg-primary-soft data-[state=selected]:[--row-mark:var(--primary)]',
                onOpen && cn('cursor-pointer', FOCUS),
              )}
              {...opener(row.id, onOpen)}
            >
              {selection && (
                <TableCell className={cn('left-0 w-10 min-w-10 px-0 py-(--space-cell-y) text-center', STICKY, LEFTMOST)}>
                  <RowCheckbox id={row.id} selection={selection} onSelect={props.onSelect} />
                </TableCell>
              )}
              {columns.map((name, index) => {
                const field = fields.fields.get(name);
                return (
                  <TableCell
                    key={name}
                    data-bz={`cell:${name}`}
                    className={cn(
                      'px-(--space-cell-x) py-(--space-cell-y)',
                      index === 0
                        ? cn('min-w-48 font-medium whitespace-normal text-foreground', STICKY, selection ? 'left-10' : cn('left-0', LEFTMOST))
                        : 'text-muted-foreground',
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
          );
        })}
      </TableBody>
    </table>
  );
}

/** The skeleton of the rows while the list loads. */
function ListSkeleton({ layout, columns }: { layout: 'table' | 'cards'; columns: number }) {
  if (layout === 'cards') return <CardsSkeleton />;
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

/** A list of a resource, with its states, filters, sort, view, selection, pages and actions. */
export function ResourceList({
  path,
  entity,
  columns,
  filters = [],
  filter: screenFilter,
  sort: initialSort = [],
  search: searchable = false,
  pageSize = 20,
  onOpen,
  selected,
  actions = [],
  rowActions = [],
  cells = {},
  display = {},
  rowTone = () => undefined,
  rowToneLabel = () => undefined,
  emptyMessage,
  icon,
  layout = THEME.composition.list,
  phoneLayout = THEME.composition.list_phone,
  density = THEME.density,
  selection: selectionProp = [],
  onSelectionChange,
  bulk = [],
  compactColumns = columns.slice(0, 2),
}: ResourceListProps) {
  const besideCard = useBesideCard();
  const view = useWide() ? layout : phoneLayout;
  const { t } = useLanguage();
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(new Set());
  const [rowDensity, setRowDensity] = useState(density);
  // the selection of the bulk actions, kept here when the screen does not keep it
  const [ownSelection, setOwnSelection] = useState<readonly string[]>([]);
  const selection = onSelectionChange ? selectionProp : ownSelection;
  const select = onSelectionChange ?? setOwnSelection;
  const fields = useListFields(path);
  const order = orderLabels(path);
  const [filter, setFilter] = useState<Filter | undefined>();
  const [sort, setSort] = useState<readonly string[]>(initialSort);
  const [offset, setOffset] = useState(0);
  // a new order of the screen (the distance from the point of a nearby list, known later)
  // replaces the one the user chose, from the first page
  const [screenSort, setScreenSort] = useState(() => JSON.stringify(initialSort));
  if (JSON.stringify(initialSort) !== screenSort) {
    setScreenSort(JSON.stringify(initialSort));
    setSort(initialSort);
    setOffset(0);
  }
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

  // the filter of the screen and those of the user
  const combined = screenFilter && filter ? Filter.and(screenFilter, filter) : (screenFilter ?? filter);
  const query = {
    ...(combined ? { filter: combined } : {}),
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
  // a field with choices is filtered by a select of its choices, by their labels
  const filterList = filters.map((it): ListFilter => {
    const filter = typeof it === 'string' ? { field: it } : it;
    const options = filter.options ?? choiceOptions(fields.fields.get(filter.field));
    return options ? { ...filter, options } : filter;
  });
  // the rows wait for the titles of their columns
  const loaded = queryState(list, rows.length === 0);
  const state = loaded === 'loaded' && !fields.ready ? 'loading' : loaded;
  // the user's own search or filters (the filter of the screen is what the list is)
  const filtered = Boolean(search || filter);
  // bazis-permit leaves out of the items the fields that the user may not see (the schema of
  // a list has every field a row may show): a column is shown when a row of the page has its field
  const shown = columns.filter(
    (name) => fields.has(name) && (rows.length === 0 || rows.some((row) => fieldValue(row, name) !== undefined)),
  );
  const sortable = shown.filter((name) => order.has(name));
  // the user hides any column but the first, the name of a row
  const hideable = shown.slice(1);
  const viewMenu = view === 'table' || hideable.length > 0;
  const selectionSet = onSelectionChange || bulk.length ? new Set(selection) : undefined;
  // the actions that create an item are those of the empty state of a list without items
  const empty = state === 'empty' && !filtered;
  const creates = empty ? toolbar.filter((action) => action.permission === 'add') : [];

  function actionButton(action: ListAction) {
    const Icon = action.icon;
    return (
      <Button key={action.id} type="button" data-bz={`action:${action.id}`} onClick={action.onClick}>
        {Icon && <Icon />}
        {action.label}
      </Button>
    );
  }

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
    columns: shown,
    fields,
    cells,
    display,
    onOpen,
    selected,
    rowTone,
    rowToneLabel,
    // next to an open card, a table shows only its compact columns
    hidden: (name) =>
      (name !== shown[0] && hiddenColumns.has(name)) || (view === 'table' && besideCard && !compactColumns.includes(name)),
    selection: selectionSet,
    onSelect: (ids, on) => {
      const others = selection.filter((id) => !ids.includes(id));
      select(on ? [...others, ...ids] : others);
    },
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
    // busy until the rows are those of the search typed and of the page asked for; the
    // search they are of in `data-search` (the end-to-end tests wait for both)
    <div
      data-bz={`list:${entity}`}
      data-search={search || undefined}
      aria-busy={list.isPlaceholderData || searchText.trim() !== search || undefined}
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
    >
      {(searchable || filterList.length > 0 || actions.length > 0 || viewMenu) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {searchable && (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                aria-label={t('list.search')}
                placeholder={t('list.search')}
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
          {view === 'cards' && sortable.length > 0 && (
            <Select
              value={sort[0] ?? EVERY}
              onValueChange={(next) => {
                setSort(next === EVERY ? [] : [next]);
                setOffset(0);
              }}
            >
              <SelectTrigger aria-label={t('list.sort')} className="bg-card">
                <span aria-hidden="true" className="text-muted-foreground">
                  {t('list.sort')}
                </span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value={EVERY} data-value="">
                  {t('list.sort_default')}
                </SelectItem>
                {sortable.flatMap((name) => {
                  const label = order.get(name) ?? name;
                  return [
                    <SelectItem key={label} value={label}>
                      {fields.title(name)} ↑
                    </SelectItem>,
                    <SelectItem key={`-${label}`} value={`-${label}`}>
                      {fields.title(name)} ↓
                    </SelectItem>,
                  ];
                })}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex gap-2">
            {viewMenu && (
              <ViewMenu
                columns={hideable}
                title={fields.title}
                hidden={hiddenColumns}
                onHide={(name, hide) => {
                  const next = new Set(hiddenColumns);
                  if (hide) next.add(name);
                  else next.delete(name);
                  setHiddenColumns(next);
                }}
                density={view === 'table' ? rowDensity : undefined}
                onDensity={setRowDensity}
              />
            )}
            {toolbar.filter((action) => !creates.includes(action)).map(actionButton)}
          </div>
        </div>
      )}
      {bulk.length > 0 && selection.length > 0 && (
        <BulkBar actions={bulk} selection={selection} page={new Set(rows.map((it) => it.id))} meta={meta} onSelect={select} />
      )}
      {state === 'empty' ? (
        <EmptyState
          icon={filtered ? SearchX : icon}
          title={filtered ? t('list.no_match') : emptyMessage}
          {...(filtered ? { description: t('list.no_match_hint') } : {})}
        >
          {creates.length > 0 ? creates.map(actionButton) : undefined}
        </EmptyState>
      ) : (
        <StatePanel
          state={state}
          error={list.error}
          onRetry={() => void list.refetch()}
          skeleton={<ListSkeleton layout={view} columns={columns.length} />}
        >
          <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
            {view === 'cards' ? (
              <CardsView {...body} />
            ) : (
              <div
                data-slot="table-scroll"
                data-density={rowDensity}
                className="max-h-[calc(100dvh-var(--sticky-top)-var(--space-section))] overflow-auto rounded-xl border bg-card shadow-xs"
              >
                <TableView
                  {...body}
                  actionsColumn={rowActions.length > 0}
                  sorted={direction}
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
      )}
      {document && rows.length > 0 && (
        <nav aria-label={t('list.pages')} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {count === undefined
              ? t('list.range', { from: offset + 1, to: offset + rows.length })
              : t('list.range_of', { from: offset + 1, to: offset + rows.length, count })}
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
              {t('list.previous')}
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
              {t('list.next')}
              <ChevronRight />
            </Button>
          </span>
        </nav>
      )}
    </div>
  );
}
