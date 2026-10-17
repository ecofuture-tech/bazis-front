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

// The contract of the calendar: `calendar:<entity>` with the days it shows in `data-from` and
// `data-to` (whole weeks of a month or a week, from the first day of the week of the
// language), moved by `action:previous-period`, `action:next-period` and `action:today`, the
// states of its list (one list of the period, `<field>__gte` and `<field>__lt` in the format
// of the field), a day `day:<YYYY-MM-DD>` with the number of all its items in `data-count`,
// its first items `row:<id>` with their cells `cell:<field>`, the list of the selected day
// with all of them (only there at the width of a phone: no hidden copy of a row), an item
// opened by a click, and the action that creates an item given the selected day. Keep it
// passing when the component is changed.

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { weekStart } from '@/bazis/i18n';
import { ResourceCalendar } from '@/bazis/ui/resource-calendar';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, resource, runtimeSchema } from '@/bazis/ui/testing';

const schema = runtimeSchema(
  {
    title: { attribute: { type: 'string', title: 'Title' } },
    due: { attribute: { type: 'string', format: 'date', title: 'Due' } },
    until: { attribute: { type: 'string', format: 'date', title: 'Until' } },
    at: { attribute: { type: 'string', format: 'date-time', title: 'At' } },
  },
  { list: true },
);

const now = new Date(2026, 9, 15, 12, 30);

/** The first day of the week of a day in English. */
function weekOf(day: Date): Date {
  const start = new Date(day);
  while (start.getDay() !== weekStart('en') % 7) start.setDate(start.getDate() - 1);
  return start;
}

function iso(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The requests of the lists, decoded (the values of a filter are encoded twice in it). */
function lists(server: Backend): string[] {
  return server
    .requests('GET')
    .filter((it) => !it.includes('schema_'))
    .map((it) => decodeURIComponent(decodeURIComponent(decodeURIComponent(it))));
}

const item = (id: string, attributes: Record<string, unknown>) => resource(id, { title: `Task ${id}`, ...attributes });

describe('ResourceCalendar', () => {
  it('is loading, then shows the days of the month of today with their items, and the list of today', async () => {
    const pending = renderWithBazis(
      <ResourceCalendar path={ITEMS as never} entity="item" field="due" label={['title']} now={now} />,
      new Backend().on('GET', `${ITEMS}schema_list/`, schema).hold('GET', ITEMS),
    );
    expect(within(screen.getByTestId('calendar:item')).getByTestId('state:loading')).toBeTruthy();
    pending.unmount();

    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .on(
        'GET',
        ITEMS,
        listDocument([
          item('a', { due: '2026-10-15' }),
          ...['b', 'c', 'd', 'e'].map((id) => item(id, { due: '2026-10-16' })),
        ]),
      );
    const onOpen = vi.fn();
    renderWithBazis(
      <ResourceCalendar path={ITEMS as never} entity="item" field="due" label={['title']} onOpen={onOpen} now={now} />,
      server,
    );
    const calendar = await screen.findByTestId('calendar:item');
    const from = weekOf(new Date(2026, 9, 1));
    const to = new Date(weekOf(new Date(2026, 9, 31)));
    to.setDate(to.getDate() + 6);
    expect(calendar.getAttribute('data-from')).toBe(iso(from));
    expect(calendar.getAttribute('data-to')).toBe(iso(to));
    const busy = await within(calendar).findByTestId('day:2026-10-16');
    // every item of the day, its first ones in it, all of them in the list of a selected day
    expect(busy.getAttribute('data-count')).toBe('4');
    expect(within(busy).getAllByTestId(/^row:/)).toHaveLength(3);
    expect(within(calendar).getByTestId('day:2026-10-14').getAttribute('data-count')).toBe('0');
    const day = within(calendar).getByTestId('day:2026-10-15');
    expect(within(within(day).getByTestId('row:a')).getByTestId('cell:title').textContent).toBe('Task a');
    // the list of today, then that of the day selected
    expect(within(calendar).getAllByTestId('row:a')).toHaveLength(2);
    expect(within(calendar).queryAllByTestId('row:e')).toHaveLength(0);
    fireEvent.click(within(busy).getAllByRole('button')[0] as HTMLElement);
    expect(within(calendar).getAllByTestId('row:e')).toHaveLength(1);
    fireEvent.click(within(within(day).getByTestId('row:a')).getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('a');
    // one list of the days shown, in the format of the field
    const after = new Date(to);
    after.setDate(after.getDate() + 1);
    const [request] = lists(server);
    expect(request).toContain(`filter=due__gte=${iso(from)}&due__lt=${iso(after)}`);
    expect(request).toContain('page[limit]=500');
  });

  it('shows a month at the width of a phone with the rows of the selected day only, each once', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    try {
      const server = new Backend()
        .on('GET', `${ITEMS}schema_list/`, schema)
        .on('GET', ITEMS, listDocument([item('a', { due: '2026-10-15' }), item('b', { due: '2026-10-16' })]));
      renderWithBazis(<ResourceCalendar path={ITEMS as never} entity="item" field="due" label={['title']} now={now} />, server);
      const calendar = await screen.findByTestId('calendar:item');
      const busy = await within(calendar).findByTestId('day:2026-10-16');
      // the day has the number of its items, not their rows
      expect(busy.getAttribute('data-count')).toBe('1');
      expect(within(busy).queryAllByTestId(/^row:/)).toHaveLength(0);
      expect(within(calendar).getAllByTestId(/^row:/).map((it) => it.dataset.bz)).toEqual(['row:a']);
      fireEvent.click(within(busy).getByRole('button'));
      expect(within(calendar).getAllByTestId(/^row:/).map((it) => it.dataset.bz)).toEqual(['row:b']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('moves to the previous and the next month, and back to today', async () => {
    const server = new Backend().on('GET', `${ITEMS}schema_list/`, schema).on('GET', ITEMS, listDocument([]));
    renderWithBazis(<ResourceCalendar path={ITEMS as never} entity="item" field="due" now={now} />, server);
    const calendar = screen.getByTestId('calendar:item');
    // an empty period still shows its days
    expect(await within(calendar).findByTestId('state:empty')).toBeTruthy();
    expect(within(calendar).getByTestId('day:2026-10-15').getAttribute('data-count')).toBe('0');
    fireEvent.click(within(calendar).getByTestId('action:next-period'));
    expect(calendar.getAttribute('data-from')).toBe(iso(weekOf(new Date(2026, 10, 1))));
    await within(calendar).findByTestId('day:2026-11-30');
    fireEvent.click(within(calendar).getByTestId('action:previous-period'));
    fireEvent.click(within(calendar).getByTestId('action:previous-period'));
    expect(calendar.getAttribute('data-from')).toBe(iso(weekOf(new Date(2026, 8, 1))));
    fireEvent.click(within(calendar).getByTestId('action:today'));
    expect(calendar.getAttribute('data-from')).toBe(iso(weekOf(new Date(2026, 9, 1))));
    await waitFor(() => {
      expect(lists(server).length).toBeGreaterThanOrEqual(3);
    });
  });

  it('shows a week, the days of a date-time in the time zone of the browser', async () => {
    const at = new Date(2026, 9, 15, 23, 45);
    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .on('GET', ITEMS, listDocument([item('a', { at: at.toISOString() })]));
    renderWithBazis(
      <ResourceCalendar path={ITEMS as never} entity="item" field="at" label={['title']} views={['week', 'month']} now={now} />,
      server,
    );
    const calendar = screen.getByTestId('calendar:item');
    const start = weekOf(new Date(2026, 9, 15));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    expect(calendar.getAttribute('data-from')).toBe(iso(start));
    expect(calendar.getAttribute('data-to')).toBe(iso(end));
    await waitFor(() => {
      expect(within(calendar).getByTestId('day:2026-10-15').getAttribute('data-count')).toBe('1');
    });
    const after = new Date(end);
    after.setDate(after.getDate() + 1);
    expect(lists(server)[0]).toContain(`filter=at__gte=${start.toISOString()}&at__lt=${after.toISOString()}`);
    fireEvent.click(within(calendar).getByTestId('view:month'));
    expect(calendar.getAttribute('data-from')).toBe(iso(weekOf(new Date(2026, 9, 1))));
  });

  it('shows an item that spans days on each of them', async () => {
    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .on('GET', ITEMS, listDocument([item('a', { due: '2026-10-14', until: '2026-10-16' })]));
    renderWithBazis(<ResourceCalendar path={ITEMS as never} entity="item" field="due" end="until" now={now} />, server);
    const calendar = screen.getByTestId('calendar:item');
    await waitFor(() => {
      expect(within(calendar).getByTestId('day:2026-10-16').getAttribute('data-count')).toBe('1');
    });
    expect(within(calendar).getByTestId('day:2026-10-14').getAttribute('data-count')).toBe('1');
    expect(within(calendar).getByTestId('day:2026-10-17').getAttribute('data-count')).toBe('0');
    // an item that starts before the days shown and ends in them
    expect(lists(server)[0]).toMatch(/filter=\(due__gte=[\d-]+\|until__gte=[\d-]+\)&due__lt=/);
  });

  it('gives the action that creates an item the selected day, when the user may create', async () => {
    const onAdd = vi.fn();
    const add = { id: 'add', label: 'Add', onAdd };
    const forbidden = renderWithBazis(
      <ResourceCalendar path={ITEMS as never} entity="item" field="due" add={add} now={now} />,
      new Backend().on('GET', `${ITEMS}schema_list/`, schema).on('GET', ITEMS, listDocument([], { meta: { for_create: false } })),
    );
    expect(await screen.findByTestId('state:empty')).toBeTruthy();
    expect(screen.queryByTestId('action:add')).toBeNull();
    forbidden.unmount();
    renderWithBazis(
      <ResourceCalendar path={ITEMS as never} entity="item" field="due" add={add} now={now} />,
      new Backend().on('GET', `${ITEMS}schema_list/`, schema).on('GET', ITEMS, listDocument([], { meta: { for_create: true } })),
    );
    fireEvent.click(await screen.findByTestId('action:add'));
    expect(onAdd).toHaveBeenLastCalledWith('2026-10-15');
    fireEvent.click(within(screen.getByTestId('day:2026-10-20')).getAllByRole('button')[0] as HTMLElement);
    fireEvent.click(screen.getByTestId('action:add'));
    expect(onAdd).toHaveBeenLastCalledWith('2026-10-20');
  });

  it('marks an error and a forbidden list', async () => {
    const failed = renderWithBazis(
      <ResourceCalendar path={ITEMS as never} entity="item" field="due" now={now} />,
      new Backend().on('GET', `${ITEMS}schema_list/`, schema).on('GET', ITEMS, errors(500), 500),
    );
    expect(await within(screen.getByTestId('calendar:item')).findByTestId('state:error')).toBeTruthy();
    failed.unmount();
    renderWithBazis(
      <ResourceCalendar path={ITEMS as never} entity="item" field="due" now={now} />,
      new Backend().on('GET', `${ITEMS}schema_list/`, schema).on('GET', ITEMS, errors(403), 403),
    );
    expect(await within(screen.getByTestId('calendar:item')).findByTestId('state:forbidden')).toBeTruthy();
  });
});
