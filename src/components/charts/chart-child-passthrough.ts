/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/heatmap-chart.json
 * Upstream path: src/charts/chart-child-passthrough.ts
 * Original source SHA-256: 7ed588788dd6b8d009928b0f6f2af64838ba9291f4690f2801d77586b7269790
 */
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

/** Marker on wrapper components whose single child should inherit clip classification. */
export const CHART_CLIP_PASSTHROUGH = "__chartClipPassthrough" as const;

export function isChartClipPassthrough(type: unknown): boolean {
  return (
    typeof type === "function" &&
    (type as { [CHART_CLIP_PASSTHROUGH]?: boolean })[CHART_CLIP_PASSTHROUGH] ===
      true
  );
}

/** Unwrap visibility wrappers so `Grid` / axes stay outside the series clip. */
export function resolveChartChildElement(child: ReactElement): ReactElement {
  if (isChartClipPassthrough(child.type)) {
    const inner = (child.props as { children?: unknown }).children;
    if (isValidElement(inner)) {
      return resolveChartChildElement(inner);
    }
  }
  return child;
}

/** Walk chart children, flattening React fragments (studio often groups layers in `<>...</>`). */
export function forEachChartChild(
  children: ReactNode,
  callback: (child: ReactElement, index: number) => void
) {
  let index = 0;
  const visit = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) {
        return;
      }
      if (child.type === Fragment) {
        visit((child.props as { children?: ReactNode }).children);
        return;
      }
      callback(child, index);
      index += 1;
    });
  };
  visit(children);
}

const CLIP_EXCLUDED_COMPONENT_NAMES = new Set([
  "Background",
  "Grid",
  "XAxis",
  "YAxis",
  "BarXAxis",
  "BarYAxis",
  "LiveXAxis",
  "LiveYAxis",
]);

const UNDERLAY_COMPONENT_NAMES = new Set(["ReferenceArea", "BarColumnTrack"]);

/** Markers render after the interaction overlay so they stay clickable. */
export function isPostOverlayComponent(child: ReactElement): boolean {
  const childType = child.type as {
    displayName?: string;
    name?: string;
    __isChartMarkers?: boolean;
    __isPostOverlay?: boolean;
  };

  if (childType.__isChartMarkers || childType.__isPostOverlay) {
    return true;
  }

  const componentName =
    typeof child.type === "function"
      ? childType.displayName || childType.name || ""
      : "";

  return (
    componentName === "ChartMarkers" ||
    componentName === "MarkerGroup" ||
    componentName === "ChartBrush"
  );
}

/** Renders above grid/axes but below series; excluded from grow-clip reveal. */
export function isUnderlayComponent(child: ReactElement): boolean {
  const childType = child.type as { displayName?: string; name?: string };
  const componentName =
    typeof child.type === "function"
      ? childType.displayName || childType.name || ""
      : "";
  return UNDERLAY_COMPONENT_NAMES.has(componentName);
}

/** Grid and axes stay visible during series clip reveal (e.g. loading → ready). */
export function isClipExcludedComponent(child: ReactElement): boolean {
  const childType = child.type as { displayName?: string; name?: string };
  const componentName =
    typeof child.type === "function"
      ? childType.displayName || childType.name || ""
      : "";
  return CLIP_EXCLUDED_COMPONENT_NAMES.has(componentName);
}

/** SVG layer lists from chart shells need stable keys when rendered as arrays. */
export function renderKeyedChartLayers(children: ReactElement[]) {
  return children.map((child, index) =>
    cloneElement(child, { key: child.key ?? `chart-layer-${index}` })
  );
}
