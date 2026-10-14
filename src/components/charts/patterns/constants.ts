/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/patterns.json
 * Upstream path: src/charts/patterns/constants.ts
 * Original source SHA-256: 797b9d6ae5dd9213590d5cff77da5145554fa71ecb311916d8b4a54fe020367f
 */
/**
 * Ported from @visx/pattern 4.0.0 (https://github.com/airbnb/visx).
 * MIT License — Copyright (c) 2017-2018 Harrison Shoff. See ./LICENSE-visx-pattern.
 */

export const PatternOrientation = {
  horizontal: "horizontal",
  vertical: "vertical",
  diagonal: "diagonal",
  diagonalRightToLeft: "diagonalRightToLeft",
} as const;

export type PatternOrientationType =
  (typeof PatternOrientation)[keyof typeof PatternOrientation];
