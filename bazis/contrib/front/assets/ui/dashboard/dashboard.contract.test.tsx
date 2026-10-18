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

// The contract of the dashboard: `screen:<id>` with its title as a header or a hero, the tiles
// `tile:<id>`, the links to the other screens `link:<screen>` (those of the navigation of
// `AppShell` by default, once the backend allows what they require), the charts it is given, the last
// items `recent:<id>` (a row `row:<id>` with a cell `cell:<field>` each, sorted and limited,
// opened by a click, with the states of its list), a state of its own (`state:loaded`, a
// dashboard of links only), what it is given before its parts, and its children in its screen
// (where a form page takes the place of its parts). Keep it passing when the component is changed.

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppShell, useScreenPage } from '@/bazis/ui/app-shell';
import { Dashboard, RecentList } from '@/bazis/ui/dashboard';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

function Icon({ className }: { className?: string }) {
  return <svg data-bz="icon:items" className={className} />;
}

const schema = runtimeSchema(
  {
    title: { attribute: { type: 'string', title: 'Title' } },
    count: { attribute: { type: 'integer', title: 'Count' } },
  },
  { list: true },
);

describe('Dashboard', () => {
  it('shows its title in the header of a working screen, or as a hero', () => {
    const { unmount } = renderWithBazis(
      <Dashboard hero={false} title="Overview" description="What is going on" actions={<button type="button">New</button>} />,
      new Backend(),
    );
    const home = screen.getByTestId('screen:home');
    expect(within(home).getByRole('heading', { level: 1 }).textContent).toBe('Overview');
    expect(home.querySelector('[data-slot="hero"]')).toBeNull();
    // a dashboard of links only has a state, which the scenarios wait for
    expect(within(home).getByTestId('state:loaded')).toBeTruthy();
    unmount();

    renderWithBazis(
      <Dashboard id="start" hero title="Welcome" description="The library of the town" actions={<button type="button">Join</button>} />,
      new Backend(),
    );
    const hero = screen.getByTestId('screen:start').querySelector('[data-slot="hero"]');
    expect(hero?.querySelector('h1')?.textContent).toBe('Welcome');
    expect(hero?.textContent).toContain('The library of the town');
    expect(within(hero as HTMLElement).getByRole('button', { name: 'Join' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Join' })).toBeNull();
  });

  it('shows its tiles and the charts it is given', async () => {
    renderWithBazis(
      <Dashboard
        hero={false}
        tiles={[
          { id: 'all', path: ITEMS as never, label: 'All' },
          { id: 'mine', path: ITEMS as never, label: 'Mine', icon: Icon, tone: 'info' },
        ]}
        charts={<div data-bz="chart:by-status" />}
      />,
      new Backend().on('GET', ITEMS, listDocument([], { count: 4 })),
    );
    await waitFor(() => {
      expect(screen.getByTestId('tile:mine').getAttribute('data-value')).toBe('4');
    });
    expect(screen.getByTestId('tile:all')).toBeTruthy();
    expect(screen.getByTestId('chart:by-status')).toBeTruthy();
  });

  it('links the other screens of the navigation, each once the backend allows it', async () => {
    const links = [
      { screen: 'home', label: 'Home', to: '/', end: true },
      { screen: 'about', label: 'About', to: '/about' },
      { screen: 'item-list', label: 'Items', to: '/items', icon: Icon, requires: { path: ITEMS } },
      { screen: 'item-new', label: 'New item', to: '/items/new', requires: { path: ITEMS, can: 'add' as const } },
    ];
    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .on('GET', `${ITEMS}schema_create/`, errors(403), 403)
    renderWithBazis(<Dashboard hero={false} links={links} />, server);
    // not the dashboard itself; a link without a requirement at once
    expect(screen.queryByTestId('link:home')).toBeNull();
    expect(screen.getByTestId('link:about').getAttribute('href')).toBe('/about');
    const items = await screen.findByTestId('link:item-list');
    expect(items.getAttribute('href')).toBe('/items');
    expect(within(items).getByTestId('icon:items')).toBeTruthy();
    // the user may not add one
    await waitFor(() => {
      expect(server.requests('GET')).toContain(`GET ${ITEMS}schema_create/`);
    });
    expect(screen.queryByTestId('link:item-new')).toBeNull();
  });

  it('links the screens of the navigation of the layout by default', () => {
    const items = [
      { screen: 'home', label: 'Home', to: '/', end: true },
      { screen: 'about', label: 'About', to: '/about' },
    ];
    renderWithBazis(
      <AppShell title="Product" items={items}>
        <Dashboard hero={false} />
      </AppShell>,
      new Backend(),
    );
    const home = screen.getByTestId('screen:home');
    expect(within(home).getByTestId('link:about').getAttribute('href')).toBe('/about');
    expect(within(home).queryByTestId('link:home')).toBeNull();
  });

  it('shows its children in its screen, where a form composed as a page takes its place', () => {
    function InScreen() {
      return <p data-bz="in-screen">{useScreenPage() === null ? 'outside' : 'inside'}</p>;
    }
    renderWithBazis(
      <Dashboard hero={false} title="Home">
        <InScreen />
      </Dashboard>,
      new Backend(),
    );
    expect(within(screen.getByTestId('screen:home')).getByTestId('in-screen').textContent).toBe('inside');
  });

  it('shows what it is given before its parts, after its hero', () => {
    renderWithBazis(
      <Dashboard hero title="Home" before={<p data-bz="before">Before</p>} tiles={[{ id: 'all', path: ITEMS as never, label: 'All' }]} />,
      new Backend(),
    );
    const home = screen.getByTestId('screen:home');
    const before = within(home).getByTestId('before');
    expect(home.querySelector('[data-slot="hero"]')?.compareDocumentPosition(before)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before.compareDocumentPosition(within(home).getByTestId('tile:all'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe('RecentList', () => {
  it('shows the last items, sorted and limited, a row each with its cells, opened by a click', async () => {
    const onOpen = vi.fn();
    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .on('GET', ITEMS, listDocument([resource('a', { title: 'Alpha', count: 3 }), resource('b', { title: 'Beta', count: 1 })]));
    renderWithBazis(
      <RecentList id="last" path={ITEMS as never} label="Last" columns={['title', 'count']} sort={['-count']} limit={3} onOpen={onOpen} />,
      server,
    );
    const recent = screen.getByTestId('recent:last');
    expect(within(recent).getByTestId('state:loading')).toBeTruthy();
    const row = await within(recent).findByTestId('row:a');
    expect(within(row).getByTestId('cell:title').textContent).toBe('Alpha');
    expect(within(row).getByTestId('cell:count').textContent).toBe('3');
    expect(within(recent).getByTestId('row:b')).toBeTruthy();
    const [request] = server.requests('GET').filter((it) => !it.includes('schema_')).map((it) => decodeURIComponent(it));
    expect(request).toContain('sort=-count');
    expect(request).toContain('page[limit]=3');
    fireEvent.click(within(row).getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('shows the rows without a button when it opens nothing, and marks an empty list and an error', async () => {
    const plain = renderWithBazis(
      <RecentList id="last" path={ITEMS as never} label="Last" columns={['title']} />,
      new Backend().on('GET', ITEMS, listDocument([resource('a', { title: 'Alpha' })])),
    );
    expect(await screen.findByTestId('row:a')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    plain.unmount();
    const empty = renderWithBazis(
      <RecentList id="last" path={ITEMS as never} label="Last" columns={['title']} />,
      new Backend().on('GET', ITEMS, listDocument([])),
    );
    expect(await within(screen.getByTestId('recent:last')).findByTestId('state:empty')).toBeTruthy();
    empty.unmount();
    renderWithBazis(
      <RecentList id="last" path={ITEMS as never} label="Last" columns={['title']} />,
      new Backend().on('GET', ITEMS, errors(500), 500),
    );
    expect(await within(screen.getByTestId('recent:last')).findByTestId('state:error')).toBeTruthy();
  });
});
