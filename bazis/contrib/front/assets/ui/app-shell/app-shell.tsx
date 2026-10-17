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
// bar, as `navigation` of spec/design/theme.yaml), its links `nav:<screen>` (those that
// require a permission shown once the backend allows it), the session
// (the user and the logout, `action:logout`), the language (`action:language`, with more
// than one language), the color mode, the tools of the product (the notifications), the
// toasts, and the screens, each wrapped in `Screen` (`screen:<id>`) with its title, its
// actions and the link back to the screen it was opened from (`nav:<screen>`).

import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, LogOut, Menu } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Link, NavLink } from 'react-router';

import { THEME } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { useCan, useFilterFields, type Can } from '@/bazis/react';
import { Toaster } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { ColorModeToggle } from './color-mode.js';
import { LanguageToggle } from './language.js';

/** A link of the navigation to a screen of the specs: `nav:<screen>`. */
export interface NavItem {
  screen: string;
  label: ReactNode;
  to: string;
  /** Active only on this exact path (the home `/`). */
  end?: boolean;
  /** Its icon, such as an icon of lucide-react. */
  icon?: ComponentType<{ className?: string }>;
  /** What the backend must allow the user: the link is shown once it does (always without). */
  requires?: NavRequirement;
}

/**
 * What the backend must let the user do for a link to be shown, read from the runtime (the
 * frontend never decides by his role; the backend checks every request anyway).
 */
export interface NavRequirement {
  /** The route set of the screen (`ROUTES` of the contract). */
  path: string;
  /** View its items (its list), the default, or add one: `useCan` of `@/bazis/react`. */
  can?: Can;
  /**
   * Fields that the user may filter its list by (`route_filter_fields/`): the link of a
   * report filtered by a field that his field permissions hide, whose filter the backend
   * answers with 400.
   */
  filters?: readonly string[];
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
  /**
   * The tools of the product next to the color mode, such as the notifications
   * (`NotificationCenter`) and the state of the socket (`LiveQuery`): in the top bar, else at
   * the foot of the sidebar (a row that wraps, above the session) or, on a phone, in its
   * header. They are mounted once.
   */
  tools?: ReactNode;
  children: ReactNode;
}

/** The width from which the sidebar is shown: the breakpoint `md` of Tailwind. */
const WIDE = '(min-width: 48rem)';

function subscribeWide(listener: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
}

/**
 * Whether the screen is at least the breakpoint `md` of Tailwind wide: the sidebar is shown,
 * and a list is not the one of a phone (true when the browser cannot tell, as in jsdom).
 */
export function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => typeof window.matchMedia !== 'function' || window.matchMedia(WIDE).matches);
}

const ShellContext = createContext<Navigation | null>(null);
const ItemsContext = createContext<readonly NavItem[]>([]);

/** The links of the navigation of the layout (`items` of `AppShell`), none outside it. */
export function useNavItems(): readonly NavItem[] {
  return useContext(ItemsContext);
}

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

// the hooks with the plain path of a link: the screens pass the typed paths of their contract
const useAnyCan = useCan as unknown as (path: string, action: Can) => boolean | undefined;
const useAnyFilterFields = useFilterFields as unknown as (
  path: string,
) => UseQueryResult<{ fields: readonly { name: string }[] }>;

/**
 * Its children once the backend allows the user what a link requires (`requires` of a
 * `NavItem`), nothing until then; at once without a requirement: the links of the navigation,
 * the quick links of a dashboard.
 */
export function Allowed({ requirement, children }: { requirement: NavRequirement | undefined; children: ReactNode }) {
  return requirement ? <Permitted requirement={requirement}>{children}</Permitted> : children;
}

function Permitted({ requirement, children }: { requirement: NavRequirement; children: ReactNode }) {
  const allowed = useAnyCan(requirement.path, requirement.can ?? 'view');
  if (allowed !== true) return null;
  const { filters = [] } = requirement;
  return filters.length ? (
    <Filterable path={requirement.path} filters={filters}>
      {children}
    </Filterable>
  ) : (
    children
  );
}

function Filterable({ path, filters, children }: { path: string; filters: readonly string[]; children: ReactNode }) {
  const fields = useAnyFilterFields(path).data?.fields;
  return fields && filters.every((name) => fields.some((it) => it.name === name)) ? children : null;
}

function Navigation({ items, vertical, onNavigate }: { items: readonly NavItem[]; vertical: boolean; onNavigate?: () => void }) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t('shell.navigation')}>
      <ul className={cn('flex gap-1', vertical ? 'flex-col' : 'items-center')}>
        {items.map((item) => {
          const Icon = item.icon;
          const link = (
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
          return (
            <Allowed key={item.screen} requirement={item.requires}>
              {link}
            </Allowed>
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
  const { t } = useLanguage();
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
        {t('shell.logout')}
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
  const { t } = useLanguage();
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={t('shell.menu')} onClick={() => { setOpen(true); }}>
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side} className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-14 justify-center border-b border-sidebar-border px-4">
            <SheetTitle>
              <Brand title={title} />
            </SheetTitle>
            <SheetDescription className="sr-only">{t('shell.menu_description')}</SheetDescription>
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
export function AppShell({ title, navigation = THEME.navigation, items, session = null, tools, children }: AppShellProps) {
  const wide = useWide();
  if (navigation === 'topbar') {
    return (
      <ShellContext value={navigation}>
        <div className="flex min-h-dvh flex-col [--bleed:1rem] [--sticky-top:4rem] md:[--bleed:var(--space-page-x)]">
          <header className="sticky top-0 z-30 h-16 border-b bg-background">
            <div className="mx-auto flex h-full w-full max-w-6xl items-center gap-6 px-4 md:px-(--space-page-x)">
              <Brand title={title} />
              <div className="hidden md:block">
                <Navigation items={items} vertical={false} />
              </div>
              <div className="ml-auto flex items-center gap-1">
                {tools}
                <LanguageToggle />
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
            <ItemsContext value={items}>{children}</ItemsContext>
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
          {/* the foot: the toggles and the tools of the product on a row that wraps, the
              session on a row of its own under them, so that neither pushes the other out */}
          <div className="grid gap-2 border-t border-sidebar-border p-3">
            <div data-slot="sidebar-tools" className="flex flex-wrap items-center gap-1">
              <ColorModeToggle className="text-muted-foreground" />
              <LanguageToggle className="text-muted-foreground" />
              {wide && tools}
            </div>
            {session && <Session session={session} />}
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
            <Drawer title={title} items={items} session={session} side="left" />
            <Brand title={title} />
            <div className="ml-auto flex items-center gap-1">
              {!wide && tools}
              <LanguageToggle />
              <ColorModeToggle />
            </div>
          </header>
          <main className="min-w-0 flex-1 px-(--bleed) pt-(--space-section) pb-(--space-page-y)">
            <ItemsContext value={items}>{children}</ItemsContext>
          </main>
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

/** The screen that a screen was opened from, such as the list of a card. */
export interface ScreenParent {
  /** Its id in the specs: the link back to it is `nav:<screen>`. */
  screen: string;
  label: ReactNode;
  to: string;
}

export interface ScreenProps {
  /** The id of the screen in the specs: `screen:<id>`. */
  id: string;
  title?: ReactNode;
  /**
   * The screen it was opened from: before the title, a breadcrumb to it on a wide screen
   * (`xl`), a button back to it below.
   */
  parent?: ScreenParent;
  /** Under the title: what the screen is for. */
  description?: ReactNode;
  /** Next to the title: the actions of the screen. */
  actions?: ReactNode;
  children: ReactNode;
}

/** The link back to the parent of a screen: an arrow below `xl`, its label and a chevron from it. */
function Breadcrumb({ parent }: { parent: ScreenParent }) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t('screen.breadcrumb')} className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
      <Link
        to={parent.to}
        data-bz={`nav:${parent.screen}`}
        className="-ml-2 inline-flex size-9 items-center justify-center gap-1 rounded-md outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:ml-0 xl:size-auto xl:px-1.5 xl:py-1"
      >
        <ArrowLeft className="size-4 xl:hidden" aria-hidden="true" />
        <span className="max-xl:sr-only">{parent.label}</span>
      </Link>
      <ChevronRight className="hidden size-4 opacity-60 xl:block" aria-hidden="true" />
    </nav>
  );
}

/**
 * A screen of the specs: `screen:<id>`, its header (the link back to its parent, the title and
 * the actions; in a working application it stays at the top while the screen scrolls,
 * `--sticky-top` high), its description and its content.
 */
export function Screen({ id, title, parent, description, actions, children }: ScreenProps) {
  const navigation = useContext(ShellContext);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [pages, setPages] = useState(0);
  const claim = useCallback((open: boolean) => {
    setPages((count) => count + (open ? 1 : -1));
  }, []);
  const page = useMemo(() => ({ target, claim }), [target, claim]);
  // the header sticks under the top of the page with the sidebar, never under a top bar
  const sticky = navigation !== 'topbar';
  const portal = THEME.preset === 'portal';
  return (
    <section data-bz={`screen:${id}`} className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-(--space-section)">
      <PageContext value={page}>
        {/* `contents`: the header is laid out in the section, which it sticks in */}
        <div className={pages > 0 ? 'hidden' : 'contents'}>
          {(title !== undefined || parent !== undefined || actions !== undefined) && (
            <header
              data-slot="screen-header"
              className={cn(
                'flex flex-wrap items-center justify-between gap-4',
                sticky &&
                  '-mx-(--bleed) bg-background px-(--bleed) md:sticky md:border-b md:top-0 md:z-20 md:mt-[calc(var(--screen-lift,var(--space-section))*-1)] md:h-(--sticky-top) md:flex-nowrap',
              )}
            >
              <div className="flex min-w-0 items-center gap-1">
                {parent !== undefined && <Breadcrumb parent={parent} />}
                {title !== undefined && (
                  <h1
                    className={cn(
                      'min-w-0 truncate font-semibold tracking-tight',
                      portal ? 'text-2xl md:text-3xl' : 'text-xl',
                    )}
                  >
                    {title}
                  </h1>
                )}
              </div>
              {actions !== undefined && <div className="ml-auto flex shrink-0 flex-wrap gap-2">{actions}</div>}
            </header>
          )}
          {description !== undefined && (
            <p
              className={cn(
                'text-muted-foreground',
                portal ? 'text-lg' : 'text-sm',
                // right under the title, not a section of its own
                title !== undefined && (sticky ? 'md:-mt-(--space-section) -mt-3' : '-mt-4'),
              )}
            >
              {description}
            </p>
          )}
          {children}
        </div>
        <div ref={setTarget} className={pages > 0 ? 'contents' : 'hidden'} />
      </PageContext>
    </section>
  );
}
