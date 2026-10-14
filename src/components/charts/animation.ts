/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/chart-animation.json
 * Upstream path: src/charts/animation.ts
 * Original source SHA-256: bd91d889c06e719f74069ee7141cf69a51e4f238e6b37f762399d239f1ea4521
 */
import type { Transition } from "motion/react";

/** Default clip-reveal easing for cartesian charts. */
export const DEFAULT_ANIMATION_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";

export const DEFAULT_ANIMATION_DURATION_MS = 1100;

/** Default enter transition — matches the original line chart reveal. */
export const DEFAULT_CHART_ENTER_TRANSITION: Transition = {
  type: "tween",
  duration: DEFAULT_ANIMATION_DURATION_MS / 1000,
  ease: [0.85, 0, 0.15, 1],
};

/**
 * Clip-path width reveal must use tween — spring does not reliably animate SVG width.
 */
export function clipRevealTransition(enterTransition?: Transition): Transition {
  if (enterTransition?.type === "tween") {
    return {
      ...enterTransition,
      ease: enterTransition.ease ?? DEFAULT_CHART_ENTER_TRANSITION.ease,
    };
  }

  const duration =
    typeof enterTransition?.duration === "number"
      ? enterTransition.duration
      : DEFAULT_ANIMATION_DURATION_MS / 1000;

  return {
    type: "tween",
    duration,
    ease: DEFAULT_CHART_ENTER_TRANSITION.ease,
  };
}
