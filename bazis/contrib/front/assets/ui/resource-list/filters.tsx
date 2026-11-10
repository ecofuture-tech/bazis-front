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

// The filters of a list: a control per field by its type in `route_filter_fields/` (a select
// of the choices named by the field, the picker of a relation, a range of dates, chips of a
// boolean, an input), and the one `filter` expression of Bazis that they make (`Filter` of
// the client). The fields are
// those of the user: the core answers a filter by a field it does not list for him (hidden
// by his field permissions, bazis-permit) with 400, so such a filter has no control.

import { FunnelX, ListFilter as ListFilterIcon } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';

import { Filter } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import { choiceOptions, DateInput, type Fields, RelationPicker, typeAt, useAnyFilterFields } from '@/bazis/ui/resource';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { fieldGroupClassName, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** A filter of a list: a field of `route_filter_fields/`, its label and its choices. */
export interface ListFilter {
  field: string;
  /** The label; the title of the field in the list schema by default. */
  label?: string;
  /**
   * The choices (value, label), as the statuses of `statusOptions()` of status-badge; those
   * of a field with choices in the list schema (`choiceOptions`) by default (`listFilters`).
   */
  options?: readonly { value: string; label: string }[];
}

/** The values of the filters by field; a date range is `<field>__gte` and `<field>__lte`. */
export type FilterValues = Readonly<Record<string, string>>;

/**
 * The filters of a list, a board or a calendar, given by the name of their field or as they
 * are: a field with choices in the list schema is filtered by a select of its choices, by
 * their labels.
 */
export function listFilters(filters: readonly (string | ListFilter)[], fields: Fields): ListFilter[] {
  return filters.map((it) => {
    const filter = typeof it === 'string' ? { field: it } : it;
    const options = filter.options ?? choiceOptions(fields.fields.get(filter.field));
    return options ? { ...filter, options } : filter;
  });
}

/**
 * The type of a filter field: `py_type` of `route_filter_fields/`, the JSON Schema type of
 * the field written by the core (`integer`, `number`, `Decimal`, `string`, `boolean`,
 * `date`, `datetime`, `object`, `array`), the path of the list of the related resource for
 * a relation, `unknown` for what the core cannot type (a relation without a route set, a
 * JSON field).
 */
type FieldType = string;

/**
 * The value of the option of every item in a select of Radix, whose options cannot be empty;
 * marked `data-value=""`, the option that the helpers of the end-to-end tests choose for null.
 */
export const EVERY = '$every';

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

/**
 * The values of the filters that select one value of their field, a related item or a
 * choice: those that a new item of the filtered items takes (the add of a calendar).
 */
export function equalValues(
  filters: readonly ListFilter[],
  values: FilterValues,
  types: ReadonlyMap<string, FieldType>,
): FilterValues {
  return Object.fromEntries(
    filters
      .filter(({ field, options }) => values[field] && (options || relationOf(types.get(field))))
      .map(({ field }) => [field, values[field] ?? '']),
  );
}

/** The kinds of the controls of the filters, by which they are as wide where the row is a line. */
export type FilterKind = 'date' | 'text' | 'relation' | 'select' | 'chips';

/** The width of the control of a filter where its row is a line (a container of 48rem); its cell otherwise. */
const WIDTHS: Record<FilterKind, string> = {
  date: '@3xl:w-36',
  text: '@3xl:w-40',
  relation: '@3xl:w-48',
  select: '@3xl:min-w-28',
  chips: '',
};

/** The width of a control of a filter of this kind: its cell where the filters are a grid, its own in a line. */
export function filterWidth(kind: FilterKind): string {
  return cn('w-full', WIDTHS[kind]);
}

/**
 * A filter of the row of the filters (`FilterRow`): its label, always over its control (on a
 * plate where the text of the control starts, as the label of a field of a form otherwise), in
 * the color of the text once the filter has a value (`data-filled`); the line of the control
 * drawn by its group (`data-slot="field-group"`), as for the range of two dates (`legend` without
 * an `id`, its label read as the name of the group). Folded (`folded`), it is hidden on a phone.
 */
export function FilterField({ label, id, kind, filled, folded = false, children, 'data-bz': mark }: {
  label: string;
  /** The id of the control that the label names; without one the filter is a group of controls named by the label. */
  id?: string;
  kind: FilterKind;
  /** Whether the filter has a value. */
  filled: boolean;
  /** Whether the filters are folded behind their button where the row is one column (a phone). */
  folded?: boolean;
  /** The mark of a group of controls (`field:<field>` of the chips of a boolean). */
  'data-bz'?: string;
  children: ReactNode;
}) {
  const wrapper = cn('grid w-full min-w-0 gap-1 @3xl:w-auto', kind === 'date' && '@md:col-span-2', folded && '@max-md:hidden');
  const text = 'cursor-pointer text-sm font-normal whitespace-nowrap text-muted-foreground in-data-filled:text-foreground';
  const group = (
    <div data-slot="field-group" className={cn(fieldGroupClassName, 'min-w-0 gap-2', kind === 'chips' && 'pl-1')}>
      {children}
    </div>
  );
  return id === undefined ? (
    <fieldset data-bz={mark} data-filled={filled || undefined} className={wrapper}>
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className={text}>
        {label}
      </span>
      {group}
    </fieldset>
  ) : (
    <div data-filled={filled || undefined} className={wrapper}>
      <Label htmlFor={id} className={text}>
        {label}
      </Label>
      {group}
    </div>
  );
}

interface FilterControlProps {
  filter: ListFilter;
  label: string;
  type: FieldType | undefined;
  values: FilterValues;
  onChange: (name: string, value: string) => void;
  folded: boolean;
}

/** The control of a filter, marked `field:<field>` (the range of a date `field:<field>__gte`, `__lte`). */
function FilterControl({ filter, label, type, values, onChange, folded }: FilterControlProps) {
  const { t } = useLanguage();
  const id = `filter-${filter.field}`;
  const { field } = filter;
  if (type === 'date' || type === 'datetime') {
    const bounds = ['gte', 'lte'] as const;
    return (
      // its two dates side by side, a dash between them, under its label
      <FilterField folded={folded} label={label} kind="date" filled={bounds.some((bound) => values[`${field}__${bound}`])}>
        {bounds.map((bound) => (
          <Fragment key={bound}>
            {bound === 'lte' && (
              <span aria-hidden="true" className="text-muted-foreground">
                —
              </span>
            )}
            <DateInput
              className={cn('min-w-0 flex-1 @3xl:flex-none', WIDTHS.date)}
              aria-label={t(bound === 'gte' ? 'filter.from' : 'filter.to', { label })}
              data-bz={`field:${field}__${bound}`}
              value={values[`${field}__${bound}`] ?? ''}
              onChange={(value) => {
                onChange(`${field}__${bound}`, value);
              }}
            />
          </Fragment>
        ))}
      </FilterField>
    );
  }
  const value = values[field] ?? '';
  if (type === 'boolean' && !filter.options) {
    // a chip for each value, pressed again to show every item
    return (
      <FilterField folded={folded} label={label} kind="chips" filled={value !== ''} data-bz={`field:${field}`}>
        {(['true', 'false'] as const).map((it) => (
          <Button
            key={it}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={value === it}
            onClick={() => {
              onChange(field, value === it ? '' : it);
            }}
          >
            {t(it === 'true' ? 'value.yes' : 'value.no')}
          </Button>
        ))}
      </FilterField>
    );
  }
  if (filter.options) {
    const { options } = filter;
    return (
      <FilterField folded={folded} label={label} id={id} kind="select" filled={value !== ''}>
        <Select
          value={value || EVERY}
          onValueChange={(next) => {
            onChange(field, next === EVERY ? '' : next);
          }}
        >
          <SelectTrigger id={id} data-bz={`field:${field}`} className={cn(filterWidth('select'), !value && 'text-muted-foreground')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value={EVERY} data-value="">
              {t('filter.all')}
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    );
  }
  const relation = relationOf(type);
  const relationType = relation === null ? undefined : typeAt(relation);
  if (relationType !== undefined) {
    return (
      <FilterField folded={folded} label={label} id={id} kind="relation" filled={value !== ''}>
        <RelationPicker
          id={id}
          data-bz={`field:${field}`}
          className={filterWidth('relation')}
          label={label}
          relation={relationType}
          value={value || null}
          placeholder={t('filter.all')}
          onChange={(next) => {
            onChange(field, next ?? '');
          }}
        />
      </FilterField>
    );
  }
  return (
    <FilterField folded={folded} label={label} id={id} kind="text" filled={value !== ''}>
      <Input
        id={id}
        data-bz={`field:${field}`}
        className={filterWidth('text')}
        type={type !== undefined && NUMBERS.has(type) ? 'number' : 'text'}
        step={type === 'integer' ? 1 : type !== undefined && NUMBERS.has(type) ? 'any' : undefined}
        value={value}
        onChange={(event) => {
          onChange(field, event.target.value);
        }}
      />
    </FilterField>
  );
}

/** Clears the filters of the user (`action:reset-filters`), shown while he has any. */
export function ResetFilters({ onReset }: { onReset: () => void }) {
  const { t } = useLanguage();
  return (
    <Button type="button" variant="outline" data-bz="action:reset-filters" aria-label={t('filter.reset')} title={t('filter.reset')} onClick={onReset}>
      <FunnelX aria-hidden="true" />
      {t('filter.clear')}
    </Button>
  );
}

/**
 * The row of the filters of a list, a calendar or a board, with the search of a list, on a plate
 * of its own (`plate`: with a search or more than one filter, not the tools alone), its tools
 * (`tools`) at its end: where its container is as wide as 48rem the filters wrap beside the tools,
 * which stay on the right of their last line, the lines of the controls at the bottom under their
 * labels; narrower (a list beside its card, a phone) a grid of cells of one width, two from 28rem
 * (a range of dates takes both, the next filters filling the cell it leaves), the label and the
 * control of a filter filling its cell, the tools at the end of the second column (of the line on
 * a phone), wrapping there rather than past the edge.
 */
export function FilterRow({ plate = true, tools, children }: { plate?: boolean; tools?: ReactNode; children: ReactNode }) {
  return (
    <div data-plate={plate || undefined} className={cn('@container', plate && 'surface px-(--space-card) py-[calc(var(--space-card)/2)]')}>
      <div className="grid grid-flow-dense grid-cols-1 items-end gap-x-6 gap-y-3 @md:grid-cols-2 @3xl:flex">
        <div className="contents @3xl:flex @3xl:min-w-0 @3xl:flex-1 @3xl:flex-wrap @3xl:items-end @3xl:gap-x-6 @3xl:gap-y-3">{children}</div>
        {tools !== undefined && <div className="col-span-full flex min-w-0 flex-wrap justify-end gap-2 @md:col-span-1 @md:col-start-2 @3xl:shrink-0">{tools}</div>}
      </div>
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
  /**
   * Called with the expression of the filters when a value changes, and the values of those
   * that select one value of their field (`equalValues`).
   */
  onFilter: (filter: Filter | undefined, equal: FilterValues) => void;
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
  // on a phone the filters are folded behind their button, which counts those with a value
  const [unfolded, setUnfolded] = useState(false);
  const filters = wanted.filter((filter) => types.has(filter.field));
  const foldable = filters.length > 1;
  const count = filters.filter(({ field }) => values[field] || values[`${field}__gte`] || values[`${field}__lte`]).length;
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
      {foldable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-bz="action:filters"
          aria-expanded={unfolded}
          className="justify-self-start @md:hidden"
          onClick={() => {
            setUnfolded(!unfolded);
          }}
        >
          <ListFilterIcon aria-hidden="true" />
          {t('filter.toggle')}
          {count > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{count}</span>}
        </Button>
      )}
      {filters.map((filter) => (
        <FilterControl
          key={filter.field}
          folded={foldable && !unfolded}
          filter={filter}
          label={filter.label ?? title(filter.field)}
          type={types.get(filter.field)}
          values={values}
          onChange={(name, value) => {
            const next = { ...values, [name]: value };
            setValues(next);
            onFilter(filterOf(filters, next, types), equalValues(filters, next, types));
          }}
        />
      ))}
    </>
  );
}
