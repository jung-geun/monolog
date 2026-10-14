/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see ../../components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/utils.json
 * Upstream path: src/lib/utils.ts
 * Original source SHA-256: 4acbc7165a8d54738ff62b51414e772c08fe78434e524e6d8770180d3ba2925f
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
