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
// require a permission shown once the backend allows it; those that the top bar has no room
// for in its menu `nav:more`), the session (the user and the
// logout, `action:logout`; without one, the sign-in `action:sign-in`), the language
// (`action:language`, with more than one language), the color mode, the tools of the product
// (the notifications), the toasts, and the screens, each wrapped in `Screen` (`screen:<id>`)
// with its title, its actions and the link back to the screen it was opened from
// (`nav:<screen>`).

import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Ellipsis, LogIn, LogOut, Menu } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { THEME } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { useCan, useFilterFields, type Can } from '@/bazis/react';
import { Toaster } from '@/bazis/ui/state-panel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  /** The link of a public screen (an anonymous role of the specs), also shown without a session. */
  public?: boolean;
}

/** Links of the navigation under a heading, shown while the backend allows the user one of them. */
export interface NavGroup {
  /** The id of the group in the specs. */
  group: string;
  label: ReactNode;
  items: readonly NavItem[];
}

/** An entry of the navigation: a link, or a group of links. */
export type NavEntry = NavItem | NavGroup;

/** The key of an entry among the entries. */
function entryKey(entry: NavEntry): string {
  return 'items' in entry ? `group:${entry.group}` : entry.screen;
}

/** The links of the entries, those of a group in its place. */
function navLinks(entries: readonly NavEntry[]): readonly NavItem[] {
  return entries.flatMap((entry) => ('items' in entry ? entry.items : [entry]));
}

/**
 * What the backend must let the user do for a link to be shown, read from the runtime (the
 * frontend never decides by his role; the backend checks every request anyway).
 */
export interface NavRequirement {
  /** The route set of the screen (`ROUTES` of the contract). */
  path: string;
  /**
   * View its items (its list), the default, add one, or call a custom action of the collection
   * (`'action_<name>'`: the link of the form of the action): `useCan` of `@/bazis/react`.
   */
  can?: Can;
  /**
   * Fields that the user may filter its list by (`route_filter_fields/`): the link of a
   * report filtered by a field that his field permissions hide, whose filter the backend
   * answers with 400.
   */
  filters?: readonly string[];
}

/** The session of the user; null without a login (no bazis-users), or before the user logs in. */
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
  /** The links of the navigation and their groups. */
  items: readonly NavEntry[];
  session?: ShellSession | null;
  /**
   * The sign-in of a user without a session (`action:sign-in`), shown in the place of the
   * session while it is null: it opens the login.
   */
  signIn?: (() => void) | undefined;
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

/** The links of the navigation of the layout (`items` of `AppShell`, those of its groups in their place), none outside it. */
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
      <span title={typeof title === 'string' ? title : undefined} className="truncate font-display text-base font-semibold tracking-tight">
        {title}
      </span>
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

interface PermittedProps {
  requirement: NavRequirement;
  children: ReactNode;
  /** What is shown until, or unless, the backend allows it. */
  otherwise?: ReactNode;
}

function Permitted({ requirement, children, otherwise = null }: PermittedProps) {
  const allowed = useAnyCan(requirement.path, requirement.can ?? 'view');
  if (allowed !== true) return otherwise;
  const { filters = [] } = requirement;
  return filters.length ? (
    <Filterable path={requirement.path} filters={filters} otherwise={otherwise}>
      {children}
    </Filterable>
  ) : (
    children
  );
}

function Filterable({ path, filters, children, otherwise }: Omit<PermittedProps, 'requirement'> & { path: string; filters: readonly string[] }) {
  const fields = useAnyFilterFields(path).data?.fields;
  return fields && filters.every((name) => fields.some((it) => it.name === name)) ? children : otherwise;
}

/**
 * Its children once the backend allows the user one of the requirements (at once when one
 * is none), nothing until then: a group of links shown with its first allowed link. The
 * requirements are asked for in turn by the queries of their links, without a request of
 * their own.
 */
function AnyAllowed({ requirements, children }: { requirements: readonly (NavRequirement | undefined)[]; children: ReactNode }) {
  const [first, ...rest] = requirements;
  if (requirements.length === 0) return null;
  if (first === undefined) return children;
  return (
    <Permitted requirement={first} otherwise={<AnyAllowed requirements={rest}>{children}</AnyAllowed>}>
      {children}
    </Permitted>
  );
}

interface EntryProps {
  vertical: boolean;
  onNavigate?: (() => void) | undefined;
  /**
   * In the copy of the row of the top bar that is measured: its items are marked by their
   * entry (`data-nav-entry`), its links are not marked (`data-bz`).
   */
  copy?: boolean;
}

/** A link or a group of links of the navigation. */
function Entry({ entry, ...props }: EntryProps & { entry: NavEntry }) {
  return 'items' in entry ? <NavGroupEntry group={entry} {...props} /> : <NavLinkEntry item={entry} {...props} />;
}

/** The navigation of the sidebar and of the drawer of a phone. */
function Navigation({ items, onNavigate }: { items: readonly NavEntry[]; onNavigate?: () => void }) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t('shell.navigation')}>
      <ul className="flex flex-col gap-1">
        {items.map((entry) => (
          <Entry key={entryKey(entry)} entry={entry} vertical onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  );
}

/** The entries that the row of the top bar shows: those before `count`; `current`, the current link is after them. */
interface Row {
  count: number;
  current: boolean;
}

const WHOLE: Row = { count: Infinity, current: false };

/**
 * The row of the top bar that `place` has room for, measured on `copy`, the row laid out whole
 * (its items, then the button of the menu): the entries from the first that ends past the room
 * that the button leaves go to the menu.
 */
function measureRow(place: Element, copy: Element, keys: readonly string[]): Row {
  const width = place.getBoundingClientRect().width;
  const start = copy.getBoundingClientRect().left;
  const end = (element: Element) => element.getBoundingClientRect().right - start;
  const items = [...copy.children];
  const button = items.pop();
  const last = items.at(-1);
  if (!button || !last || end(last) <= width) return WHOLE;
  const room = width - (end(button) - end(last));
  const first = items.findIndex((it) => end(it) > room);
  return {
    count: keys.indexOf(items[first]?.getAttribute('data-nav-entry') ?? ''),
    current: items.slice(first).some((it) => it.querySelector('[aria-current="page"]') !== null),
  };
}

/**
 * The navigation of the top bar: the entries that its row has room for, the others in its menu
 * `nav:more`, shown as the current link while the current link is in it. The row is measured
 * on a hidden copy of it laid out whole when the place of the row or the copy changes its size
 * (`ResizeObserver`; without one, as in jsdom, the row shows every entry), and when the
 * entries or the current link change.
 */
function TopNavigation({ items }: { items: readonly NavEntry[] }) {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const place = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLUListElement>(null);
  const [row, setRow] = useState(WHOLE);
  const keys = useMemo(() => items.map(entryKey), [items]);
  // a new observer reports the sizes at once
  useLayoutEffect(() => {
    const box = place.current;
    const whole = copy.current;
    if (!box || !whole) return;
    const observer = new ResizeObserver(() => {
      const next = measureRow(box, whole, keys);
      setRow((it) => (it.count === next.count && it.current === next.current ? it : next));
    });
    observer.observe(box);
    observer.observe(whole);
    return () => {
      observer.disconnect();
    };
  }, [keys, pathname]);
  const rest = items.slice(row.count);
  return (
    <div ref={place} className="hidden min-w-0 flex-1 md:block">
      {typeof ResizeObserver === 'function' && (
        <div aria-hidden="true" inert className="invisible h-0 overflow-hidden">
          <ul ref={copy} className="flex w-max items-center gap-1">
            {items.map((entry) => (
              <Entry key={entryKey(entry)} entry={entry} vertical={false} copy />
            ))}
            <li>
              <MoreButton tabIndex={-1} />
            </li>
          </ul>
        </div>
      )}
      <nav aria-label={t('shell.navigation')}>
        <ul className="flex items-center gap-1">
          {items.slice(0, row.count).map((entry) => (
            <Entry key={entryKey(entry)} entry={entry} vertical={false} />
          ))}
          {rest.length > 0 && (
            <li className="shrink-0">
              <More entries={rest} current={row.current} />
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}

/** The button of the menu of the top bar, shown as the current link while the current link is in the menu. */
function MoreButton({ current = false, ...props }: ComponentProps<'button'> & { current?: boolean }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      data-current={current ? '' : undefined}
      {...props}
      className={cn(LINK.base, LINK.horizontal, current && CURRENT.horizontal)}
    >
      <Ellipsis aria-hidden="true" className="size-4 shrink-0 opacity-70" />
      {t('shell.more')}
    </button>
  );
}

/** The menu of the entries that the row of the top bar has no room for, `nav:more`. */
function More({ entries, current }: { entries: readonly NavEntry[]; current: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MoreButton data-bz="nav:more" current={current} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {entries.map((entry) =>
          'items' in entry ? <MoreGroup key={entryKey(entry)} group={entry} /> : <MoreLink key={entry.screen} item={entry} />,
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A group of links in the menu of the top bar under its heading, set apart from the entries after it by a line. */
function MoreGroup({ group }: { group: NavGroup }) {
  const heading = useId();
  return (
    <AnyAllowed requirements={group.items.map((it) => it.requires)}>
      <DropdownMenuGroup aria-labelledby={heading} className="not-first:pt-1 not-last:mb-1 not-last:border-b not-last:pb-1">
        <DropdownMenuLabel id={heading} className="text-xs text-muted-foreground">
          {group.label}
        </DropdownMenuLabel>
        {group.items.map((item) => (
          <MoreLink key={item.screen} item={item} />
        ))}
      </DropdownMenuGroup>
    </AnyAllowed>
  );
}

/** A link in the menu of the top bar, `nav:<screen>`, shown once the backend allows what it requires. */
function MoreLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Allowed requirement={item.requires}>
      <DropdownMenuItem asChild className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground">
        <NavLink to={item.to} end={item.end} data-bz={`nav:${item.screen}`}>
          {Icon && <Icon className="opacity-70" />}
          <span title={typeof item.label === 'string' ? item.label : undefined} className="truncate">
            {item.label}
          </span>
        </NavLink>
      </DropdownMenuItem>
    </Allowed>
  );
}

/** A group of links under its heading: hidden while the backend allows the user none of them. */
function NavGroupEntry({ group, vertical, onNavigate, copy = false }: EntryProps & { group: NavGroup }) {
  const heading = useId();
  return (
    <AnyAllowed requirements={group.items.map((it) => it.requires)}>
      <li
        data-nav-group=""
        data-nav-entry={copy ? entryKey(group) : undefined}
        className={cn('flex gap-1', vertical ? 'flex-col pt-3' : 'items-center')}
      >
        <span
          id={heading}
          className={cn(
            'truncate text-xs font-medium',
            vertical ? 'px-3 pb-1 text-sidebar-foreground/80' : 'pl-2 text-muted-foreground',
          )}
        >
          {group.label}
        </span>
        <ul aria-labelledby={heading} className={cn('flex gap-1', vertical ? 'flex-col' : 'items-center')}>
          {group.items.map((item) => (
            <NavLinkEntry key={item.screen} item={item} vertical={vertical} onNavigate={onNavigate} copy={copy} />
          ))}
        </ul>
      </li>
    </AnyAllowed>
  );
}

/** A link of the navigation outside the groups right after a group: set apart from its links by a line. */
const AFTER_GROUP = {
  vertical: '[[data-nav-group]+&]:mt-2 [[data-nav-group]+&]:border-t [[data-nav-group]+&]:border-sidebar-border [[data-nav-group]+&]:pt-2',
  horizontal: '[[data-nav-group]+&]:ml-1 [[data-nav-group]+&]:border-l [[data-nav-group]+&]:border-border [[data-nav-group]+&]:pl-2',
};

/** A link of the navigation, also the button of the menu of the top bar. */
const LINK = {
  base: 'group flex items-center gap-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
  vertical: 'rounded-md px-3 py-2 text-sidebar-foreground/80 pointer-coarse:min-h-11 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
  horizontal: 'rounded-full px-3.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
};

/** The current link. */
const CURRENT = {
  vertical: 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent',
  horizontal: 'bg-accent text-accent-foreground',
};

/** A link of the navigation, `nav:<screen>`, shown once the backend allows what it requires. */
function NavLinkEntry({ item, vertical, onNavigate, copy = false }: EntryProps & { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Allowed requirement={item.requires}>
      <li data-nav-entry={copy ? item.screen : undefined} className={vertical ? AFTER_GROUP.vertical : AFTER_GROUP.horizontal}>
        <NavLink
          to={item.to}
          end={item.end}
          data-bz={copy ? undefined : `nav:${item.screen}`}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              LINK.base,
              vertical ? LINK.vertical : LINK.horizontal,
              isActive && (vertical ? CURRENT.vertical : CURRENT.horizontal),
            )
          }
        >
          {Icon && (
            <Icon className="size-4 shrink-0 opacity-70 group-aria-[current=page]:text-primary group-aria-[current=page]:opacity-100" />
          )}
          <span title={typeof item.label === 'string' ? item.label : undefined} className="truncate">
            {item.label}
          </span>
        </NavLink>
      </li>
    </Allowed>
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
          <span title={typeof session.user === 'string' ? session.user : undefined} className="truncate font-medium">
            {session.user}
          </span>
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

/** The session of the user, else the sign-in when there is one, else nothing. */
function Account({ session, signIn, compact = false }: { session: ShellSession | null; signIn: (() => void) | undefined; compact?: boolean }) {
  const { t } = useLanguage();
  if (session) return <Session session={session} compact={compact} />;
  if (!signIn) return null;
  return (
    <Button type="button" size="sm" data-bz="action:sign-in" className={cn(!compact && 'w-full')} onClick={signIn}>
      <LogIn />
      {t('shell.sign_in')}
    </Button>
  );
}

/** The drawer of the navigation on a phone; closed when the route changes. */
function Drawer({
  title,
  items,
  session,
  signIn,
  side,
}: {
  title: ReactNode;
  items: readonly NavEntry[];
  session: ShellSession | null;
  signIn: (() => void) | undefined;
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
            <Navigation items={items} onNavigate={close} />
          </div>
          {(session || signIn) && (
            <div className="border-t border-sidebar-border p-3">
              <Account session={session} signIn={signIn} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** The layout of the screens. */
export function AppShell({ title, navigation = THEME.navigation, items, session = null, signIn, tools, children }: AppShellProps) {
  const wide = useWide();
  const links = useMemo(() => navLinks(items), [items]);
  if (navigation === 'topbar') {
    return (
      <ShellContext value={navigation}>
        <div className="flex min-h-dvh flex-col [--bleed:1rem] [--sticky-top:4rem] md:[--bleed:var(--space-page-x)]">
          <header className="sticky top-0 z-30 h-16 border-b bg-background">
            <div className="mx-auto flex h-full w-full max-w-6xl items-center gap-6 px-4 md:px-(--space-page-x)">
              <Brand title={title} />
              <TopNavigation items={items} />
              <div className="ml-auto flex items-center gap-1">
                {tools}
                <LanguageToggle />
                <ColorModeToggle />
                {(session || signIn) && (
                  <div className="hidden md:block">
                    <Account session={session} signIn={signIn} compact />
                  </div>
                )}
                <div className="md:hidden">
                  <Drawer title={title} items={items} session={session} signIn={signIn} side="right" />
                </div>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-8 md:px-(--space-page-x) md:py-12">
            <ItemsContext value={links}>{children}</ItemsContext>
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
            <Navigation items={items} />
          </div>
          {/* the foot: the toggles and the tools of the product on a row that wraps, the
              session on a row of its own under them, so that neither pushes the other out */}
          <div className="grid gap-2 border-t border-sidebar-border p-3">
            <div data-slot="sidebar-tools" className="flex flex-wrap items-center gap-1">
              <ColorModeToggle className="text-muted-foreground" />
              <LanguageToggle className="text-muted-foreground" />
              {wide && tools}
            </div>
            <Account session={session} signIn={signIn} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
            <Drawer title={title} items={items} session={session} signIn={signIn} side="left" />
            <Brand title={title} />
            <div className="ml-auto flex items-center gap-1">
              {!wide && tools}
              <LanguageToggle />
              <ColorModeToggle />
            </div>
          </header>
          <main className="min-w-0 flex-1 px-(--bleed) pt-(--space-section) pb-(--space-page-y)">
            <ItemsContext value={links}>{children}</ItemsContext>
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
  /** The screen has a title, its `h1`; without one, its card is headed by its item, `h1`. */
  titled: boolean;
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

/**
 * The link back to the parent of a screen: an arrow below `xl`, its label from it, and a
 * chevron before the title of the screen (none on a screen that its card heads).
 */
function Breadcrumb({ parent, titled }: { parent: ScreenParent; titled: boolean }) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t('screen.breadcrumb')} className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
      <Link
        to={parent.to}
        data-bz={`nav:${parent.screen}`}
        className="-ml-2 inline-flex size-9 items-center justify-center gap-1 rounded-md outline-none pointer-coarse:min-h-11 pointer-coarse:min-w-11 hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:ml-0 xl:size-auto xl:px-1.5 xl:py-1"
      >
        <ArrowLeft className="size-4 xl:hidden" aria-hidden="true" />
        <span className="max-xl:sr-only">{parent.label}</span>
      </Link>
      {titled && <ChevronRight className="hidden size-4 opacity-60 xl:block" aria-hidden="true" />}
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
  const titled = title !== undefined;
  const page = useMemo(() => ({ target, claim, titled }), [target, claim, titled]);
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
                {parent !== undefined && <Breadcrumb parent={parent} titled={titled} />}
                {title !== undefined && (
                  <h1
                    title={typeof title === 'string' ? title : undefined}
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
