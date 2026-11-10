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

// A list and the card of its items (`composition.list_card` of spec/design/theme.yaml): the
// route of the list renders `ListCardLayout` with its screen, and the route of the card is
// its child. `split`: on a wide screen the card is shown next to the list (the list takes
// the whole width while no item is open); `pages`, and a narrow screen: the card in place of
// the list. The list stays mounted under the same element whatever is open, so that it keeps
// its search, filters, sort and page. An item opened from the list while the card of another is
// open replaces that card in the history: Back leaves the list instead of walking its items.

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { UNSAFE_NavigationContext, useLocation, useOutlet, useResolvedPath, type Navigator } from 'react-router';

import { THEME } from '@/bazis/generated/theme';
import { cn } from '@/lib/utils';

export interface ListCardLayoutProps {
  /** The screen of the list. */
  list: ReactNode;
  /** `composition.list_card` of the theme by default. */
  mode?: 'split' | 'pages';
}

const BesideCard = createContext(false);
const BesideList = createContext(false);

/** The width from which a list and its card share the page (`split`): the breakpoint `xl` of Tailwind. */
const SPLIT = '(min-width: 80rem)';

function subscribeSplit(listener: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(SPLIT);
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
}

/**
 * Whether the list is shown next to an open card (`split` on a wide screen): narrow, it
 * shows only its first columns (`compactColumns` of `ResourceList`).
 */
export function useBesideCard(): boolean {
  return useContext(BesideCard);
}

/**
 * Whether the card is shown next to its list (`split` from the breakpoint `xl`): narrow, a
 * list in it (a related list) shows its rows as the cards of a phone, never wider than the card.
 */
export function useBesideList(): boolean {
  const split = useSyncExternalStore(subscribeSplit, () => typeof window.matchMedia === 'function' && window.matchMedia(SPLIT).matches);
  return useContext(BesideList) && split;
}

/**
 * The navigation of the list: while a card is open, going to an item of the list (a child of its
 * path) replaces the open card in the history; the other navigations add an entry as usual.
 */
function ReplacingCard({ open, children }: { open: boolean; children: ReactNode }) {
  const navigation = useContext(UNSAFE_NavigationContext);
  const { pathname: base } = useResolvedPath('.');
  const value = useMemo(() => {
    const { basename, navigator } = navigation;
    if (!open) return navigation;
    const prefix = `${basename === '/' ? '' : basename}${base === '/' ? '' : base}/`;
    const push: Navigator['push'] = (to, state, options) => {
      const path = typeof to === 'string' ? to : (to.pathname ?? '');
      const item = path.startsWith(prefix) && !path.slice(prefix.length).includes('/');
      if (item) navigator.replace(to, state, options);
      else navigator.push(to, state, options);
    };
    // the navigator of the router under it (its getters too), with this push
    return { ...navigation, navigator: Object.assign(Object.create(navigator) as Navigator, { push }) };
  }, [navigation, base, open]);
  return <UNSAFE_NavigationContext value={value}>{children}</UNSAFE_NavigationContext>;
}

/** Focuses the first heading in an element, once it shows (the card reads its item), unless the user moved the focus meanwhile. */
function focusHeading(area: HTMLElement) {
  const focus = (heading: HTMLElement) => {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  };
  const found = area.querySelector<HTMLElement>('h1, h2');
  if (found) {
    focus(found);
    return;
  }
  const from = document.activeElement;
  const observer = new MutationObserver(() => {
    const heading = area.querySelector<HTMLElement>('h1, h2');
    if (!heading) return;
    observer.disconnect();
    if (document.activeElement === from || document.activeElement === document.body) focus(heading);
  });
  observer.observe(area, { childList: true, subtree: true });
}

/** The screen of a list with the screen of its card (the child route). */
export function ListCardLayout({ list, mode = THEME.composition.list_card }: ListCardLayoutProps) {
  const card = useOutlet();
  const open = card !== null;
  const split = mode === 'split';
  const { pathname } = useLocation();
  const listArea = useRef<HTMLDivElement>(null);
  const cardArea = useRef<HTMLDivElement>(null);
  const shown = useRef(pathname);
  // the focus follows the user from the list to a card (its heading, once it shows) and back to the
  // row of the card that closes; never on the first render (a link opened in a new tab)
  useEffect(() => {
    const before = shown.current;
    shown.current = pathname;
    if (before === pathname) return;
    if (open) {
      if (cardArea.current) focusHeading(cardArea.current);
      return;
    }
    const row = `row:${before.split('/').filter(Boolean).pop() ?? ''}`;
    const rows = listArea.current?.querySelectorAll<HTMLElement>('[data-bz^="row:"]') ?? [];
    [...rows].find((it) => it.dataset.bz === row)?.focus();
  }, [pathname, open]);
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] gap-(--space-section)',
        // the two areas meet at the line between them, each with the room of the edge of the page
        // on that side: the lines of their headers run from the edge of the page to it, as one line
        split && open && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-0 2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]',
      )}
    >
      <div ref={listArea} className={cn('min-w-0', open && (split ? 'hidden xl:block xl:self-start xl:pr-(--space-page-x)' : 'hidden'))}>
        <BesideCard value={split && open}><ReplacingCard open={open}>{list}</ReplacingCard></BesideCard>
      </div>
      {open && (
        <div
          ref={cardArea}
          className={cn(
            'min-w-0',
            // the line between the areas as high as the window and the list: the area is as high as
            // the window from the top of the page to its bottom (no scroll of the page of its own)
            split && 'xl:-mt-(--space-section) xl:-mr-(--space-page-x) xl:-mb-(--space-page-y) xl:min-h-dvh xl:border-l',
          )}
        >
          <div
            className={cn(
              split &&
                // its header sticks at the top of its own scroll area: not lifted into the padding of the page;
                // room at its end, where the shadows of the lifted blocks of the card are drawn (a scroll area
                // clips them)
                'xl:sticky xl:top-0 xl:max-h-dvh xl:overflow-y-auto xl:px-(--space-page-x) xl:pb-(--space-page-y) xl:[--screen-lift:0px]',
            )}
          >
            <BesideList value={split}>{card}</BesideList>
          </div>
        </div>
      )}
    </div>
  );
}
