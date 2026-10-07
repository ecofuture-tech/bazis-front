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
// color mode; and the list with its card (`ListCardLayout`), side by side or one at a time.
// Keep it passing when the component is changed.

import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
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
    expect(screen.queryByTestId('screen:item-list')).toBeNull();
    expect(screen.getByTestId('screen:item-card')).toBeTruthy();
  });

  for (const mode of ['split', 'pages'] as const) {
    it(`shows the list without an item (${mode})`, () => {
      layout(mode, '/items');
      expect(screen.getByTestId('screen:item-list')).toBeTruthy();
      expect(screen.queryByTestId('screen:item-card')).toBeNull();
    });
  }
});
