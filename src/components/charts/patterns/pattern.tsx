/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/patterns.json
 * Upstream path: src/charts/patterns/pattern.tsx
 * Original source SHA-256: 088e5f19232a9cfdd2bb2e4cfcf573780b4bb5761c56cefd42e736fe0fd02c39
 */
/**
 * Ported from @visx/pattern 4.0.0 (https://github.com/airbnb/visx).
 * MIT License — Copyright (c) 2017-2018 Harrison Shoff. See ./LICENSE-visx-pattern.
 */

import type { ReactNode } from "react";

export interface PatternProps {
  /** Unique id of the pattern element. */
  id: string;
  /** Width of the pattern. */
  width: number;
  /** Height of the pattern. */
  height: number;
  /** Children of pattern element to render. */
  children: ReactNode;
}

export function Pattern({ id, width, height, children }: PatternProps) {
  return (
    <defs>
      <pattern
        height={height}
        id={id}
        patternUnits="userSpaceOnUse"
        width={width}
      >
        {children}
      </pattern>
    </defs>
  );
}
