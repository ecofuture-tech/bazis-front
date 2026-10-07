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

// A form of a resource over `useResourceForm`: the fields of the runtime schema of the create
// or of the update for the current user, rendered by `FieldInput` (`field:<name>`,
// `error:<name>`), submitted with `action:submit`. A 422 is the state `invalid`.

import type { ReactNode, SubmitEvent } from 'react';

import { ApiError } from '@/bazis/client';
import type { CreatePath, ResourceForm as Form, UpdatePath } from '@/bazis/react';
import { FieldInput, useAnyResourceForm, type ResourceObject } from '@/bazis/ui/resource';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';

/** The document that a create or an update returns. */
export interface SavedDocument {
  data: ResourceObject;
}

export type ResourceFormProps = (
  | { /** A create: the route set. */ path: CreatePath; id?: undefined }
  | { /** An update: the route set and the item. */ path: UpdatePath; id: string }
) & {
  /**
   * The fields, in this order (those the runtime schema does not have are left out); by
   * default every field of the schema but the to-many relationships.
   */
  fields?: readonly string[];
  /** Called with the saved document. */
  onSaved?: (saved: SavedDocument) => void;
  /** Shows a cancel button (`action:cancel`); the changes are dropped. */
  onCancel?: () => void;
  submitLabel?: ReactNode;
};

/** The errors of the fields that the form does not show, with their names. */
function otherErrors(form: Form<unknown>, shown: ReadonlySet<string>): string[] {
  return Object.entries(form.errors)
    .filter(([name]) => !shown.has(name))
    .map(([name, messages]) => `${name}: ${messages.join(' ')}`);
}

/**
 * A form of a resource bound to its runtime schema. The fields the user may not change are
 * read-only and never sent; the backend validates (a 422 marks the fields and the state
 * `invalid`).
 */
export function ResourceForm(props: ResourceFormProps) {
  return <ResourceFormBody {...props} />;
}

/**
 * `ResourceForm` over a plain path, for the components that hold the path of another
 * action of the route set (the card holds the path of its retrieve).
 */
export function ResourceFormBody({
  path,
  id,
  fields,
  onSaved,
  onCancel,
  submitLabel,
}: Omit<ResourceFormProps, 'path' | 'id'> & { path: string; id?: string | undefined }) {
  const form = useAnyResourceForm(path, id === undefined ? {} : { id }) as Form<SavedDocument>;

  if (form.status !== 'ready') {
    const state = form.status === 'loading' ? 'loading' : errorState(form.error);
    return <StatePanel state={state} error={form.error} />;
  }

  const byName = new Map(form.fields.map((it) => [it.name, it]));
  const shown = (fields ?? form.fields.map((it) => it.name)).flatMap((name) => {
    const field = byName.get(name);
    return field && !(field.kind === 'relation' && field.many) ? [field] : [];
  });
  const failure = form.submitError ? errorState(form.submitError) : null;
  const others = otherErrors(form, new Set(shown.map((it) => it.name)));

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.submit().then((saved) => {
      if (saved) onSaved?.(saved);
    });
  }

  return (
    <form data-bz="state:loaded" noValidate onSubmit={submit} aria-busy={form.isSubmitting || undefined} className="grid gap-4">
      {failure && (
        <StatePanel
          inline
          state={failure}
          error={form.submitError}
          message={
            failure === 'invalid' && form.submitError instanceof ApiError && Object.keys(form.errors).length
              ? ['Check the values of the fields.', ...others].join(' ')
              : undefined
          }
        />
      )}
      {shown.map((field) => (
        <FieldInput
          key={field.name}
          field={field}
          value={form.values[field.name]}
          errors={form.errors[field.name]}
          disabled={form.isSubmitting}
          onChange={(value) => {
            form.setValue(field.name, value);
          }}
        />
      ))}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            data-bz="action:cancel"
            onClick={() => {
              form.reset();
              onCancel();
            }}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" data-bz="action:submit" disabled={form.isSubmitting}>
          {submitLabel ?? (id === undefined ? 'Create' : 'Save')}
        </Button>
      </div>
    </form>
  );
}
