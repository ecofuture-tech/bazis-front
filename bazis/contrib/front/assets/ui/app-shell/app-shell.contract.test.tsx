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
// `aria-current="page"`), `screen:<id>`, the logout `action:logout` with a session only.
// Keep it passing when the component is changed.

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppShell, Screen } from '@/bazis/ui/app-shell';
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
});
