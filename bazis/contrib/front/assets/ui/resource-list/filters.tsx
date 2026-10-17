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
// one `filter` expression of Bazis that they make (`Filter` of the client). The fields are
// those of the user: the core answers a filter by a field it does not list for him (hidden
// by his field permissions, bazis-permit) with 400, so such a filter has no control.

import { useState } from 'react';

import { Filter } from '@/bazis/client';
import { ROUTES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import { RelationPicker, useAnyFilterFields } from '@/bazis/ui/resource';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';

/** A filter of a list: a field of `route_filter_fields/`, its label and its choices. */
export interface ListFilter {
  field: string;
  /** The label; the title of the field in the list schema by default. */
  label?: string;
  /**
   * The choices (value, label), as the statuses of `statusOptions()` of status-badge; those
   * of a field with choices in the list schema (`choiceOptions`) by default in `ResourceList`.
   */
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

/** The types of the filter fields of the route set by name, whether they are loaded, the error of their request. */
function useFilterTypes(path: string): { types: ReadonlyMap<string, FieldType>; pending: boolean; error: Error | null } {
  const query = useAnyFilterFields(path);
  const fields = query.data?.fields ?? [];
  return { types: new Map(fields.map((it) => [it.name, it.py_type])), pending: query.isPending, error: query.error };
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

interface FilterControlProps {
  filter: ListFilter;
  label: string;
  type: FieldType | undefined;
  values: FilterValues;
  onChange: (name: string, value: string) => void;
}

/** The control of a filter, marked `field:<field>` (the range of a date `field:<field>__gte`, `__lte`). */
function FilterControl({ filter, label, type, values, onChange }: FilterControlProps) {
  const { t } = useLanguage();
  const id = `filter-${filter.field}`;
  const { field } = filter;
  if (type === 'date' || type === 'datetime') {
    return (
      // on a phone a row of the full width (a fieldset is as wide as its content otherwise),
      // its two dates under the label when they do not fit beside it, sharing the row
      <fieldset className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
        <legend className="sr-only">{label}</legend>
        <span aria-hidden="true" className="text-sm whitespace-nowrap text-muted-foreground">
          {label}
        </span>
        <div className="flex min-w-0 grow items-center gap-1.5 sm:grow-0">
          {(['gte', 'lte'] as const).map((bound) => (
            <Input
              key={bound}
              type="date"
              className="h-9 w-36 min-w-0 flex-1 sm:flex-none"
              aria-label={t(bound === 'gte' ? 'filter.from' : 'filter.to', { label })}
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
  if (type === 'boolean' && !filter.options) {
    // a chip for each value, pressed again to show every item
    return (
      <div role="group" aria-label={label} data-bz={`field:${field}`} className="flex items-center gap-2">
        <span aria-hidden="true" className="text-sm whitespace-nowrap text-muted-foreground">
          {label}
        </span>
        {(['true', 'false'] as const).map((it) => (
          <Button
            key={it}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={value === it}
            className="rounded-full aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-ink"
            onClick={() => {
              onChange(field, value === it ? '' : it);
            }}
          >
            {t(it === 'true' ? 'value.yes' : 'value.no')}
          </Button>
        ))}
      </div>
    );
  }
  const relation = relationOf(type);
  const relationType = relation === null ? undefined : typeOfPath(relation);
  let control;
  if (filter.options) {
    const { options } = filter;
    control = (
      <NativeSelect
        id={id}
        data-bz={`field:${field}`}
        value={value}
        onChange={(event) => {
          onChange(field, event.target.value);
        }}
      >
        <NativeSelectOption value="">{t('filter.all')}</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  } else if (relationType !== undefined) {
    control = (
      <RelationPicker
        id={id}
        data-bz={`field:${field}`}
        className="w-48 min-w-0 flex-1 sm:flex-none"
        label={label}
        relation={relationType}
        value={value || null}
        placeholder={t('filter.all')}
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
        className="h-9 w-40 min-w-0 flex-1 sm:flex-none"
        type={type !== undefined && NUMBERS.has(type) ? 'number' : 'text'}
        step={type === 'integer' ? 1 : type !== undefined && NUMBERS.has(type) ? 'any' : undefined}
        value={value}
        onChange={(event) => {
          onChange(field, event.target.value);
        }}
      />
    );
  }
  // on a phone a row of the full width, its control taking the rest of it
  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
      <Label htmlFor={id} className="font-normal whitespace-nowrap text-muted-foreground">
        {label}
      </Label>
      {control}
    </div>
  );
}

interface FilterBarProps {
  path: string;
  filters: readonly ListFilter[];
  /** Whether the titles of the fields are loaded: until then, and until the types of the filters are, a skeleton. */
  ready?: boolean;
  /** The titles of the fields. */
  title: (name: string) => string;
  /** Called with the expression of the filters when a value changes. */
  onFilter: (filter: Filter | undefined) => void;
}

/**
 * The controls of the filters of a list (their types from `route_filter_fields/`), but for
 * the fields that the backend does not offer the user to filter by; the state of the error
 * when the filter fields cannot be read (not every filter hidden in silence).
 */
export function FilterBar({ path, filters: wanted, ready = true, title, onFilter }: FilterBarProps) {
  const { t } = useLanguage();
  const { types, pending, error } = useFilterTypes(path);
  const [values, setValues] = useState<FilterValues>({});
  const filters = wanted.filter((filter) => types.has(filter.field));
  if (error) return <StatePanel inline state={errorState(error)} error={error} message={t('filter.unavailable')} />;
  if (pending || !ready) {
    return (
      <>
        {wanted.map((filter) => (
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
