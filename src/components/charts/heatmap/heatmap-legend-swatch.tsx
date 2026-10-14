/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/heatmap-chart.json
 * Upstream path: src/charts/heatmap/heatmap-legend-swatch.tsx
 * Original source SHA-256: 6d2ed887829365202ed3b4dfbc7c239603afe854f46a73f554bc2e267834f149
 */
"use client";

import { memo } from "react";
import { renderPatternPreset } from "../pattern-preset";
import {
  type HeatmapLevelStyle,
  heatmapLevelPatternId,
  heatmapLevelPatternRenderOptions,
  isHeatmapLevelPattern,
} from "./heatmap-colors";

export const HeatmapLegendSwatch = memo(function HeatmapLegendSwatch({
  level,
  style,
  cellSize,
  cornerRadius,
}: {
  level: number;
  style: HeatmapLevelStyle;
  cellSize: number;
  cornerRadius: number;
}) {
  const shellStyle = {
    width: cellSize,
    height: cellSize,
    borderRadius: cornerRadius,
  };

  if (isHeatmapLevelPattern(style) && style.pattern) {
    const patternId = heatmapLevelPatternId(level);
    const patternNode = renderPatternPreset(
      style.pattern,
      patternId,
      heatmapLevelPatternRenderOptions(style)
    );
    const opacity = style.patternOpacity ?? 1;

    return (
      <span
        aria-hidden="true"
        className="block shrink-0 overflow-hidden"
        style={{ ...shellStyle, opacity }}
      >
        <svg
          aria-hidden="true"
          className="block size-full"
          viewBox={`0 0 ${cellSize} ${cellSize}`}
        >
          {patternNode ? <defs>{patternNode}</defs> : null}
          <rect
            fill={patternNode ? `url(#${patternId})` : style.color}
            height={cellSize}
            rx={cornerRadius}
            ry={cornerRadius}
            width={cellSize}
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="block shrink-0"
      style={{
        ...shellStyle,
        backgroundColor: style.color,
        border: level === 0 ? `1px solid ${style.color}` : undefined,
        boxSizing: "border-box",
      }}
    />
  );
});

HeatmapLegendSwatch.displayName = "HeatmapLegendSwatch";
