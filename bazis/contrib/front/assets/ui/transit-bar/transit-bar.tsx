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

// The transits that the user may run on an item now (`useTransits`), a button
// `transit:<id>` each, disabled with the errors of its validators when they restrict it. A
// transit whose action takes a typed payload opens a dialog with its fields (`FieldInput`,
// `field:<name>`, `error:<name>`, `action:submit`).

import { useState } from 'react';

import { ApiError } from '@/bazis/client';
import { objectFields } from '@/bazis/react';
import { useTransit, useTransits, type Transit, type TransitPath } from '@/bazis/react/statusy';
import { FieldInput } from '@/bazis/ui/resource';
import { transitName } from '@/bazis/ui/status-badge';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface TransitBarProps {
  /** The route set of the statusy model (`ROUTES` of the contract). */
  path: TransitPath;
  id: string;
  /** Called after a transit with the item, or null when the user can no longer view it (leave its screen). */
  onDone?: (item: unknown) => void;
}

const PAYLOAD_POINTER = /^\/payload\/([^/]+)/;

/** The errors of the fields of the payload of a 422 by name (`source.pointer` `/payload/<name>`). */
export function payloadErrors(error: unknown): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  if (!(error instanceof ApiError)) return fields;
  for (const item of error.errors) {
    const name = PAYLOAD_POINTER.exec(item.source?.pointer ?? '')?.[1];
    if (name !== undefined) (fields[name] ??= []).push(item.detail ?? item.title ?? item.code ?? '');
  }
  return fields;
}

function defaults(transit: Transit): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of objectFields(transit.payload ?? {})) {
    if ('default' in field.schema) values[field.name] = field.schema.default;
  }
  return values;
}

/** The transits of an item, with the dialog of their payloads. */
export function TransitBar({ path, id, onDone }: TransitBarProps) {
  const transits = useTransits(path, id);
  const mutation = useTransit(path, id);
  const [open, setOpen] = useState<Transit | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});

  if (transits.isPending) return <StatePanel inline state="loading" />;
  if (transits.isError) return <StatePanel inline state={errorState(transits.error)} error={transits.error} />;
  if (!transits.data.length) return null;

  function run(transit: Transit, payload?: Record<string, unknown>) {
    mutation.mutate(
      { transit: transit.id, ...(payload === undefined ? {} : { payload }) },
      {
        onSuccess: (item) => {
          setOpen(null);
          onDone?.(item);
        },
      },
    );
  }

  function start(transit: Transit) {
    mutation.reset();
    if (transit.payload === null) {
      run(transit);
      return;
    }
    setValues(defaults(transit));
    setOpen(transit);
  }

  const fields = open ? objectFields(open.payload ?? {}) : [];
  const errors = payloadErrors(mutation.error);
  return (
    <div className="grid gap-2">
      <div role="group" aria-label="Transits" className="flex flex-wrap gap-2">
        {transits.data.map((transit) => (
          <div key={transit.id} className="grid gap-1">
            <Button
              type="button"
              data-bz={`transit:${transit.id}`}
              disabled={!transit.allowed || mutation.isPending}
              aria-describedby={transit.allowed ? undefined : `restricts-${transit.id}`}
              onClick={() => {
                start(transit);
              }}
            >
              {transitName(transit.resource.type, transit.id)}
            </Button>
            {!transit.allowed && (
              <p id={`restricts-${transit.id}`} className="text-xs text-muted-foreground">
                {transit.restricts.map((it) => it.detail ?? it.title).join(' ')}
              </p>
            )}
          </div>
        ))}
      </div>
      {open === null && mutation.isError && (
        <StatePanel inline state={errorState(mutation.error)} error={mutation.error} message={mutation.error.message} />
      )}
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
                run(open, values);
              }}
            >
              <DialogHeader>
                <DialogTitle>{transitName(open.resource.type, open.id)}</DialogTitle>
                <DialogDescription>{open.hint ?? 'Fill in the values of the transit.'}</DialogDescription>
              </DialogHeader>
              {mutation.isError && Object.keys(errors).length === 0 && (
                <StatePanel inline state={errorState(mutation.error)} error={mutation.error} message={mutation.error.message} />
              )}
              {fields.map((field) => (
                <FieldInput
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  errors={errors[field.name]}
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
                  Cancel
                </Button>
                <Button type="submit" data-bz="action:submit" disabled={mutation.isPending}>
                  {transitName(open.resource.type, open.id)}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
