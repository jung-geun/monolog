/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/heatmap-chart.json
 * Upstream path: src/charts/heatmap/heatmap-pattern-defs.tsx
 * Original source SHA-256: d0f1e3e28bcd6475a74ccb34508219351ad36a504408ca86bdca45be2d7df1d5
 */
"use client";

import { Fragment, memo } from "react";
import { renderPatternPreset } from "../pattern-preset";
import {
  type HeatmapLevelStyles,
  heatmapLevelPatternId,
  heatmapLevelPatternRenderOptions,
  isHeatmapLevelPattern,
} from "./heatmap-colors";

export const HeatmapPatternDefs = memo(function HeatmapPatternDefs({
  levelStyles,
}: {
  levelStyles: HeatmapLevelStyles;
}) {
  const nodes = levelStyles.flatMap((style, level) => {
    if (!isHeatmapLevelPattern(style)) {
      return [];
    }

    const id = heatmapLevelPatternId(level);
    const pattern = style.pattern;
    if (!pattern) {
      return [];
    }

    const node = renderPatternPreset(
      pattern,
      id,
      heatmapLevelPatternRenderOptions(style)
    );

    return node ? [<Fragment key={id}>{node}</Fragment>] : [];
  });

  if (nodes.length === 0) {
    return null;
  }

  return <defs>{nodes}</defs>;
});

HeatmapPatternDefs.displayName = "HeatmapPatternDefs";
