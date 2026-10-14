/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/chart-context.json
 * Upstream path: src/charts/line-loading-timing.ts
 * Original source SHA-256: e2328b4a9502014022dd671c6086ede1b6bd4ce8da02f04a8d251634bee0e4f4
 */
/** Grow + exit timeline for `LineLoadingPulse` (seconds). */
export const LINE_LOADING_PULSE_CYCLE_S = 2.2;

/** Idle gap before the loading line pulse restarts (milliseconds). */
export const LINE_LOADING_LOOP_PAUSE_MS = 280;

/** Loading label exit on loading → ready (seconds). */
export const LOADING_LABEL_EXIT_S = 0.45;

/** Loading label drops this many pixels while exiting. */
export const LOADING_LABEL_EXIT_Y_PX = 30;

export const LINE_LOADING_PULSE_EASE = [0.85, 0, 0.15, 1] as const;
