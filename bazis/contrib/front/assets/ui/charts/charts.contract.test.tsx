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
import { isoDate, LanguageProvider, weekStart } from '@/bazis/i18n';
import { Chart, StatusChart, TimeChart } from '@/bazis/ui/charts';
import { Backend, errors, ITEMS, listDocument, renderWithBazis, testLanguages } from '@/bazis/ui/testing';

interface Drawn {
  data?: readonly { key: string; value: number; fill: string; fillOpacity: number }[];
  children?: ReactNode;
  ticks?: readonly number[];
  tickFormatter?: (value: number) => string;
  width?: number;
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
        data-opacities={data ? JSON.stringify(data.map((it) => it.fillOpacity)) : undefined}
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
    YAxis: ({ ticks, tickFormatter, width }: Drawn) => (
      <span
        data-bz="drawn:scale"
        data-ticks={JSON.stringify(ticks)}
        data-labels={JSON.stringify(ticks?.map((it) => tickFormatter?.(it) ?? String(it)))}
        data-width={width}
      />
    ),
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
    // values of your own: none of them current, none lighter; the scale from 0 to the largest value
    expect(screen.getByTestId('drawn:bar-chart').getAttribute('data-opacities')).toBe('[1,1]');
    expect(screen.getByTestId('drawn:scale').getAttribute('data-ticks')).toBe('[0,1]');
    unmount();
    // the bars of periods: those before the current one (the last) lighter
    const periods = render(<Chart id="periods" label="Periods" periods values={values} />);
    expect((await screen.findByTestId('drawn:bar-chart')).getAttribute('data-opacities')).toBe('[0.55,1]');
    periods.unmount();
    render(<Chart id="line" label="Line" kind="line" values={values} />);
    expect(await drawn('line-chart')).toEqual([
      ['x', 1, 'var(--chart-1)'],
      ['y', 0, 'var(--chart-1)'],
    ]);
  });

  it('labels its scale in the language, as wide as its longest number: never a digit cut', async () => {
    const scale = async (values: { key: string; label: string; value: number }[], language: string) => {
      const { unmount } = render(
        <LanguageProvider store={testLanguages(language)}>
          <Chart id="sums" label="Sums" values={values} />
        </LanguageProvider>,
      );
      const drawn = await screen.findByTestId('drawn:scale');
      const result = { labels: JSON.parse(drawn.getAttribute('data-labels') ?? '[]') as string[], width: Number(drawn.getAttribute('data-width')) };
      unmount();
      return result;
    };
    const large = [
      { key: 'x', label: 'X', value: 1200 },
      { key: 'y', label: 'Y', value: 322423 },
    ];
    const english = await scale(large, 'en');
    expect(english.labels).toEqual(['0', '322,423']);
    // the seven characters of its longest label (7 px each at 12 px) and the gap to the plot
    expect(english.width).toBeGreaterThanOrEqual(7 * 7 + 12);
    expect((await scale(large, 'ru')).labels[1]).toMatch(/^322\s423$/);
    // a sum of millions shortened, a small one as it is
    expect((await scale([{ key: 'm', label: 'M', value: 1_250_000 }], 'en')).labels).toEqual(['0', '1.3M']);
    const small = await scale([{ key: 's', label: 'S', value: 7 }], 'en');
    expect(small.labels).toEqual(['0', '7']);
    expect(small.width).toBeLessThan(english.width);
    // a largest value with a fraction, its digits whole (322 449,7 hours)
    const hours = await scale([{ key: 'h', label: 'H', value: 322449.7 }], 'ru');
    expect(hours.labels[1]).toMatch(/^322\s449,7$/);
    expect(hours.width).toBeGreaterThanOrEqual(9 * 7 + 12);
    expect((await scale([{ key: 'q', label: 'Q', value: 0.25 }], 'en')).labels).toEqual(['0', '0.25']);
    // all zero, no scale: the empty state of the chart
    render(<Chart id="zero" label="Zero" values={[{ key: 'z', label: 'Z', value: 0 }]} />);
    expect(await screen.findByTestId('state:empty')).toBeTruthy();
    expect(screen.queryByTestId('drawn:scale')).toBeNull();
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

  it('draws a distribution without recharts: the sum, a stacked bar of the shares, and the values with their shares', () => {
    render(
      <Chart
        id="spread"
        label="Spread"
        kind="distribution"
        values={[
          { key: 'a', label: 'A', value: 3, tone: 'warning' },
          { key: 'b', label: 'B', value: 0 },
          { key: 'c', label: 'C', value: 1 },
        ]}
      />,
    );
    const chart = screen.getByTestId('chart:spread');
    expect(chart.querySelector('[data-slot="chart-total"] [data-value]')?.getAttribute('data-value')).toBe('4');
    expect(within(chart).getByTestId('value:a').getAttribute('data-value')).toBe('3');
    expect(within(chart).getByTestId('value:a').textContent).toBe('A375%');
    expect(within(chart).getByTestId('value:b').textContent).toBe('B00%');
    // a segment of the bar for each value above 0, in its color (a tone, or the series)
    const segments = [...chart.querySelectorAll<HTMLElement>('[aria-hidden="true"].rounded-full > span')];
    expect(segments.map((it) => [it.style.flexGrow, it.style.background])).toEqual([
      ['3', 'var(--color-warning)'],
      ['1', 'var(--chart-3)'],
    ]);
    expect(screen.queryByTestId(/^drawn:/)).toBeNull();
  });

  it('shows the value of the current period large over the bars with its change and the figures beside it', async () => {
    const values = [
      { key: 'w1', label: 'W1', value: 1 },
      { key: 'w2', label: 'W2', value: 4 },
      { key: 'w3', label: 'W3', value: 2 },
    ];
    const { unmount } = render(<Chart id="weeks" label="Weeks" periods hero={{ bucket: 'week', side: ['prev', 'peak', 'total'] }} values={values} />);
    const hero = screen.getByTestId('chart:weeks').querySelector('[data-slot="chart-hero"]') as HTMLElement;
    expect(hero.querySelector('p [data-value]')?.getAttribute('data-value')).toBe('2');
    expect(hero.querySelector('p')?.textContent).toBe('2This week-2 on the week before');
    expect([...hero.querySelectorAll('dd')].map((it) => [it.previousElementSibling?.textContent, it.getAttribute('data-value')])).toEqual([
      ['The week before', '4'],
      ['Peak of the period', '4'],
      ['Over the period', '7'],
    ]);
    expect((await screen.findByTestId('drawn:bar-chart')).getAttribute('data-opacities')).toBe('[0.55,0.55,1]');
    unmount();
    // the same value as the period before; a figure of your choice
    render(<Chart id="months" label="Months" periods hero={{ bucket: 'month', side: ['total'] }} values={[{ key: 'm1', label: 'M1', value: 3 }, { key: 'm2', label: 'M2', value: 3 }]} />);
    const same = screen.getByTestId('chart:months').querySelector('[data-slot="chart-hero"]') as HTMLElement;
    expect(same.querySelector('p')?.textContent).toBe('3This monthNo change');
    expect(same.querySelectorAll('dd')).toHaveLength(1);
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
  const now = new Date(2026, 9, 15, 12, 30);

  it('counts the items of each month of a date to the current one', async () => {
    const server = new Backend()
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
    // the bounds are dates whatever the field: the chart reads no schema
    expect(server.requests('GET').filter((it) => it.includes('schema_'))).toEqual([]);
    expect(await drawn('line-chart')).toHaveLength(3);
  });

  it('is the chart in focus with `hero`: the value of the current period over the bars, no other query', async () => {
    const server = new Backend().on(
      'GET',
      ITEMS,
      grouped([
        { group: '2026-09-01', values: { count: 5 } },
        { group: '2026-10-01', values: { count: 2 } },
      ]),
    );
    renderWithBazis(
      <TimeChart id="due" path={ITEMS as never} field="due" bucket="month" last={3} label="Due" now={now} hero={['prev', 'peak']} />,
      server,
    );
    const chart = await screen.findByTestId('chart:due');
    await waitFor(() => {
      expect(chart.querySelector('[data-slot="chart-hero"] p [data-value]')?.getAttribute('data-value')).toBe('2');
    });
    expect(chart.querySelector('[data-slot="chart-hero"] p')?.textContent).toBe('2This month-3 on the month before');
    expect([...chart.querySelectorAll('[data-slot="chart-hero"] dd')].map((it) => it.getAttribute('data-value'))).toEqual(['5', '5']);
    expect(lists(server)).toHaveLength(1);
  });

  it('adds up the days of a week from its first day, bounded by dates of a date-time, and averages a field', async () => {
    const start = new Date(2026, 9, 15);
    while (start.getDay() !== weekStart('en') % 7) start.setDate(start.getDate() - 1);
    const next = new Date(start);
    next.setDate(next.getDate() + 7);
    const previous = new Date(start);
    previous.setDate(previous.getDate() - 7);
    const day = (date: Date, shift: number) => isoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + shift));
    const server = new Backend().on(
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
    // the periods before the current one (the last) lighter
    expect((await screen.findByTestId('drawn:bar-chart')).getAttribute('data-opacities')).toBe('[0.55,1]');
    expect(lists(server)).toEqual([
      expect.stringContaining(
        `filter=owner=me&dt_created__gte=${isoDate(previous)}&dt_created__lt=${isoDate(next)}&page[limit]=1` +
          '&meta=aggregates&aggregate=sum(hours),count(hours)&group=dt_created:day',
      ),
    ]);
  });
});
