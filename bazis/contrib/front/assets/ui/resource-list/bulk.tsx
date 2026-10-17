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

// The actions on the selected rows of a list (`list.bulk` of the specs): a bar over the rows
// with the number selected, a button `bulk:<id>` per action and the clear of the selection
// (`action:clear-selection`); an action is confirmed in a dialog (`action:confirm-bulk`), then
// run on the items one after the other (a request each: a transit, a delete), the backend
// refusing a row it does not allow. Done, the selection is cleared and a toast tells it; the
// rows whose request failed stay selected, and the bar tells how many failed and why
// (`error:bulk`).

import { LoaderCircle, X } from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';

import type { PermitMeta } from '@/bazis/client';
import { useLanguage } from '@/bazis/i18n';
import { permitted } from '@/bazis/ui/resource';
import { toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** An action on the selected rows: `bulk:<id>`. */
export interface BulkAction {
  id: string;
  label: ReactNode;
  /** Its icon, such as an icon of lucide-react. */
  icon?: ComponentType<{ className?: string }>;
  /** What the backend must allow on a row of the page (`for_change`, `for_delete` of its meta): the others are left out. */
  permission?: 'change' | 'delete';
  variant?: 'default' | 'outline' | 'destructive';
  /**
   * Runs the action on an item, rejected when its request fails: `useItemsTransit(path)`
   * of `@/bazis/react/statusy` (`mutateAsync({id, transit})`), `useDestroy(path)`.
   */
  run: (id: string) => Promise<unknown>;
}

export interface BulkBarProps {
  actions: readonly BulkAction[];
  /** The ids of the selected rows, also of other pages. */
  selection: readonly string[];
  /** The ids of the rows of the page, whose permission meta is known. */
  page: ReadonlySet<string>;
  meta: PermitMeta | null | undefined;
  /** Selects these rows instead: none after a clear, those whose request failed after an action. */
  onSelect: (ids: readonly string[]) => void;
}

/** The bar of the actions on the selected rows, with the dialog that confirms one. */
export function BulkBar({ actions, selection, page, meta, onSelect }: BulkBarProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<BulkAction | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [failure, setFailure] = useState<{ failed: number; count: number; reasons: readonly string[] } | null>(null);
  // a row of another page is left to the backend, which checks every request
  const targets = (action: BulkAction) =>
    selection.filter((id) => !action.permission || !page.has(id) || permitted(meta, action.permission, id));
  const ids = open ? targets(open) : [];

  async function run(action: BulkAction) {
    const failed: string[] = [];
    const reasons = new Set<string>();
    setFailure(null);
    setDone(0);
    for (const [index, id] of ids.entries()) {
      try {
        await action.run(id);
      } catch (error) {
        failed.push(id);
        if (error instanceof Error && error.message) reasons.add(error.message);
      }
      setDone(index + 1);
    }
    setDone(null);
    setOpen(null);
    onSelect(failed);
    if (failed.length) setFailure({ failed: failed.length, count: ids.length, reasons: [...reasons] });
    else toast({ title: action.label, description: t('bulk.done', { count: ids.length }) });
  }

  return (
    <div
      data-slot="bulk-bar"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/30 bg-primary-soft/50 px-3 py-2"
    >
      <span className="text-sm font-medium tabular-nums">{t('bulk.selected', { count: selection.length })}</span>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.variant ?? 'outline'}
              data-bz={`bulk:${action.id}`}
              disabled={targets(action).length === 0}
              onClick={() => {
                setOpen(action);
              }}
            >
              {Icon && <Icon />}
              {action.label}
            </Button>
          );
        })}
      </div>
      {failure && (
        <p data-bz="error:bulk" role="alert" className="text-sm text-danger-ink">
          {t('bulk.failed', { failed: failure.failed, count: failure.count })}
          {failure.reasons.length > 0 && `: ${failure.reasons.join(' ')}`}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        data-bz="action:clear-selection"
        className="ml-auto"
        onClick={() => {
          onSelect([]);
        }}
      >
        <X />
        {t('bulk.clear')}
      </Button>
      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next && done === null) setOpen(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open?.label}</DialogTitle>
            <DialogDescription>
              {done === null ? t('bulk.confirm', { count: ids.length }) : t('bulk.progress', { done, count: ids.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={done !== null}
              onClick={() => {
                setOpen(null);
              }}
            >
              {t('action.cancel')}
            </Button>
            <Button
              type="button"
              variant={open?.variant === 'destructive' ? 'destructive' : 'default'}
              data-bz="action:confirm-bulk"
              disabled={done !== null}
              onClick={() => {
                if (open) void run(open);
              }}
            >
              {done !== null && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {t('bulk.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
