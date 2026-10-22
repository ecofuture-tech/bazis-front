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
import { type ReactNode, type SubmitEvent } from 'react';

import { ApiError, type ErrorObject } from '@/bazis/client';
import { useLanguage, type Translate } from '@/bazis/i18n';
import { useErrorMessage, type CreatePath, type FixedValues, type ResourceForm as Form, type UpdatePath } from '@/bazis/react';
import {
  contractFormat,
  FieldInput,
  fieldTitle,
  isReverse,
  useAnyResourceForm,
  useUploads,
  type FieldFilters,
  type SavedDocument,
} from '@/bazis/ui/resource';
import { errorState, StatePanel, toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type ResourceFormProps = (
  | {
      /** A create: the route set. */
      path: CreatePath;
      id?: undefined;
      /**
       * The values that the create starts with in place of the defaults of the schema, which
       * the user may change (`useResourceForm` `initial`): the day of a calendar. They are
       * sent unless the user empties them.
       */
      initial?: Readonly<Record<string, unknown>> | undefined;
    }
  | { /** An update: the route set and the item. */ path: UpdatePath; id: string; initial?: undefined }
) & {
  /**
   * The fields, in this order (those the runtime schema does not have are left out); by
   * default every field of the schema but the `fixed` ones and the reverse relationships
   * (`isReverse`: the core deletes the unlinked items of a reverse foreign key). A to-many
   * relationship is chosen with `RelationListPicker` and sent with all its items.
   */
  fields?: readonly string[];
  /**
   * The values of fields that the screen sets and the user does not change (`useResourceForm`
   * `fixed`): the item of a card that a related item is added to, `{request: id}`. They are
   * sent with the form; a fixed field is shown read-only when `fields` names it, else not.
   */
  fixed?: FixedValues;
  /** The items that the pickers of its relationships offer, by field: those that match (`filters` of the specs). */
  filters?: FieldFilters | undefined;
  /** Called with the saved document. */
  onSaved?: (saved: SavedDocument) => void;
  /** Shows a cancel button (`action:cancel`); the changes are dropped. */
  onCancel?: () => void;
  submitLabel?: ReactNode;
};

/**
 * The messages of a failed submit that no field shows: the errors of the item as a whole
 * (`/data`: an invariant of `validate_item`), of an included item (`/included/<index>`) and
 * of the request, then those of the fields that the form does not show, with their titles
 * (`fieldTitle`: a field that the backend checks and the user does not fill, chosen by the
 * backend); after `form.check` when a field shows an error.
 */
function formMessages(
  form: Form<unknown>,
  path: string,
  shown: ReadonlySet<string>,
  t: Translate,
  message: (error: ErrorObject) => string,
): string[] {
  const error = form.submitError;
  if (!(error instanceof ApiError)) return [];
  const general = error.formErrors(message).map(({ message, included, field }) => {
    if (included === null) return message;
    const index = String(included + 1);
    return field === null
      ? t('form.included_error', { index, message })
      : t('form.included_field_error', { index, field, message });
  });
  const names = Object.keys(form.errors);
  const others = names
    .filter((name) => !shown.has(name))
    .map((name) => {
      const title = fieldTitle(path, name, form.fields.find((it) => it.name === name)?.title);
      return `${title}: ${(form.errors[name] ?? []).join(' ')}`;
    });
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
  filters,
  initial,
  onSaved,
  onCancel,
  submitLabel,
}: Omit<ResourceFormProps, 'path' | 'id'> & { path: string; id?: string | undefined }) {
  const form = useAnyResourceForm(path, {
    ...(id === undefined ? {} : { id }),
    ...(fixed === undefined ? {} : { fixed }),
    ...(initial === undefined ? {} : { initial }),
  });
  // the fields whose file uploads: the form waits for them
  const { uploading, onBusy } = useUploads();
  const { t } = useLanguage();
  const message = useErrorMessage();

  if (form.status !== 'ready') {
    const state = form.status === 'loading' ? 'loading' : errorState(form.error);
    return <StatePanel state={state} error={form.error} skeleton={<FormSkeleton />} />;
  }

  const byName = new Map(form.fields.map((it) => [it.name, it]));
  const isFixed = (name: string) => fixed !== undefined && name in fixed;
  const names =
    fields ??
    form.fields
      .filter((field) => !isFixed(field.name) && !(field.kind === 'relation' && isReverse(form.type, field.name)))
      .map((field) => field.name);
  const shown = names.flatMap((name) => {
    const field = byName.get(name);
    if (!field) return [];
    // the format that the model gives an attribute where its runtime schema has none (a decimal)
    const typed = field.kind === 'attribute' && field.format === null ? { ...field, format: contractFormat(path, name).format } : field;
    // the user sees a fixed value, never changes it
    return [isFixed(name) ? { ...typed, readOnly: true } : typed];
  });
  const failure = form.submitError ? errorState(form.submitError) : null;
  const messages = formMessages(form, path, new Set(shown.map((it) => it.name)), t, message);

  const busy = form.isSubmitting || uploading;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
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
          filter={filters?.[field.name]}
          value={form.values[field.name]}
          errors={form.errors[field.name]}
          disabled={form.isSubmitting}
          onChange={(value) => {
            form.setValue(field.name, value);
          }}
          onBusy={onBusy(field.name)}
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
