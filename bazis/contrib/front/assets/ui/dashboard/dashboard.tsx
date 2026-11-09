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

// The dashboard of a product (`primitive: dashboard` of the specs, its home): the day of today
// (`today`, beside its title), the tiles of the numbers (`tile:<id>`), the links to the other screens of the navigation (`link:<screen>`,
// once the backend allows them), the charts (`chart:<id>` of
// `@/bazis/ui/charts`, an optional asset) and the last items of a route set
// (`recent:<id>`, a row `row:<id>` with a cell `cell:<field>` each). Its title is the header of
// a working screen, the hero of a portal (`preset` of the theme): never a path of the API or
// the name of a resource. Laid out in focus (`focus`, `layout: focus` of the specs), a chart is
// large beside the tiles as a rail, the other charts and the last items in a row under them.
// A tile, a chart or the last items of a route set that the backend
// does not let the user view are not shown to him (`Viewable`): the money of a clinic on the
// home of its receptionist, not on that of its doctor; with `requires: {can: 'add'}` a part is
// shown to those who may add an item, as the link of the navigation is: the tile "New" of a
// dispatcher, not of a master.

import { ChevronRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import type { Filter } from '@/bazis/client';
import { THEME } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import { useCan, type ListPath } from '@/bazis/react';
import { Allowed, Screen, useNavItems, type NavItem } from '@/bazis/ui/app-shell';
import { ItemValue, useAnyList, useListFields, type FieldDisplay } from '@/bazis/ui/resource';
import { StatCard, type StatCardProps } from '@/bazis/ui/stat-card';
import { queryState, SkeletonLines, StatePanel } from '@/bazis/ui/state-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CARD = 'surface text-card-foreground';
/** A row of the focus: its parts one under the other, beside each other on a wide screen; hidden with none shown. */
const ROW = 'flex flex-col gap-4 not-has-[>:not(:empty)]:hidden xl:flex-row xl:gap-5';
/**
 * The rail of the tiles, a row each with a line between the rows: one column beside the chart in
 * focus on a wide screen, two otherwise (the last of an odd number of tiles taking its row).
 */
const RAIL = cn(
  'surface grid min-w-0 grid-cols-2 py-2 empty:hidden xl:flex-1',
  '*:border-line-6 *:not-first:border-t *:nth-2:border-t-0 *:last:odd:col-span-2',
  'xl:[[data-slot=dashboard-focus]:not(:empty)+&]:auto-rows-fr xl:[[data-slot=dashboard-focus]:not(:empty)+&]:grid-cols-1',
  'xl:[[data-slot=dashboard-focus]:not(:empty)+&]:*:nth-2:border-t xl:[[data-slot=dashboard-focus]:not(:empty)+&]:*:last:odd:col-span-1',
);
const FOCUS = 'outline-none focus-visible:ring-focus';

/** What the backend must let the user do with the items of a part for it to be shown (`requires` of the specs). */
type Requirement = 'view' | 'add';

/** A part of a dashboard that is shown to the users who may add an item (`requires.can`), not only view them. */
export interface DashboardPart {
  requires?: { can: Requirement };
}

export interface RecentListProps {
  /** The id of the list in the specs: `recent:<id>`. */
  id: string;
  /** The route set of its items (`ROUTES` of the contract). */
  path: ListPath;
  label: ReactNode;
  /** The fields it shows, the first as the title of a row. */
  columns: readonly string[];
  /** Its order: the last created first (`['-dt_created']`), say. */
  sort?: readonly string[] | undefined;
  /** The number of its items: 5 by default. */
  limit?: number;
  filter?: Filter | undefined;
  /** How a field is shown (`display` of the entity of the specs). */
  display?: Readonly<Record<string, FieldDisplay>>;
  /** Opens an item (`open` of the specs): a click on its row. */
  onOpen?: ((id: string) => void) | undefined;
  className?: string;
}

// the hook with the plain path of a part: the screens pass the typed paths of their contract
const useAnyCan = useCan as unknown as (path: string, action: Requirement) => boolean | undefined;

/**
 * A part of a dashboard once the backend lets the user view the items of its route set, and add
 * one too with `can: 'add'` (`useCan(path, can)`): its tile and its last items read the list,
 * which a user who may only add is refused. Nothing when it does not, its loading state until
 * it tells.
 */
export function Viewable({ path, can = 'view', children }: { path: ListPath; can?: Requirement; children: ReactNode }): ReactNode {
  const allowed = [useAnyCan(path, 'view'), useAnyCan(path, can)];
  if (allowed.includes(false)) return null;
  if (allowed.includes(undefined)) return <StatePanel state="loading" skeleton={<Skeleton className="h-28 w-full rounded-xl" />} />;
  return children;
}

/** The last items of a route set: a row each, its first field as its title, one chip of `chips`. */
export function RecentList({
  id,
  path,
  label,
  columns,
  sort,
  limit = 5,
  filter,
  display = {},
  onOpen,
  className,
}: RecentListProps) {
  const fields = useListFields(path);
  const list = useAnyList(path, { ...(filter ? { filter } : {}), ...(sort ? { sort } : {}), page: { limit } });
  const rows = list.data?.data ?? [];
  const [first, ...rest] = columns;
  return (
    <section data-bz={`recent:${id}`} className={cn(CARD, 'grid grid-cols-[minmax(0,1fr)] content-start gap-3 p-(--space-card)', className)}>
      <h2 className="font-eyebrow text-muted-foreground">{label}</h2>
      <StatePanel
        inline
        state={queryState(list, rows.length === 0)}
        error={list.error}
        skeleton={<SkeletonLines lines={Math.min(limit, 5)} />}
      >
        <ul className="-mx-2 grid grid-cols-[minmax(0,1fr)]">
          {rows.map((row) => {
            const cells = (
              <>
                {first !== undefined && (
                  <span data-bz={`cell:${first}`} className="min-w-0 flex-[1_1_12rem] font-medium wrap-anywhere">
                    <ItemValue item={row} name={first} fields={fields} display={display[first]} chips={1} />
                  </span>
                )}
                {rest.map((name) => (
                  // a text of the item wraps, a word too long for the row breaks; a date stays whole
                  <span key={name} data-bz={`cell:${name}`} className="min-w-0 text-sm break-words text-muted-foreground">
                    <ItemValue item={row} name={name} fields={fields} display={display[name]} chips={1} />
                  </span>
                ))}
              </>
            );
            const layout = 'flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-left';
            return (
              // a line between the rows
              <li key={row.id} data-bz={`row:${row.id}`} className="border-b border-line-6 last:border-b-0">
                {onOpen ? (
                  <button
                    type="button"
                    className={cn(layout, FOCUS, 'transition-colors hover:bg-muted/60')}
                    onClick={() => {
                      onOpen(row.id);
                    }}
                  >
                    {cells}
                  </button>
                ) : (
                  <div className={layout}>{cells}</div>
                )}
              </li>
            );
          })}
        </ul>
      </StatePanel>
    </section>
  );
}

/** The day of today in the language of the product: `Monday, 2 November`, its first letter a capital. */
function Today() {
  const { language } = useLanguage();
  const day = new Date().toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <span data-bz="today" className="inline-block first-letter:uppercase">
      {day}
    </span>
  );
}

/** A link to a screen: its icon and its label. */
function QuickLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      data-bz={`link:${item.screen}`}
      className={cn(
        CARD,
        FOCUS,
        'group flex items-center gap-3 p-4 transition-shadow hover:shadow-(--shadow-lift-2)',
      )}
    >
      {Icon && (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink"
        >
          <Icon className="size-4" />
        </span>
      )}
      <span title={typeof item.label === 'string' ? item.label : undefined} className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

export interface DashboardProps {
  /** The id of the screen in the specs: `screen:<id>`; `home` by default. */
  id?: string;
  title?: ReactNode;
  /** What the product is for (`summary` of the product, under the title of a hero). */
  description?: ReactNode;
  /** The actions of the screen, such as the forms that create an item (`action:<id>`). */
  actions?: ReactNode;
  /** The title, the description and the actions as a hero: a portal (`preset` of the theme) by default. */
  hero?: boolean;
  /** The day of today beside the title (`caption` of `Screen`; under it in a hero, `today`): `Monday, 2 November`. */
  today?: boolean;
  /** What the screen shows before its parts (after the hero and the day), such as the extension of a generated screen. */
  before?: ReactNode;
  tiles?: readonly (StatCardProps & DashboardPart)[];
  /**
   * The links to the screens, the items of the navigation of `AppShell` by default: all but
   * the dashboard itself, each once the backend allows what it `requires`; none with `[]`.
   */
  links?: readonly NavItem[];
  /** The charts: `StatusChart` and `TimeChart` of `@/bazis/ui/charts`, each in `Viewable`. */
  charts?: ReactNode;
  /**
   * The chart in focus (`layout: focus` of the specs, a `TimeChart` with `hero` in `Viewable`):
   * large beside the tiles, a rail of rows (`layout="rail"` of `StatCard`), with the other
   * charts in a column beside the last items under them; one column on a narrow screen.
   */
  focus?: ReactNode;
  recent?: readonly (RecentListProps & DashboardPart)[];
  /**
   * What the screen shows after its parts, such as the create forms of its actions: in the
   * screen, so that a form composed as a page takes its place.
   */
  children?: ReactNode;
}

/** The home of a product: its numbers, its links, its charts and its last items, in this order. */
export function Dashboard({
  id = 'home',
  title,
  description,
  actions,
  hero = THEME.preset === 'portal',
  today = false,
  before,
  tiles = [],
  links,
  charts,
  focus,
  recent = [],
  children,
}: DashboardProps) {
  const { t } = useLanguage();
  const linksId = useId();
  const navigation = useNavItems();
  const shown = (links ?? navigation).filter((it) => it.screen !== id);
  const day = today ? <Today /> : undefined;
  const header = hero ? {} : { title, description, actions, caption: day };
  const cards = (layout: 'card' | 'rail') =>
    tiles.map(({ requires, ...it }) => (
      <Viewable key={it.id} path={it.path} can={requires?.can}>
        <StatCard {...it} layout={layout} />
      </Viewable>
    ));
  const lists = recent.map(({ requires, ...it }) => (
    <Viewable key={it.id} path={it.path} can={requires?.can}>
      <RecentList {...it} />
    </Viewable>
  ));
  return (
    <Screen id={id} {...header}>
      {/* the dashboard is shown at once, its parts with the states of their lists: a screen of
          links only has a state too, which the scenarios wait for */}
      <div data-bz="state:loaded" className="contents">
        {hero && (title !== undefined || description !== undefined || actions !== undefined || day !== undefined) && (
          <header
            data-slot="hero"
            className="surface grid gap-4 rounded-2xl bg-none bg-primary-soft/40 px-6 py-10 md:px-10 md:py-14"
          >
            {title !== undefined && (
              <h1 className="font-heading text-3xl md:text-4xl">{title}</h1>
            )}
            {day !== undefined && <p className="-mt-2 text-sm font-medium text-muted-foreground">{day}</p>}
            {description !== undefined && <p className="max-w-2xl text-lg text-muted-foreground">{description}</p>}
            {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
          </header>
        )}
        {before}
        {focus === undefined ? (
          tiles.length > 0 && (
            // on a phone two columns, the last tile of an odd number of them (those the user views)
            // taking the row: never a hole beside it
            <div className="grid grid-cols-2 gap-3 max-sm:*:last:odd:col-span-2 sm:gap-4 xl:grid-cols-4">{cards('card')}</div>
          )
        ) : (
          // two rows whose parts share the width (the chart in focus two thirds, the rail one; the
          // charts one third, the last items two): a part that the user may not view is empty and
          // hidden, and the others of its row take its place; a row with nothing shown is hidden
          <div className="grid gap-4 xl:gap-5">
            <div className={ROW}>
              <div data-slot="dashboard-focus" className="grid min-w-0 empty:hidden xl:flex-[2]">
                {focus}
              </div>
              {tiles.length > 0 && <div className={RAIL}>{cards('rail')}</div>}
            </div>
            <div className={ROW}>
              {charts !== undefined && (
                // as many columns of charts as their width takes: one beside the last items
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] content-start gap-4 empty:hidden xl:flex-1">
                  {charts}
                </div>
              )}
              {recent.length > 0 && <div className="grid min-w-0 content-start gap-4 empty:hidden xl:flex-[2]">{lists}</div>}
            </div>
          </div>
        )}
        {shown.length > 0 && (
          <nav aria-labelledby={linksId} className="grid gap-3">
            <h2 id={linksId} className="text-sm font-medium text-muted-foreground">
              {t('dashboard.links')}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((item) => (
                <Allowed key={item.screen} requirement={item.requires}>
                  {/* one track no wider than the column: a long label is cut, never the page widened */}
                  <li className="grid grid-cols-[minmax(0,1fr)]">
                    <QuickLink item={item} />
                  </li>
                </Allowed>
              ))}
            </ul>
          </nav>
        )}
        {focus === undefined && charts !== undefined && <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">{charts}</div>}
        {focus === undefined && recent.length > 0 && (
          <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-4', recent.length > 1 && 'xl:grid-cols-2')}>{lists}</div>
        )}
      </div>
      {children}
    </Screen>
  );
}
