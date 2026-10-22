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

// The custom actions of the specs (`primitive: custom`): a button that calls a custom action
// of the route set of the entity (`custom_actions` of its resource in the contract, a POST of
// the backend), of the item of a card, of each row of a list (`list.row_actions`) or of the
// route set from the toolbar of a list; or a bulk action of a list (`list.bulk`), called on
// each selected row with an empty body. One with `fields` asks for them in a dialog, the
// properties of its JSON body (`field:<name>`, `action:submit`); one with `confirm` and no
// field is confirmed in a dialog (`action:confirm-<id>`). Done, the queries of the resource
// are refetched and a toast tells it; refused, the dialog shows why (the errors of the fields
// at them), a toast without a dialog.

import { LoaderCircle } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

import type { CustomActionName } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import { customActionAt, useAnyAction, useAnyItemAction, useListFields, useUploads } from '@/bazis/ui/resource';
import type { BulkAction, RowAction } from '@/bazis/ui/resource-list';
import { errorState, StatePanel, toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { ActionFields, bodyDefaults, type ActionFieldsProps, type StartValues } from './action-fields.js';

export interface CustomActionOptions {
  /** The id of the action in the specs: `action:<id>`, its confirmation `action:confirm-<id>`. */
  id: string;
  /** The label of its button, also the title of its dialog by default. */
  label: ReactNode;
  /** The route set of the entity (`ROUTES` of the contract). */
  path: string;
  /** The name of the custom action in its path (`escalate` of `<path><id>/escalate/`), as `custom_actions` of the contract has it. */
  action: string;
  /**
   * Whether it is the action of an item (`<path><id>/<action>/`: on a card, the rows and the
   * selected rows of a list) or of the route set (`<path><action>/`: the toolbar of a list);
   * a route set may have both under one name.
   */
  target: 'item' | 'route';
  /** The item of a card, whose action it is; none on a list (a row or the selected rows give theirs). */
  item?: string;
  /** The properties of the body that its dialog asks for, in this order; none by default (an empty body). */
  fields?: readonly string[];
  /** The labels of its fields by property, before their titles (`ActionFields`). */
  labels?: Readonly<Record<string, string>>;
  /**
   * The values that its fields start with by property, over the defaults of the body: a day
   * of the browser (`today`, `month_start`, ...) for a date, computed when the dialog opens.
   */
  values?: StartValues;
  /** The title of its dialog: the label by default. */
  title?: ReactNode;
  /** What its dialog says. */
  description?: ReactNode;
  /** Whether an action without fields is confirmed in a dialog first. */
  confirm?: boolean;
  /** What the toast says once it is done. */
  message?: ReactNode;
}

/** A custom action of a screen: its buttons, its run and its dialog. */
export interface CustomAction {
  /**
   * The button of the card of its item (`ResourceCard` `actions`), or of the toolbar of a list
   * for an action of the route set (`ResourceList` `actions`): shown when the backend lists it
   * in `custom_actions` of the meta.
   */
  action: { id: string; label: ReactNode; permission: CustomActionName; onClick: () => void };
  /**
   * The button of the rows of a list (`ResourceList` `rowActions`): shown on a row that the
   * list lets the user change (or delete) when the action requires it (`access_action`). A
   * list tells of each row only that (`for_change`, `for_delete`), so the check of the specs
   * (S032) puts on the rows only an action that requires nothing else of the item (none,
   * `view`, `change` or `delete`); another runs on the card, by the meta of its item.
   */
  row: RowAction;
  /**
   * The action on the selected rows of a list (`ResourceList` `bulk`, `bulk:<id>`), called on
   * each with an empty body, on the rows that it lets the user change (or delete) as `row`,
   * with the same rule of S032.
   */
  bulk: BulkAction;
  /** Its dialog, rendered in the screen. */
  dialog: ReactNode;
}

/**
 * The fields of a dialog, with the titles and the labels of the choices of the list of the
 * route set in the language of the interface (`useListFields`), read once it opens.
 */
function DialogFields(props: Omit<ActionFieldsProps, 'resource'>) {
  return <ActionFields {...props} resource={useListFields(props.path)} />;
}

/**
 * A custom action of the specs, of the route set of `path` or of its items: what its buttons
 * do, and the dialog of its fields or of its confirmation. The contract must have it (the
 * check of the specs, S032).
 */
export function useCustomAction({
  id,
  label,
  path,
  action,
  target,
  item,
  fields = [],
  labels,
  values: startValues,
  title,
  description,
  confirm = false,
  message,
}: CustomActionOptions): CustomAction {
  const { t } = useLanguage();
  const ofItem = useAnyItemAction(path, action);
  const ofRoute = useAnyAction(path, action);
  // the item of the open dialog (none for an action of the route set); null while it is closed
  const [open, setOpen] = useState<{ item: string | undefined } | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  // the items (the route set: '') whose request runs: a click on one of them again sends
  // nothing, one on another item runs beside it
  const running = useRef(new Set<string>());
  // the fields of the dialog whose files upload: it waits for them
  const { uploading, onBusy } = useUploads();
  const declared = customActionAt(path, action, target === 'item');
  if (declared === undefined) {
    throw new Error(`The contract has no custom action "${action}" of the ${target} of ${path}: export the contract again.`);
  }
  const { body } = declared;
  const mutation = target === 'item' ? ofItem : ofRoute;
  const asks = fields.length > 0 || confirm;

  const send = (on: string | undefined, payload: Readonly<Record<string, unknown>>) =>
    target === 'item' ? ofItem.mutateAsync({ id: on ?? '', body: payload }) : ofRoute.mutateAsync(payload);

  function submit(on: string | undefined, payload: Readonly<Record<string, unknown>>) {
    const key = on ?? '';
    if (running.current.has(key)) return;
    running.current.add(key);
    send(on, payload).then(
      () => {
        running.current.delete(key);
        setOpen(null);
        toast({ title: label, description: message ?? t('action.done') });
      },
      (error: unknown) => {
        running.current.delete(key);
        // the dialog shows the errors; without one, a toast
        if (!asks) toast({ title: label, description: error instanceof Error ? error.message : t('action.failed'), tone: 'danger' });
      },
    );
  }

  function start(on?: string) {
    mutation.reset();
    if (!asks) {
      submit(on, {});
      return;
    }
    setValues(bodyDefaults(body, fields, startValues));
    setOpen({ item: on });
  }

  const shown = new Set(fields);
  const fieldErrors = Object.keys(mutation.errors).some((name) => shown.has(name));
  const dialog = (
    <Dialog
      open={open !== null}
      onOpenChange={(next) => {
        if (!next && !mutation.isPending) setOpen(null);
      }}
    >
      {open && (
        <DialogContent>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!uploading) submit(open.item, values);
            }}
          >
            <DialogHeader>
              <DialogTitle>{title ?? label}</DialogTitle>
              <DialogDescription>{description ?? t(fields.length ? 'action.fill' : 'action.confirm')}</DialogDescription>
            </DialogHeader>
            {mutation.isError && !fieldErrors && (
              <StatePanel inline state={errorState(mutation.error)} error={mutation.error} />
            )}
            {fields.length > 0 && body && (
              <DialogFields
                path={path}
                body={body}
                names={fields}
                labels={labels}
                values={values}
                errors={mutation.errors}
                disabled={mutation.isPending}
                onChange={(name, value) => {
                  setValues((current) => ({ ...current, [name]: value }));
                }}
                onBusy={onBusy}
              />
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-bz="action:cancel"
                disabled={mutation.isPending}
                onClick={() => {
                  setOpen(null);
                }}
              >
                {t('action.cancel')}
              </Button>
              <Button
                type="submit"
                data-bz={fields.length ? 'action:submit' : `action:confirm-${id}`}
                disabled={mutation.isPending || uploading}
              >
                {mutation.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {label}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
  const permission = declared.access_action === 'change' || declared.access_action === 'delete' ? declared.access_action : undefined;
  return {
    action: {
      id,
      label,
      permission: declared.key,
      onClick: () => {
        start(item);
      },
    },
    row: { id, label, permission, onClick: start },
    bulk: { id, label, permission, run: (on) => send(on, {}) },
    dialog,
  };
}
