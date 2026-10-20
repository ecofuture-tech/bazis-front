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

// The contract of the charts: `chart:<id>` with the state of its query, the aggregates of a list
// of one item (`meta=aggregates`, the filter of the chart) grouped by status (`group=status`) or
// by the days or the months of a date field within the periods (`<field>__gte`, `<field>__lt`,
// in the format of the field), a count or a measure of a field (`value`), each value
// `value:<key>` with its number in `data-value`, drawn in the colors of the series of the
// theme. recharts is replaced by a fake that records what it is asked to draw: jsdom draws
// no chart. Keep it passing when the component is changed.

import { render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Filter } from '@/bazis/client';
import { isoDate, weekStart } from '@/bazis/i18n';
import { Chart, StatusChart, TimeChart } from '@/bazis/ui/charts';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, runtimeSchema } from '@/bazis/ui/testing';

interface Drawn {
  data?: readonly { key: string; value: number; fill: string }[];
  children?: ReactNode;
}

// the tones of the statuses of the theme, whatever those of the product that runs the test
vi.mock('@/bazis/generated/theme', async (original) => {
  const theme = await original<typeof import('@/bazis/generated/theme')>();
  return { ...theme, THEME: { ...theme.THEME, statuses: { draft: 'neutral', done: 'success' } } };
});

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

  it('draws a value of a tone in the color of the tone, the others in the colors of the series', async () => {
    render(
      <Chart
        id="tones"
        label="Tones"
        kind="donut"
        values={[
          { key: 'a', label: 'A', value: 2, tone: 'warning' },
          { key: 'b', label: 'B', value: 5 },
        ]}
      />,
    );
    expect(await drawn('pie')).toEqual([
      ['a', 2, 'var(--color-warning)'],
      ['b', 5, 'var(--chart-2)'],
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

/** A list of one item with the aggregates of its items by group (`meta.aggregates` with `group`). */
const grouped = (groups: readonly { group: string | null; values: Record<string, unknown> }[]) =>
  listDocument([], { meta: { aggregates: groups } });

describe('StatusChart', () => {
  it('counts the items of each status with one query of the aggregates, within its filter', async () => {
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
      expect(pending.requests('GET')).toHaveLength(1);
    });
    unmount();
    expect(lists(pending)).toEqual([
      expect.stringContaining('filter=owner=me&page[limit]=1&meta=aggregates&aggregate=count&group=status'),
    ]);

    // a status without items has no group; one that the chart does not show is left out
    const server = new Backend().on(
      'GET',
      ITEMS,
      grouped([
        { group: 'archived', values: { count: 9 } },
        { group: 'draft', values: { count: 3 } },
      ]),
    );
    renderWithBazis(ui, server);
    const chart = await screen.findByTestId('chart:by-status');
    await waitFor(() => {
      expect(within(chart).getByTestId('value:draft').getAttribute('data-value')).toBe('3');
    });
    expect(within(chart).getByTestId('value:done').getAttribute('data-value')).toBe('0');
    // a ring by default, a status in the color of its tone (`statuses` of the theme, that of its
    // badge); the id of a status the contract does not name
    expect(within(chart).getByTestId('value:draft').textContent).toContain('draft');
    expect(await drawn('pie')).toEqual([
      ['draft', 3, 'var(--color-neutral)'],
      ['done', 0, 'var(--color-success)'],
    ]);
  });

  it('shows the sum or the average of a field of the items of each status', async () => {
    const sum = new Backend().on('GET', ITEMS, grouped([{ group: 'draft', values: { 'sum(hours)': '7.50' } }]));
    const summed = renderWithBazis(
      <StatusChart id="hours" path={ITEMS as never} label="Hours" statuses={['draft']} value={{ sum: 'hours' }} />,
      sum,
    );
    await waitFor(() => {
      expect(within(screen.getByTestId('chart:hours')).getByTestId('value:draft').getAttribute('data-value')).toBe('7.5');
    });
    expect(lists(sum)[0]).toContain('aggregate=sum(hours)&group=status');
    summed.unmount();
    // an average by the sum and the count of the field
    const average = new Backend().on('GET', ITEMS, grouped([{ group: 'draft', values: { 'sum(hours)': '9.00', 'count(hours)': 4 } }]));
    renderWithBazis(<StatusChart id="hours" path={ITEMS as never} label="Hours" statuses={['draft']} value={{ avg: 'hours' }} />, average);
    await waitFor(() => {
      expect(within(screen.getByTestId('chart:hours')).getByTestId('value:draft').getAttribute('data-value')).toBe('2.25');
    });
    expect(lists(average)[0]).toContain('aggregate=sum(hours),count(hours)&group=status');
  });

  it('marks the error of its query with the text of the backend, a forbidden one, and a model without statuses as empty', async () => {
    const refused = {
      errors: [{ status: 400, code: 'ERR_AGGREGATE', detail: 'More than 1000 groups of status', source: { pointer: '/query/group' } }],
    };
    const failed = renderWithBazis(
      <StatusChart id="s" path={ITEMS as never} label="S" statuses={['draft']} />,
      new Backend().on('GET', ITEMS, refused, 400),
    );
    const error = await within(screen.getByTestId('chart:s')).findByTestId('state:error');
    expect(error.textContent).toContain('More than 1000 groups of status');
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

  it('counts the items of each month of a date to the current one, after the schema of the field', async () => {
    const held = new Backend().hold('GET', `${ITEMS}schema_list/`).on('GET', ITEMS, grouped([]));
    const { unmount } = renderWithBazis(
      <TimeChart id="due" path={ITEMS as never} field="due" bucket="month" last={3} label="Due" now={now} />,
      held,
    );
    // the format of the bounds is that of the field: no query before its schema
    expect(within(screen.getByTestId('chart:due')).getByTestId('state:loading')).toBeTruthy();
    expect(lists(held)).toEqual([]);
    unmount();

    const server = new Backend()
      .on('GET', `${ITEMS}schema_list/`, schema)
      .on(
        'GET',
        ITEMS,
        grouped([
          { group: '2026-08-01', values: { count: 1 } },
          { group: '2026-10-01', values: { count: 2 } },
        ]),
      );
    renderWithBazis(
      <TimeChart id="due" path={ITEMS as never} field="due" bucket="month" last={3} label="Due" now={now} kind="line" />,
      server,
    );
    const chart = await screen.findByTestId('chart:due');
    await waitFor(() => {
      expect(within(chart).getByTestId('value:2026-10-01').getAttribute('data-value')).toBe('2');
    });
    expect(
      within(chart)
        .getAllByTestId(/^value:/)
        .map((it) => [it.getAttribute('data-bz'), it.getAttribute('data-value')]),
    ).toEqual([
      ['value:2026-08-01', '1'],
      ['value:2026-09-01', '0'],
      ['value:2026-10-01', '2'],
    ]);
    expect(lists(server)).toEqual([
      expect.stringContaining('filter=due__gte=2026-08-01&due__lt=2026-11-01&page[limit]=1&meta=aggregates&aggregate=count&group=due:month'),
    ]);
    expect(await drawn('line-chart')).toHaveLength(3);
  });

  it('adds up the days of a week from its first day, bounded in the time zone of the browser, and averages a field', async () => {
    const start = new Date(2026, 9, 15);
    while (start.getDay() !== weekStart('en') % 7) start.setDate(start.getDate() - 1);
    const next = new Date(start);
    next.setDate(next.getDate() + 7);
    const previous = new Date(start);
    previous.setDate(previous.getDate() - 7);
    const day = (date: Date, shift: number) => isoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + shift));
    const server = new Backend().on('GET', `${ITEMS}schema_list/`, schema).on(
      'GET',
      ITEMS,
      grouped([
        { group: day(previous, 1), values: { 'sum(hours)': '2.0', 'count(hours)': 1 } },
        { group: day(start, 0), values: { 'sum(hours)': '3.0', 'count(hours)': 2 } },
        { group: day(start, 6), values: { 'sum(hours)': '6.0', 'count(hours)': 2 } },
      ]),
    );
    renderWithBazis(
      <TimeChart
        id="created"
        path={ITEMS as never}
        field="dt_created"
        label="Created"
        now={now}
        last={2}
        filter={Filter.where('owner', 'me')}
        value={{ avg: 'hours' }}
      />,
      server,
    );
    const chart = await screen.findByTestId('chart:created');
    await waitFor(() => {
      expect(within(chart).getByTestId(`value:${isoDate(start)}`).getAttribute('data-value')).toBe('2.25');
    });
    expect(within(chart).getByTestId(`value:${isoDate(previous)}`).getAttribute('data-value')).toBe('2');
    expect(lists(server)).toEqual([
      expect.stringContaining(
        `filter=owner=me&dt_created__gte=${previous.toISOString()}&dt_created__lt=${next.toISOString()}&page[limit]=1` +
          '&meta=aggregates&aggregate=sum(hours),count(hours)&group=dt_created:day',
      ),
    ]);
  });
});
