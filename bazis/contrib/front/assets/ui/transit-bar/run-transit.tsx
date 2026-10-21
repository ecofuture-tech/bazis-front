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

// The run of a transit of an item, shared by the transit bar and the moves of a board: a
// transit without a payload runs at once, but one that the specs `confirm` (a payment, a
// cancellation), which a dialog asks for first (`action:confirm-<transit>`); one whose action
// takes a typed payload opens a dialog with its fields (`FieldInput`, `field:<name>`,
// `error:<name>`, `action:submit`; a property named as a to-one relationship of the resource
// is its picker, `relatedField`), which is its confirmation. A toast tells the status the
// item moved to. The dialog of a transit of a list (a board: `for_transit`, its id only) reads
// the transits of its item once as it opens, in the request of its card (`ITEM_META`): the
// titles of the fields of the payload in the language of the user, and its hint.

import { useState, type ReactNode } from 'react';

import { ApiError, errorText, type ErrorObject } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import { objectFields, useErrorMessage } from '@/bazis/react';
import { useItemsTransit, useTransits, type Transit, type TransitPath } from '@/bazis/react/statusy';
import { FieldInput, ITEM_META, relatedField, statusyModel } from '@/bazis/ui/resource';
import { statusName, transitName, transitTarget } from '@/bazis/ui/status-badge';
import { errorState, StatePanel, toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PAYLOAD_POINTER = /^\/payload\/([^/]+)/;

/**
 * The errors of a transit: those of the fields of its payload by name (`source.pointer`
 * `/payload/<name>`, a name of `names`), and the others (its validators, a field that the
 * dialog does not show, an error that is not of the backend), each the text that `message`
 * gives (in the language of the interface with `useErrorMessage`).
 */
export function payloadErrors(
  error: unknown,
  names: readonly string[],
  message: (error: ErrorObject) => string = errorText,
): { fields: Record<string, string[]>; others: string[] } {
  const fields: Record<string, string[]> = {};
  const others: string[] = [];
  if (!(error instanceof ApiError)) {
    if (error instanceof Error) others.push(error.message);
    return { fields, others };
  }
  for (const item of error.errors) {
    const name = PAYLOAD_POINTER.exec(item.source?.pointer ?? '')?.[1];
    const text = message(item);
    if (name !== undefined && names.includes(name)) (fields[name] ??= []).push(text);
    else others.push(name === undefined ? text : `${name}: ${text}`);
  }
  if (!others.length && !Object.keys(fields).length) others.push(error.message);
  return { fields, others };
}

function defaults(transit: Transit): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of objectFields(transit.payload ?? {})) {
    if ('default' in field.schema) values[field.name] = field.schema.default;
  }
  return values;
}

/**
 * A transit of the workflow of the specs (`workflow.transitions` of the entity, `transits` of
 * the generated entities): their order is that of the transits shown, the first the main
 * one; one with `confirm` is asked for before it runs.
 */
export interface DeclaredTransit {
  id: string;
  confirm?: boolean;
}

/**
 * A transit of an item that its list gives (`for_transit` of bazis-statusy: its id only), with
 * the JSON Schema of its payload from the contract (`TRANSITS`): allowed, the validators not
 * called (a refusal of one is the 422 of the transit). The dialog of `useRunTransit` asks for
 * the payload by the schema of the backend, which it reads as it opens.
 */
export function listedTransit(item: { type: string; id: string }, id: string): Transit {
  const payload = statusyModel(item.type)?.transits.find((it) => it.id === id)?.payload;
  return {
    id,
    allowed: true,
    restricts: [],
    payload: payload?.schema ?? null,
    hint: null,
    hintTitle: null,
    hintAction: null,
    resource: { type: item.type, id: item.id },
    related: [],
  };
}

/** The transits of the backend in the order of the specs, those that the specs do not declare after them. */
export function inDeclaredOrder<T extends { id: string }>(transits: readonly T[], declared: readonly DeclaredTransit[]): T[] {
  const order = (id: string) => {
    const index = declared.findIndex((it) => it.id === id);
    return index === -1 ? declared.length : index;
  };
  return [...transits].sort((a, b) => order(a.id) - order(b.id));
}

/** The run of the transits of the items of a route set: `start` one, the `dialog` of its payload or its confirmation to render. */
export interface TransitRun {
  /** Runs a transit of an item, once the dialog has its payload when it takes one. */
  start: (id: string, transit: Transit) => void;
  mutation: ReturnType<typeof useItemsTransit>;
  /** The transit whose payload the dialog asks for, and its item; null while it is closed. */
  open: { id: string; transit: Transit } | null;
  dialog: ReactNode;
}

interface TransitFormProps {
  path: TransitPath;
  /** The item and the transit that `start` was given. */
  open: { id: string; transit: Transit };
  mutation: ReturnType<typeof useItemsTransit>;
  run: (id: string, transit: Transit, payload?: Record<string, unknown>) => void;
  onCancel: () => void;
}

/**
 * The content of the dialog of a transit, mounted as it opens. The transit of a payload is
 * that of the backend, with its payload in the language of the user: read in the request of
 * the card (`ITEM_META`), again over its stale data on a board, not beside the card that
 * shows it (the transit bar); that of `start` (the contract) when it cannot be read.
 */
function TransitForm({ path, open, mutation, run, onCancel }: TransitFormProps) {
  const { language, t } = useLanguage();
  const errorMessage = useErrorMessage();
  const read = useTransits(path, open.transit.payload === null ? null : open.id, ITEM_META);
  const transit = read.data?.find((it) => it.id === open.transit.id) ?? open.transit;
  // the values that the user entered, over the defaults of the payload
  const [entered, setEntered] = useState<Record<string, unknown>>({});
  const values = { ...defaults(transit), ...entered };
  const fields = read.isLoading ? [] : objectFields(transit.payload ?? {});
  const target = transitTarget(transit.resource.type, transit.id);
  // a transit without a payload is only confirmed: the status it leads to
  const question =
    transit.payload === null
      ? target === null
        ? t('action.confirm')
        : t('transit.confirm', { status: statusName(transit.resource.type, target, language) })
      : null;
  const errors = payloadErrors(
    mutation.error,
    fields.map((it) => it.name),
    errorMessage,
  );
  return (
    <DialogContent>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(open.id, transit, question === null ? values : undefined);
        }}
      >
        <DialogHeader>
          <DialogTitle>{transitName(transit.resource.type, transit.id, language)}</DialogTitle>
          <DialogDescription>{transit.hint ?? question ?? t('transit.fill')}</DialogDescription>
        </DialogHeader>
        {read.isLoading && <StatePanel inline state="loading" />}
        {mutation.isError && errors.others.length > 0 && (
          <StatePanel inline state={errorState(mutation.error)} error={mutation.error} message={errors.others.join(' ')} />
        )}
        {fields.map((field) => (
          <FieldInput
            key={field.name}
            // titled by the payload, in the language of the user, not by the field of the resource
            field={relatedField(path, field, field.title)}
            value={values[field.name]}
            errors={errors.fields[field.name]}
            disabled={mutation.isPending}
            onChange={(value) => {
              setEntered({ ...entered, [field.name]: value });
            }}
          />
        ))}
        <DialogFooter>
          <Button type="button" variant="outline" data-bz="action:cancel" onClick={onCancel}>
            {t('action.cancel')}
          </Button>
          <Button
            type="submit"
            data-bz={question === null ? 'action:submit' : `action:confirm-${transit.id}`}
            disabled={mutation.isPending || read.isLoading}
          >
            {transitName(transit.resource.type, transit.id, language)}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/**
 * Runs the transits of the items of a route set (of an item, of the cards of a board);
 * `onDone` gets the item after one (null when the user can no longer view it); those that
 * `declared` confirms are asked for first.
 */
export function useRunTransit(
  path: TransitPath,
  onDone?: (item: unknown) => void,
  declared: readonly DeclaredTransit[] = [],
): TransitRun {
  const mutation = useItemsTransit(path);
  const [open, setOpen] = useState<{ id: string; transit: Transit } | null>(null);
  const { language, t } = useLanguage();

  function run(id: string, transit: Transit, payload?: Record<string, unknown>) {
    mutation.mutate(
      { id, transit: transit.id, ...(payload === undefined ? {} : { payload }) },
      {
        onSuccess: (item) => {
          setOpen(null);
          const target = transitTarget(transit.resource.type, transit.id);
          toast({
            title: transitName(transit.resource.type, transit.id, language),
            ...(target === null
              ? {}
              : { description: t('transit.done', { status: statusName(transit.resource.type, target, language) }) }),
          });
          onDone?.(item);
        },
      },
    );
  }

  function start(id: string, transit: Transit) {
    mutation.reset();
    const confirm = declared.some((it) => it.id === transit.id && it.confirm);
    if (transit.payload === null && !confirm) {
      run(id, transit);
      return;
    }
    setOpen({ id, transit });
  }

  const dialog = (
    <Dialog
      open={open !== null}
      onOpenChange={(next) => {
        if (!next) setOpen(null);
      }}
    >
      {open && (
        <TransitForm
          key={`${open.id} ${open.transit.id}`}
          path={path}
          open={open}
          mutation={mutation}
          run={run}
          onCancel={() => {
            setOpen(null);
          }}
        />
      )}
    </Dialog>
  );
  return { start, mutation, open, dialog };
}
