/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/heatmap-chart.json
 * Upstream path: src/charts/heatmap/heatmap-x-axis.tsx
 * Original source SHA-256: 63a0666d70f7321f7b24dbc34ed0fd527651d8779b97842feb8076431b3ff0d7
 */
"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "src/libs/utils/cn";
import { useHeatmap } from "./heatmap-context";
import { getHeatmapColumnMonthAnchor } from "./heatmap-utils";

export interface HeatmapXAxisProps {
  /** Additional class name for labels */
  className?: string;
  /** Explicit civil-calendar ticks retain the caller's week/month boundaries. */
  ticks?: readonly { label: string; col: number }[];
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export const HeatmapXAxis = memo(function HeatmapXAxis({
  className,
  ticks: calendarTicks,
}: HeatmapXAxisProps) {
  const { containerRef, data, margin, xScale } = useHeatmap();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const labels = useMemo(() => {
    if (calendarTicks) {
      return calendarTicks.map((tick) => ({
        label: tick.label,
        x: margin.left + xScale(tick.col),
        key: String(tick.col),
      }));
    }
    const ticks: { label: string; x: number; key: string }[] = [];
    let lastMonthKey = "";

    for (let columnIndex = 0; columnIndex < data.length; columnIndex++) {
      const column = data[columnIndex];
      if (!column) {
        continue;
      }

      const monthAnchor = getHeatmapColumnMonthAnchor(column);
      if (!monthAnchor) {
        continue;
      }

      const monthKey = `${monthAnchor.getUTCFullYear()}-${monthAnchor.getUTCMonth()}`;
      if (monthKey === lastMonthKey) {
        continue;
      }

      ticks.push({
        label: monthFmt.format(monthAnchor),
        x: margin.left + xScale(columnIndex),
        key: monthKey,
      });
      lastMonthKey = monthKey;
    }

    return ticks;
  }, [calendarTicks, data, margin.left, xScale]);

  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }

  return createPortal(
    labels.map((tick) => (
      <div
        className="pointer-events-none absolute"
        key={tick.key}
        style={{
          top: 0,
          left: tick.x,
          width: 0,
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <span
          className={cn(
            "whitespace-nowrap text-chart-label text-xs",
            className
          )}
        >
          {tick.label}
        </span>
      </div>
    )),
    container
  );
});

HeatmapXAxis.displayName = "HeatmapXAxis";

export default HeatmapXAxis;
