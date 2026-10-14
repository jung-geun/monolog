/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/heatmap-chart.json
 * Upstream path: src/charts/heatmap/use-delayed-tooltip-data.ts
 * Original source SHA-256: d078e68f74802f16193f9527584dab4bf37ecd9b7fa9c8d910d2a77d5f680611
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { HeatmapTooltipData } from "./heatmap-context";

export function useDelayedTooltipData(
  tooltipData: HeatmapTooltipData | null,
  showDelay: number,
  hideDelay: number
): HeatmapTooltipData | null {
  const [displayData, setDisplayData] = useState<HeatmapTooltipData | null>(
    null
  );
  const isShowingRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = undefined;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }

    if (tooltipData) {
      if (isShowingRef.current) {
        setDisplayData(tooltipData);
        return;
      }

      if (showDelay === 0) {
        isShowingRef.current = true;
        setDisplayData(tooltipData);
        return;
      }

      showTimerRef.current = setTimeout(() => {
        isShowingRef.current = true;
        setDisplayData(tooltipData);
      }, showDelay);
      return;
    }

    if (hideDelay === 0) {
      isShowingRef.current = false;
      setDisplayData(null);
      return;
    }

    hideTimerRef.current = setTimeout(() => {
      isShowingRef.current = false;
      setDisplayData(null);
    }, hideDelay);
  }, [tooltipData, showDelay, hideDelay]);

  useEffect(
    () => () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    },
    []
  );

  return displayData;
}
