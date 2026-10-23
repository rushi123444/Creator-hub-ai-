import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompact } from '../utils/format.js';

/**
 * Recharts theme helpers (colours come from CSS tokens so light/dark both work).
 *
 *  CHART_COLORS                       array of 6 CSS colours (var(--chart-n))
 *  chartColor(i)                      colour for series i
 *  <AreaTrend|LineTrend|BarCompare data xKey series height format xFormat stacked />
 *       series: [{ key, name?, color? }]; data: array of objects; format(value) -> label for ticks + tooltip
 *  <DonutChart data nameKey valueKey height format />
 *  <ChartTooltip /> and AXIS / GRID props for custom Recharts compositions:
 *       <Tooltip content={<ChartTooltip format={fmt} />} cursor={CURSOR} />
 */
export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
export const chartColor = (i) => CHART_COLORS[i % CHART_COLORS.length];

const tick = { fill: 'var(--chart-axis)', fontSize: 12 };
export const AXIS = { tick, tickLine: false, axisLine: false, tickMargin: 8 };
export const GRID = { stroke: 'var(--chart-grid)', vertical: false, strokeDasharray: '3 3' };
export const CURSOR = { stroke: 'var(--border-strong)', fill: 'var(--surface-hover)' };

export function ChartTooltip({ active, payload, label, format = (v) => v, labelFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label != null && <div className="chart-tooltip__label">{labelFormat ? labelFormat(label) : label}</div>}
      {payload.map((p, i) => (
        <div className="chart-tooltip__row" key={i}>
          <span className="chart-tooltip__dot" style={{ background: p.color || p.payload?.fill }} />
          <span className="chart-tooltip__name">{p.name}</span>
          <span className="chart-tooltip__val">{typeof p.value === 'number' ? format(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

const defaultFormat = (v) => formatCompact(v);
const MARGIN = { top: 8, right: 8, bottom: 0, left: -8 };

function useSeries(series, yKey = 'value') {
  return (series?.length ? series : [{ key: yKey }]).map((s, i) => ({ name: s.key, ...s, color: s.color || chartColor(i) }));
}

export function AreaTrend({ data = [], xKey = 'date', series, height = 260, format = defaultFormat, xFormat, stacked }) {
  const ss = useSeries(series);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={MARGIN}>
        <defs>
          {ss.map((s, i) => (
            <linearGradient key={s.key} id={`ch-area-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey={xKey} {...AXIS} tickFormatter={xFormat} minTickGap={28} />
        <YAxis {...AXIS} tickFormatter={format} width={48} />
        <Tooltip content={<ChartTooltip format={format} labelFormat={xFormat} />} cursor={CURSOR} />
        {ss.map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#ch-area-${i})`} stackId={stacked ? 'a' : undefined} dot={false} activeDot={{ r: 4 }} />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({ data = [], xKey = 'date', series, height = 260, format = defaultFormat, xFormat }) {
  const ss = useSeries(series);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey={xKey} {...AXIS} tickFormatter={xFormat} minTickGap={28} />
        <YAxis {...AXIS} tickFormatter={format} width={48} />
        <Tooltip content={<ChartTooltip format={format} labelFormat={xFormat} />} cursor={CURSOR} />
        {ss.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarCompare({ data = [], xKey = 'name', series, height = 260, format = defaultFormat, xFormat, stacked, horizontal }) {
  const ss = useSeries(series);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={horizontal ? { ...MARGIN, left: 8 } : MARGIN}>
        <CartesianGrid {...GRID} vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS} tickFormatter={format} />
            <YAxis type="category" dataKey={xKey} {...AXIS} width={110} tickFormatter={xFormat} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...AXIS} tickFormatter={xFormat} />
            <YAxis {...AXIS} tickFormatter={format} width={48} />
          </>
        )}
        <Tooltip content={<ChartTooltip format={format} labelFormat={xFormat} />} cursor={CURSOR} />
        {ss.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={36} stackId={stacked ? 'a' : undefined} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data = [], nameKey = 'name', valueKey = 'value', height = 220, format = defaultFormat }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip content={<ChartTooltip format={format} />} />
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
          {data.map((d, i) => <Cell key={i} fill={chartColor(i)} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Legend row for a donut or multi-series chart. items: [{ name, color? }] */
export function ChartLegend({ items = [] }) {
  return (
    <div className="chart-legend">
      {items.map((it, i) => <span className="chart-legend__item" key={it.name}><span className="chart-legend__dot" style={{ background: it.color || chartColor(i) }} />{it.name}</span>)}
    </div>
  );
}
