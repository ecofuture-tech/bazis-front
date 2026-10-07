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
// schema, search, filters, sort, pages and the actions the backend allows. Marked
// `list:<entity>`, its rows `row:<id>`, its states `state:<state>`.

import { useEffect, useState, type ReactNode } from 'react';

import { nextPage, pagination, prevPage, type Filter } from '@/bazis/client';
import { RESOURCES } from '@/bazis/generated/contract';
import type { ListPath } from '@/bazis/react';
import {
  FieldValue,
  fieldValue,
  permitted,
  useAnyList,
  useListFields,
  type ResourceObject,
} from '@/bazis/ui/resource';
import { queryState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { FilterBar, type ListFilter } from './filters.js';

/** An action of the list, a button `action:<id>`; `add` shows it when the user may create. */
export interface ListAction {
  id: string;
  label: ReactNode;
  onClick: () => void;
  permission?: 'add';
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
  /** The fields of the columns: attributes and relationships of the list. */
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
  actions?: readonly ListAction[];
  rowActions?: readonly RowAction[];
  /** The content of the cells of a column, instead of the formatted value. */
  cells?: Readonly<Record<string, (row: ResourceObject) => ReactNode>>;
  /** The message of the empty list. */
  emptyMessage?: ReactNode;
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
  actions = [],
  rowActions = [],
  cells = {},
  emptyMessage,
}: ResourceListProps) {
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

  function toggle(name: string) {
    const label = order.get(name);
    if (label === undefined) return;
    setSort(sort[0] === label ? [`-${label}`] : [label]);
    setOffset(0);
  }

  function open(id: string) {
    onOpen?.(id);
  }

  return (
    <div data-bz={`list:${entity}`} className="grid gap-4">
      {(searchable || filterList.length > 0 || actions.length > 0) && (
        <div className="flex flex-wrap items-end gap-3">
          {searchable && (
            <Input
              type="search"
              aria-label="Search"
              placeholder="Search"
              data-bz="field:$search"
              className="max-w-xs"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
              }}
            />
          )}
          {filterList.length > 0 && (
            <FilterBar
              path={path}
              filters={filterList}
              title={fields.title}
              onFilter={(next) => {
                setFilter(next);
                setOffset(0);
              }}
            />
          )}
          <div className="ml-auto flex gap-2">
            {toolbar.map((action) => (
              <Button key={action.id} type="button" data-bz={`action:${action.id}`} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      <StatePanel
        state={queryState(list, rows.length === 0)}
        error={list.error}
        message={rows.length === 0 && document ? emptyMessage : undefined}
        onRetry={() => void list.refetch()}
      >
        <Table aria-busy={list.isPlaceholderData || undefined}>
          <TableHeader>
            <TableRow>
              {columns.map((name) => {
                const label = order.get(name);
                const direction = sort[0] === label ? 'ascending' : sort[0] === `-${label ?? ''}` ? 'descending' : undefined;
                return (
                  <TableHead key={name} aria-sort={direction}>
                    {label === undefined ? (
                      fields.title(name)
                    ) : (
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => {
                          toggle(name);
                        }}
                      >
                        {fields.title(name)}
                        {direction === 'ascending' ? ' ↑' : direction === 'descending' ? ' ↓' : ''}
                      </button>
                    )}
                  </TableHead>
                );
              })}
              {rowActions.length > 0 && (
                <TableHead>
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
                tabIndex={onOpen ? 0 : undefined}
                className={onOpen ? 'cursor-pointer' : undefined}
                onClick={
                  onOpen
                    ? () => {
                        open(row.id);
                      }
                    : undefined
                }
                onKeyDown={
                  onOpen
                    ? (event) => {
                        // not the Enter of a control of the row (its actions), which bubbles
                        if (event.key === 'Enter' && event.target === event.currentTarget) open(row.id);
                      }
                    : undefined
                }
              >
                {columns.map((name) => (
                  <TableCell key={name}>
                    {cells[name]?.(row) ?? <FieldValue field={fields.fields.get(name)} value={fieldValue(row, name)} />}
                  </TableCell>
                ))}
                {rowActions.length > 0 && (
                  <TableCell className="text-right">
                    {rowActions
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
                      ))}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </StatePanel>
      {document && rows.length > 0 && (
        <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>
            {offset + 1}–{offset + rows.length}
            {count === undefined ? '' : ` of ${String(count)}`}
          </span>
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
          </Button>
        </nav>
      )}
    </div>
  );
}
