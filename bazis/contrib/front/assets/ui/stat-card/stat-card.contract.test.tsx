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

// The contract of a figure of a dashboard: `tile:<id>` counting the items of a filter, or
// showing an aggregate of a field of them (`value`), with the aggregates of a list of one item
// (`data-value` once loaded: a number, or a date), its states (`state:loading`, `state:loaded`,
// `state:error`, `state:forbidden`), opened by a click anywhere on it. Keep it passing when the
// component is changed.

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Filter } from '@/bazis/client';
import { StatCard } from '@/bazis/ui/stat-card';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, resource } from '@/bazis/ui/testing';

/** A list of one item with the aggregates of its items (`meta.aggregates` without a group). */
const totals = (values: Readonly<Record<string, unknown>>) => listDocument([resource('a')], { meta: { aggregates: values } });

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

    const server = new Backend().on('GET', ITEMS, totals({ count: 12345 }));
    renderWithBazis(
      <StatCard id="done" path={ITEMS as never} filter={Filter.where('done', true)} label="Done" tone="success" icon={Icon} />,
      server,
    );
    const loaded = within(await screen.findByTestId('tile:done')).findByTestId('state:loaded');
    expect((await loaded).textContent).toBe('12,345');
    expect(screen.getByTestId('tile:done').getAttribute('data-value')).toBe('12345');
    // one item of the list and the count of its aggregates, filtered
    const [request] = server.requests('GET').map((it) => decodeURIComponent(it));
    expect(request).toContain('filter=done=true');
    expect(request).toContain('page[limit]=1');
    expect(request).toContain('meta=aggregates&aggregate=count');
    // the icon in the soft color of its tone
    expect(within(screen.getByTestId('tile:done')).getByTestId('icon:item').parentElement?.className).toContain('bg-success-soft');
  });

  it('shows the sum of a field of the items as its field is shown, a decimal with its digits', async () => {
    const server = new Backend().on('GET', ITEMS, totals({ 'sum(amount)': '12345.50' }));
    renderWithBazis(
      <StatCard id="paid" path={ITEMS as never} label="Paid" value={{ sum: 'amount' }} display={{ amount: { currency: 'USD' } }} />,
      server,
    );
    const loaded = await within(await screen.findByTestId('tile:paid')).findByTestId('state:loaded');
    expect(loaded.textContent).toBe('$12,345.50');
    expect(screen.getByTestId('tile:paid').getAttribute('data-value')).toBe('12345.5');
    expect(server.requests('GET').map((it) => decodeURIComponent(it))[0]).toContain('meta=aggregates&aggregate=sum(amount)');
  });

  it('rounds an average, shows the date of a maximum, and no value over no item', async () => {
    const average = renderWithBazis(
      <StatCard id="mean" path={ITEMS as never} label="Mean" value={{ avg: 'count' }} />,
      new Backend().on('GET', ITEMS, totals({ 'avg(count)': '2.3333333333333333' })),
    );
    expect((await within(screen.getByTestId('tile:mean')).findByTestId('state:loaded')).textContent).toBe('2.333');
    average.unmount();

    const latest = renderWithBazis(
      <StatCard id="latest" path={ITEMS as never} label="Latest" value={{ max: 'due' }} />,
      new Backend().on('GET', ITEMS, totals({ 'max(due)': '2026-10-08' })),
    );
    expect((await within(screen.getByTestId('tile:latest')).findByTestId('state:loaded')).textContent).toBe('Oct 8, 2026');
    expect(screen.getByTestId('tile:latest').getAttribute('data-value')).toBe('2026-10-08');
    latest.unmount();

    renderWithBazis(
      <StatCard id="none" path={ITEMS as never} label="None" value={{ min: 'count' }} />,
      new Backend().on('GET', ITEMS, totals({ 'min(count)': null })),
    );
    expect((await within(screen.getByTestId('tile:none')).findByTestId('state:loaded')).textContent).toBe('—');
    expect(screen.getByTestId('tile:none').getAttribute('data-value')).toBeNull();
  });

  it('shows the error of an aggregate that the backend refuses', async () => {
    const refused = { errors: [{ status: 400, code: 'ERR_AGGREGATE', detail: 'The field is not a number', source: { pointer: '/query/aggregate' } }] };
    renderWithBazis(
      <StatCard id="paid" path={ITEMS as never} label="Paid" value={{ sum: 'title' }} />,
      new Backend().on('GET', ITEMS, refused, 400),
    );
    const failed = await within(screen.getByTestId('tile:paid')).findByTestId('state:error');
    expect(failed.textContent).toContain('The field is not a number');
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
      new Backend().on('GET', ITEMS, listDocument([], { meta: { aggregates: { count: 0 } } })),
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
