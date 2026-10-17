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

// The contract of the empty state: `state:empty` with the icon of the entity, its title, its
// hint and its actions (`action:<id>`). Keep it passing when the component is changed.

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from '@/bazis/ui/empty-state';
import { Backend, renderWithBazis } from '@/bazis/ui/testing';

function Icon({ className }: { className?: string }) {
  return <svg data-bz="icon:item" className={className} />;
}

describe('EmptyState', () => {
  it('shows the icon of the entity, its texts and its actions', () => {
    const create = vi.fn();
    renderWithBazis(
      <EmptyState icon={Icon} title="No items" description="Create the first one.">
        <button type="button" data-bz="action:create" onClick={create} />
      </EmptyState>,
      new Backend(),
    );
    const state = screen.getByTestId('state:empty');
    expect(state.getAttribute('role')).toBe('status');
    expect(within(state).getByTestId('icon:item')).toBeTruthy();
    expect(state.textContent).toContain('No items');
    expect(state.textContent).toContain('Create the first one.');
    fireEvent.click(within(state).getByTestId('action:create'));
    expect(create).toHaveBeenCalledOnce();
  });

  it('has a title and a hint without them, and no actions', () => {
    renderWithBazis(<EmptyState />, new Backend());
    const state = screen.getByTestId('state:empty');
    expect(state.querySelectorAll('p')).toHaveLength(2);
    expect([...state.querySelectorAll('p')].every((it) => it.textContent)).toBe(true);
    expect(state.querySelector('button')).toBeNull();
  });
});
