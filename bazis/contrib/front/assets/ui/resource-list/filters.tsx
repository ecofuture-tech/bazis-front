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

// The filters of a list: a control per field by its type in `route_filter_fields/`, and the
// one `filter` expression of Bazis that they make (`Filter` of the client).

import { useState } from 'react';

import { Filter } from '@/bazis/client';
import { ROUTES } from '@/bazis/generated/contract';
import { RelationSelect, useAnyFilterFields } from '@/bazis/ui/resource';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';

/** A filter of a list: a field of `route_filter_fields/`, its label and its choices. */
export interface ListFilter {
  field: string;
  /** The label; the title of the field in the list schema by default. */
  label?: string;
  /** The choices (value, label), as the statuses of `statusOptions()` of status-badge. */
  options?: readonly { value: string; label: string }[];
}

/** The values of the filters by field; a date range is `<field>__gte` and `<field>__lte`. */
export type FilterValues = Readonly<Record<string, string>>;

/**
 * The type of a filter field: `py_type` of `route_filter_fields/`, the JSON Schema type of
 * the field written by the core (`integer`, `number`, `Decimal`, `string`, `boolean`,
 * `date`, `datetime`, `object`, `array`), the path of the list of the related resource for
 * a relation, `unknown` for what the core cannot type (a relation without a route set, a
 * JSON field).
 */
type FieldType = string;

/** The numeric types; a `Decimal` is sent as it is written, not as a float. */
const NUMBERS = new Set(['integer', 'number', 'Decimal']);

/** The types of the filter fields of the route set by name, and whether they are loaded. */
export function useFilterTypes(path: string): { types: ReadonlyMap<string, FieldType>; pending: boolean } {
  const query = useAnyFilterFields(path);
  const fields = query.data?.fields ?? [];
  return { types: new Map(fields.map((it) => [it.name, it.py_type])), pending: query.isPending };
}

function relationOf(type: FieldType | undefined): string | null {
  return type?.startsWith('/') ? type : null;
}

/** The `filter` expression of the values, or undefined without any. */
export function filterOf(
  filters: readonly ListFilter[],
  values: FilterValues,
  types: ReadonlyMap<string, FieldType>,
): Filter | undefined {
  const parts: Filter[] = [];
  for (const { field, options } of filters) {
    const type = types.get(field);
    const value = values[field];
    if (type === 'date' || type === 'datetime') {
      const from = values[`${field}__gte`];
      const to = values[`${field}__lte`];
      if (from) parts.push(Filter.where(`${field}__gte`, from));
      if (to) parts.push(Filter.where(`${field}__lte`, type === 'datetime' ? `${to}T23:59:59` : to));
    } else if (!value) {
      continue;
    } else if (options || relationOf(type)) {
      parts.push(Filter.where(field, value));
    } else if (type === 'boolean') {
      parts.push(Filter.where(field, value === 'true'));
    } else if (type === 'Decimal') {
      parts.push(Filter.where(field, value));
    } else if (type !== undefined && NUMBERS.has(type)) {
      parts.push(Filter.where(field, Number(value)));
    } else if (type === 'string') {
      // every word of the value is in the field
      parts.push(Filter.where(`${field}__$search`, value));
    } else {
      parts.push(Filter.where(field, value));
    }
  }
  return parts.length ? Filter.and(...parts) : undefined;
}

/** The JSON:API type of the route set of a path (`ROUTES` of the contract). */
function typeOfPath(path: string): string | undefined {
  return Object.entries(ROUTES as Readonly<Record<string, string>>).find(([, it]) => it === path)?.[0];
}

export interface FilterControlProps {
  filter: ListFilter;
  label: string;
  type: FieldType | undefined;
  values: FilterValues;
  onChange: (name: string, value: string) => void;
}

/** The control of a filter, marked `field:<field>` (the range of a date `field:<field>__gte`, `__lte`). */
export function FilterControl({ filter, label, type, values, onChange }: FilterControlProps) {
  const id = `filter-${filter.field}`;
  const { field } = filter;
  if (type === 'date' || type === 'datetime') {
    return (
      <fieldset className="flex items-center gap-2">
        <legend className="sr-only">{label}</legend>
        <span aria-hidden="true" className="text-sm whitespace-nowrap text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {(['gte', 'lte'] as const).map((bound) => (
            <Input
              key={bound}
              type="date"
              className="h-9 w-36"
              aria-label={`${label} ${bound === 'gte' ? 'from' : 'to'}`}
              data-bz={`field:${field}__${bound}`}
              value={values[`${field}__${bound}`] ?? ''}
              onChange={(event) => {
                onChange(`${field}__${bound}`, event.target.value);
              }}
            />
          ))}
        </div>
      </fieldset>
    );
  }
  const value = values[field] ?? '';
  const relation = relationOf(type);
  const relationType = relation === null ? undefined : typeOfPath(relation);
  let control;
  if (filter.options || type === 'boolean') {
    const options = filter.options ?? [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ];
    control = (
      <NativeSelect
        id={id}
        data-bz={`field:${field}`}
        value={value}
        onChange={(event) => {
          onChange(field, event.target.value);
        }}
      >
        <NativeSelectOption value="">All</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  } else if (relationType !== undefined) {
    control = (
      <RelationSelect
        id={id}
        data-bz={`field:${field}`}
        relation={relationType}
        value={value || null}
        placeholder="All"
        onChange={(next) => {
          onChange(field, next ?? '');
        }}
      />
    );
  } else {
    control = (
      <Input
        id={id}
        data-bz={`field:${field}`}
        className="h-9 w-40"
        type={type !== undefined && NUMBERS.has(type) ? 'number' : 'text'}
        step={type === 'integer' ? 1 : type !== undefined && NUMBERS.has(type) ? 'any' : undefined}
        value={value}
        onChange={(event) => {
          onChange(field, event.target.value);
        }}
      />
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="font-normal whitespace-nowrap text-muted-foreground">
        {label}
      </Label>
      {control}
    </div>
  );
}

export interface FilterBarProps {
  path: string;
  filters: readonly ListFilter[];
  /** Whether the titles of the fields are loaded: until then, and until the types of the filters are, a skeleton. */
  ready?: boolean;
  /** The titles of the fields. */
  title: (name: string) => string;
  /** Called with the expression of the filters when a value changes. */
  onFilter: (filter: Filter | undefined) => void;
}

/** The controls of the filters of a list (their types from `route_filter_fields/`). */
export function FilterBar({ path, filters, ready = true, title, onFilter }: FilterBarProps) {
  const { types, pending } = useFilterTypes(path);
  const [values, setValues] = useState<FilterValues>({});
  if (pending || !ready) {
    return (
      <>
        {filters.map((filter) => (
          <Skeleton key={filter.field} data-filter-skeleton="" className="h-9 w-44" />
        ))}
      </>
    );
  }
  return (
    <>
      {filters.map((filter) => (
        <FilterControl
          key={filter.field}
          filter={filter}
          label={filter.label ?? title(filter.field)}
          type={types.get(filter.field)}
          values={values}
          onChange={(name, value) => {
            const next = { ...values, [name]: value };
            setValues(next);
            onFilter(filterOf(filters, next, types));
          }}
        />
      ))}
    </>
  );
}
