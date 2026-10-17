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

// The contract of the layout: `nav:<screen>` of the navigation (the current one
// `aria-current="page"`; a link that `requires` a permission only once the backend allows
// it), `screen:<id>`, the logout `action:logout` with a session only, the
// color mode, the language (`action:language`, with more than one language), the tools of the
// product mounted once, the link of a screen back to its parent (`nav:<screen>`); and the list
// with its card (`ListCardLayout`), side by side or one at a time.
// Keep it passing when the component is changed.

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { THEME } from '@/bazis/generated/theme';
import { AppShell, ListCardLayout, Screen, setColorMode } from '@/bazis/ui/app-shell';
import { Backend, errors, ITEMS, renderWithBazis, testLanguages } from '@/bazis/ui/testing';

const items = [
  { screen: 'home', label: 'Home', to: '/', end: true },
  { screen: 'task-list', label: 'Tasks', to: '/tasks' },
];

describe('AppShell', () => {
  for (const navigation of ['sidebar', 'topbar'] as const) {
    it(`renders the navigation as a ${navigation}`, () => {
      const onLogout = vi.fn();
      renderWithBazis(
        <AppShell title="Product" navigation={navigation} items={items} session={{ user: 'manager', onLogout }}>
          <Screen id="task-list" title="Tasks">
            content
          </Screen>
        </AppShell>,
        new Backend(),
        { route: '/tasks' },
      );
      expect(screen.getByTestId('nav:task-list').getAttribute('aria-current')).toBe('page');
      expect(screen.getByTestId('nav:home').getAttribute('aria-current')).toBeNull();
      expect(screen.getByTestId('screen:task-list').textContent).toContain('content');
      expect(screen.getByText('manager')).toBeTruthy();
      fireEvent.click(screen.getByTestId('action:logout'));
      expect(onLogout).toHaveBeenCalledOnce();
    });
  }

  it('shows a link that requires a permission once the backend allows it', async () => {
    const guarded = [
      { screen: 'home', label: 'Home', to: '/', end: true },
      { screen: 'item-list', label: 'Items', to: '/items', requires: { path: ITEMS } },
      { screen: 'item-new', label: 'New item', to: '/items/new', requires: { path: ITEMS, can: 'add' as const } },
      { screen: 'report', label: 'Report', to: '/report', requires: { path: ITEMS, filters: ['done'] } },
      { screen: 'secret', label: 'Secret', to: '/secret', requires: { path: ITEMS, filters: ['secret'] } },
    ];
    const shell = (
      <AppShell title="Product" navigation="sidebar" items={guarded}>
        <Screen id="home">home</Screen>
      </AppShell>
    );
    const pending = renderWithBazis(shell, new Backend().hold('GET', `${ITEMS}schema_list/`));
    // never shown before the backend answers
    expect(screen.getByTestId('nav:home')).toBeTruthy();
    expect(screen.queryByTestId('nav:item-list')).toBeNull();
    pending.unmount();

    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, { title: 'list' })
      .on('GET', `${ITEMS}schema_create/`, errors(403), 403)
      .on('GET', `${ITEMS}route_filter_fields/`, { fields: [{ name: 'done', py_type: 'boolean' }] });
    renderWithBazis(shell, server);
    expect(await screen.findByTestId('nav:item-list')).toBeTruthy();
    // the user may not add one; a report needs the filter field that the backend offers him
    expect(await screen.findByTestId('nav:report')).toBeTruthy();
    await waitFor(() => {
      expect(server.requests('GET')).toContain(`GET ${ITEMS}schema_create/`);
    });
    expect(screen.queryByTestId('nav:item-new')).toBeNull();
    expect(screen.queryByTestId('nav:secret')).toBeNull();
  });

  it('hides the links of a resource that the backend does not let the user view', async () => {
    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, errors(403), 403)
      .on('GET', `${ITEMS}schema_create/`, { title: 'create' });
    const links = [
      ...items,
      { screen: 'item-list', label: 'Items', to: '/items', requires: { path: ITEMS } },
      { screen: 'item-new', label: 'New item', to: '/items/new', requires: { path: ITEMS, can: 'add' as const } },
    ];
    renderWithBazis(
      <AppShell title="Product" navigation="sidebar" items={links}>
        <Screen id="home">home</Screen>
      </AppShell>,
      server,
    );
    await waitFor(() => {
      expect(server.requests('GET')).toContain(`GET ${ITEMS}schema_list/`);
    });
    // each action is asked for on its own
    expect(await screen.findByTestId('nav:item-new')).toBeTruthy();
    expect(screen.getByTestId('nav:task-list')).toBeTruthy();
    expect(screen.queryByTestId('nav:item-list')).toBeNull();
    // no filter fields are read for a link without `filters`
    expect(server.requests('GET')).not.toContain(`GET ${ITEMS}route_filter_fields/`);
  });

  it('switches the language of the interface with more than one language', () => {
    const { unmount } = renderWithBazis(
      <AppShell title="Product" items={items} session={{ onLogout: vi.fn() }}>
        <Screen id="home">home</Screen>
      </AppShell>,
      new Backend(),
    );
    // one language: nothing to switch
    expect(screen.queryByTestId('action:language')).toBeNull();
    unmount();

    const languages = testLanguages('en', 'ru');
    renderWithBazis(
      <AppShell title="Product" items={items} session={{ onLogout: vi.fn() }}>
        <Screen id="home">home</Screen>
      </AppShell>,
      new Backend(),
      { language: languages },
    );
    const toggle = () => screen.getAllByTestId('action:language')[0];
    expect(toggle()?.dataset.value).toBe('en');
    expect(screen.getAllByTestId('action:logout')[0]?.textContent).toBe('Log out');
    act(() => {
      toggle()?.click();
    });
    expect([languages.get(), toggle()?.dataset.value]).toEqual(['ru', 'ru']);
    // the texts of the components follow it
    expect(screen.getAllByTestId('action:logout')[0]?.textContent).toBe('Выйти');
    act(() => {
      toggle()?.click();
    });
    expect(languages.get()).toBe('en');
  });

  it('has no logout without a session', () => {
    renderWithBazis(
      <AppShell title="Product" items={items}>
        <Screen id="home">home</Screen>
      </AppShell>,
      new Backend(),
    );
    expect(screen.getByTestId('screen:home')).toBeTruthy();
    expect(screen.queryByTestId('action:logout')).toBeNull();
  });

  for (const [navigation, wide] of [['sidebar', true], ['sidebar', false], ['topbar', true]] as const) {
    it(`mounts the tools once (${navigation}, ${wide ? 'wide' : 'a phone'})`, () => {
      // the sidebar is shown from the breakpoint `md`, its header on a phone
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('min-width') ? wide : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const mounted = vi.fn();
      function Tool() {
        useEffect(mounted, []);
        return <button type="button" data-bz="action:tool" />;
      }
      try {
        renderWithBazis(
          <AppShell title="Product" navigation={navigation} items={items} tools={<Tool />}>
            <Screen id="home">home</Screen>
          </AppShell>,
          new Backend(),
        );
        expect(screen.getAllByTestId('action:tool')).toHaveLength(1);
        expect(mounted).toHaveBeenCalledOnce();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  }

  it('puts the session under the tools at the foot of the sidebar, which wrap', () => {
    function Tool({ id }: { id: string }) {
      return <button type="button" data-bz={`action:${id}`} />;
    }
    renderWithBazis(
      <AppShell
        title="Product"
        navigation="sidebar"
        items={items}
        session={{ user: 'A user with a long name', onLogout: vi.fn() }}
        tools={
          <>
            <Tool id="live" />
            <Tool id="bell" />
          </>
        }
      >
        <Screen id="home">home</Screen>
      </AppShell>,
      new Backend(),
    );
    const sidebar = screen.getByTestId('action:bell').closest('aside');
    const row = sidebar?.querySelector('[data-slot="sidebar-tools"]');
    if (!sidebar || !row) throw new Error('No foot of the sidebar');
    // the tools and the toggles share a row that wraps; the session is not on it
    expect(row.contains(screen.getByTestId('action:live'))).toBe(true);
    expect(row.className).toContain('flex-wrap');
    const logout = sidebar.querySelector('[data-bz="action:logout"]');
    expect(logout).not.toBeNull();
    expect(row.contains(logout)).toBe(false);
    expect(row.parentElement?.contains(logout)).toBe(true);
  });

  it('lays the header of a screen out in the screen, so that it sticks in it', () => {
    renderWithBazis(
      <AppShell title="Product" navigation="sidebar" items={items}>
        <Screen id="home" title="Home" description="The overview">
          home
        </Screen>
      </AppShell>,
      new Backend(),
    );
    const section = screen.getByTestId('screen:home');
    const header = section.querySelector('header');
    if (header === null) throw new Error('No header');
    // its parent is `display: contents`: the containing block of the sticky header is the
    // screen, not a box of the title alone
    expect(header.parentElement?.className).toBe('contents');
    expect(header.parentElement?.parentElement).toBe(section);
    expect(header.className).toContain('md:sticky');
    expect(header.className).toContain('--screen-lift');
    expect(header.className).toContain('md:h-(--sticky-top)');
    expect(header.textContent).not.toContain('The overview');
  });

  it('links a screen back to the screen it was opened from', () => {
    renderWithBazis(
      <Routes>
        <Route
          path="/tasks/:id"
          element={
            <Screen id="task-card" title="A task" parent={{ screen: 'task-list', label: 'Tasks', to: '/tasks' }}>
              card
            </Screen>
          }
        />
        <Route path="/tasks" element={<Screen id="task-list">list</Screen>} />
      </Routes>,
      new Backend(),
      { route: '/tasks/1' },
    );
    const back = screen.getByTestId('nav:task-list');
    // in the header, before the title, named by the parent also where only its arrow shows
    const header = screen.getByTestId('screen:task-card').querySelector('header');
    expect(header?.contains(back)).toBe(true);
    expect(back.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(back.textContent).toBe('Tasks');
    expect(back.closest('nav')).not.toBeNull();
    fireEvent.click(back);
    expect(screen.getByTestId('screen:task-list')).toBeTruthy();
  });

  it('switches the color mode when the tokens have a dark mode', () => {
    renderWithBazis(
      <AppShell title="Product" items={items}>
        <Screen id="home" title="Home" description="The overview">
          home
        </Screen>
      </AppShell>,
      new Backend(),
    );
    expect(screen.getByTestId('screen:home').textContent).toContain('The overview');
    const toggles = screen.queryAllByRole('button', { name: /^Color mode/ });
    if (!THEME.dark) {
      expect(toggles).toHaveLength(0);
      return;
    }
    expect(toggles.length).toBeGreaterThan(0);
    setColorMode('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    setColorMode('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    setColorMode('system');
  });
});

describe('ListCardLayout', () => {
  function layout(mode: 'split' | 'pages', route: string) {
    renderWithBazis(
      <Routes>
        <Route
          path="/items"
          element={
            <ListCardLayout
              mode={mode}
              list={
                <Screen id="item-list" title="Items">
                  list
                </Screen>
              }
            />
          }
        >
          <Route
            path=":id"
            element={
              <Screen id="item-card" title="Item">
                card
              </Screen>
            }
          />
        </Route>
      </Routes>,
      new Backend(),
      { route },
    );
  }

  it('shows the card next to the list (split)', () => {
    layout('split', '/items/1');
    expect(screen.getByTestId('screen:item-list')).toBeTruthy();
    expect(screen.getByTestId('screen:item-card')).toBeTruthy();
  });

  it('shows the card in place of the list (pages)', () => {
    layout('pages', '/items/1');
    // the list is kept, hidden, with its state
    expect(screen.getByTestId('screen:item-list').closest('.hidden')).not.toBeNull();
    expect(screen.getByTestId('screen:item-card')).toBeTruthy();
  });

  for (const mode of ['split', 'pages'] as const) {
    it(`keeps the state of the list when a card opens and closes (${mode})`, () => {
      let mounted = 0;
      function List() {
        const navigate = useNavigate();
        const [filter, setFilter] = useState('');
        useEffect(() => {
          mounted += 1;
        }, []);
        return (
          <Screen id="item-list" title="Items">
            <input
              aria-label="Filter"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
              }}
            />
            <button type="button" onClick={() => void navigate('/items/1')}>
              open
            </button>
            <button type="button" onClick={() => void navigate('/items')}>
              close
            </button>
          </Screen>
        );
      }
      renderWithBazis(
        <Routes>
          <Route path="/items" element={<ListCardLayout mode={mode} list={<List />} />}>
            <Route
              path=":id"
              element={
                <Screen id="item-card" title="Item">
                  card
                </Screen>
              }
            />
          </Route>
        </Routes>,
        new Backend(),
        { route: '/items' },
      );
      fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'draft' } });
      fireEvent.click(screen.getByText('open'));
      expect(screen.getByTestId('screen:item-card')).toBeTruthy();
      fireEvent.click(screen.getByText('close'));
      expect(screen.queryByTestId('screen:item-card')).toBeNull();
      expect(screen.getByLabelText<HTMLInputElement>('Filter').value).toBe('draft');
      expect(mounted).toBe(1);
    });
  }

  for (const mode of ['split', 'pages'] as const) {
    it(`shows the list without an item (${mode})`, () => {
      layout(mode, '/items');
      expect(screen.getByTestId('screen:item-list')).toBeTruthy();
      expect(screen.queryByTestId('screen:item-card')).toBeNull();
    });
  }
});
