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
// transit without a payload runs at once, one whose action takes a typed payload opens a
// dialog with its fields (`FieldInput`, `field:<name>`, `error:<name>`, `action:submit`). A
// toast tells the status the item moved to.

import { useState, type ReactNode } from 'react';

import { ApiError } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import { objectFields } from '@/bazis/react';
import { useItemsTransit, type Transit, type TransitPath } from '@/bazis/react/statusy';
import { FieldInput } from '@/bazis/ui/resource';
import { statusName, transitName, transitTarget } from '@/bazis/ui/status-badge';
import { errorState, StatePanel, toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PAYLOAD_POINTER = /^\/payload\/([^/]+)/;

/**
 * The errors of a transit: those of the fields of its payload by name (`source.pointer`
 * `/payload/<name>`, a name of `names`), and the others (its validators, a field that the
 * dialog does not show, an error that is not of the backend).
 */
export function payloadErrors(
  error: unknown,
  names: readonly string[],
): { fields: Record<string, string[]>; others: string[] } {
  const fields: Record<string, string[]> = {};
  const others: string[] = [];
  if (!(error instanceof ApiError)) {
    if (error instanceof Error) others.push(error.message);
    return { fields, others };
  }
  for (const item of error.errors) {
    const name = PAYLOAD_POINTER.exec(item.source?.pointer ?? '')?.[1];
    const message = item.detail ?? item.title ?? item.code ?? '';
    if (name !== undefined && names.includes(name)) (fields[name] ??= []).push(message);
    else others.push(name === undefined ? message : `${name}: ${message}`);
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

/** The run of the transits of the items of a route set: `start` one, the `dialog` of its payload to render. */
export interface TransitRun {
  /** Runs a transit of an item, once the dialog has its payload when it takes one. */
  start: (id: string, transit: Transit) => void;
  mutation: ReturnType<typeof useItemsTransit>;
  /** The transit whose payload the dialog asks for, and its item; null while it is closed. */
  open: { id: string; transit: Transit } | null;
  dialog: ReactNode;
}

/**
 * Runs the transits of the items of a route set (of an item, of the cards of a board);
 * `onDone` gets the item after one (null when the user can no longer view it).
 */
export function useRunTransit(path: TransitPath, onDone?: (item: unknown) => void): TransitRun {
  const mutation = useItemsTransit(path);
  const [open, setOpen] = useState<{ id: string; transit: Transit } | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
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
    if (transit.payload === null) {
      run(id, transit);
      return;
    }
    setValues(defaults(transit));
    setOpen({ id, transit });
  }

  const fields = open ? objectFields(open.transit.payload ?? {}) : [];
  const errors = payloadErrors(
    mutation.error,
    fields.map((it) => it.name),
  );
  const dialog = (
    <Dialog
      open={open !== null}
      onOpenChange={(next) => {
        if (!next) setOpen(null);
      }}
    >
      {open && (
        <DialogContent>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              run(open.id, open.transit, values);
            }}
          >
            <DialogHeader>
              <DialogTitle>{transitName(open.transit.resource.type, open.transit.id, language)}</DialogTitle>
              <DialogDescription>{open.transit.hint ?? t('transit.fill')}</DialogDescription>
            </DialogHeader>
            {mutation.isError && errors.others.length > 0 && (
              <StatePanel
                inline
                state={errorState(mutation.error)}
                error={mutation.error}
                message={errors.others.join(' ')}
              />
            )}
            {fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                value={values[field.name]}
                errors={errors.fields[field.name]}
                disabled={mutation.isPending}
                onChange={(value) => {
                  setValues({ ...values, [field.name]: value });
                }}
              />
            ))}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-bz="action:cancel"
                onClick={() => {
                  setOpen(null);
                }}
              >
                {t('action.cancel')}
              </Button>
              <Button type="submit" data-bz="action:submit" disabled={mutation.isPending}>
                {transitName(open.transit.resource.type, open.transit.id, language)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
  return { start, mutation, open, dialog };
}
