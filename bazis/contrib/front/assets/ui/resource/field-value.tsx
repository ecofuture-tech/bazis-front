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

import { useLanguage } from '@/bazis/i18n';
import type { FormField } from '@/bazis/react';

import { formatValue, statusName, statusyModel, type FieldDisplay } from './fields.js';
import { FileValue, isFile, useFiles } from './files.js';
import { text } from './hooks.js';
import { RelationLabel } from './relation.js';

export interface FieldValueProps {
  field: FormField | undefined;
  value: unknown;
  /** The JSON:API type of the item: the `status` of an item of a statusy model is named by the contract. */
  type?: string;
  /** How the value is shown (`display` of the field of the entity of the specs). */
  display?: FieldDisplay | undefined;
}

/** A number with a bar of its share of `max` (`display: {bar}`), a `meter`. */
function Bar({ value, max, text, label }: { value: number; max: number; text: string; label: string }) {
  const share = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      {text}
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(Math.max(value, 0), Math.max(max, 0))}
        aria-valuetext={text}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${String(share)}%` }} />
      </span>
    </span>
  );
}

/**
 * The value of a field for reading: an attribute formatted by its type, its format and
 * `display` (a phone as a link to call it, a share as a bar), the labels of the related items
 * of a relationship (the status of an item of bazis-statusy by its name), an uploaded file
 * (`FileValue`).
 */
export function FieldValue({ field, value, type, display }: FieldValueProps) {
  const { resources } = useFiles();
  const language = useLanguage();
  if (isFile(field, resources) && value !== null && value !== undefined) {
    return <FileValue relation={field.relation} id={text(value)} />;
  }
  if (field?.kind === 'relation' && field.name === 'status' && typeof value === 'string' && type && statusyModel(type)) {
    return <>{statusName(type, value, language.language)}</>;
  }
  if (field?.kind === 'relation' && value !== null && value !== undefined) {
    const ids = Array.isArray(value) ? (value as unknown[]).map(text) : [text(value)];
    if (!ids.length) return <>—</>;
    return (
      <>
        {ids.map((id, index) => (
          <span key={id}>
            {index > 0 && ', '}
            <RelationLabel relation={field.relation} id={id} />
          </span>
        ))}
      </>
    );
  }
  const shown = formatValue(field, value, language, display);
  if (display === 'phone' && typeof value === 'string' && /\d/.test(value)) {
    return (
      <a
        href={`tel:${value.replace(/[^\d+]/g, '')}`}
        className="text-primary underline-offset-4 hover:underline"
        // a call, not the opening of the row
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {shown}
      </a>
    );
  }
  if (typeof display === 'object' && 'bar' in display && typeof value === 'number') {
    return <Bar value={value} max={display.bar} text={shown} label={field?.title ?? shown} />;
  }
  return <>{shown}</>;
}
