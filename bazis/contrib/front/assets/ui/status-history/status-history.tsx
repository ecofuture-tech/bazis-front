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

// The status history of an item of a statusy model, from what bazis-statusy exposes: the
// current status of the item with its date (`status_dt`) and its author (`status_author`,
// the user of the transit that set it; none for the initial status). bazis-statusy keeps
// every transit (`<Model>StatusyTransit`: the transit, the status, the date, the author)
// but has no endpoint that reads them, so the earlier transits are not shown.

import { History } from 'lucide-react';

import type { Tone } from '@/bazis/generated/theme';
import { fieldValue, formatDateTime, RelationLabel, type ResourceObject } from '@/bazis/ui/resource';
import { statusName, statusOf, statusTone } from '@/bazis/ui/status-badge';
import { cn } from '@/lib/utils';

/** The dot of each tone of a status. */
const DOTS: Readonly<Record<Tone, string>> = {
  neutral: 'bg-neutral',
  primary: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export interface StatusHistoryProps {
  /** The item (the `data` of a retrieve, a row of a list) with its fields of bazis-statusy. */
  resource: ResourceObject;
  /** The name of the history for assistive technologies. */
  label?: string;
}

/** The related item of a to-one relationship: its type and id, null for none. */
function identifier(resource: ResourceObject, name: string): { type: string; id: string } | null {
  const data = resource.relationships?.[name]?.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { type, id } = data as { type?: unknown; id?: unknown };
  return typeof type === 'string' && typeof id === 'string' ? { type, id } : null;
}

/**
 * The status history of the item: its status since its date, by its author (each when the
 * user may see the field). Nothing without a status.
 */
export function StatusHistory({ resource, label = 'Status history' }: StatusHistoryProps) {
  const status = statusOf(resource);
  if (status === null) return null;
  const since = fieldValue(resource, 'status_dt');
  const author = identifier(resource, 'status_author');
  return (
    <section aria-label={label} className="flex items-start gap-2 text-sm text-muted-foreground">
      <History className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <ol className="grid gap-1">
        <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOTS[statusTone(status)])} />
          <span className="font-medium text-foreground">{statusName(resource.type, status)}</span>
          {typeof since === 'string' && (
            <span>
              since <time dateTime={since}>{formatDateTime(since)}</time>
            </span>
          )}
          {author && (
            <span>
              by <RelationLabel relation={author.type} id={author.id} />
            </span>
          )}
        </li>
      </ol>
    </section>
  );
}
