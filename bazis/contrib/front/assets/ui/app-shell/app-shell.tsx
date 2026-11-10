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
// require a permission shown once the backend allows it, the number of the items of a list
// beside a link `count:<screen>`; those that the top bar has no room for in its menu
// `nav:more`; the sidebar collapsed to a rail of icons, by default on a narrow screen, the choice
// of the user kept in the storage of the browser),
// the session (the user and the logout, `action:logout`; without one, the sign-in
// `action:sign-in`), the language
// (`action:language`, with more than one language), the color mode, the tools of the product
// (the notifications), the toasts, and the screens, each wrapped in `Screen` (`screen:<id>`)
// with its title, its actions and the link back to the screen it was opened from
// (`nav:<screen>`).

import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Ellipsis, LogIn, LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserRound, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { Link, NavLink, useLocation, useNavigate } from 'react-router';

import { aggregateValues, type Filter } from '@/bazis/client';
import { THEME, type BrandMark } from '@/bazis/generated/theme';
import { formatNumber, useLanguage } from '@/bazis/i18n';
import { useCan, useFilterFields, useList, type Can, type QueryOptions } from '@/bazis/react';
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
import { useBesideList } from './list-card.js';

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
  /**
   * The number beside the link (`count` of the link in the specs): the items of the route set
   * (`ROUTES` of the contract) that the filter selects, once the link is shown; none at 0.
   */
  count?: { path: string; filter: Filter };
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

/**
 * The entries that show the first `count` links of `entries` and those that show the others:
 * a group the count ends in is in both, with its heading, the links before the end of the
 * count in the first, the others in the second.
 */
function splitEntries(entries: readonly NavEntry[], count: number): [NavEntry[], NavEntry[]] {
  const shown: NavEntry[] = [];
  const rest: NavEntry[] = [];
  let left = count;
  for (const entry of entries) {
    if (!('items' in entry)) {
      (left > 0 ? shown : rest).push(entry);
      left -= 1;
      continue;
    }
    const taken = Math.min(Math.max(left, 0), entry.items.length);
    if (taken === entry.items.length) shown.push(entry);
    else if (taken === 0) rest.push(entry);
    else {
      shown.push({ ...entry, items: entry.items.slice(0, taken) });
      rest.push({ ...entry, items: entry.items.slice(taken) });
    }
    left -= entry.items.length;
  }
  return [shown, rest];
}

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
   * (its key in the contract, `customActionKey(path, '<name>')` of `@/bazis/ui/resource`: the
   * link of the form of the action): `useCan` of `@/bazis/react`.
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
  /** Who is logged in: in the sidebar, a plate with the circle of his initials. */
  user?: ReactNode;
  /** Under his name in the sidebar, smaller: his role, his organization. */
  detail?: ReactNode;
  onLogout: () => void;
}

export type Navigation = 'sidebar' | 'topbar';

export interface AppShellProps {
  /** The name of the product. */
  title: ReactNode;
  /** `navigation` of the theme by default. */
  navigation?: Navigation;
  /** The mark of the brand next to the name, `brand` of the theme by default; null: the first letter of the name. */
  brand?: BrandMark | null;
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

/** The key of the storage of the browser that keeps the choice of the user: the sidebar collapsed to a rail or expanded. */
const RAIL = 'bazis-sidebar';

/** Whether the user collapsed the sidebar to a rail; null when he did not choose (or the storage is not available). */
function storedRail(): boolean | null {
  try {
    const stored = window.localStorage.getItem(RAIL);
    return stored === null ? null : stored === 'collapsed';
  } catch {
    return null;
  }
}

function storeRail(collapsed: boolean): void {
  try {
    window.localStorage.setItem(RAIL, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // a storage that is not available: the choice lasts until the page is reloaded
  }
}

/** The width from which the sidebar is shown: the breakpoint `md` of Tailwind. */
const WIDE = '(min-width: 48rem)';
/** The width from which the sidebar is expanded until the user collapses it, a rail below: the breakpoint `lg`. */
const ROOMY = '(min-width: 64rem)';

function subscriber(media: string) {
  return (listener: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => undefined;
    const query = window.matchMedia(media);
    query.addEventListener('change', listener);
    return () => {
      query.removeEventListener('change', listener);
    };
  };
}

const subscribeWide = subscriber(WIDE);
const subscribeRoomy = subscriber(ROOMY);

/**
 * Whether the screen is at least the breakpoint `md` of Tailwind wide: the sidebar is shown,
 * and a list is not the one of a phone (true when the browser cannot tell, as in jsdom).
 */
export function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => typeof window.matchMedia !== 'function' || window.matchMedia(WIDE).matches);
}

/** The id of the content of the page, which the first link of the page skips to. */
const CONTENT = 'content';

/** The first link of the page for the keyboard, shown once focused: past the navigation to the content. */
function SkipLink() {
  const { t } = useLanguage();
  return (
    <a
      href={`#${CONTENT}`}
      className="sr-only rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow-(--shadow-lift-2) focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus-visible:ring-focus"
    >
      {t('shell.skip')}
    </a>
  );
}

const ShellContext = createContext<Navigation | null>(null);
const ItemsContext = createContext<readonly NavItem[]>([]);
/** Whether the links are those of a rail, only their icons seen: their labels in their titles. */
const RailContext = createContext(false);

/** The links of the navigation of the layout (`items` of `AppShell`, those of its groups in their place), none outside it. */
export function useNavItems(): readonly NavItem[] {
  return useContext(ItemsContext);
}

export interface BrandProps {
  /** The name of the product. */
  title: ReactNode;
  /** Its mark, `brand` of the theme by default; null: the first letter of the name. */
  mark?: BrandMark | null | undefined;
  /** Larger, as on the login screen. */
  large?: boolean | undefined;
}

/**
 * The mark of the product on the color of its brand (its icon or its image, else the first
 * letter of its name, `data-slot="brand-mark"`) and its name in two lines at most: that of the
 * shell, and of the login screen (`large`).
 */
export function Brand({ title, mark = THEME.brand, large = false }: BrandProps) {
  const letter = typeof title === 'string' ? title.trim().charAt(0).toUpperCase() : null;
  const Icon = mark !== null && 'icon' in mark ? mark.icon : null;
  return (
    <span className={cn('flex min-w-0 items-center', large ? 'gap-3' : 'gap-2.5')}>
      {(mark !== null || letter) && (
        <span
          aria-hidden="true"
          data-slot="brand-mark"
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden bg-brand font-semibold text-brand-foreground shadow-sm',
            large ? 'size-10 rounded-xl text-lg' : 'size-8 rounded-lg text-sm',
          )}
        >
          {Icon ? (
            <Icon className={large ? 'size-5' : 'size-4.5'} />
          ) : mark !== null && 'image' in mark ? (
            <img src={mark.image} alt="" className="size-full object-cover" />
          ) : (
            letter
          )}
        </span>
      )}
      <span
        data-slot="brand-name"
        title={typeof title === 'string' ? title : undefined}
        // the leading after the size: `cn` drops a leading that a size follows
        className={cn('line-clamp-2 font-heading', large ? 'text-xl' : 'text-base', 'leading-tight')}
      >
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
const useAnyList = useList as unknown as (path: string, query: QueryOptions) => UseQueryResult<Parameters<typeof aggregateValues>[0]>;

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
   * In the copy of the row of the top bar that is measured: its links are marked by their
   * screen (`data-nav-entry`), they are not marked for the tests (`data-bz`).
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

/** The links that the row of the top bar shows: the first `count` of them; `current`, the current link is after them. */
interface Row {
  count: number;
  current: boolean;
}

const WHOLE: Row = { count: Infinity, current: false };

/**
 * The row of the top bar that `place` has room for, measured on `copy`, the row laid out whole
 * (its entries, then the button of the menu): the links from the first that ends past the room
 * that the button leaves go to the menu, a group is shared by the row and the menu. The ends of
 * the links include the headings of the groups before them. `screens` are those of the links in
 * their order, also those that the backend does not allow and the copy has not.
 */
function measureRow(place: Element, copy: Element, screens: readonly string[]): Row {
  const width = place.getBoundingClientRect().width;
  const start = copy.getBoundingClientRect().left;
  const end = (element: Element) => element.getBoundingClientRect().right - start;
  const button = copy.lastElementChild;
  const links = [...copy.querySelectorAll('[data-nav-entry]')];
  const last = links.at(-1);
  if (!button || !last || end(last) <= width) return WHOLE;
  const room = width - (end(button) - end(last));
  const first = links.findIndex((it) => end(it) > room);
  return {
    count: screens.indexOf(links[first]?.getAttribute('data-nav-entry') ?? ''),
    current: links.slice(first).some((it) => it.querySelector('[aria-current="page"]') !== null),
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
  const screens = useMemo(() => navLinks(items).map((it) => it.screen), [items]);
  // a new observer reports the sizes at once
  useLayoutEffect(() => {
    const box = place.current;
    const whole = copy.current;
    if (!box || !whole) return;
    const observer = new ResizeObserver(() => {
      const next = measureRow(box, whole, screens);
      setRow((it) => (it.count === next.count && it.current === next.current ? it : next));
    });
    observer.observe(box);
    observer.observe(whole);
    return () => {
      observer.disconnect();
    };
  }, [screens, pathname]);
  const [shown, rest] = splitEntries(items, row.count);
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
          {shown.map((entry) => (
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
          {item.count && <NavCount screen={item.screen} count={item.count} vertical={false} />}
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
        className={cn(
          'flex gap-1',
          // a group of a rail: a line over its links instead of its heading
          vertical
            ? 'flex-col pt-3 group-data-[state=collapsed]/sidebar:mx-2 group-data-[state=collapsed]/sidebar:mt-2 group-data-[state=collapsed]/sidebar:border-t group-data-[state=collapsed]/sidebar:border-sidebar-border group-data-[state=collapsed]/sidebar:pt-2'
            : 'items-center',
        )}
      >
        <span
          id={heading}
          className={cn(
            'truncate',
            vertical
              ? 'px-3 pb-1.5 font-eyebrow text-sidebar-muted-foreground group-data-[state=collapsed]/sidebar:sr-only'
              : 'pl-2 text-xs font-medium text-muted-foreground',
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

/** A link of the navigation outside the groups right after a group: set apart from its links (in the top bar by a line). */
const AFTER_GROUP = {
  vertical: '[[data-nav-group]+&]:mt-3',
  horizontal: '[[data-nav-group]+&]:ml-1 [[data-nav-group]+&]:border-l [[data-nav-group]+&]:border-border [[data-nav-group]+&]:pl-2',
};

/** A link of the navigation, also the button of the menu of the top bar. */
const LINK = {
  base: 'group flex items-center gap-3 text-sm font-medium transition-colors outline-none focus-visible:ring-focus',
  vertical:
    'relative rounded-md px-3 py-2 text-sidebar-foreground/80 pointer-coarse:min-h-11 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground group-data-[state=collapsed]/sidebar:justify-center',
  horizontal: 'rounded-full px-3.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
};

/** The current link: in the sidebar a lifted fill with a bar at its start (`color.nav-active`, `-bar`, `shadow.nav-active`). */
const CURRENT = {
  vertical:
    'bg-nav-active text-sidebar-accent-foreground shadow-(--shadow-nav-active) hover:bg-nav-active before:absolute before:inset-y-[11px] before:left-0 before:w-0.5 before:rounded-r-full before:bg-nav-active-bar',
  horizontal: 'bg-accent text-accent-foreground',
};

/** A link of the navigation, `nav:<screen>`, shown once the backend allows what it requires. */
function NavLinkEntry({ item, vertical, onNavigate, copy = false }: EntryProps & { item: NavItem }) {
  const Icon = item.icon;
  const rail = useContext(RailContext);
  const label = typeof item.label === 'string' ? item.label : undefined;
  return (
    <Allowed requirement={item.requires}>
      <li data-nav-entry={copy ? item.screen : undefined} className={vertical ? AFTER_GROUP.vertical : AFTER_GROUP.horizontal}>
        <NavLink
          to={item.to}
          end={item.end}
          data-bz={copy ? undefined : `nav:${item.screen}`}
          // the label of a link of a rail, only the icon of which is seen
          title={rail ? label : undefined}
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
            <Icon
              className={cn(
                'size-4 shrink-0 opacity-70 group-aria-[current=page]:opacity-100',
                // in the sidebar a thinner stroke, the current one in the color of its text
                vertical ? '[stroke-width:1.75]' : 'group-aria-[current=page]:text-primary',
              )}
            />
          )}
          <span title={label} className="truncate group-data-[state=collapsed]/sidebar:sr-only">
            {item.label}
          </span>
          {item.count && <NavCount screen={copy ? undefined : item.screen} count={item.count} vertical={vertical} />}
        </NavLink>
      </li>
    </Allowed>
  );
}

/**
 * The number of the items that a link counts (`count` of `NavItem`), `count:<screen>` with the
 * number in `data-value`, at the end of the link; nothing until it is loaded, at 0, on an error.
 * In the sidebar on the current link in its primary; a dot in a rail. The query is that of a
 * tile counting the same items (`StatCard`), whose answer it shares.
 */
function NavCount({
  screen,
  count,
  vertical,
}: {
  /** None in the copy of the row of the top bar, which is not marked for the tests. */
  screen: string | undefined;
  count: NonNullable<NavItem['count']>;
  vertical: boolean;
}) {
  const { language } = useLanguage();
  const list = useAnyList(count.path, { filter: count.filter, page: { limit: 1 }, meta: ['aggregates'], aggregate: ['count'] });
  const value = Number((list.data && aggregateValues(list.data)?.count) ?? 0);
  if (!value) return null;
  return (
    <span
      data-bz={screen === undefined ? undefined : `count:${screen}`}
      data-value={value}
      className={cn(
        'ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
        vertical
          ? 'bg-sidebar-accent text-sidebar-accent-foreground group-aria-[current=page]:bg-sidebar-primary group-aria-[current=page]:text-sidebar-primary-foreground group-data-[state=collapsed]/sidebar:absolute group-data-[state=collapsed]/sidebar:top-1.5 group-data-[state=collapsed]/sidebar:right-1.5 group-data-[state=collapsed]/sidebar:size-2 group-data-[state=collapsed]/sidebar:min-w-0 group-data-[state=collapsed]/sidebar:bg-sidebar-primary group-data-[state=collapsed]/sidebar:p-0 group-data-[state=collapsed]/sidebar:text-[0px]'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {formatNumber(value, language)}
    </span>
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

/**
 * The session: in the sidebar and its drawer the plate of the user (the circle of his initials,
 * his name and its `detail`, the logout as an icon), in the top bar his name and the logout;
 * without his name the logout alone. In a rail the plate is the circle over the logout.
 */
function Session({ session, compact = false }: { session: ShellSession; compact?: boolean }) {
  const { t } = useLanguage();
  const letters = initials(session.user);
  if (!compact && session.user !== undefined) {
    return (
      <div
        data-slot="sidebar-user"
        className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl bg-nav-active py-2 pr-2 pl-2.5 shadow-(--shadow-nav-active) group-data-[state=collapsed]/sidebar:grid-cols-[2rem] group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-1"
      >
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground"
        >
          {letters ?? <UserRound className="size-4" />}
        </span>
        <span className="grid min-w-0 group-data-[state=collapsed]/sidebar:sr-only">
          <span
            title={typeof session.user === 'string' ? session.user : undefined}
            className="truncate text-[13px] font-semibold text-sidebar-accent-foreground"
          >
            {session.user}
          </span>
          {session.detail !== undefined && (
            <span className="truncate text-xs text-sidebar-muted-foreground">{session.detail}</span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-bz="action:logout"
          title={t('shell.logout')}
          className="text-sidebar-foreground/80"
          onClick={session.onLogout}
        >
          <LogOut />
          <span className="sr-only">{t('shell.logout')}</span>
        </Button>
      </div>
    );
  }
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
        // its name in a rail, where only its icon is seen
        title={t('shell.logout')}
        className={cn('text-muted-foreground', !compact && 'ml-auto')}
        onClick={session.onLogout}
      >
        <LogOut />
        <span className="group-data-[state=collapsed]/sidebar:sr-only">{t('shell.logout')}</span>
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
    <Button
      type="button"
      size="sm"
      data-bz="action:sign-in"
      title={t('shell.sign_in')}
      className={cn(!compact && 'w-full')}
      onClick={signIn}
    >
      <LogIn />
      <span className="group-data-[state=collapsed]/sidebar:sr-only">{t('shell.sign_in')}</span>
    </Button>
  );
}

/** The drawer of the navigation on a phone; closed when the route changes. */
function Drawer({
  title,
  brand,
  items,
  session,
  signIn,
  side,
}: {
  title: ReactNode;
  brand: BrandMark | null;
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
        <SheetContent data-slot="sidebar" side={side} className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-14 justify-center border-b border-sidebar-border px-4">
            <SheetTitle>
              <Brand title={title} mark={brand} />
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
export function AppShell({
  title,
  navigation = THEME.navigation,
  brand = THEME.brand,
  items,
  session = null,
  signIn,
  tools,
  children,
}: AppShellProps) {
  const wide = useWide();
  const links = useMemo(() => navLinks(items), [items]);
  const [chosen, setChosen] = useState(storedRail);
  const roomy = useSyncExternalStore(subscribeRoomy, () => typeof window.matchMedia !== 'function' || window.matchMedia(ROOMY).matches);
  const collapsed = chosen ?? !roomy;
  const { t } = useLanguage();
  if (navigation === 'topbar') {
    return (
      <ShellContext value={navigation}>
        <div className="flex min-h-dvh flex-col [--bleed:1rem] [--sticky-top:4rem] md:[--bleed:var(--space-page-x)]">
          <SkipLink />
          <header className="sticky top-0 z-30 h-16 border-b bg-background">
            <div className="flex h-full w-full items-center gap-6 px-4 md:px-(--space-page-x)">
              <Brand title={title} mark={brand} />
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
                  <Drawer title={title} brand={brand} items={items} session={session} signIn={signIn} side="right" />
                </div>
              </div>
            </div>
          </header>
          <main id={CONTENT} tabIndex={-1} className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-8 outline-none md:px-(--space-page-x) md:py-12">
            <ItemsContext value={links}>{children}</ItemsContext>
          </main>
          <Toaster />
        </div>
      </ShellContext>
    );
  }
  return (
    <ShellContext value={navigation}>
      <div
        className={cn(
          'min-h-dvh [--bleed:1rem] [--sticky-top:3.5rem] md:grid md:[--bleed:var(--space-page-x)] md:[--sticky-top:4rem]',
          collapsed ? 'md:grid-cols-[4.25rem_minmax(0,1fr)]' : 'md:grid-cols-[15rem_minmax(0,1fr)]',
        )}
      >
        <SkipLink />
        {/* a rail (`data-state="collapsed"`): the icons of the links with their labels in their
            titles, the mark of the brand, the tools in a column and the circle of the user */}
        <aside
          data-slot="sidebar"
          data-state={collapsed ? 'collapsed' : 'expanded'}
          className="group/sidebar sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
        >
          <div className="flex h-16 shrink-0 items-center px-5 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0 group-data-[state=collapsed]/sidebar:[&_[data-slot=brand-name]]:sr-only">
            <Brand title={title} mark={brand} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <RailContext value={collapsed}>
              <Navigation items={items} />
            </RailContext>
          </div>
          {/* the foot: the toggles and the tools of the product on a row that wraps, the
              session on a row of its own under them, so that neither pushes the other out */}
          <div className="grid gap-2 border-t border-sidebar-border p-3 group-data-[state=collapsed]/sidebar:justify-items-center group-data-[state=collapsed]/sidebar:px-1.5">
            <div
              data-slot="sidebar-tools"
              className="flex flex-wrap items-center gap-1 group-data-[state=collapsed]/sidebar:flex-col"
            >
              <ColorModeToggle className="text-muted-foreground" />
              <LanguageToggle className="text-muted-foreground" />
              {wide && tools}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t(collapsed ? 'shell.expand' : 'shell.collapse')}
                aria-expanded={!collapsed}
                title={t(collapsed ? 'shell.expand' : 'shell.collapse')}
                className="ml-auto text-muted-foreground group-data-[state=collapsed]/sidebar:ml-0"
                onClick={() => {
                  storeRail(!collapsed);
                  setChosen(!collapsed);
                }}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </div>
            <Account session={session} signIn={signIn} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden">
            <Drawer title={title} brand={brand} items={items} session={session} signIn={signIn} side="left" />
            <Brand title={title} mark={brand} />
            <div className="ml-auto flex items-center gap-1">
              {!wide && tools}
              <LanguageToggle />
              <ColorModeToggle />
            </div>
          </header>
          <main id={CONTENT} tabIndex={-1} className="min-w-0 flex-1 px-(--bleed) pt-(--space-section) pb-(--space-page-y) outline-none">
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
  /**
   * The place of the tools of a list in the header of the screen (`toolbar="header"` of
   * `ResourceList`), `data-slot="screen-tools"`: null without a header.
   */
  tools: HTMLElement | null;
  /**
   * The caption beside the title (`caption`, `data-slot="screen-caption"`), where a list puts the
   * number of its items (`count` of `ResourceList`): null without a header.
   */
  caption: HTMLElement | null;
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
   * (`xl`), its label after an arrow below; beside its list (`ListCardLayout`, `split`) the
   * screen closes back to it (`action:close`, Escape).
   */
  parent?: ScreenParent;
  /** Under the title: what the screen is for. */
  description?: ReactNode;
  /** Beside the title, smaller: a fact of the screen, such as the day of today of a dashboard. */
  caption?: ReactNode;
  /** Next to the title: the actions of the screen. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The link back to the parent of a screen: its label, after an arrow below `xl`, and a chevron
 * before the title of the screen (none on a screen that its card heads).
 */
function Breadcrumb({ parent, titled }: { parent: ScreenParent; titled: boolean }) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t('screen.breadcrumb')} className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
      <Link
        to={parent.to}
        data-bz={`nav:${parent.screen}`}
        className="-ml-2 inline-flex h-9 items-center gap-1 rounded-md px-2 outline-none pointer-coarse:min-h-11 hover:bg-accent hover:text-foreground focus-visible:ring-focus xl:ml-0 xl:h-auto xl:px-1.5 xl:py-1"
      >
        <ArrowLeft className="size-4 xl:hidden" aria-hidden="true" />
        <span>{parent.label}</span>
      </Link>
      {titled && <ChevronRight className="hidden size-4 opacity-60 xl:block" aria-hidden="true" />}
    </nav>
  );
}

/**
 * A screen of the specs: `screen:<id>`, its header (the link back to its parent, the title with
 * its caption, the tools of its list and the actions; in a working application it stays at the
 * top while the screen scrolls, `--sticky-top` high), its description and its content.
 */
export function Screen({ id, title, parent, description, caption, actions, children }: ScreenProps) {
  const navigation = useContext(ShellContext);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [tools, setTools] = useState<HTMLElement | null>(null);
  const [captionPlace, setCaptionPlace] = useState<HTMLElement | null>(null);
  const [pages, setPages] = useState(0);
  const claim = useCallback((open: boolean) => {
    setPages((count) => count + (open ? 1 : -1));
  }, []);
  const titled = title !== undefined;
  const page = useMemo(
    () => ({ target, claim, titled, tools, caption: captionPlace }),
    [target, claim, titled, tools, captionPlace],
  );
  // the header sticks under the top of the page with the sidebar, never under a top bar
  const sticky = navigation !== 'topbar';
  const portal = THEME.preset === 'portal';
  const { t } = useLanguage();
  const navigate = useNavigate();
  // beside its list, closed back to it, by Escape too unless a page of it (a form) is open or a
  // dialog, a menu or a field took the key
  const beside = useBesideList();
  const closes = beside && parent !== undefined ? parent.to : undefined;
  // beside its list, whose title is the `h1` of the page, under it
  const Heading = beside ? 'h2' : 'h1';
  // the title of the page: that of the screen before that of the product (of index.html)
  useEffect(() => {
    if (typeof title !== 'string') return;
    const product = document.title;
    document.title = `${title} · ${product}`;
    return () => {
      document.title = product;
    };
  }, [title]);
  useEffect(() => {
    if (closes === undefined || pages > 0) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) void navigate(closes);
    };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
    };
  }, [closes, pages, navigate]);
  return (
    <section data-bz={`screen:${id}`} className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-(--space-section)">
      <PageContext value={page}>
        {/* `contents`: the header is laid out in the section, which it sticks in */}
        <div className={pages > 0 ? 'hidden' : 'contents'}>
          {(title !== undefined || parent !== undefined || caption !== undefined || actions !== undefined) && (
            <header
              data-slot="screen-header"
              className={cn(
                'flex flex-wrap items-center justify-between gap-4',
                // the air under the sticky header: the ring of a focused control is never under it
                sticky &&
                  '-mx-(--bleed) px-(--bleed) md:sticky md:border-b md:top-0 md:z-20 md:mt-[calc(var(--screen-lift,var(--space-section))*-1)] md:mb-3 md:h-(--sticky-top) md:flex-nowrap md:bg-background',
              )}
            >
              <div className="flex min-w-0 items-center gap-1">
                {parent !== undefined && <Breadcrumb parent={parent} titled={titled} />}
                <div className="flex min-w-0 items-baseline gap-3">
                  {title !== undefined && (
                    <Heading
                      title={typeof title === 'string' ? title : undefined}
                      className={cn(
                        'min-w-0 truncate font-heading',
                        portal ? 'text-2xl md:text-3xl' : 'text-xl',
                      )}
                    >
                      {title}
                    </Heading>
                  )}
                  <p
                    ref={setCaptionPlace}
                    data-slot="screen-caption"
                    className="shrink-0 text-sm whitespace-nowrap text-muted-foreground tabular-nums empty:hidden"
                  >
                    {caption}
                  </p>
                </div>
              </div>
              {/* the search, the view and the actions of a list (`toolbar="header"`) at the end, a row of
                  their own under the title on a phone */}
              <div
                ref={setTools}
                data-slot="screen-tools"
                className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-3 empty:hidden max-md:basis-full md:flex-1 md:flex-nowrap"
              />
              {actions !== undefined && <div className="ml-auto flex shrink-0 flex-wrap gap-2">{actions}</div>}
              {closes !== undefined && (
                <Button asChild variant="ghost" size="icon" className="-mr-2 ml-auto">
                  <Link to={closes} data-bz="action:close" aria-label={t('action.close')} title={t('action.close')}>
                    <X aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </header>
          )}
          {description !== undefined && (
            <p
              className={cn(
                'text-muted-foreground',
                portal ? 'text-lg' : 'text-sm',
                // right under the title, not a section of its own; under the line of a sticky
                // header at the air of the content, never against the line
                title !== undefined && (sticky ? '-mt-3 md:mt-0' : '-mt-4'),
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
