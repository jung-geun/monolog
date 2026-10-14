/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/patterns.json
 * Upstream path: src/charts/patterns/circles.tsx
 * Original source SHA-256: 0603639825b91fb9493ce2b3ff25bf1484c58494440a5873ccd9e2d529380a06
 */
/**
 * Ported from @visx/pattern 4.0.0 (https://github.com/airbnb/visx).
 * MIT License — Copyright (c) 2017-2018 Harrison Shoff. See ./LICENSE-visx-pattern.
 */
import { cn } from "src/libs/utils/cn";
import { Pattern } from "./pattern";

export interface PatternCirclesProps {
  /** Unique id for the pattern. */
  id: string;
  /** Width of the pattern element. */
  width: number;
  /** Height of the pattern element. */
  height: number;
  /** Radius of the pattern circles. */
  radius?: number;
  /** Fill applied to circles. */
  fill?: string;
  /** className applied to circles. */
  className?: string;
  /** stroke applied to circles. */
  stroke?: string;
  /** strokeWidth applied to circles. */
  strokeWidth?: number | string;
  /** strokeDasharray applied to circles. */
  strokeDasharray?: number | string;
  /** Whether to fill in circles within the pattern gaps to increase pattern density. */
  complement?: boolean;
  /** Background color applied behind circles. */
  background?: string;
}

export function Circles({
  id,
  width,
  height,
  radius = 2,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  background,
  complement = false,
  className,
}: PatternCirclesProps) {
  let corners: [number, number][] | undefined;
  if (complement) {
    corners = [
      [0, 0],
      [0, height],
      [width, 0],
      [width, height],
    ];
  }
  return (
    <Pattern height={height} id={id} width={width}>
      {!!background && <rect fill={background} height={height} width={width} />}
      <circle
        className={cn("visx-pattern-circle", className)}
        cx={width / 2}
        cy={height / 2}
        fill={fill}
        r={radius}
        stroke={stroke}
        strokeDasharray={strokeDasharray}
        strokeWidth={strokeWidth}
      />
      {corners?.map(([cornerX, cornerY]) => (
        <circle
          className={cn(
            "visx-pattern-circle visx-pattern-circle-complement",
            className
          )}
          cx={cornerX}
          cy={cornerY}
          fill={fill}
          key={`${id}-complement-${cornerX}-${cornerY}`}
          r={radius}
          stroke={stroke}
          strokeDasharray={strokeDasharray}
          strokeWidth={strokeWidth}
        />
      ))}
    </Pattern>
  );
}
