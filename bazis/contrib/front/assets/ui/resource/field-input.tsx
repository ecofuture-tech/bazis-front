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

import { useCallback, useId, useState } from 'react';

import type { Filter } from '@/bazis/client';
import { choiceLabel, type AttributeField, type FormField } from '@/bazis/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

import { DateInput } from './dates.js';
import { DecimalInput } from './decimals.js';
import { fromLocalDateTime, toLocalDateTime } from './fields.js';
import { isFile, useFiles, type ControlProps } from './files.js';
import { text } from './hooks.js';
import { isPoint, PointInput, usePoints } from './points.js';
import { RelationListPicker, RelationPicker } from './relation-picker.js';

export interface FieldInputProps {
  field: FormField;
  /**
   * The value: of an attribute, the id of the related item of a to-one relationship, the ids
   * of the related items of a to-many one.
   */
  value: unknown;
  onChange: (value: unknown) => void;
  /** The validation errors of the field. */
  errors?: readonly string[] | undefined;
  /** Disables the control, e.g. while the form is submitted. */
  disabled?: boolean;
  /** A file of the field starts or ends uploading: the form waits for it to be submitted. */
  onBusy?: (busy: boolean) => void;
  /** The route set of the resource of the field: a point field of it (`PointsProvider`, the contract) is edited as a point. */
  path?: string | undefined;
  /** The items that the picker of a relationship offers: those of the related resource that match it (`filters` of the specs). */
  filter?: Filter | undefined;
}

/** The filters of the pickers of the relationships of a form by their fields (`filters` of the specs). */
export type FieldFilters = Readonly<Record<string, Filter>>;

const TEXTAREA =
  'min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none ' +
  'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm';

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
        {/* offered by its label (`enumDict` of the backend), sent as its value */}
        {field.enum.map((choice) => (
          <NativeSelectOption key={text(choice)} value={text(choice)}>
            {choiceLabel(field, choice) ?? text(choice)}
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
    if (field.format === 'decimal') {
      return <DecimalInput field={field} value={value} onChange={onChange} disabled={disabled} control={control} />;
    }
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
    if (field.format === 'date') {
      return (
        <DateInput
          {...control}
          value={current}
          readOnly={readOnly}
          disabled={disabled}
          onChange={(next) => {
            // an empty date is no date: null, or the empty string of a field that allows it (`blank`)
            onChange(next === '' && !field.blank ? empty(field) : next);
          }}
        />
      );
    }
    const type = { time: 'time', email: 'email', uri: 'url' }[field.format ?? ''];
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
          // an empty URL, e-mail or time is no value of its format: null, or the empty string
          // of a field that allows it (`blank`)
          onChange(next === '' && type !== undefined && !field.blank ? empty(field) : next);
        }}
      />
    );
  }
  return <JsonInput value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} control={control} />;
}

function noBusy(): void {
  // a form without uploads to wait for
}

/**
 * The uploads of the file fields of a form, `onBusy(name)` of each `FieldInput`: `uploading`
 * while a file of one of them uploads, when the form is not submitted.
 */
export function useUploads(): { uploading: boolean; onBusy: (name: string) => (busy: boolean) => void } {
  const [names, setNames] = useState<ReadonlySet<string>>(() => new Set());
  const onBusy = useCallback(
    (name: string) => (busy: boolean) => {
      setNames((current) => {
        if (current.has(name) === busy) return current;
        const next = new Set(current);
        if (busy) next.add(name);
        else next.delete(name);
        return next;
      });
    },
    [],
  );
  return { uploading: names.size > 0, onBusy };
}

/**
 * A field of a runtime schema with its label and its errors: the control by the type,
 * format and choices of an attribute (a select of the labels of the choices, a decimal
 * typed with a point or a comma and given as its digits with a point, `'2.5'`), the
 * coordinates of a point field of the route set `path` (`PointInput`, with the map of
 * `MapProvider`), the picker of the related item of a to-one relationship
 * (`RelationPicker`) or of the related items of a to-many one (`RelationListPicker`), the
 * upload of a file field (the controls of `FilesProvider`: `FileField` of file-field, and
 * `FilesField` of several files);
 * read-only when the user may not change it.
 */
export function FieldInput({
  field,
  value,
  onChange,
  errors: fieldErrors = [],
  disabled = false,
  onBusy = noBusy,
  path,
  filter,
}: FieldInputProps) {
  const id = useId();
  const files = useFiles();
  const points = usePoints();
  // the error of the file of a file field, until it is replaced
  const [fileError, setFileError] = useState<string | null>(null);
  const errors = fileError === null ? fieldErrors : [...fieldErrors, fileError];
  const errorId = `${id}-error`;
  const invalid = errors.length > 0;
  const file = isFile(field, files.resources) ? field : null;
  const FileControl = file && !file.many ? files.control : null;
  const FilesControl = file?.many ? files.listControl : null;
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
      {file && FileControl ? (
        <FileControl
          field={file}
          value={typeof value === 'string' && value ? value : null}
          onChange={onChange}
          disabled={disabled || file.readOnly}
          control={control}
          onBusy={onBusy}
          onError={setFileError}
        />
      ) : file && FilesControl ? (
        <FilesControl
          field={file}
          value={Array.isArray(value) ? value.map(text) : []}
          onChange={onChange}
          disabled={disabled || file.readOnly}
          control={control}
          onBusy={onBusy}
          onError={setFileError}
        />
      ) : field.kind === 'relation' ? (
        field.many ? (
          <RelationListPicker
            {...control}
            relation={field.relation}
            filter={filter}
            label={field.title}
            value={Array.isArray(value) ? value.map(text) : []}
            disabled={disabled || field.readOnly}
            aria-readonly={field.readOnly || undefined}
            onChange={onChange}
          />
        ) : (
          <RelationPicker
            {...control}
            relation={field.relation}
            filter={filter}
            label={field.title}
            value={typeof value === 'string' && value ? value : null}
            nullable={field.nullable}
            disabled={disabled || field.readOnly}
            aria-readonly={field.readOnly || undefined}
            onChange={onChange}
          />
        )
      ) : isPoint(field, path, points.fields) ? (
        <PointInput field={field} value={value} onChange={onChange} disabled={disabled} control={control} />
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
