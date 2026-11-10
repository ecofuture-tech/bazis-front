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

// The drawing of a chart with recharts (the npm dependency that `bazis_front add charts` sets
// in package.json), a chunk of its own loaded with the first chart shown (`charts.tsx`): the
// bars, the line or the ring of the values, in the colors of the series of the theme
// (`--chart-1` … `--chart-6`), the axes and the grid in its muted colors: the zero line and
// the scale from 0 to the largest value only, in the language and as wide as its longest number;
// the bars of the periods before the current one (the last) lighter.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatNumber, useLanguage } from '@/bazis/i18n';

import type { ChartKind } from './charts.js';

/** A value of the drawing, with its color. */
export interface ChartPoint {
  key: string;
  label: string;
  value: number;
  color: string;
}

const AXIS = {
  stroke: 'var(--muted-foreground)',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const TOOLTIP = {
  contentStyle: {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    fontSize: 12,
  },
  cursor: { fill: 'var(--muted)', opacity: 0.6 },
} as const;

/** The opacity of the bar of a period before the current one. */
const PAST = 0.55;

/** A number of the scale in the language: grouped from five digits, shortened from a million (`1.2M`). */
function scaleLabel(value: number, language: string): string {
  return formatNumber(value, language, Math.abs(value) >= 1_000_000 ? { notation: 'compact', maximumFractionDigits: 1 } : undefined);
}

/** The width of the scale: its longest label in the digits of its 12 px (7 px each) and the gap to the plot. */
function scaleWidth(labels: readonly string[]): number {
  return Math.max(...labels.map((it) => it.length)) * 7 + 12;
}

/**
 * The chart of the values: bars, a line, or a ring (`donut`); `periods`: the values of periods,
 * the last one the current.
 */
export default function ChartView({
  kind,
  points,
  periods = false,
}: {
  kind: Exclude<ChartKind, 'distribution'>;
  points: readonly ChartPoint[];
  periods?: boolean;
}) {
  const data = points.map((it, index) => ({
    ...it,
    fill: it.color,
    fillOpacity: periods && index < points.length - 1 ? PAST : 1,
  }));
  const { language } = useLanguage();
  const largest = Math.max(0, ...points.map((it) => it.value));
  // the scale of its ends, never cut (`322 423`, not `22423`), the grid of its zero
  const ticks = [0, largest];
  const scale = (
    <YAxis
      allowDecimals={false}
      ticks={ticks}
      domain={[0, largest]}
      tickFormatter={(value: number) => scaleLabel(value, language)}
      width={scaleWidth(ticks.map((it) => scaleLabel(it, language)))}
      {...AXIS}
    />
  );
  const grid = <CartesianGrid vertical={false} horizontalValues={[0]} stroke="var(--border)" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      {kind === 'donut' ? (
        <PieChart>
          <Tooltip {...TOOLTIP} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="var(--card)"
            isAnimationActive={false}
          />
        </PieChart>
      ) : kind === 'line' ? (
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grid}
          <XAxis dataKey="label" {...AXIS} />
          {scale}
          <Tooltip {...TOOLTIP} />
          <Line
            dataKey="value"
            name=""
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grid}
          <XAxis dataKey="label" {...AXIS} />
          {scale}
          <Tooltip {...TOOLTIP} />
          <Bar dataKey="value" name="" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
