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
// `transit:<id>` each in the order of the workflow of the specs (the first the main one),
// disabled with the errors of its validators when they restrict it; a transit to a status of
// the tone `danger` is a destructive button. A transit whose action takes a typed payload
// opens a dialog with its fields, and one that the specs confirm a dialog of its confirmation
// (`useRunTransit`). A toast tells the status the item moved to.

import { ArrowRight, LoaderCircle, X } from 'lucide-react';

import { useLanguage } from '@/bazis/i18n';
import { useTransits, type TransitPath } from '@/bazis/react/statusy';
import { ITEM_META } from '@/bazis/ui/resource';
import { statusTone, transitName, transitTarget } from '@/bazis/ui/status-badge';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { inDeclaredOrder, useRunTransit, type DeclaredTransit } from './run-transit.js';

export interface TransitBarProps {
  /** The route set of the statusy model (`ROUTES` of the contract). */
  path: TransitPath;
  id: string;
  /**
   * The transits of the workflow of the specs (`transits` of the generated entities): their
   * order (the first the main button), and those confirmed first; the order of the backend
   * by default.
   */
  transits?: readonly DeclaredTransit[];
  /** Called after a transit with the item, or null when the user can no longer view it (leave its screen). */
  onDone?: (item: unknown) => void;
}

/** The transits of an item, with the dialog of their payloads. */
export function TransitBar({ path, id, transits: declared = [], onDone }: TransitBarProps) {
  // the retrieve of the card of the item (`ResourceCard`): one request for both
  const transits = useTransits(path, id, ITEM_META);
  const { start, mutation, open, dialog } = useRunTransit(path, onDone, declared);
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

  const ordered = inDeclaredOrder(transits.data, declared);
  const restricted = ordered.filter((transit) => !transit.allowed);
  return (
    <div className="surface grid gap-3 px-(--space-card) py-3 text-card-foreground">
      {/* the label over the line of the buttons, the reasons of the unavailable transits a line each
          under all of them: the buttons stay where they are whatever is available */}
      <span className="text-sm font-medium text-muted-foreground">{t('transit.next')}</span>
      <div role="group" aria-label={t('transit.group')} className="flex flex-wrap items-center gap-2">
        {ordered.map((transit, index) => {
          const target = transitTarget(transit.resource.type, transit.id);
          const danger = target !== null && statusTone(target) === 'danger';
          const Icon = danger ? X : ArrowRight;
          // the first the main button, filled (unavailable, the muted fill)
          const main = index === 0 && !danger;
          return (
            <Button
              key={transit.id}
              type="button"
              // another unavailable transit an outline in the muted text, read in both modes
              variant={main ? 'default' : danger && transit.allowed ? 'destructive' : 'outline'}
              className={cn(!transit.allowed && !main && 'disabled:text-muted-foreground disabled:opacity-100')}
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
                <Icon aria-hidden="true" />
              )}
              {transitName(transit.resource.type, transit.id, language)}
            </Button>
          );
        })}
      </div>
      {restricted.map((transit) => (
        // the name of the transit before its reason when another one is unavailable too
        <p key={transit.id} id={`restricts-${transit.id}`} className="-mt-1 text-xs text-muted-foreground">
          {restricted.length > 1 && `${transitName(transit.resource.type, transit.id, language)}: `}
          {transit.restricts.map((it) => it.detail ?? it.title).join(' ')}
        </p>
      ))}
      {open === null && mutation.isError && (
        <StatePanel inline state={errorState(mutation.error)} error={mutation.error} />
      )}
      {dialog}
    </div>
  );
}
