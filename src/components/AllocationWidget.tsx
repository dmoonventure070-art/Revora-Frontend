import React, { useState, useId } from "react";
import { PieChart, AlignLeft } from "lucide-react";
import { usePrintMode } from "../hooks/usePrintMode";

export interface AllocationSlice {
  id: string;
  label: string;
  value: number; // dollar amount
  percentage: number; // 0-100
}

interface AllocationWidgetProps {
  slices: AllocationSlice[];
  /** Controlled view override (for tests) */
  __initialView?: "donut" | "bar";
}

// Accessible categorical chart palette — guaranteed >= 3:1 contrast on dark surfaces
const SLICE_COLOURS = [
  "var(--chart-cat-1, #60a5fa)", // blue
  "var(--chart-cat-2, #34d399)", // emerald
  "var(--chart-cat-3, #fbbf24)", // amber
  "var(--chart-cat-4, #a78bfa)", // violet
  "var(--chart-cat-5, #f87171)", // rose
  "var(--chart-cat-6, #22d3ee)", // cyan
  "var(--chart-cat-7, #fb923c)", // orange
  "var(--chart-cat-8, #f472b6)", // pink
];

function normaliseSlices(slices: AllocationSlice[]): AllocationSlice[] {
  const totalPct = slices.reduce((sum, s) => sum + Math.max(0, s.percentage), 0);
  const totalValue = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return slices.map((s) => {
    const rawPct = Math.max(0, s.percentage);
    const percentage =
      totalPct === 100
        ? rawPct
        : totalPct > 0
          ? (rawPct / totalPct) * 100
          : totalValue > 0
            ? (Math.max(0, s.value) / totalValue) * 100
            : 0;
    return { ...s, percentage };
  });
}

function DonutChart({ slices }: { slices: AllocationSlice[] }) {
  const size = 160;
  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = 2; // degrees gap between slices

  const normalisedSlices = normaliseSlices(slices);

  // Build strokes from normalised percentages
  let cumulativeLen = 0;
  const segments = normalisedSlices.map((s, i) => {
    const pct = s.percentage;
    const sliceLen = (pct / 100) * circumference;
    const dashLen = Math.max(0, sliceLen - (gap / 360) * circumference);
    const offset = cumulativeLen === 0 ? 0 : -cumulativeLen;
    cumulativeLen += sliceLen;
    return { ...s, dashLen, offset, colour: SLICE_COLOURS[i % SLICE_COLOURS.length] };
  });

  const totalFormatted = normalisedSlices.reduce((sum, s) => sum + s.value, 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Donut chart showing portfolio allocation"
        >
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth={22} />
          {segments.map((seg) => (
            <circle
              key={seg.id}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.colour}
              strokeWidth={22}
              strokeDasharray={`${seg.dashLen} ${circumference - seg.dashLen}`}
              strokeDashoffset={seg.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              aria-label={`${seg.label}: ${seg.percentage.toFixed(1)}%`}
            />
          ))}
        </svg>
        {/* Center label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
          aria-hidden="true"
        >
          <span className="text-xs text-muted">Total</span>
          <span className="text-sm font-bold">{totalFormatted}</span>
        </div>
      </div>

      {/* Legend */}
      <ul className="w-full space-y-1.5" aria-label="Allocation legend">
        {segments.map((seg) => (
          <li key={seg.id} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span
                className="inline-block rounded-full flex-shrink-0"
                style={{ width: 10, height: 10, background: seg.colour }}
                aria-hidden="true"
              />
              {seg.label}
            </span>
            <span className="font-medium">{seg.percentage.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarView({ slices }: { slices: AllocationSlice[] }) {
  return (
    <ul className="w-full space-y-3" aria-label="Portfolio allocation by issuer">
      {slices.map((s, i) => {
        const colour = SLICE_COLOURS[i % SLICE_COLOURS.length];
        const formatted = s.value.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });
        return (
          <li key={s.id} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>{s.label}</span>
              <span className="font-medium">{formatted} ({s.percentage.toFixed(1)}%)</span>
            </div>
            <div
              className="w-full rounded-full"
              style={{ height: 8, background: "rgba(148,163,184,0.1)" }}
              role="progressbar"
              aria-valuenow={s.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${s.label}: ${s.percentage.toFixed(1)}%`}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${s.percentage}%`, background: colour }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const AllocationWidget: React.FC<AllocationWidgetProps> = ({
  slices,
  __initialView = "donut",
}) => {
  const [view, setView] = useState<"donut" | "bar">(__initialView);
  const isPrinting = usePrintMode();
  const toggleId = useId();

  // Force bar view when printing for accessible output
  const effectiveView = isPrinting ? "bar" : view;

  if (slices.length === 0) {
    return (
      <section className="glass-card p-6" aria-labelledby={`${toggleId}-heading`} data-testid="allocation-widget">
        <h2 id={`${toggleId}-heading`} className="text-base font-semibold mb-4">Allocation</h2>
        <p className="text-muted text-sm text-center py-8">No holdings to display.</p>
      </section>
    );
  }

  const normalisedSlices = normaliseSlices(slices);

  return (
    <section
      className="glass-card p-6 space-y-4"
      aria-labelledby={`${toggleId}-heading`}
      data-testid="allocation-widget"
      data-print-view={isPrinting ? "bar" : view}
    >
      <div className="flex items-center justify-between">
        <h2 id={`${toggleId}-heading`} className="text-base font-semibold">Allocation</h2>
        {/* Toggle between donut and bar */}
        <div role="group" aria-label="Chart view toggle" className="flex items-center gap-1">
          <button
            className={`btn--icon p-1.5 rounded-md transition-colors ${effectiveView === "donut" ? "text-primary bg-primary/10" : "text-muted hover:text-main"}`}
            onClick={() => setView("donut")}
            aria-pressed={effectiveView === "donut"}
            aria-label="Donut chart view"
            data-testid="donut-toggle"
          >
            <PieChart size={16} aria-hidden="true" />
          </button>
          <button
            className={`btn--icon p-1.5 rounded-md transition-colors ${effectiveView === "bar" ? "text-primary bg-primary/10" : "text-muted hover:text-main"}`}
            onClick={() => setView("bar")}
            aria-pressed={effectiveView === "bar"}
            aria-label="Bar chart view"
            data-testid="bar-toggle"
          >
            <AlignLeft size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {effectiveView === "donut" ? (
        <div className="donut-view">
          <DonutChart slices={normalisedSlices} />
        </div>
      ) : (
        <div className="bar-view">
          <BarView slices={normalisedSlices} />
        </div>
      )}
    </section>
  );
};
