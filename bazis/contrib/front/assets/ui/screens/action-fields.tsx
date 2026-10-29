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

// The fields of the body of a custom action, read from the contract (its JSON Schema and the
// fields of the resource): those of its dialog (`useCustomAction`) and of its form
// (`ActionForm`). A property named as a relationship of the resource is the picker of its
// related items (`relatedField`), one of the ids of the uploaded files (`x-relation`) a file
// field; another is the attribute of the body (a decimal typed as such).

import { objectFields, startValue, type JsonSchema } from '@/bazis/react';
import { FieldInput, relatedField, type FieldFilters, type Fields } from '@/bazis/ui/resource';

/** The values of the specs that the fields of an action start with (`values`), by property. */
export type StartValues = Readonly<Record<string, string | number | boolean>>;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * A day of the browser of `values` (`today`, `today+<n>`, `today-<n>`, `month_start`,
 * `month_end`, then ` HH:MM`) as the value of a field of a date (`YYYY-MM-DD`) or of a
 * date-time (ISO, UTC) at the time `now`; null for another text or field.
 */
function dayOf(text: string, format: string | null, now: Date): string | null {
  const match = /^(today(?:([+-])(\d+))?|month_start|month_end)(?: (\d{2}):(\d{2}))?$/.exec(text);
  if (!match || (format !== 'date' && format !== 'date-time')) return null;
  const [, day, sign, count, hours = '0', minutes = '0'] = match;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (day === 'month_start') date.setDate(1);
  else if (day === 'month_end') date.setMonth(date.getMonth() + 1, 0);
  else if (count) date.setDate(date.getDate() + (sign === '-' ? -1 : 1) * Number(count));
  if (format === 'date') return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  date.setHours(Number(hours), Number(minutes));
  return date.toISOString();
}

/**
 * The values that the fields start with when the form or the dialog opens: those of the
 * specs (`values`, a day of the browser of a date computed now), else the `startValue` of the
 * properties of the body that they ask for (their defaults, false of a checkbox).
 */
export function bodyDefaults(
  body: JsonSchema | null,
  names: readonly string[],
  start: StartValues = {},
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const now = new Date();
  for (const field of objectFields(body ?? {})) {
    if (!names.includes(field.name)) continue;
    const given = start[field.name];
    const value =
      given === undefined ? startValue(field) : typeof given === 'string' ? (dayOf(given, field.format, now) ?? given) : given;
    if (value !== undefined) values[field.name] = value;
  }
  return values;
}

export interface ActionFieldsProps {
  /** The route set of the entity whose action it is (`ROUTES` of the contract). */
  path: string;
  /** The JSON Schema of the body of the action (`body` of its custom action in the contract). */
  body: JsonSchema;
  /** The properties of the body that it asks for, in this order. */
  names: readonly string[];
  /** The labels of the specs by property (`labels` of the action), before any other title. */
  labels?: Readonly<Record<string, string>> | undefined;
  /** The items that the pickers of its relationships offer, by property (`filters` of the action). */
  filters?: FieldFilters | undefined;
  /**
   * The fields of a runtime schema of the route set that a screen has read (the list of a
   * dialog): the titles and the labels of the choices of the properties named as its fields,
   * in the language of the interface.
   */
  resource?: Fields | undefined;
  values: Readonly<Record<string, unknown>>;
  errors: Readonly<Record<string, readonly string[]>>;
  disabled: boolean;
  onChange: (name: string, value: unknown) => void;
  /** A file of a field starts or ends uploading (`useUploads`): the action waits for it. */
  onBusy: (name: string) => (busy: boolean) => void;
}

/** The fields of the properties of the body of a custom action that a dialog or a form asks for. */
export function ActionFields({ path, body, names, labels, filters, resource, values, errors, disabled, onChange, onBusy }: ActionFieldsProps) {
  const properties = objectFields(body);
  return names.map((name) => {
    const property = properties.find((it) => it.name === name);
    if (property === undefined) return null;
    return (
      <FieldInput
        key={name}
        field={relatedField(path, property, labels?.[name], resource)}
        filter={filters?.[name]}
        value={values[name]}
        errors={errors[name]}
        disabled={disabled}
        onChange={(value) => {
          onChange(name, value);
        }}
        onBusy={onBusy(name)}
      />
    );
  });
}
