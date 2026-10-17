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

// The contract of the charts: `chart:<id>` with the states of its lists, a count of a list of
// one item per status (`status=<id>` and the filter of the chart) or per period of a date
// field (`<field>__gte`, `<field>__lt`, in the format of the field), each value
// `value:<key>` with its number in `data-value`, drawn in the colors of the series of the
// theme. recharts is replaced by a fake that records what it is asked to draw: jsdom draws
// no chart. Keep it passing when the component is changed.

import { render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Filter } from '@/bazis/client';
import { weekStart } from '@/bazis/i18n';
import { Chart, StatusChart, TimeChart } from '@/bazis/ui/charts';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, runtimeSchema } from '@/bazis/ui/testing';

interface Drawn {
  data?: readonly { key: string; value: number; fill: string }[];
  children?: ReactNode;
}

vi.mock('recharts', () => {
  const chart =
    (name: string) =>
    ({ data, children }: Drawn) => (
      <div
        data-bz={`drawn:${name}`}
        data-points={data ? JSON.stringify(data.map((it) => [it.key, it.value, it.fill])) : undefined}
      >
        {children}
      </div>
    );
  const nothing = () => null;
  return {
    ResponsiveContainer: ({ children }: Drawn) => <div>{children}</div>,
    PieChart: chart('pie-chart'),
    BarChart: chart('bar-chart'),
    LineChart: chart('line-chart'),
    Pie: chart('pie'),
    Bar: nothing,
    Line: nothing,
    CartesianGrid: nothing,
    Tooltip: nothing,
    XAxis: nothing,
    YAxis: nothing,
  };
});

/** What a fake chart was asked to draw: `[key, value, color]` per value. */
async function drawn(name: string): Promise<unknown> {
  return JSON.parse((await screen.findByTestId(`drawn:${name}`)).getAttribute('data-points') ?? 'null') as unknown;
}

/** The requests of the lists, decoded (the values of a filter are encoded twice in it). */
function lists(server: Backend): string[] {
  return server
    .requests('GET')
    .filter((it) => !it.includes('schema_'))
    .map((it) => decodeURIComponent(decodeURIComponent(decodeURIComponent(it))));
}

describe('Chart', () => {
  it('shows its values: a ring with its legend, in the colors of the series of the theme', async () => {
    render(
      <Chart
        id="shares"
        label="Shares"
        kind="donut"
        values={[
          { key: 'a', label: 'A', value: 2 },
          { key: 'b', label: 'B', value: 5 },
        ]}
      />,
    );
    const chart = screen.getByTestId('chart:shares');
    expect(within(chart).getByTestId('value:b').getAttribute('data-value')).toBe('5');
    expect(within(chart).getByTestId('value:a').className).not.toContain('sr-only');
    expect(await drawn('pie')).toEqual([
      ['a', 2, 'var(--chart-1)'],
      ['b', 5, 'var(--chart-2)'],
    ]);
  });

  it('draws bars or a line in one color, its values for the screen readers', async () => {
    const values = [
      { key: 'x', label: 'X', value: 1 },
      { key: 'y', label: 'Y', value: 0 },
    ];
    const { unmount } = render(<Chart id="bars" label="Bars" values={values} />);
    expect(await drawn('bar-chart')).toEqual([
      ['x', 1, 'var(--chart-1)'],
      ['y', 0, 'var(--chart-1)'],
    ]);
    expect(screen.getByTestId('value:x').parentElement?.className).toContain('sr-only');
    unmount();
    render(<Chart id="line" label="Line" kind="line" values={values} />);
    expect(await drawn('line-chart')).toEqual([
      ['x', 1, 'var(--chart-1)'],
      ['y', 0, 'var(--chart-1)'],
    ]);
  });

  it('is empty when every value is 0, and shows the state of what it shows', () => {
    const { unmount } = render(<Chart id="none" label="None" values={[{ key: 'a', label: 'A', value: 0 }]} />);
    expect(within(screen.getByTestId('chart:none')).getByTestId('state:empty')).toBeTruthy();
    unmount();
    render(<Chart id="busy" label="Busy" values={[]} state="loading" />);
    expect(within(screen.getByTestId('chart:busy')).getByTestId('state:loading')).toBeTruthy();
  });
});

describe('StatusChart', () => {
  it('counts the items of each status with a list of one item, within its filter', async () => {
    const ui = (
      <StatusChart
        id="by-status"
        path={ITEMS as never}
        label="By status"
        statuses={['draft', 'done']}
        filter={Filter.where('owner', 'me')}
      />
    );
    const pending = new Backend().hold('GET', ITEMS);
    const { unmount } = renderWithBazis(ui, pending);
    expect(within(screen.getByTestId('chart:by-status')).getByTestId('state:loading')).toBeTruthy();
    await waitFor(() => {
      expect(pending.requests('GET')).toHaveLength(2);
    });
    const [draft, done] = pending.requests('GET');
    unmount();
    expect(lists(pending)).toEqual([
      expect.stringContaining('filter=owner=me&status=draft'),
      expect.stringContaining('filter=owner=me&status=done'),
    ]);
    for (const it of lists(pending)) {
      expect(it).toContain('page[limit]=1');
      expect(it).toContain('meta=pagination');
    }

    const server = new Backend()
      .on('GET', (draft ?? '').slice(4), listDocument([], { count: 3 }))
      .on('GET', (done ?? '').slice(4), listDocument([], { count: 1 }));
    renderWithBazis(ui, server);
    const chart = await screen.findByTestId('chart:by-status');
    await waitFor(() => {
      expect(within(chart).getByTestId('value:draft').getAttribute('data-value')).toBe('3');
    });
    expect(within(chart).getByTestId('value:done').getAttribute('data-value')).toBe('1');
    // a ring by default, a color per status; the id of a status the contract does not name
    expect(within(chart).getByTestId('value:draft').textContent).toContain('draft');
    expect(await drawn('pie')).toEqual([
      ['draft', 3, 'var(--chart-1)'],
      ['done', 1, 'var(--chart-2)'],
    ]);
  });

  it('marks the error of a list, a forbidden one, and a model without statuses as empty', async () => {
    const failed = renderWithBazis(
      <StatusChart id="s" path={ITEMS as never} label="S" statuses={['draft']} />,
      new Backend().on('GET', ITEMS, errors(500), 500),
    );
    expect(await within(screen.getByTestId('chart:s')).findByTestId('state:error')).toBeTruthy();
    failed.unmount();
    const forbidden = renderWithBazis(
      <StatusChart id="s" path={ITEMS as never} label="S" statuses={['draft']} />,
      new Backend().on('GET', ITEMS, errors(403), 403),
    );
    expect(await within(screen.getByTestId('chart:s')).findByTestId('state:forbidden')).toBeTruthy();
    forbidden.unmount();
    // the route set of the tests is no statusy model of the contract
    const server = new Backend();
    renderWithBazis(<StatusChart id="s" path={ITEMS as never} label="S" />, server);
    expect(within(screen.getByTestId('chart:s')).getByTestId('state:empty')).toBeTruthy();
    expect(server.requests('GET')).toEqual([]);
  });
});

describe('TimeChart', () => {
  const schema = runtimeSchema(
    {
      due: { attribute: { type: 'string', format: 'date' } },
      dt_created: { attribute: { type: 'string', format: 'date-time' } },
    },
    { list: true },
  );
  const now = new Date(2026, 9, 15, 12, 30);

  it('counts the items of each period of a date to the current one, after the schema of the field', async () => {
    const held = new Backend().hold('GET', `${ITEMS}schema_list/`).on('GET', ITEMS, listDocument([]));
    const { unmount } = renderWithBazis(
      <TimeChart id="due" path={ITEMS as never} field="due" bucket="month" last={3} label="Due" now={now} />,
      held,
    );
    // the format of the bounds is that of the field: no count before its schema
    expect(within(screen.getByTestId('chart:due')).getByTestId('state:loading')).toBeTruthy();
    expect(lists(held)).toEqual([]);
    unmount();

    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .on('GET', ITEMS, listDocument([], { count: 2 }));
    renderWithBazis(
      <TimeChart
        id="due"
        path={ITEMS as never}
        field="due"
        bucket="month"
        last={3}
        label="Due"
        now={now}
        kind="line"
      />,
      server,
    );
    const chart = await screen.findByTestId('chart:due');
    await waitFor(() => {
      expect(within(chart).getByTestId('value:2026-10-01').getAttribute('data-value')).toBe('2');
    });
    expect(
      within(chart)
        .getAllByTestId(/^value:/)
        .map((it) => it.getAttribute('data-bz')),
    ).toEqual(['value:2026-08-01', 'value:2026-09-01', 'value:2026-10-01']);
    const requests = lists(server);
    expect(requests).toHaveLength(3);
    expect(requests[2]).toContain('filter=due__gte=2026-10-01&due__lt=2026-11-01');
    expect(await drawn('line-chart')).toHaveLength(3);
  });

  it('bounds a date-time by the first moment of a day in the time zone of the browser, a week from its first day', async () => {
    const server = new Backend().on('GET', `${ITEMS}schema_list/`, schema).on('GET', ITEMS, listDocument([]));
    renderWithBazis(
      <TimeChart
        id="created"
        path={ITEMS as never}
        field="dt_created"
        label="Created"
        now={now}
        last={2}
        filter={Filter.where('owner', 'me')}
      />,
      server,
    );
    const chart = await screen.findByTestId('chart:created');
    // all zero: empty
    expect(await within(chart).findByTestId('state:empty')).toBeTruthy();
    const start = new Date(2026, 9, 15);
    while (start.getDay() !== weekStart('en') % 7) start.setDate(start.getDate() - 1);
    const next = new Date(start);
    next.setDate(next.getDate() + 7);
    const previous = new Date(start);
    previous.setDate(previous.getDate() - 7);
    expect(lists(server)).toEqual([
      expect.stringContaining(
        `filter=owner=me&dt_created__gte=${previous.toISOString()}&dt_created__lt=${start.toISOString()}&`,
      ),
      expect.stringContaining(
        `filter=owner=me&dt_created__gte=${start.toISOString()}&dt_created__lt=${next.toISOString()}&`,
      ),
    ]);
  });
});
