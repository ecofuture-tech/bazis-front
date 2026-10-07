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

// The layout of the application: the navigation (a sidebar or a top bar, as `navigation` of
// spec/design/theme.yaml), its links `nav:<screen>`, the session (the user and the logout,
// `action:logout`) and the screens, each wrapped in `Screen` (`screen:<id>`).

import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A link of the navigation to a screen of the specs: `nav:<screen>`. */
export interface NavItem {
  screen: string;
  label: ReactNode;
  to: string;
  /** Active only on this exact path (the home `/`). */
  end?: boolean;
}

/** The session of the user; null without a login (no bazis-users). */
export interface ShellSession {
  /** Who is logged in. */
  user?: ReactNode;
  onLogout: () => void;
}

export interface AppShellProps {
  /** The name of the product. */
  title: ReactNode;
  navigation?: 'sidebar' | 'topbar';
  items: readonly NavItem[];
  session?: ShellSession | null;
  children: ReactNode;
}

function Navigation({ items, vertical }: { items: readonly NavItem[]; vertical: boolean }) {
  return (
    <nav aria-label="Main">
      <ul className={cn('flex gap-1', vertical ? 'flex-col' : 'flex-wrap items-center')}>
        {items.map((item) => (
          <li key={item.screen}>
            <NavLink
              to={item.to}
              end={item.end}
              data-bz={`nav:${item.screen}`}
              className={({ isActive }) =>
                cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  vertical
                    ? 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                  isActive && (vertical ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'bg-accent text-accent-foreground'),
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Session({ session }: { session: ShellSession }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {session.user !== undefined && <span className="truncate">{session.user}</span>}
      <Button type="button" variant="outline" size="sm" data-bz="action:logout" onClick={session.onLogout}>
        Log out
      </Button>
    </div>
  );
}

/** The layout of the screens of a logged-in user. */
export function AppShell({ title, navigation = 'sidebar', items, session = null, children }: AppShellProps) {
  if (navigation === 'topbar') {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center gap-4 border-b px-6 py-3">
          <span className="text-lg font-semibold">{title}</span>
          <Navigation items={items} vertical={false} />
          {session && (
            <div className="ml-auto">
              <Session session={session} />
            </div>
          )}
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b bg-sidebar p-4 text-sidebar-foreground md:w-60 md:border-r md:border-b-0">
        <span className="px-3 text-lg font-semibold">{title}</span>
        <Navigation items={items} vertical />
        {session && (
          <div className="mt-auto px-3">
            <Session session={session} />
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}

export interface ScreenProps {
  /** The id of the screen in the specs: `screen:<id>`. */
  id: string;
  title?: ReactNode;
  /** Next to the title: the actions of the screen. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A screen of the specs: `screen:<id>`, its title and its actions. */
export function Screen({ id, title, actions, children }: ScreenProps) {
  return (
    <section data-bz={`screen:${id}`} className="mx-auto grid w-full max-w-6xl gap-6">
      {(title !== undefined || actions !== undefined) && (
        <header className="flex flex-wrap items-center justify-between gap-4">
          {title !== undefined && <h1 className="text-2xl font-semibold">{title}</h1>}
          {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
