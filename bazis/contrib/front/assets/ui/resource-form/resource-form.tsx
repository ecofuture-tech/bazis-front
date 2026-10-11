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
// `error:<name>`), submitted with `action:submit`, with a toast when it is saved. A 422 is
// the state `invalid`, with the errors of the fields at their fields and the others (of the
// item as a whole, of an included item) in the form. `FormSurface` shows a form in a dialog or
// as a page, as the theme composes the forms.

import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode, type SubmitEvent } from 'react';

import { ApiError } from '@/bazis/client';
import { useLanguage, type Translate } from '@/bazis/i18n';
import type { CreatePath, FixedValues, ResourceForm as Form, UpdatePath } from '@/bazis/react';
import { FieldInput, useAnyResourceForm, type SavedDocument } from '@/bazis/ui/resource';
import { errorState, StatePanel, toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type ResourceFormProps = (
  | { /** A create: the route set. */ path: CreatePath; id?: undefined }
  | { /** An update: the route set and the item. */ path: UpdatePath; id: string }
) & {
  /**
   * The fields, in this order (those the runtime schema does not have are left out); by
   * default every field of the schema but the `fixed` ones. A to-many relationship is chosen
   * with `RelationListPicker` and sent with the other fields.
   */
  fields?: readonly string[];
  /**
   * The values of fields that the screen sets and the user does not change (`useResourceForm`
   * `fixed`): the item of a card that a related item is added to, `{request: id}`. They are
   * sent with the form; a fixed field is shown read-only when `fields` names it, else not.
   */
  fixed?: FixedValues;
  /** Called with the saved document. */
  onSaved?: (saved: SavedDocument) => void;
  /** Shows a cancel button (`action:cancel`); the changes are dropped. */
  onCancel?: () => void;
  submitLabel?: ReactNode;
};

/**
 * The messages of a failed submit that no field shows: the errors of the item as a whole
 * (`/data`: an invariant of `validate_item`), of an included item (`/included/<index>`) and
 * of the request, then those of the fields that the form does not show, with their names;
 * after `form.check` when a field shows an error.
 */
function formMessages(form: Form<unknown>, shown: ReadonlySet<string>, t: Translate): string[] {
  const error = form.submitError;
  if (!(error instanceof ApiError)) return [];
  const general = error.formErrors().map(({ message, included, field }) => {
    if (included === null) return message;
    const index = String(included + 1);
    return field === null
      ? t('form.included_error', { index, message })
      : t('form.included_field_error', { index, field, message });
  });
  const names = Object.keys(form.errors);
  const others = names
    .filter((name) => !shown.has(name))
    .map((name) => `${name}: ${(form.errors[name] ?? []).join(' ')}`);
  return [...(names.some((name) => shown.has(name)) ? [t('form.check')] : []), ...general, ...others];
}

/** The skeleton of a form while its schema loads. */
function FormSkeleton() {
  return (
    <div className="grid gap-(--space-field)" aria-hidden="true">
      {[0, 1, 2].map((it) => (
        <div key={it} className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-24 justify-self-end" />
    </div>
  );
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
  fixed,
  onSaved,
  onCancel,
  submitLabel,
}: Omit<ResourceFormProps, 'path' | 'id'> & { path: string; id?: string | undefined }) {
  const form = useAnyResourceForm(path, {
    ...(id === undefined ? {} : { id }),
    ...(fixed === undefined ? {} : { fixed }),
  });
  // the fields whose file uploads: the form waits for them
  const [uploading, setUploading] = useState<ReadonlySet<string>>(() => new Set());
  const { t } = useLanguage();

  if (form.status !== 'ready') {
    const state = form.status === 'loading' ? 'loading' : errorState(form.error);
    return <StatePanel state={state} error={form.error} skeleton={<FormSkeleton />} />;
  }

  const byName = new Map(form.fields.map((it) => [it.name, it]));
  const isFixed = (name: string) => fixed !== undefined && name in fixed;
  const names = fields ?? form.fields.map((it) => it.name).filter((name) => !isFixed(name));
  const shown = names.flatMap((name) => {
    const field = byName.get(name);
    if (!field) return [];
    // the user sees a fixed value, never changes it
    return [isFixed(name) ? { ...field, readOnly: true } : field];
  });
  const failure = form.submitError ? errorState(form.submitError) : null;
  const messages = formMessages(form, new Set(shown.map((it) => it.name)), t);

  const busy = form.isSubmitting || uploading.size > 0;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading.size > 0) return;
    void form.submit().then((saved) => {
      if (!saved) return;
      toast({ title: t(id === undefined ? 'form.created' : 'form.saved') });
      onSaved?.(saved);
    });
  }

  return (
    <form data-bz="state:loaded" noValidate onSubmit={submit} aria-busy={busy || undefined} className="grid gap-(--space-field)">
      {failure && (
        <StatePanel
          inline
          state={failure}
          error={form.submitError}
          message={failure === 'invalid' && messages.length ? messages.join(' ') : undefined}
        />
      )}
      {shown.map((field) => (
        <FieldInput
          key={field.name}
          path={path}
          field={field}
          value={form.values[field.name]}
          errors={form.errors[field.name]}
          disabled={form.isSubmitting}
          onChange={(value) => {
            form.setValue(field.name, value);
          }}
          onBusy={(running) => {
            setUploading((current) => {
              const next = new Set(current);
              if (running) next.add(field.name);
              else next.delete(field.name);
              return next;
            });
          }}
        />
      ))}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
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
            {t('action.cancel')}
          </Button>
        )}
        <Button type="submit" data-bz="action:submit" disabled={busy}>
          {form.isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {submitLabel ?? t(id === undefined ? 'form.create' : 'form.save')}
        </Button>
      </div>
    </form>
  );
}
