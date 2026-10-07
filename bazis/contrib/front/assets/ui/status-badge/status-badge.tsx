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

// The status of an item of bazis-statusy: a badge with its name, `status:<id>`, in the tone
// that `statuses` of spec/design/theme.yaml gives the status (neutral by default).

import type { Tone } from '@/bazis/generated/theme';
import type { ResourceObject } from '@/bazis/ui/resource';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { statusName, statusOf, statusTone } from './statusy.js';

/** The colors of each tone: the soft colors that the theme derives from the tokens. */
const TONES: Readonly<Record<Tone, string>> = {
  neutral: 'bg-neutral-soft text-neutral-ink',
  primary: 'bg-primary-soft text-primary-ink',
  info: 'bg-info-soft text-info-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
};

/** The status of the item (a row of a list or the `data` of an item); nothing without one. */
export function StatusBadge({ resource, className }: { resource: ResourceObject; className?: string }) {
  const status = statusOf(resource);
  if (status === null) return null;
  const tone = statusTone(status);
  return (
    <Badge
      variant="outline"
      data-bz={`status:${status}`}
      data-tone={tone}
      className={cn('gap-1.5 border-transparent', TONES[tone], className)}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusName(resource.type, status)}
    </Badge>
  );
}
