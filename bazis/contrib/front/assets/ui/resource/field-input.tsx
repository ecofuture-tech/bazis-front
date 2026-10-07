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

// The input of a field of a runtime schema, the only one: the forms of the resources and the
// payloads of the transits render their fields with it. The control is marked
// `data-bz="field:<name>"` and its errors `data-bz="error:<name>"`.

import { useId, useState, type ComponentProps } from 'react';

import type { AttributeField, FormField } from '@/bazis/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

import { fromLocalDateTime, toLocalDateTime } from './fields.js';
import { text } from './hooks.js';
import { RelationSelect } from './relation.js';

export interface FieldInputProps {
  field: FormField;
  /** The value: of an attribute, the id of the related item of a to-one relationship. */
  value: unknown;
  onChange: (value: unknown) => void;
  /** The validation errors of the field. */
  errors?: readonly string[] | undefined;
  /** Disables the control, e.g. while the form is submitted. */
  disabled?: boolean;
}

const TEXTAREA =
  'min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none ' +
  'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm';

type ControlProps = Pick<ComponentProps<'input'>, 'id' | 'required' | 'aria-invalid' | 'aria-describedby'> & {
  'data-bz': string;
};

/** A JSON value (an object, an array) as text; kept as text while it is not valid JSON. */
function JsonInput({ value, onChange, readOnly, disabled, control }: {
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  disabled: boolean;
  control: ControlProps;
}) {
  const [draft, setDraft] = useState(() => (value === undefined ? '' : JSON.stringify(value, null, 2)));
  return (
    <textarea
      {...control}
      className={cn(TEXTAREA, 'font-mono')}
      value={draft}
      readOnly={readOnly}
      disabled={disabled}
      onChange={(event) => {
        setDraft(event.target.value);
        try {
          onChange(event.target.value ? JSON.parse(event.target.value) : null);
        } catch {
          onChange(event.target.value);
        }
      }}
    />
  );
}

function empty(field: AttributeField): null | undefined {
  return field.nullable ? null : undefined;
}

function AttributeControl({ field, value, onChange, disabled, control }: {
  field: AttributeField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  control: ControlProps;
}) {
  const { readOnly } = field;
  if (field.enum) {
    return (
      <NativeSelect
        {...control}
        className="w-full"
        value={value === null || value === undefined ? '' : text(value)}
        disabled={disabled || readOnly}
        aria-readonly={readOnly || undefined}
        onChange={(event) => {
          const choice = field.enum?.find((it) => text(it) === event.target.value);
          onChange(choice === undefined ? empty(field) : choice);
        }}
      >
        <NativeSelectOption value="">—</NativeSelectOption>
        {field.enum.map((choice) => (
          <NativeSelectOption key={text(choice)} value={text(choice)}>
            {text(choice)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  if (field.type === 'boolean') {
    return (
      <input
        {...control}
        type="checkbox"
        className="size-4 accent-primary"
        checked={value === true}
        disabled={disabled || readOnly}
        aria-readonly={readOnly || undefined}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    );
  }
  if (field.type === 'integer' || field.type === 'number') {
    return (
      <Input
        {...control}
        type="number"
        step={field.type === 'integer' ? 1 : 'any'}
        value={typeof value === 'number' ? value : ''}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value === '' ? empty(field) : Number(event.target.value));
        }}
      />
    );
  }
  if (field.type === 'string') {
    const current = typeof value === 'string' ? value : '';
    if (field.format === 'date-time') {
      return (
        <Input
          {...control}
          type="datetime-local"
          value={toLocalDateTime(value)}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(event) => {
            onChange(fromLocalDateTime(event.target.value) ?? empty(field));
          }}
        />
      );
    }
    const type = { date: 'date', time: 'time', email: 'email', uri: 'url' }[field.format ?? ''];
    // a text field of the model has no maximal length: several lines
    if (type === undefined && field.format === null && field.schema.maxLength === undefined) {
      return (
        <textarea
          {...control}
          className={TEXTAREA}
          value={current}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      );
    }
    return (
      <Input
        {...control}
        type={type ?? 'text'}
        value={current}
        maxLength={typeof field.schema.maxLength === 'number' ? field.schema.maxLength : undefined}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === '' && type !== undefined ? empty(field) : next);
        }}
      />
    );
  }
  return <JsonInput value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} control={control} />;
}

/**
 * A field of a runtime schema with its label and its errors: the control by the type,
 * format and choices of an attribute, the select of the related item of a to-one
 * relationship; read-only when the user may not change it. To-many relationships are not
 * edited here (`useRelationship`): they are shown read-only.
 */
export function FieldInput({ field, value, onChange, errors = [], disabled = false }: FieldInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = errors.length > 0;
  const control: ControlProps = {
    id,
    required: field.required,
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? errorId : undefined,
    'data-bz': `field:${field.name}`,
  };
  const checkbox = field.kind === 'attribute' && field.type === 'boolean' && !field.enum;
  return (
    // the wrapper of a select of shadcn/ui fits its content: the field is as wide as the form
    <div
      className={cn(
        'grid gap-2 [&>[data-slot=native-select-wrapper]]:w-full',
        checkbox && 'grid-cols-[auto_1fr] items-center',
      )}
    >
      <Label htmlFor={id} className={cn(checkbox && 'order-2')}>
        {field.title}
        {field.required && <span aria-hidden="true">*</span>}
      </Label>
      {field.kind === 'relation' ? (
        field.many ? (
          <Input {...control} value={Array.isArray(value) ? value.join(', ') : ''} readOnly />
        ) : (
          <RelationSelect
            {...control}
            relation={field.relation}
            value={typeof value === 'string' && value ? value : null}
            disabled={disabled || field.readOnly}
            aria-readonly={field.readOnly || undefined}
            onChange={onChange}
          />
        )
      ) : (
        <AttributeControl field={field} value={value} onChange={onChange} disabled={disabled} control={control} />
      )}
      {invalid && (
        <p id={errorId} data-bz={`error:${field.name}`} role="alert" className="col-span-full text-sm text-destructive">
          {errors.join(' ')}
        </p>
      )}
    </div>
  );
}
