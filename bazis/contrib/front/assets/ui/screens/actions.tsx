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

// The actions of the specs (`actions` of a screen) as the screens generated from them use
// them: the create form of an entity (`primitive: form`, `mode: create`), opened by an action
// of a list (`ListAction`), of a calendar (`add`, starting with the selected day) or of the
// header of a screen (`ScreenAction`); the update form of the item of a card (`mode:
// update`), opened by an action of `ResourceCard`; and the deletion of the item of a card
// (`primitive: destroy`), an action of `ResourceCard` confirmed in a dialog
// (`action:confirm-<id>`), which shows the screen `then` after it.

import { LoaderCircle } from 'lucide-react';
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { useLanguage } from '@/bazis/i18n';
import { useDestroy, type CreatePath, type DestroyPath, type UpdatePath } from '@/bazis/react';
import { Allowed, type NavRequirement } from '@/bazis/ui/app-shell';
import type { CardAction } from '@/bazis/ui/resource-card';
import { FormSurface, ResourceForm, type SavedDocument } from '@/bazis/ui/resource-form';
import type { FieldFilters } from '@/bazis/ui/resource';
import { toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Whether the create form of a screen is open, and with which values: `CreateFormAction.use()`. */
export interface CreateForm {
  open: boolean;
  /** The values that the form starts with, of the last `onOpenWith`; none after `onOpen`. */
  initial: Readonly<Record<string, unknown>> | undefined;
  /** Opens the form: the `onClick` of an action (its event is not read). */
  onOpen: () => void;
  /** Opens the form starting with these values, which the user may change: the day of a calendar, `{due_date: day}`. */
  onOpenWith: (initial: Readonly<Record<string, unknown>>) => void;
  onClose: () => void;
}

export interface CreateFormActionProps {
  open: boolean;
  onClose: () => void;
  /** The route set of the entity (`ROUTES` of the contract). */
  path: CreatePath;
  /** The fields of the form (`fields` of the action); every field of the create schema by default. */
  fields?: readonly string[];
  /** The items that the pickers of its relationships offer, by field (`filters` of the action). */
  filters?: FieldFilters | undefined;
  /** The values that the form starts with, which the user may change (`ResourceForm` `initial`). */
  initial?: Readonly<Record<string, unknown>> | undefined;
  title: ReactNode;
  description?: ReactNode;
  /** Called with the saved document once the form is closed: the screen `then` of the action. */
  onSaved?: (saved: SavedDocument) => void;
  /** `composition.forms` of the theme by default (`FormSurface`). */
  mode?: 'dialog' | 'page';
}

/**
 * The create form of an action in `FormSurface` (a dialog or a page, as the theme composes the
 * forms), closed when it is saved or cancelled; its state is `CreateFormAction.use()`.
 */
export function CreateFormAction({ open, onClose, path, fields, filters, initial, title, description, onSaved, mode }: CreateFormActionProps) {
  return (
    <FormSurface open={open} title={title} description={description} onClose={onClose} mode={mode}>
      <ResourceForm
        path={path}
        fields={fields}
        filters={filters}
        initial={initial}
        onSaved={(saved) => {
          onClose();
          onSaved?.(saved);
        }}
        onCancel={onClose}
      />
    </FormSurface>
  );
}

/** The state of a create form: `{...create}` gives it to `CreateFormAction`. */
CreateFormAction.use = function useCreateForm(): CreateForm {
  const [state, setState] = useState<Pick<CreateForm, 'open' | 'initial'>>({ open: false, initial: undefined });
  return {
    ...state,
    onOpen: () => {
      setState({ open: true, initial: undefined });
    },
    onOpenWith: (initial) => {
      setState({ open: true, initial });
    },
    onClose: () => {
      setState((current) => ({ ...current, open: false }));
    },
  };
};

export interface UpdateFormActionProps extends Omit<CreateFormActionProps, 'path' | 'initial'> {
  /** The route set of the entity (`ROUTES` of the contract). */
  path: UpdatePath;
  /** The id of the item that it updates. */
  id: string;
}

/**
 * The update form of an item in `FormSurface` (a dialog or a page, as the theme composes the
 * forms), closed when it is saved or cancelled; its state is `UpdateFormAction.use()`.
 */
export function UpdateFormAction({ open, onClose, path, id, fields, filters, title, description, onSaved, mode }: UpdateFormActionProps) {
  return (
    <FormSurface open={open} title={title} description={description} onClose={onClose} mode={mode}>
      <ResourceForm
        path={path}
        id={id}
        fields={fields}
        filters={filters}
        onSaved={(saved) => {
          onClose();
          onSaved?.(saved);
        }}
        onCancel={onClose}
      />
    </FormSurface>
  );
}

/** The state of an update form, that of a create form (opened by `onOpen`): `{...edit}` gives it to `UpdateFormAction`. */
UpdateFormAction.use = CreateFormAction.use;

export interface ScreenActionProps {
  /** The id of the action in the specs: `action:<id>`. */
  id: string;
  label: ReactNode;
  /** Its icon, such as an icon of lucide-react. */
  icon?: ComponentType<{ className?: string }>;
  /** What the backend must allow the user for the action to be shown: `{path, can: 'add'}` for a create form. */
  requires?: NavRequirement;
  onClick: () => void;
}

/**
 * An action in the header of a screen (`actions` of `Screen` or of `Dashboard`), a button
 * `action:<id>`, shown once the backend allows what it `requires`.
 */
export function ScreenAction({ id, label, icon: Icon, requires, onClick }: ScreenActionProps) {
  return (
    <Allowed requirement={requires}>
      <Button
        type="button"
        data-bz={`action:${id}`}
        onClick={() => {
          onClick();
        }}
      >
        {Icon && <Icon />}
        {label}
      </Button>
    </Allowed>
  );
}

export interface DestroyCardActionOptions {
  /** The id of the action in the specs: `action:<id>`, its confirmation `action:confirm-<id>`. */
  id: string;
  /** The label of the action and of the button that confirms it. */
  label: ReactNode;
  /** The title of the confirmation, a question (`title` of the action): `Delete this item?` by default. */
  title?: ReactNode;
  /** What the confirmation says (`description` of the action); that the deletion cannot be undone by default. */
  description?: ReactNode;
  /** The route set of the entity (`ROUTES` of the contract). */
  path: DestroyPath;
  /** The id of the item of the card. */
  item: string;
  /** The route shown once the item is deleted (the screen `then` of the action); the card stays without it. */
  then?: string | undefined;
}

/** The deletion of the item of a card: its action and the dialog that confirms it. */
export interface DestroyCardAction {
  /** The action of `ResourceCard` (`actions`), shown when the user may delete the item: it opens the confirmation. */
  action: CardAction;
  /** The confirmation, rendered in the screen: the deletion runs from its button `action:confirm-<id>`. */
  confirm: ReactNode;
}

/**
 * The deletion of the item of a card, an action of `ResourceCard` (`actions`) shown when the
 * user may delete it, run once confirmed in its dialog (once, whatever the clicks): a toast
 * once it is deleted, then the route `then`; a toast of the error when the backend refuses it.
 */
export function useDestroyCardAction({
  id,
  label,
  title,
  description,
  path,
  item,
  then,
}: DestroyCardActionOptions): DestroyCardAction {
  const destroy = useDestroy(path, { leaving: then !== undefined });
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  // set by the first click until its request ends, before the dialog shows it is pending:
  // the clicks after it send nothing
  const running = useRef(false);
  const run = () => {
    if (running.current) return;
    running.current = true;
    destroy.mutate(item, {
      onSettled: () => {
        running.current = false;
      },
      onSuccess: () => {
        setOpen(false);
        toast({ title: t('card.deleted') });
        if (then !== undefined) void navigate(then);
      },
      onError: (error) => {
        setOpen(false);
        toast({ title: t('card.not_deleted'), description: error.message, tone: 'danger' });
      },
    });
  };
  const confirm = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !destroy.isPending) setOpen(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? t('card.delete_title')}</DialogTitle>
          <DialogDescription>{description ?? t('card.delete_confirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={destroy.isPending}
            onClick={() => {
              setOpen(false);
            }}
          >
            {t('action.cancel')}
          </Button>
          <Button type="button" variant="destructive" data-bz={`action:confirm-${id}`} disabled={destroy.isPending} onClick={run}>
            {destroy.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return {
    action: {
      id,
      label,
      permission: 'delete',
      variant: 'destructive',
      onClick: () => {
        setOpen(true);
      },
    },
    confirm,
  };
}
