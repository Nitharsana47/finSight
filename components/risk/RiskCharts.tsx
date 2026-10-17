"use client";

import { useEffect, useRef, useState } from "react";
import type { BacktestPoint } from "@/lib/risk/backtest";

// Palette validated against the dark card surface (#141414)
export const RISK_COLORS = {
  line: "#C08A1F", // volatility / VaR limit
  breach: "#D9424B", // VaR breach
  returns: "#4B5160", // daily returns (recessive context)
  grid: "#2A2D33",
  surface: "#141414",
};

const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const niceTicks = (min: number, max: number, count = 4) => {
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / count));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => span / s <= count) ?? step * 10;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max + 1e-9; v += nice) ticks.push(Number(v.toFixed(6)));
  return ticks;
};

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtMonth = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

function Tooltip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-gray-600 bg-gray-900 px-2.5 py-1.5 text-xs text-gray-400 shadow-lg whitespace-nowrap"
      style={{ left }}
    >
      {children}
    </div>
  );
}

const LineKey = ({ color }: { color: string }) => <span className="inline-block h-0.5 w-3 rounded-full align-middle" style={{ backgroundColor: color }} />;

// Annualised GARCH volatility over the last year, with the long-run level as a reference
export function VolatilityChart({ series, longRun, height = 180 }: { series: { date: string; vol: number }[]; longRun: number; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (series.length < 2) return null;

  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  const maxV = Math.max(longRun, ...series.map((p) => p.vol)) * 1.1;
  const ticks = niceTicks(0, maxV);
  const top = ticks[ticks.length - 1] >= maxV ? ticks[ticks.length - 1] : maxV;
  const x = (i: number) => PAD.left + (i / (series.length - 1)) * w;
  const y = (v: number) => PAD.top + h - (v / top) * h;
  const path = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.vol).toFixed(1)}`).join("");
  const area = `${path}L${x(series.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (series.length - 1));
    setHover(Math.min(series.length - 1, Math.max(0, i)));
  };

  const p = hover !== null ? series[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      {p && (
        <Tooltip x={x(hover!)} width={width}>
          <p className="text-sm font-semibold text-gray-100 tabular-nums">{p.vol.toFixed(1)}%</p>
          <p className="flex items-center gap-1.5"><LineKey color={RISK_COLORS.line} /> Annualised volatility</p>
          <p className="text-gray-500">{fmtDate(p.date)}</p>
        </Tooltip>
      )}
      <svg width={width} height={height} role="img" aria-label={`Volatility over the last year, currently ${series[series.length - 1].vol.toFixed(1)}% annualised`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={RISK_COLORS.grid} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-gray-500 text-[11px]">{t}%</text>
          </g>
        ))}
        <line x1={PAD.left} x2={width - PAD.right} y1={y(longRun)} y2={y(longRun)} stroke="#9095A1" strokeWidth={1} />
        <text x={width - PAD.right} y={y(longRun) - 5} textAnchor="end" className="fill-gray-400 text-[11px]">Long-run {longRun.toFixed(1)}%</text>
        <path d={area} fill={RISK_COLORS.line} opacity={0.1} />
        <path d={path} fill="none" stroke={RISK_COLORS.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].vol)} r={4} fill={RISK_COLORS.line} stroke={RISK_COLORS.surface} strokeWidth={2} />
        <text x={PAD.left} y={height - 6} className="fill-gray-500 text-[11px]">{fmtMonth(series[0].date)}</text>
        <text x={width - PAD.right} y={height - 6} textAnchor="end" className="fill-gray-500 text-[11px]">{fmtMonth(series[series.length - 1].date)}</text>
        {p && <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + h} stroke="#9095A1" strokeWidth={1} />}
        {p && <circle cx={x(hover!)} cy={y(p.vol)} r={4} fill={RISK_COLORS.line} stroke={RISK_COLORS.surface} strokeWidth={2} />}
        <rect x={PAD.left} y={PAD.top} width={w} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
    </div>
  );
}

// Daily returns vs the forecast 95% VaR limit; red dots mark days the loss was worse than forecast
export function BacktestChart({ series, height = 200 }: { series: BacktestPoint[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (series.length < 2) return null;

  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  const maxUp = Math.max(...series.map((p) => p.ret), 0.5);
  const maxDown = Math.max(...series.map((p) => Math.max(-p.ret, p.var95)), 0.5);
  const ticks = niceTicks(-maxDown, maxUp);
  const lo = Math.min(-maxDown, ticks[0]);
  const hi = Math.max(maxUp, ticks[ticks.length - 1]);
  const x = (i: number) => PAD.left + (i / (series.length - 1)) * w;
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * h;
  const varPath = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(-p.var95).toFixed(1)}`).join("");

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (series.length - 1));
    setHover(Math.min(series.length - 1, Math.max(0, i)));
  };
  const p = hover !== null ? series[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      {p && (
        <Tooltip x={x(hover!)} width={width}>
          <p className="text-gray-500">{fmtDate(p.date)}</p>
          <p className="flex items-center gap-1.5"><LineKey color={RISK_COLORS.returns} /> Return <span className="font-semibold text-gray-100 tabular-nums">{p.ret >= 0 ? "+" : ""}{p.ret.toFixed(2)}%</span></p>
          <p className="flex items-center gap-1.5"><LineKey color={RISK_COLORS.line} /> VaR limit <span className="font-semibold text-gray-100 tabular-nums">−{p.var95.toFixed(2)}%</span></p>
          {p.breach && <p className="mt-0.5 font-semibold text-gray-100">● Breach: loss beyond forecast</p>}
        </Tooltip>
      )}
      <svg width={width} height={height} role="img" aria-label="Daily returns compared with the forecast 95% Value-at-Risk limit">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#3A3E46" : RISK_COLORS.grid} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-gray-500 text-[11px]">{t > 0 ? "+" : ""}{t}%</text>
          </g>
        ))}
        {series.map((pt, i) => (
          <line key={pt.date} x1={x(i)} x2={x(i)} y1={y(0)} y2={y(pt.ret)} stroke={RISK_COLORS.returns} strokeWidth={1} opacity={hover !== null && hover !== i ? 0.6 : 1} />
        ))}
        <path d={varPath} fill="none" stroke={RISK_COLORS.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {series.map((pt, i) => pt.breach && (
          <circle key={`b-${pt.date}`} cx={x(i)} cy={y(pt.ret)} r={4} fill={RISK_COLORS.breach} stroke={RISK_COLORS.surface} strokeWidth={2} />
        ))}
        <text x={PAD.left} y={height - 6} className="fill-gray-500 text-[11px]">{fmtMonth(series[0].date)}</text>
        <text x={width - PAD.right} y={height - 6} textAnchor="end" className="fill-gray-500 text-[11px]">{fmtMonth(series[series.length - 1].date)}</text>
        {p && <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + h} stroke="#9095A1" strokeWidth={1} />}
        <rect x={PAD.left} y={PAD.top} width={w} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><LineKey color={RISK_COLORS.returns} /> Daily return</span>
        <span className="flex items-center gap-1.5"><LineKey color={RISK_COLORS.line} /> 95% VaR limit (forecast the day before)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: RISK_COLORS.breach }} /> Breach</span>
      </div>
    </div>
  );
}
