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

// The notifications of the user (bazis-ws, `{"action": "notification"}`): a bell with the
// count of the unread ones (`action:notifications`), the list of those received in the
// session (`list:notifications`, each `notification:<key>`), opened by the bell, which
// marks them read; a toast for each new one. Pub/sub keeps nothing: a notification published
// while the page was closed is not there. Mount it once under `SocketProvider`, in the
// `tools` of `AppShell`.

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useNotifications, type Notification } from '@/bazis/react/ws';
import { toast } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// the greatest key of a notification shown as a toast: each is toasted once in the page,
// whatever center saw it first
let toasted = 0;

export interface NotificationCenterProps {
  /**
   * Opens the item of a notification (its `resource` and `id`), such as its card; without
   * it, the notifications are not links.
   */
  onOpen?: (notification: Notification) => void;
  /** A toast for each new notification (not for those received before it was mounted). */
  toasts?: boolean;
}

function time(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function Item({ notification, onOpen }: { notification: Notification; onOpen: ((it: Notification) => void) | null }) {
  const content = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{notification.title}</span>
        <time dateTime={notification.received.toISOString()} className="shrink-0 text-xs text-muted-foreground">
          {time(notification.received)}
        </time>
      </span>
      {notification.text !== null && <span className="text-muted-foreground">{notification.text}</span>}
    </>
  );
  const className = 'grid w-full gap-0.5 px-4 py-3 text-left text-sm';
  return (
    <li data-bz={`notification:${String(notification.key)}`}>
      {onOpen ? (
        <button
          type="button"
          className={cn(className, 'transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none')}
          onClick={() => {
            onOpen(notification);
          }}
        >
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

/** The bell of the notifications with their list. */
export function NotificationCenter({ onOpen, toasts = true }: NotificationCenterProps) {
  const { items, unread, markRead, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  // the notifications received before it was mounted are not toasted
  const [since] = useState(() => Math.max(toasted, items[0]?.key ?? 0));

  useEffect(() => {
    if (!toasts || open) return;
    for (const item of [...items].reverse()) {
      if (item.key <= since || item.key <= toasted || item.read) continue;
      toasted = item.key;
      toast({ title: item.title, ...(item.text === null ? {} : { description: item.text }), tone: 'info' });
    }
  }, [items, toasts, open, since]);

  // the list is open: what comes is read
  useEffect(() => {
    if (open && unread > 0) markRead();
  }, [open, unread, markRead]);

  const label = unread > 0 ? `Notifications, ${String(unread)} unread` : 'Notifications';
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
        <div className="flex h-11 items-center justify-between border-b px-4">
          <p className="text-sm font-semibold">Notifications</p>
          {items.length > 0 && (
            <Button type="button" variant="ghost" size="sm" data-bz="action:clear-notifications" onClick={clear}>
              Clear
            </Button>
          )}
        </div>
        <ul data-bz="list:notifications" aria-label="Notifications" className="max-h-96 divide-y overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</li>}
          {items.map((item) => (
            <Item
              key={item.key}
              notification={item}
              onOpen={
                onOpen && item.resource !== null
                  ? (notification) => {
                      setOpen(false);
                      onOpen(notification);
                    }
                  : null
              }
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
