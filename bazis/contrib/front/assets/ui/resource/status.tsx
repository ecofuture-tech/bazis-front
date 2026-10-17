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

// The tones of the theme as the components show them, and the status of an item as a badge
// of its tone (`statuses` of spec/design/theme.yaml), read from the contract without the
// hooks of bazis-statusy: the badge of `status-badge` and of the column `status` of a list.

import { THEME, type Tone } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { statusName } from './fields.js';

/** The soft colors of each tone that the theme derives from the tokens: a background and the text on it. */
export const SOFT_TONES: Readonly<Record<Tone, string>> = {
  neutral: 'bg-neutral-soft text-neutral-ink',
  primary: 'bg-primary-soft text-primary-ink',
  info: 'bg-info-soft text-info-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
};

/** The tone of a status: `statuses` of the theme, neutral for another. */
export function statusTone(status: string): Tone {
  return THEME.statuses[status] ?? 'neutral';
}

export interface StatusLabelProps {
  /** The JSON:API type of the model, whose statuses name it. */
  type: string;
  /** The id of the status. */
  status: string;
  className?: string;
}

/** A status by its id: its name in a badge of its tone, `status:<id>` with `data-tone`. */
export function StatusLabel({ type, status, className }: StatusLabelProps) {
  const { language } = useLanguage();
  const tone = statusTone(status);
  return (
    <Badge
      variant="outline"
      data-bz={`status:${status}`}
      data-tone={tone}
      className={cn('gap-1.5 border-transparent', SOFT_TONES[tone], className)}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusName(type, status, language)}
    </Badge>
  );
}
