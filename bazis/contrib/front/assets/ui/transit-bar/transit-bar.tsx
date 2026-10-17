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
// `transit:<id>` each, disabled with the errors of its validators when they restrict it; a
// transit to a status of the tone `danger` is a destructive button. A transit whose action
// takes a typed payload opens a dialog with its fields (`useRunTransit`). A toast tells the
// status the item moved to.

import { ArrowRight, LoaderCircle } from 'lucide-react';

import { useLanguage } from '@/bazis/i18n';
import { useTransits, type TransitPath } from '@/bazis/react/statusy';
import { statusTone, transitName, transitTarget } from '@/bazis/ui/status-badge';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useRunTransit } from './run-transit.js';

export interface TransitBarProps {
  /** The route set of the statusy model (`ROUTES` of the contract). */
  path: TransitPath;
  id: string;
  /** Called after a transit with the item, or null when the user can no longer view it (leave its screen). */
  onDone?: (item: unknown) => void;
}

/** The transits of an item, with the dialog of their payloads. */
export function TransitBar({ path, id, onDone }: TransitBarProps) {
  const transits = useTransits(path, id);
  const { start, mutation, open, dialog } = useRunTransit(path, onDone);
  const { language, t } = useLanguage();

  if (transits.isPending) {
    return (
      <StatePanel
        inline
        state="loading"
        skeleton={
          <div className="flex gap-2" aria-hidden="true">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
        }
      />
    );
  }
  if (transits.isError) return <StatePanel inline state={errorState(transits.error)} error={transits.error} />;
  if (!transits.data.length) return null;

  return (
    <div className="grid gap-3 rounded-xl border bg-card px-(--space-card) py-3 text-card-foreground shadow-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm font-medium text-muted-foreground">{t('transit.next')}</span>
        <div role="group" aria-label={t('transit.group')} className="flex flex-wrap items-start gap-2">
          {transits.data.map((transit, index) => {
            const target = transitTarget(transit.resource.type, transit.id);
            const danger = target !== null && statusTone(target) === 'danger';
            return (
              <div key={transit.id} className="grid gap-1">
                <Button
                  type="button"
                  variant={danger ? 'destructive' : index === 0 ? 'default' : 'outline'}
                  data-bz={`transit:${transit.id}`}
                  disabled={!transit.allowed || mutation.isPending}
                  aria-describedby={transit.allowed ? undefined : `restricts-${transit.id}`}
                  onClick={() => {
                    start(id, transit);
                  }}
                >
                  {mutation.isPending && mutation.variables.transit === transit.id ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight aria-hidden="true" />
                  )}
                  {transitName(transit.resource.type, transit.id, language)}
                </Button>
                {!transit.allowed && (
                  <p id={`restricts-${transit.id}`} className="max-w-56 text-xs text-muted-foreground">
                    {transit.restricts.map((it) => it.detail ?? it.title).join(' ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {open === null && mutation.isError && (
        <StatePanel inline state={errorState(mutation.error)} error={mutation.error} message={mutation.error.message} />
      )}
      {dialog}
    </div>
  );
}
