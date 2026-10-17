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
// (`--chart-1` … `--chart-6`), the axes and the grid in its muted colors.

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

/** The chart of the values: bars, a line, or a ring (`donut`). */
export default function ChartView({ kind, points }: { kind: ChartKind; points: readonly ChartPoint[] }) {
  const data = points.map((it) => ({ ...it, fill: it.color }));
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
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
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
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip {...TOOLTIP} />
          <Bar dataKey="value" name="" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
