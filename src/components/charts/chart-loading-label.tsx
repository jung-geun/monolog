/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/heatmap-chart.json
 * Upstream path: src/charts/chart-loading-label.tsx
 * Original source SHA-256: 06f6b5dc09269f07b65afbd6a70559fa1d53c40e6c4ae0548a92d0664732a06e
 */
"use client";

import { motion } from "motion/react";
import { cn } from "src/libs/utils/cn";
import { ShimmeringText } from "./components/shimmering-text";
import {
  LINE_LOADING_PULSE_EASE,
  LOADING_LABEL_EXIT_S,
  LOADING_LABEL_EXIT_Y_PX,
} from "./line-loading-timing";

export interface ChartLoadingLabelProps {
  /** Label shown centered over the chart. */
  text?: string;
  className?: string;
  /** Animate down, fade, and blur during loading → ready handoff. */
  exiting?: boolean;
}

export function ChartLoadingLabel({
  text = "Loading",
  className,
  exiting = false,
}: ChartLoadingLabelProps) {
  if (!text.trim()) {
    return null;
  }

  return (
    <motion.div
      animate={{
        y: exiting ? LOADING_LABEL_EXIT_Y_PX : 0,
        opacity: exiting ? 0 : 1,
        filter: exiting ? "blur(2px)" : "blur(0px)",
      }}
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className
      )}
      initial={false}
      role="status"
      transition={{
        duration: LOADING_LABEL_EXIT_S,
        ease: [...LINE_LOADING_PULSE_EASE],
      }}
    >
      <ShimmeringText
        className="font-medium text-sm tracking-wide [--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]"
        text={text}
      />
    </motion.div>
  );
}

export default ChartLoadingLabel;
