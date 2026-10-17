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

// The contract of a figure of a dashboard: `tile:<id>` counting the items of a filter with a
// list of one item and its pagination (`data-value` once loaded), its states
// (`state:loading`, `state:loaded`, `state:error`, `state:forbidden`), opened by a click
// anywhere on it. Keep it passing when the component is changed.

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Filter } from '@/bazis/client';
import { StatCard } from '@/bazis/ui/stat-card';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, resource } from '@/bazis/ui/testing';

function Icon({ className }: { className?: string }) {
  return <svg data-bz="icon:item" className={className} />;
}

describe('StatCard', () => {
  it('is loading, then counts the items of its filter', async () => {
    const pending = new Backend().hold('GET', ITEMS);
    const { unmount } = renderWithBazis(<StatCard id="all" path={ITEMS as never} label="All" />, pending);
    const tile = screen.getByTestId('tile:all');
    expect(within(tile).getByTestId('state:loading').getAttribute('aria-busy')).toBe('true');
    expect(tile.getAttribute('data-value')).toBeNull();
    unmount();

    const server = new Backend().on('GET', ITEMS, listDocument([resource('a')], { count: 1234 }));
    renderWithBazis(
      <StatCard id="done" path={ITEMS as never} filter={Filter.where('done', true)} label="Done" tone="success" icon={Icon} />,
      server,
    );
    const loaded = within(await screen.findByTestId('tile:done')).findByTestId('state:loaded');
    expect((await loaded).textContent).toBe((1234).toLocaleString('en'));
    expect(screen.getByTestId('tile:done').getAttribute('data-value')).toBe('1234');
    // one item of the list and its pagination, filtered
    const [request] = server.requests('GET').map((it) => decodeURIComponent(it));
    expect(request).toContain('filter=done=true');
    expect(request).toContain('page[limit]=1');
    expect(request).toContain('meta=pagination');
    // the icon in the soft color of its tone
    expect(within(screen.getByTestId('tile:done')).getByTestId('icon:item').parentElement?.className).toContain('bg-success-soft');
  });

  it('marks a forbidden list and an error', async () => {
    const forbidden = renderWithBazis(
      <StatCard id="all" path={ITEMS as never} label="All" />,
      new Backend().on('GET', ITEMS, errors(403), 403),
    );
    expect(await within(screen.getByTestId('tile:all')).findByTestId('state:forbidden')).toBeTruthy();
    forbidden.unmount();
    renderWithBazis(<StatCard id="all" path={ITEMS as never} label="All" />, new Backend().on('GET', ITEMS, errors(500), 500));
    expect(await within(screen.getByTestId('tile:all')).findByTestId('state:error')).toBeTruthy();
  });

  it('opens what it counts by a click on the tile, named by its label', async () => {
    const onOpen = vi.fn();
    renderWithBazis(
      <StatCard id="all" path={ITEMS as never} label="All the items" onOpen={onOpen} />,
      new Backend().on('GET', ITEMS, listDocument([])),
    );
    const open = screen.getByRole('button', { name: 'All the items' });
    expect(screen.getByTestId('tile:all').contains(open)).toBe(true);
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByTestId('tile:all').getAttribute('data-value')).toBe('0');
    });
  });

  it('is not a button without onOpen', () => {
    renderWithBazis(<StatCard id="all" path={ITEMS as never} label="All" />, new Backend().hold('GET', ITEMS));
    expect(screen.queryByRole('button')).toBeNull();
  });
});
