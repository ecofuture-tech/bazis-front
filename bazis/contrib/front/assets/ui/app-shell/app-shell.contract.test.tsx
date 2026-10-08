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
// `aria-current="page"`), `screen:<id>`, the logout `action:logout` with a session only, the
// color mode, the tools of the product mounted once; and the list with its card (`ListCardLayout`), side by side or one at a time.
// Keep it passing when the component is changed.

import { fireEvent, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { THEME } from '@/bazis/generated/theme';
import { AppShell, ListCardLayout, Screen, setColorMode } from '@/bazis/ui/app-shell';
import { Backend, renderWithBazis } from '@/bazis/ui/testing';

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
