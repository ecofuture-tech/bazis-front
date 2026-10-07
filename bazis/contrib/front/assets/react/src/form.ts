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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ApiError } from '@/bazis/client';

import { useBazis } from './context.js';
import { invalidateResource } from './mutations.js';
import { retrieveQuery, schemaQuery } from './queries.js';
import { resourceSchema, type FormField } from './schema.js';
import {
  loose,
  type CreatePath,
  type CreateResponse,
  type UpdatePath,
  type UpdateResponse,
} from './types.js';

export interface ResourceForm<Saved> {
  /** `loading` until the schema (and the item) are loaded, `error` if they failed. */
  status: 'loading' | 'error' | 'ready';
  /** The error of loading the schema or the item (403, 404, ...). */
  error: Error | null;
  /** The fields that the user may set, from the runtime schema, in its order. */
  fields: readonly FormField[];
  /**
   * The value of every field but the to-many relationships: the value of an attribute, the
   * id of the related item of a to-one relationship (null for none). `undefined` is no
   * value: on a create, a field without a default.
   */
  values: Readonly<Record<string, unknown>>;
  setValue(name: string, value: unknown): void;
  /** The fields whose value differs from the initial one; only they are submitted. */
  dirty: readonly string[];
  /** The validation errors of the last submit by field (`ApiError.fieldErrors()`). */
  errors: Readonly<Record<string, readonly string[]>>;
  /** The error of the last submit, also when it has errors by field. */
  submitError: Error | null;
  isSubmitting: boolean;
  /**
   * Creates or updates the item with the changed fields. Resolves to the saved item, or to
   * null when it failed (`errors`, `submitError`); the changes are kept then.
   */
  submit(): Promise<Saved | null>;
  /** Forgets the changes. */
  reset(): void;
}

interface Item {
  data?: {
    attributes?: Record<string, unknown>;
    relationships?: Record<string, { data?: { id: string } | readonly unknown[] | null }>;
  };
}

const NO_FIELDS: readonly FormField[] = [];
const NO_CHANGES: Readonly<Record<string, unknown>> = {};

function same(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
}

/** The initial values: the defaults of the schema on a create, the item on an update. */
function initialValues(fields: readonly FormField[], item: Item | undefined): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.kind === 'relation' && field.many) continue;
    if (item === undefined) {
      if (field.kind === 'attribute' && 'default' in field.schema) {
        values[field.name] = field.schema.default;
      } else if (field.kind === 'relation') {
        values[field.name] = null;
      }
    } else if (field.kind === 'attribute') {
      values[field.name] = item.data?.attributes?.[field.name];
    } else {
      const data = item.data?.relationships?.[field.name]?.data;
      values[field.name] = data && !Array.isArray(data) ? (data as { id: string }).id : null;
    }
  }
  return values;
}

/** The JSON:API document of the changed fields: attributes and to-one relationships. */
export function formDocument(
  type: string,
  id: string | undefined,
  fields: readonly FormField[],
  values: Readonly<Record<string, unknown>>,
  dirty: readonly string[],
): { data: Record<string, unknown> } {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.readOnly || !dirty.includes(field.name)) continue;
    const value = values[field.name];
    if (field.kind === 'attribute') {
      attributes[field.name] = value;
    } else if (!field.many) {
      relationships[field.name] = {
        data: value === null || value === undefined ? null : { type: field.relation, id: value },
      };
    }
  }
  return { data: { type, ...(id === undefined ? {} : { id }), attributes, relationships } };
}

/**
 * A form of a resource bound to its runtime schema: `schema_create/` without an id,
 * `schema_update/` of the item with one, so that the fields are those the current user may
 * set. Submit sends the changed attributes and to-one relationships as one JSON:API
 * document; a 422 gives the `errors` by field. To-many relationships are in `fields`
 * (`many: true`) but not in `values`: change them with `useRelationship`.
 */
export function useResourceForm<P extends CreatePath>(
  path: P,
  options?: { id?: undefined },
): ResourceForm<CreateResponse<P>>;
export function useResourceForm<P extends UpdatePath>(
  path: P,
  options: { id: string },
): ResourceForm<UpdateResponse<P>>;
export function useResourceForm(path: string, { id }: { id?: string } = {}): ResourceForm<unknown> {
  const { api, session } = useBazis();
  const queryClient = useQueryClient();
  const schema = useQuery(schemaQuery(api, path, id === undefined ? 'create' : 'update', id, session));
  const item = useQuery({
    ...retrieveQuery<Item>(api, path, id ?? '', {}, session),
    enabled: id !== undefined,
  });
  const mutation = useMutation({
    mutationFn: (document: unknown) =>
      id === undefined ? loose(api).create(path, document) : loose(api).update(path, id, document),
    onSuccess: () => invalidateResource(queryClient, path),
  });

  // the changes of the user, for this path and item: another item starts without them
  const target = `${path}\n${id ?? ''}`;
  const [changes, setChanges] = useState({ target, values: NO_CHANGES });
  const edits = changes.target === target ? changes.values : NO_CHANGES;

  const resource = useMemo(() => (schema.data ? resourceSchema(schema.data) : null), [schema.data]);
  const fields = resource?.fields ?? NO_FIELDS;
  const initial = useMemo(
    () => initialValues(fields, id === undefined ? undefined : item.data),
    [fields, id, item.data],
  );
  const values = useMemo(() => ({ ...initial, ...edits }), [initial, edits]);
  const dirty = useMemo(
    () => Object.keys(edits).filter((name) => !same(edits[name], initial[name])),
    [edits, initial],
  );

  const loading = schema.isPending || (id !== undefined && item.isPending);
  const error = schema.error ?? (id === undefined ? null : item.error);
  return {
    status: error ? 'error' : loading ? 'loading' : 'ready',
    error,
    fields,
    values,
    setValue: (name, value) => {
      setChanges((current) => ({
        target,
        values: { ...(current.target === target ? current.values : NO_CHANGES), [name]: value },
      }));
    },
    dirty,
    errors: mutation.error instanceof ApiError ? mutation.error.fieldErrors() : {},
    submitError: mutation.error,
    isSubmitting: mutation.isPending,
    submit: async () => {
      if (!resource) return null;
      const document = formDocument(resource.type, id, fields, values, dirty);
      try {
        const saved = await mutation.mutateAsync(document);
        setChanges({ target, values: NO_CHANGES });
        return saved;
      } catch {
        return null;
      }
    },
    reset: () => {
      setChanges({ target, values: NO_CHANGES });
    },
  };
}
