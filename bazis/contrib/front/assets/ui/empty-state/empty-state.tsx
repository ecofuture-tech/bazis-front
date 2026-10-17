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

// The empty state of what lists items (a list, a related section, a tile of a dashboard): the
// icon of the entity, a title, a hint and the actions that fill it, such as the creation of
// the first item. Marked `state:empty`, as `StatePanel` marks its states; the actions keep
// their own marks (`action:<id>`).

import { Inbox } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { useLanguage } from '@/bazis/i18n';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** The icon of the entity, such as an icon of lucide-react; an empty tray by default. */
  icon?: ComponentType<{ className?: string }>;
  /** The title; the text `state.empty.title` by default. */
  title?: ReactNode;
  /** The hint under the title; the text `state.empty.hint` by default. */
  description?: ReactNode;
  /** The actions, buttons marked `action:<id>`: what the user may do to fill it. */
  children?: ReactNode;
  className?: string;
}

/** Nothing to show, with what fills it: `state:empty`. */
export function EmptyState({ icon: Icon = Inbox, title, description, children, className }: EmptyStateProps) {
  const { t } = useLanguage();
  return (
    <div
      data-bz="state:empty"
      role="status"
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
        <Icon className="size-5" />
      </span>
      <div className="grid max-w-md gap-1">
        <p className="font-medium text-foreground">{title ?? t('state.empty.title')}</p>
        <p className="text-sm text-muted-foreground">{description ?? t('state.empty.hint')}</p>
      </div>
      {children !== undefined && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
