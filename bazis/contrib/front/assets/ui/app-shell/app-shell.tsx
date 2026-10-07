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

// The layout of the application: the navigation (a sidebar, a drawer on a phone, or a top
// bar, as `navigation` of spec/design/theme.yaml), its links `nav:<screen>`, the session
// (the user and the logout, `action:logout`), the color mode, the toasts, and the screens,
// each wrapped in `Screen` (`screen:<id>`) with its title and its actions.

import { LogOut, Menu } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { NavLink } from 'react-router';

import { THEME } from '@/bazis/generated/theme';
import { Toaster } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { ColorModeToggle } from './color-mode.js';

/** A link of the navigation to a screen of the specs: `nav:<screen>`. */
export interface NavItem {
  screen: string;
  label: ReactNode;
  to: string;
  /** Active only on this exact path (the home `/`). */
  end?: boolean;
  /** Its icon, such as an icon of lucide-react. */
  icon?: ComponentType<{ className?: string }>;
}

/** The session of the user; null without a login (no bazis-users). */
export interface ShellSession {
  /** Who is logged in. */
  user?: ReactNode;
  onLogout: () => void;
}

export type Navigation = 'sidebar' | 'topbar';

export interface AppShellProps {
  /** The name of the product. */
  title: ReactNode;
  /** `navigation` of the theme by default. */
  navigation?: Navigation;
  items: readonly NavItem[];
  session?: ShellSession | null;
  children: ReactNode;
}

const ShellContext = createContext<Navigation | null>(null);

/** The mark of the product: the first letter of its name on the primary color. */
function Brand({ title }: { title: ReactNode }) {
  const letter = typeof title === 'string' ? title.trim().charAt(0).toUpperCase() : null;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {letter && (
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
        >
          {letter}
        </span>
      )}
      <span className="truncate font-display text-base font-semibold tracking-tight">{title}</span>
    </span>
  );
}

function Navigation({ items, vertical, onNavigate }: { items: readonly NavItem[]; vertical: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main">
      <ul className={cn('flex gap-1', vertical ? 'flex-col' : 'items-center')}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.screen}>
              <NavLink
                to={item.to}
                end={item.end}
                data-bz={`nav:${item.screen}`}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    vertical
                      ? 'rounded-md px-3 py-2 text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                      : 'rounded-full px-3.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    isActive &&
                      (vertical
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent'
                        : 'bg-accent text-accent-foreground'),
                  )
                }
              >
                {Icon && (
                  <Icon className="size-4 shrink-0 opacity-70 group-aria-[current=page]:text-primary group-aria-[current=page]:opacity-100" />
                )}
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The initials of a user, for the avatar. */
function initials(user: ReactNode): string | null {
  if (typeof user !== 'string' || !user.trim()) return null;
  return user
    .trim()
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((it) => it.charAt(0).toUpperCase())
    .join('');
}

function Session({ session, compact = false }: { session: ShellSession; compact?: boolean }) {
  const letters = initials(session.user);
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      {session.user !== undefined && (
        <span className="flex min-w-0 items-center gap-2">
          {letters && (
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink"
            >
              {letters}
            </span>
          )}
          <span className="truncate font-medium">{session.user}</span>
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-bz="action:logout"
        className={cn('text-muted-foreground', !compact && 'ml-auto')}
        onClick={session.onLogout}
      >
        <LogOut />
        Log out
      </Button>
    </div>
  );
}

/** The drawer of the navigation on a phone; closed when the route changes. */
function Drawer({
  title,
  items,
  session,
  side,
}: {
  title: ReactNode;
  items: readonly NavItem[];
  session: ShellSession | null;
  side: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Open the menu" onClick={() => { setOpen(true); }}>
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side} className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-14 justify-center border-b border-sidebar-border px-4">
            <SheetTitle>
              <Brand title={title} />
            </SheetTitle>
            <SheetDescription className="sr-only">The navigation of the application</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            <Navigation items={items} vertical onNavigate={close} />
          </div>
          {session && (
            <div className="border-t border-sidebar-border p-3">
              <Session session={session} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** The layout of the screens of a logged-in user. */
export function AppShell({ title, navigation = THEME.navigation, items, session = null, children }: AppShellProps) {
  if (navigation === 'topbar') {
    return (
      <ShellContext value={navigation}>
        <div className="flex min-h-dvh flex-col [--bleed:1rem] [--sticky-top:4rem] md:[--bleed:var(--space-page-x)]">
          <header className="sticky top-0 z-30 h-16 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="mx-auto flex h-full w-full max-w-6xl items-center gap-6 px-4 md:px-(--space-page-x)">
              <Brand title={title} />
              <div className="hidden md:block">
                <Navigation items={items} vertical={false} />
              </div>
              <div className="ml-auto flex items-center gap-1">
                <ColorModeToggle />
                {session && (
                  <div className="hidden md:block">
                    <Session session={session} compact />
                  </div>
                )}
                <div className="md:hidden">
                  <Drawer title={title} items={items} session={session} side="right" />
                </div>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-8 md:px-(--space-page-x) md:py-12">
            {children}
          </main>
          <Toaster />
        </div>
      </ShellContext>
    );
  }
  return (
    <ShellContext value={navigation}>
      <div className="min-h-dvh [--bleed:1rem] [--sticky-top:3.5rem] md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:[--bleed:var(--space-page-x)] md:[--sticky-top:4rem]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex h-16 shrink-0 items-center px-5">
            <Brand title={title} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <Navigation items={items} vertical />
          </div>
          <div className="flex items-center gap-1 border-t border-sidebar-border p-3">
            <ColorModeToggle className="text-muted-foreground" />
            {session && (
              <div className="ml-auto min-w-0">
                <Session session={session} compact />
              </div>
            )}
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:hidden">
            <Drawer title={title} items={items} session={session} side="left" />
            <Brand title={title} />
            <ColorModeToggle className="ml-auto" />
          </header>
          <main className="min-w-0 flex-1 px-(--bleed) pt-(--space-section) pb-(--space-page-y)">{children}</main>
        </div>
        <Toaster />
      </div>
    </ShellContext>
  );
}

/**
 * The place of a form shown as a page (`forms: page` of the theme, `FormSurface` of
 * resource-form): it takes the place of the content of the screen while it is open.
 */
export interface ScreenPage {
  target: HTMLElement | null;
  /** A form page opens (true) or closes (false). */
  claim: (open: boolean) => void;
}

const PageContext = createContext<ScreenPage | null>(null);

/** The page of the current screen, null outside a `Screen`. */
export function useScreenPage(): ScreenPage | null {
  return useContext(PageContext);
}

export interface ScreenProps {
  /** The id of the screen in the specs: `screen:<id>`. */
  id: string;
  title?: ReactNode;
  /** Under the title: what the screen is for. */
  description?: ReactNode;
  /** Next to the title: the actions of the screen. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * A screen of the specs: `screen:<id>`, its header (the title, the description and the
 * actions; it stays at the top of a working application while the screen scrolls) and its
 * content.
 */
export function Screen({ id, title, description, actions, children }: ScreenProps) {
  const navigation = useContext(ShellContext);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [pages, setPages] = useState(0);
  const claim = useCallback((open: boolean) => {
    setPages((count) => count + (open ? 1 : -1));
  }, []);
  const page = useMemo(() => ({ target, claim }), [target, claim]);
  const portal = navigation === 'topbar';
  return (
    <section data-bz={`screen:${id}`} className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-(--space-section)">
      <PageContext value={page}>
        <div className={pages > 0 ? 'hidden' : 'contents'}>
          {(title !== undefined || actions !== undefined) && (
            <div className={cn('grid', portal ? 'gap-1' : 'md:-mt-(--space-section)')}>
              <header
                className={cn(
                  'flex items-center justify-between gap-4',
                  portal
                    ? 'flex-wrap'
                    : '-mx-(--bleed) flex-wrap bg-background/90 px-(--bleed) backdrop-blur md:sticky md:top-0 md:z-20 md:h-16 md:flex-nowrap',
                )}
              >
                {title !== undefined && (
                  <h1
                    className={cn(
                      'min-w-0 truncate font-semibold tracking-tight',
                      portal ? 'text-3xl md:text-4xl' : 'text-xl',
                    )}
                  >
                    {title}
                  </h1>
                )}
                {actions !== undefined && <div className="ml-auto flex shrink-0 flex-wrap gap-2">{actions}</div>}
              </header>
              {description !== undefined && (
                <p className={cn('text-muted-foreground', portal ? 'text-lg' : 'text-sm')}>{description}</p>
              )}
            </div>
          )}
          {children}
        </div>
        <div ref={setTarget} className={pages > 0 ? 'contents' : 'hidden'} />
      </PageContext>
    </section>
  );
}
