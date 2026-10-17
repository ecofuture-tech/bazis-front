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

// The dashboard of a product (`primitive: dashboard` of the specs, its home): the tiles of the
// numbers (`tile:<id>`), the links to the other screens of the navigation (`link:<screen>`,
// once the backend allows them), the charts (`chart:<id>` of
// `@/bazis/ui/charts`, an optional asset) and the last items of a route set
// (`recent:<id>`, a row `row:<id>` with a cell `cell:<field>` each). Its title is the header of
// a working screen, the hero of a portal (`preset` of the theme): never a path of the API or
// the name of a resource.

import { ChevronRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import type { Filter } from '@/bazis/client';
import { THEME } from '@/bazis/generated/theme';
import { useLanguage } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import { Allowed, Screen, useNavItems, type NavItem } from '@/bazis/ui/app-shell';
import { ItemValue, useAnyList, useListFields, type FieldDisplay } from '@/bazis/ui/resource';
import { StatCard, type StatCardProps } from '@/bazis/ui/stat-card';
import { queryState, SkeletonLines, StatePanel } from '@/bazis/ui/state-panel';
import { cn } from '@/lib/utils';

const CARD = 'rounded-xl border bg-card text-card-foreground shadow-xs';
const FOCUS = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

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

/** The last items of a route set: a row each, its first field as its title. */
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
    <section data-bz={`recent:${id}`} className={cn(CARD, 'grid content-start gap-3 p-(--space-card)', className)}>
      <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
      <StatePanel
        inline
        state={queryState(list, rows.length === 0)}
        error={list.error}
        skeleton={<SkeletonLines lines={Math.min(limit, 5)} />}
      >
        <ul className="-mx-2 grid">
          {rows.map((row) => {
            const cells = (
              <>
                {first !== undefined && (
                  <span data-bz={`cell:${first}`} className="min-w-0 flex-[1_1_12rem] font-medium break-words">
                    <ItemValue item={row} name={first} fields={fields} display={display[first]} />
                  </span>
                )}
                {rest.map((name) => (
                  <span key={name} data-bz={`cell:${name}`} className="shrink-0 text-sm text-muted-foreground">
                    <ItemValue item={row} name={name} fields={fields} display={display[name]} />
                  </span>
                ))}
              </>
            );
            const layout = 'flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-left pointer-coarse:min-h-11';
            return (
              <li key={row.id} data-bz={`row:${row.id}`}>
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
        'group flex items-center gap-3 p-4 transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md',
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
  tiles?: readonly StatCardProps[];
  /**
   * The links to the screens, the items of the navigation of `AppShell` by default: all but
   * the dashboard itself, each once the backend allows what it `requires`.
   */
  links?: readonly NavItem[];
  /** The charts: `StatusChart` and `TimeChart` of `@/bazis/ui/charts`. */
  charts?: ReactNode;
  recent?: readonly RecentListProps[];
}

/** The home of a product: its numbers, its links, its charts and its last items, in this order. */
export function Dashboard({
  id = 'home',
  title,
  description,
  actions,
  hero = THEME.preset === 'portal',
  tiles = [],
  links,
  charts,
  recent = [],
}: DashboardProps) {
  const { t } = useLanguage();
  const linksId = useId();
  const navigation = useNavItems();
  const shown = (links ?? navigation).filter((it) => it.screen !== id);
  const header = hero ? {} : { title, description, actions };
  return (
    <Screen id={id} {...header}>
      {/* the dashboard is shown at once, its parts with the states of their lists: a screen of
          links only has a state too, which the scenarios wait for */}
      <div data-bz="state:loaded" className="contents">
        {hero && (title !== undefined || description !== undefined || actions !== undefined) && (
          <header
            data-slot="hero"
            className="grid gap-4 rounded-2xl border bg-primary-soft/40 px-6 py-10 md:px-10 md:py-14"
          >
            {title !== undefined && (
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
            )}
            {description !== undefined && <p className="max-w-2xl text-lg text-muted-foreground">{description}</p>}
            {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
          </header>
        )}
        {tiles.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {tiles.map((it) => (
              <StatCard key={it.id} {...it} />
            ))}
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
                  <li className="grid">
                    <QuickLink item={item} />
                  </li>
                </Allowed>
              ))}
            </ul>
          </nav>
        )}
        {charts !== undefined && <div className="grid gap-4 lg:grid-cols-2">{charts}</div>}
        {recent.length > 0 && (
          <div className={cn('grid gap-4', recent.length > 1 && 'xl:grid-cols-2')}>
            {recent.map((it) => (
              <RecentList key={it.id} {...it} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
