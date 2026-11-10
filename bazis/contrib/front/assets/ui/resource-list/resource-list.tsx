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
// actions in a toolbar (the search, the view and the actions in the header of its screen with
// `toolbar="header"`, the number of its items beside its title with `count`), sort, pages and
// the actions the backend allows; a table or a grid of
// cards (`composition.list` of the theme), cards on a phone; the rows that the user selects.
// Marked `list:<entity>` (`aria-busy` until its rows are those of its search and its page,
// their search in `data-search`), its rows `row:<id>` (with `data-tone` and the label of the
// tone as their `aria-description` when highlighted) with their cells `cell:<column>` and
// their checkboxes `select:<id>` (`select:all` for the page), its states `state:<state>` (the
// loading one is the skeleton of the rows, the empty one with the creation of an item).

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, SearchX } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Filter, nextPage, pagination, prevPage, type CustomActionName } from '@/bazis/client';
import { THEME, type Theme, type Tone } from '@/bazis/generated/theme';
import { formatNumber, useLanguage } from '@/bazis/i18n';
import type { FormField, ListPath } from '@/bazis/react';
import { useBesideCard, useBesideList, useScreenPage, useWide } from '@/bazis/ui/app-shell';
import { EmptyState } from '@/bazis/ui/empty-state';
import {
  alignsDigits,
  fieldValue,
  isFile,
  isNumeric,
  permitted,
  resourceAt,
  useAnyList,
  useFiles,
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
import { cardRoles, CardsSkeleton, CardsView } from './cards.js';
import { ViewMenu } from './columns.js';
import { EVERY, FilterBar, FilterField, FilterRow, filterWidth, listFilters, ResetFilters, type ListFilter } from './filters.js';
import { cell, FOCUS, opener, PageCheckbox, RowCheckbox, type BodyProps, type CardLayout } from './rows.js';

/**
 * An action of the list, a button `action:<id>`; `add` shows it when the user may create, a
 * custom action of the route set (`action_<name>`) when the backend lists it in
 * `custom_actions` of the list.
 */
export interface ListAction {
  id: string;
  label: ReactNode;
  onClick: () => void;
  permission?: 'add' | CustomActionName;
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
  /**
   * Where the search, the view and the actions are: in the toolbar over the list (`list`), or in
   * the header of its `Screen` beside the title (`header`), the filters staying over the list;
   * `composition.list_tools` of the theme by default for the list of a screen (`header.search` of
   * the spec chooses), `list` for a list inside a part of it (`NestedLists`: a related section).
   */
  toolbar?: 'list' | 'header';
  /** The number of the items (of the search and the filters) beside the title of its `Screen` (`header.count` of the spec). */
  count?: boolean;
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
  /** The icon of the entity (such as an icon of lucide-react): in the empty state, and the cover of a card without its image. */
  icon?: ComponentType<{ className?: string }>;
  /** A table or a grid of cards; `composition.list` of the theme by default. */
  layout?: 'table' | 'cards';
  /**
   * The list on a phone, below the breakpoint `md` (cards, where a table would scroll
   * sideways); `composition.list_phone` of the theme by default.
   */
  phoneLayout?: 'table' | 'cards';
  /**
   * The composition of a card of the grid (`list.card` of the spec): its cover, its rubric, its
   * title, its figure and its muted values; without it, the first column is the title, the first
   * column of an image a thumbnail beside it.
   */
  card?: CardLayout | undefined;
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
/** The meta of a list with an action of the route set: the custom actions that the user may call. */
const CUSTOM_META = [...META, 'custom_actions'];
const SEARCH_DELAY = 300;

/**
 * The first column of the table stays at the left of a table wider than its list (after the
 * checkboxes of the selection, a column of 2.5rem whatever the density, its `min-width`: a table
 * wider than its list gives a column no more than its content otherwise): the rows are opaque, the
 * hover mixed with the card, so that its cells take the color of their row (`bg-inherit`) over
 * the columns that scroll under them; the line under a row is that of each of its cells (a table
 * of separate borders), which a sticky cell carries instead of covering it (`bg-clip-padding`); they
 * draw the focus ring of their row, which they cover; the leftmost one draws the mark of a tone or of
 * the selection of its row (`--row-mark`).
 */
const ROW = 'border-0 *:border-b *:border-line-6 last:*:border-b-0 bg-card hover:bg-[color-mix(in_oklab,var(--color-accent)_75%,var(--color-card))] has-aria-expanded:bg-[color-mix(in_oklab,var(--color-accent)_75%,var(--color-card))]';
/** A cell of the header: on the card, set apart by a firmer line (a shadow: the cell is sticky). */
const HEAD = 'sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--color-line-16)]';
const STICKY = 'sticky z-[1] bg-inherit bg-clip-padding';
const RING =
  '[tr:focus-visible>&]:shadow-[inset_0_3px_0_color-mix(in_oklab,var(--color-ring)_50%,transparent),inset_0_-3px_0_color-mix(in_oklab,var(--color-ring)_50%,transparent)]';
const LEFTMOST =
  'shadow-[inset_3px_0_0_var(--row-mark,transparent)] [tr:focus-visible>&]:shadow-[inset_3px_0_0_color-mix(in_oklab,var(--color-ring)_50%,transparent),inset_0_3px_0_color-mix(in_oklab,var(--color-ring)_50%,transparent),inset_0_-3px_0_color-mix(in_oklab,var(--color-ring)_50%,transparent)]';

/** The cross that clears the search, in the muted color of the text instead of that of the browser. */
const CLEAR_SEARCH =
  '[&::-webkit-search-cancel-button]:size-3.5 [&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-cancel-button]:appearance-none ' +
  '[&::-webkit-search-cancel-button]:bg-muted-foreground ' +
  '[&::-webkit-search-cancel-button]:[mask:url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27black%27%20stroke-width=%272.4%27%20stroke-linecap=%27round%27%3E%3Cpath%20d=%27M6%206l12%2012M18%206L6%2018%27/%3E%3C/svg%3E)_center/contain_no-repeat]';

/** The colors of a highlighted row of a table, by its tone: the soft colors of the theme. */
const ROW_TONES: Readonly<Record<Tone, string>> = {
  neutral: 'bg-neutral-soft [--row-mark:var(--color-neutral)]',
  primary: 'bg-tone-primary-soft [--row-mark:var(--color-tone-primary)]',
  info: 'bg-info-soft [--row-mark:var(--color-info)]',
  success: 'bg-success-soft [--row-mark:var(--color-success)]',
  warning: 'bg-warning-soft [--row-mark:var(--color-warning)]',
  danger: 'bg-danger-soft [--row-mark:var(--color-danger)]',
};

/** The bounds of a column of names with their avatars and of chips, wider than those of a text. */
const DISPLAY_WIDTHS: Readonly<Partial<Record<string, string>>> = { avatar: 'min-w-40 max-w-56', chips: 'min-w-40 max-w-72' };

/** The length of the texts of a first column as wide as they are. */
const SHORT_TEXT = 12;

/** Whether the values of a field are short by their nature and never wrap: a number, a date, a time. */
function isShort(field: FormField | undefined): boolean {
  return isNumeric(field) || (field?.kind === 'attribute' && ['date', 'date-time', 'time'].includes(field.format ?? ''));
}

/**
 * Whether the content of a scrolled element goes on beyond its right edge: the element by the
 * ref callback, updated as it scrolls and as it or its content is resized (`ResizeObserver`;
 * without one, as in jsdom, never).
 */
function useMoreRight(): [(element: HTMLDivElement | null) => void, boolean] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (element === null || typeof ResizeObserver !== 'function') return;
    const update = () => {
      setMore(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [element]);
  return [setElement, more];
}

/** The header of a column sorted by: the arrows after its label, before it over numbers (the label over their right edge). */
function SortButton({ label, direction, numeric, onClick }: { label: ReactNode; direction: 'ascending' | 'descending' | undefined; numeric: boolean; onClick: () => void }) {
  const Icon = direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      className={cn(
        'group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-focus focus-visible:outline-none',
        numeric && 'flex-row-reverse',
        direction && 'text-primary-ink hover:text-primary-ink',
      )}
      onClick={onClick}
    >
      <span className="first-letter:uppercase">{label}</span>
      {/* the arrows of a column not sorted by under the pointer over the header or the focus only */}
      <Icon
        className={cn('size-3.5', !direction && 'opacity-0 group-hover/head:opacity-40 group-focus-visible/sort:opacity-40')}
        aria-hidden="true"
      />
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
  const { resources } = useFiles();
  // the texts of the first column short on the page (the number of a booking): as wide as they
  // are, by their values (`data-short`, which the screenshots do not make long, V015)
  const first = columns[0];
  const shortFirst =
    first !== undefined &&
    rows.every((row) => {
      const value = fieldValue(row, first);
      return value === null || ((typeof value === 'string' || typeof value === 'number') && String(value).length <= SHORT_TEXT);
    });
  /** Whether the values of a column are as wide as they are, never wrapped: short values, files (their thumbnails), the short texts of the first column. */
  const compact = (field: FormField | undefined, index: number) => isShort(field) || isFile(field, resources) || (index === 0 && shortFirst);
  // the columns of texts of several lines on the page (an item a line: the items of a booking),
  // each line kept whole where it can
  const lined = new Set(
    columns.filter((name) =>
      rows.some((row) => {
        const value = fieldValue(row, name);
        return typeof value === 'string' && value.includes('\n');
      }),
    ),
  );
  return (
    // narrower than 56rem (a table beside the sidebar on a small laptop, beside a card), the
    // cells closer: the room of the texts
    <table
      data-slot="table"
      className="w-full caption-bottom border-separate border-spacing-0 text-sm @max-4xl:[--space-cell-x:0.75rem]"
    >
      <TableHeader>
        <TableRow className="group/head border-transparent hover:bg-transparent">
          {selection && (
            <TableHead className={cn(HEAD, 'left-0 z-20 w-10 min-w-10 px-0 text-center')}>
              <PageCheckbox rows={rows} selection={selection} onSelect={props.onSelect} />
            </TableHead>
          )}
          {columns.map((name, index) => (
            <TableHead
              key={name}
              aria-sort={sorted(name)}
              className={cn(
                HEAD,
                'h-10 px-(--space-cell-x) text-xs font-semibold text-foreground/75',
                index === 0 && (selection ? 'left-10 z-20' : 'left-0 z-20'),
                isNumeric(fields.fields.get(name)) && 'text-right',
                hidden(name) && 'hidden',
              )}
            >
              {header(name)}
            </TableHead>
          ))}
          {actionsColumn && (
            <TableHead className={HEAD}>
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
                ROW,
                tone && ROW_TONES[tone],
                // the soft color of the selected, its bar at the start
                'data-[state=selected]:bg-primary-soft data-[state=selected]:[--row-mark:var(--selected)]',
                onOpen && cn('cursor-pointer', FOCUS),
              )}
              {...opener(row, onOpen)}
            >
              {selection && (
                <TableCell className={cn('left-0 w-10 min-w-10 px-0 py-(--space-cell-y) text-center', STICKY, LEFTMOST)}>
                  <RowCheckbox id={row.id} selection={selection} onSelect={props.onSelect} />
                </TableCell>
              )}
              {columns.map((name, index) => {
                const field = fields.fields.get(name);
                const shown = props.display[name];
                const fits = compact(field, index);
                return (
                  <TableCell
                    key={name}
                    data-bz={`cell:${name}`}
                    data-short={(index === 0 && shortFirst) || undefined}
                    className={cn(
                      'px-(--space-cell-x) py-(--space-cell-y)',
                      // the first column, the name of a row, is at least 12rem but for a short value (a
                      // number, a short text) or a file
                      index === 0
                        ? cn(!fits && 'min-w-48', 'font-medium text-foreground', STICKY, selection ? cn('left-10', RING) : cn('left-0', LEFTMOST))
                        : 'text-foreground/80',
                      // a short value as narrow as it is, its room left to the texts; a text wraps in the
                      // width that the table gives its column, a long word too, at its own line breaks
                      // (an item a line, each whole); the table shares its width between the columns of texts by
                      // their bounds (8rem to 14rem), not by the length of their texts alone: a name or
                      // an item of a list on one line where the table has room, a long text no wider
                      // than 14rem, never narrowing the column of a short word (an e-mail) below 8rem
                      fits
                        ? 'w-px'
                        : cn(
                            'whitespace-pre-line wrap-anywhere',
                            index > 0 ? ((typeof shown === 'string' && DISPLAY_WIDTHS[shown]) || 'min-w-32 max-w-56') : 'max-w-48',
                          ),
                      isNumeric(field) && 'text-right',
                      alignsDigits(field) && 'tabular-nums',
                      hidden(name) && 'hidden',
                    )}
                  >
                    {lined.has(name) ? (
                      // its lines whole up to 12rem: the column no narrower than its longest line
                      // there, a longer line wrapping within it
                      <span className="inline-block w-max max-w-48 align-top">{cell(props, row, name)}</span>
                    ) : (
                      cell(props, row, name)
                    )}
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

/** The skeleton of the rows while the list loads (the cards with their covers, `media`). */
function ListSkeleton({ layout, columns, media }: { layout: 'table' | 'cards'; columns: number; media: boolean }) {
  if (layout === 'cards') return <CardsSkeleton media={media} />;
  return (
    <div className="surface overflow-hidden" aria-hidden="true">
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

const Nested = createContext(false);

/**
 * The lists inside a part of a screen (a related section of a card, a list of a product beside the
 * list of its screen): their search, view and actions stay over them, whatever
 * `composition.list_tools` of the theme; the header of the screen is that of its own list.
 */
export function NestedLists({ children }: { children: ReactNode }) {
  return <Nested value>{children}</Nested>;
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
  toolbar: placed,
  count: counted = false,
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
  card,
  density = THEME.density,
  selection: selectionProp = [],
  onSelectionChange,
  bulk = [],
  compactColumns = columns.slice(0, 2),
}: ResourceListProps) {
  const besideCard = useBesideCard();
  const nested = useContext(Nested);
  const place = placed ?? (nested ? 'list' : THEME.composition.list_tools);
  const wide = useWide();
  // next to its list, a card is as narrow as a phone: a list in it takes the layout of a phone
  const besideList = useBesideList();
  const view = wide && !besideList ? layout : phoneLayout;
  const { t, language } = useLanguage();
  const page = useScreenPage();
  // the places in the header of the screen, none outside one
  const header = place === 'header' ? (page?.tools ?? null) : null;
  const caption = counted ? (page?.caption ?? null) : null;
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(new Set());
  const [rowDensity, setRowDensity] = useState(density);
  // the selection of the bulk actions, kept here when the screen does not keep it
  const [ownSelection, setOwnSelection] = useState<readonly string[]>([]);
  const selection = onSelectionChange ? selectionProp : ownSelection;
  const select = onSelectionChange ?? setOwnSelection;
  const fields = useListFields(path);
  const order = orderLabels(path);
  const [filter, setFilter] = useState<Filter | undefined>();
  // the filters of the user start again empty when he resets them
  const [filterKey, setFilterKey] = useState(0);
  const sortId = useId();
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
  const [setScroller, moreRight] = useMoreRight();
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
    meta: actions.some((action) => action.permission?.startsWith('action_')) ? CUSTOM_META : META,
  };
  const list = useAnyList(path, query);
  const document = list.data;
  const rows = document?.data ?? [];
  const meta = document?.meta;
  const count = document ? pagination(document)?.count : undefined;
  const toolbar = actions.filter((action) => document && (!action.permission || permitted(meta, action.permission)));
  const filterList = listFilters(filters, fields);
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
    card,
    icon,
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

  const searchField = searchable && (
    // 15rem in a line of filters, whatever the tools beside it (the reset that comes and goes);
    // in the header as wide as 18rem, down to 6rem beside the actions on a phone too
    <div
      className={cn(
        'relative',
        header === null ? 'w-full @3xl:w-60' : 'min-w-24 flex-1 sm:max-w-72',
      )}
    >
      <Search className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        aria-label={t('list.search')}
        placeholder={t('list.search')}
        data-bz="field:$search"
        className={cn('pl-6', CLEAR_SEARCH)}
        value={searchText}
        onChange={(event) => {
          setSearchText(event.target.value);
        }}
      />
    </div>
  );
  function reset() {
    setFilterKey((it) => it + 1);
    setFilter(undefined);
    setSearchText('');
    setSearch('');
    setOffset(0);
  }
  // at the end of the row of the filters (`tools` of `FilterRow`), or in the header of the screen
  const tools = (
    <>
      <ResetFilters shown={filtered} onReset={reset} />
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
    </>
  );
  // the sort of the cards stays over them with the filters
  const sorts = view === 'cards' && sortable.length > 0;
  // the rows of the page among the items
  const range = (
    <span className="tabular-nums">
      {count === undefined
        ? t('list.range', { from: offset + 1, to: offset + rows.length })
        : t('list.range_of', { from: offset + 1, to: offset + rows.length, count })}
    </span>
  );

  return (
    // busy until the rows are those of the search typed and of the page asked for; the
    // search they are of in `data-search` (the end-to-end tests wait for both)
    <div
      data-bz={`list:${entity}`}
      data-search={search || undefined}
      aria-busy={list.isPlaceholderData || searchText.trim() !== search || undefined}
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
    >
      {header !== null &&
        createPortal(
          <>
            {searchField}
            <div className="flex gap-2">{tools}</div>
          </>,
          header,
        )}
      {caption !== null &&
        count !== undefined &&
        createPortal(
          <span data-slot="screen-count" data-value={count}>
            <span className="sr-only">{t('list.count')} </span>
            {formatNumber(count, language)}
          </span>,
          caption,
        )}
      {(header === null ? searchable || filterList.length > 0 || actions.length > 0 || viewMenu : filterList.length > 0 || sorts) && (
        // a plate with a search, the filters or the sort, not the tools alone
        <FilterRow
          plate={(header === null && searchable) || filterList.length > 0 || sorts}
          line={nested}
          tools={header === null ? tools : undefined}
        >
          {header === null && searchField}
          {filterList.length > 0 && (
            <FilterBar
              resets={filterKey}
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
          {sorts && (
            // as a filter of the row
            <FilterField label={t('list.sort')} id={sortId} kind="select" filled={sort.length > 0}>
              <Select
                value={sort[0] ?? EVERY}
                onValueChange={(next) => {
                  setSort(next === EVERY ? [] : [next]);
                  setOffset(0);
                }}
              >
                <SelectTrigger id={sortId} className={cn(filterWidth('select'), sort.length === 0 && 'text-muted-foreground')}>
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
            </FilterField>
          )}
        </FilterRow>
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
          skeleton={
            <ListSkeleton layout={view} columns={columns.length} media={cardRoles(columns, display, card).media !== undefined} />
          }
        >
          <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
            {view === 'cards' ? (
              <CardsView {...body} />
            ) : (
              <div className="relative">
                <div
                  ref={setScroller}
                  data-slot="table-scroll"
                  data-density={rowDensity}
                  className="@container surface max-h-[calc(100dvh-var(--sticky-top)-var(--space-section))] overflow-auto"
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
                          numeric={isNumeric(fields.fields.get(name))}
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
                {/* the table goes on to the right of its card, scrolled sideways: a shade at its edge */}
                <div
                  aria-hidden="true"
                  data-slot="table-more"
                  className={cn(
                    'pointer-events-none absolute inset-y-px right-px w-8 rounded-r-xl bg-linear-to-l from-foreground/12 to-transparent transition-opacity',
                    moreRight ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </div>
            )}
          </div>
        </StatePanel>
      )}
      {document &&
        rows.length > 0 &&
        (offset === 0 && nextPage(document) === null ? (
          // one page: its range, without the buttons of the pages
          <p className="text-sm text-muted-foreground">{range}</p>
        ) : (
          <nav aria-label={t('list.pages')} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            {range}
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
        ))}
    </div>
  );
}
