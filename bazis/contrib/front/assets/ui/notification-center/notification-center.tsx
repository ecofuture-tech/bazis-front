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

// The notifications of the user: a bell with the count of the unread ones
// (`action:notifications`), their list (`list:notifications`, each `notification:<key>`, the
// unread ones marked), opened by the bell, where a click on one marks it read and opens it,
// with the actions to mark them all read (`action:read-notifications`) and to clear them
// (`action:clear-notifications`); a toast for each new one. Its source is a prop, so that it
// needs no package: `useInbox(path)` of `@/bazis/react/notify` (the stored notifications of
// bazis-notify, listed again when the backend says they changed: `useLiveQueries` with
// bazis-ws) or `useNotifications()` of `@/bazis/react/ws` (those received on the socket of
// bazis-ws in the session, lost on a reload). Mount it once, in the `tools` of `AppShell`.

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

import { formatTime, useLanguage } from '@/bazis/i18n';
import { SkeletonLines, StatePanel, errorState, toast, type Toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** A notification as the center shows it, as `useInbox` and `useNotifications` give it. */
export interface CenterNotification {
  /** Unique in the page. */
  key: string | number;
  title: string;
  text: string | null;
  /** When it was created (or received). */
  time: Date;
  read: boolean;
  /** `success` and `error` give the tone of its toast (bazis-notify). */
  severity?: string;
}

/** The notifications of the center and their actions: `useInbox(path)` or `useNotifications()`. */
export interface NotificationSource<T extends CenterNotification> {
  /** The newest first. */
  items: readonly T[];
  unread: number;
  /** The reading of the notifications (`ready` without it): `loading`, `error` (`error`, `retry()`). */
  status?: 'loading' | 'error' | 'ready';
  error?: Error | null;
  retry?: () => void;
  /** Marks a notification read, or all of them without a key. */
  markRead: (key?: T['key']) => void;
  clear: () => void;
}

export interface NotificationCenterProps<T extends CenterNotification> {
  notifications: NotificationSource<T>;
  /**
   * Opens what a notification is about (its card, `route` of a notification of bazis-notify);
   * the list closes. A click on a notification marks it read in any case.
   */
  onOpen?: (notification: T) => void;
  /** A toast for each new notification (not for those there when it was mounted). */
  toasts?: boolean;
}

// the notifications shown as a toast: each is toasted once in the page, whatever center saw
// it first
const toasted = new Set<string>();

const TOASTS: Readonly<Record<string, Toast['tone']>> = { success: 'success', error: 'danger' };

function Item({ notification, onClick }: { notification: CenterNotification; onClick: () => void }) {
  const { language, t } = useLanguage();
  return (
    <li data-bz={`notification:${String(notification.key)}`}>
      <button
        type="button"
        className="grid w-full gap-0.5 px-4 py-3 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
        onClick={onClick}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn('flex min-w-0 items-baseline gap-2', !notification.read && 'font-semibold')}>
            {!notification.read && (
              <span className="size-2 shrink-0 self-center rounded-full bg-primary">
                <span className="sr-only">{t('notifications.new')}</span>
              </span>
            )}
            <span className="min-w-0">{notification.title}</span>
          </span>
          <time dateTime={notification.time.toISOString()} className="shrink-0 text-xs text-muted-foreground">
            {formatTime(notification.time, language)}
          </time>
        </span>
        {notification.text !== null && <span className="text-muted-foreground">{notification.text}</span>}
      </button>
    </li>
  );
}

/** The bell of the notifications with their list. */
export function NotificationCenter<T extends CenterNotification>({ notifications, onOpen, toasts = true }: NotificationCenterProps<T>) {
  const { items, unread, status = 'ready', error = null, retry, markRead, clear } = notifications;
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  // what is there when the notifications are first read is not new: no toast for it
  const [known, setKnown] = useState<ReadonlySet<string> | null>(null);
  if (known === null && status === 'ready') setKnown(new Set(items.map((it) => String(it.key))));

  useEffect(() => {
    if (!toasts || open || known === null) return;
    for (const item of [...items].reverse()) {
      const key = String(item.key);
      if (item.read || known.has(key) || toasted.has(key)) continue;
      toasted.add(key);
      toast({
        title: item.title,
        ...(item.text === null ? {} : { description: item.text }),
        tone: TOASTS[item.severity ?? ''] ?? 'info',
      });
    }
  }, [items, toasts, open, known]);

  const label = unread > 0 ? t('notifications.unread', { count: unread }) : t('notifications.title');
  let list;
  if (status === 'loading') {
    list = <StatePanel state="loading" skeleton={<SkeletonLines lines={2} />} className="p-4" />;
  } else if (status === 'error') {
    list = <StatePanel state={errorState(error)} error={error} onRetry={retry} className="m-3 py-6" />;
  } else {
    list = (
      <ul data-bz="list:notifications" aria-label={t('notifications.title')} className="max-h-96 divide-y overflow-y-auto">
        {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t('notifications.empty')}</li>}
        {items.map((item) => (
          <Item
            key={item.key}
            notification={item}
            onClick={() => {
              if (!item.read) markRead(item.key);
              if (onOpen) {
                setOpen(false);
                onOpen(item);
              }
            }}
          />
        ))}
      </ul>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" data-bz="action:notifications" aria-label={label} className="relative">
          <Bell />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground tabular-nums"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex h-11 items-center justify-between gap-1 border-b px-4">
          <p className="mr-auto text-sm font-semibold">{t('notifications.title')}</p>
          {unread > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-bz="action:read-notifications"
              onClick={() => {
                markRead();
              }}
            >
              {t('notifications.read_all')}
            </Button>
          )}
          {items.length > 0 && (
            <Button type="button" variant="ghost" size="sm" data-bz="action:clear-notifications" onClick={clear}>
              {t('notifications.clear')}
            </Button>
          )}
        </div>
        {list}
      </PopoverContent>
    </Popover>
  );
}
