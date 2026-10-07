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

import type { FormField } from '@/bazis/react';

import { formatValue } from './fields.js';
import { text } from './hooks.js';
import { RelationLabel } from './relation.js';

/**
 * The value of a field for reading: an attribute formatted by its type and format, the
 * labels of the related items of a relationship.
 */
export function FieldValue({ field, value }: { field: FormField | undefined; value: unknown }) {
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
  return <>{formatValue(field, value)}</>;
}
