import { gray, blue, red, green, grayDark, blueDark, redDark, greenDark, indigo, indigoDark } from "@radix-ui/colors"

/*
 * Palette adaptations from the official themes:
 * https://github.com/Binaryify/OneDark-Pro/blob/master/themes/OneDark-Pro-mix.json
 * https://github.com/microsoft/vscode/tree/main/extensions/theme-defaults/themes
 * One Dark Pro Mix: Copyright (c) 2013-2022 Binaryify
 * VS Code Dark/Light Modern: Copyright (c) 2015 - present Microsoft Corporation
 *
 * MIT License
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
export interface EditorColors {
  bg: string
  bg2: string
  bg3: string
  fg: string
  fg2: string
  fg3: string
  fg4: string
  line: string
  line2: string
  gutter: string
  accent: string
  accentSoft: string
  accent2: string
  accent3: string
}

export interface SyntaxColors {
  comment: string
  punctuation: string
  property: string
  tag: string
  boolean: string
  number: string
  constant: string
  string: string
  keyword: string
  function: string
  className: string
  attribute: string
  variable: string
  regex: string
  operator: string
  deleted: string
  inserted: string
  selector: string
}

export type ColorThemeId = "one-dark-pro-mix" | "dark-modern" | "light-modern"
export type ColorThemePreference = ColorThemeId | "system"
export interface ColorTheme {
  id: ColorThemeId
  label: string
  scheme: "dark" | "light"
  editor: EditorColors
  syntax: SyntaxColors
}

export const colorThemes: readonly ColorTheme[] = [
  {
    id: "one-dark-pro-mix", label: "One Dark Pro Mix", scheme: "dark",
    editor: {
      bg: "#282c34", bg2: "#21252b", bg3: "#2c313a",
      fg: "#abb2bf", fg2: "#d7dae0", fg3: "#9da5b4", fg4: "#7f848e",
      line: "#181a1f", line2: "#3e4452", gutter: "#2c313c",
      accent: "#61afef", accentSoft: "#323842", accent2: "#56b6c2", accent3: "#61afef",
    },
    syntax: {
      comment: "#5c6370", punctuation: "#abb2bf", property: "#e06c75", tag: "#e06c75",
      boolean: "#d19a66", number: "#d19a66", constant: "#d19a66", string: "#98c379",
      keyword: "#c678dd", function: "#61afef", className: "#e5c07b", attribute: "#d19a66",
      variable: "#e06c75", regex: "#56b6c2", operator: "#56b6c2", deleted: "#e06c75",
      inserted: "#98c379", selector: "#e06c75",
    },
  },
  {
    id: "dark-modern", label: "Dark Modern", scheme: "dark",
    editor: {
      bg: "#1f1f1f", bg2: "#181818", bg3: "#313131",
      fg: "#cccccc", fg2: "#cccccc", fg3: "#9d9d9d", fg4: "#868686",
      line: "#2b2b2b", line2: "#3c3c3c", gutter: "#202020",
      accent: "#0078d4", accentSoft: "#264778", accent2: "#4daafc", accent3: "#4daafc",
    },
    syntax: {
      comment: "#6a9955", punctuation: "#cccccc", property: "#9cdcfe", tag: "#569cd6",
      boolean: "#569cd6", number: "#b5cea8", constant: "#4fc1ff", string: "#ce9178",
      keyword: "#c586c0", function: "#dcdcaa", className: "#4ec9b0", attribute: "#9cdcfe",
      variable: "#9cdcfe", regex: "#d16969", operator: "#cccccc", deleted: "#f85149",
      inserted: "#b5cea8", selector: "#d7ba7d",
    },
  },
  {
    id: "light-modern", label: "Light Modern", scheme: "light",
    editor: {
      bg: "#ffffff", bg2: "#f8f8f8", bg3: "#f2f2f2",
      fg: "#3b3b3b", fg2: "#1f1f1f", fg3: "#616161", fg4: "#767676",
      line: "#e5e5e5", line2: "#cecece", gutter: "#f8f8f8",
      accent: "#005fb8", accentSoft: "#bed6ed", accent2: "#005fb8", accent3: "#005fb8",
    },
    syntax: {
      comment: "#008000", punctuation: "#3b3b3b", property: "#001080", tag: "#800000",
      boolean: "#0000ff", number: "#098658", constant: "#0070c1", string: "#a31515",
      keyword: "#af00db", function: "#795e26", className: "#267f99", attribute: "#e50000",
      variable: "#001080", regex: "#811f3f", operator: "#3b3b3b", deleted: "#a31515",
      inserted: "#098658", selector: "#800000",
    },
  },
]

export const DEFAULT_COLOR_THEME: ColorThemeId = "one-dark-pro-mix"
export const COLOR_THEME_STORAGE_KEY = "monolog.colorTheme"
export const isColorThemePreference = (value: unknown): value is ColorThemePreference =>
  value === "system" || colorThemes.some((theme) => theme.id === value)
export const getColorThemePreference = (value: unknown): ColorThemePreference =>
  isColorThemePreference(value) ? value : DEFAULT_COLOR_THEME
export const resolveColorTheme = (preference: ColorThemePreference, systemDark = true): ColorTheme =>
  colorThemes.find((theme) => theme.id === (preference === "system" ? systemDark ? "dark-modern" : "light-modern" : preference))!

const lightScales = { ...indigo, ...gray, ...blue, ...red, ...green }
const darkScales = { ...indigoDark, ...grayDark, ...blueDark, ...redDark, ...greenDark }
type ColorScales = { [Key in keyof typeof lightScales]: string }
export type Colors = ColorScales & { editor: EditorColors }

// Every Emotion surface uses CSS variables, so the pre-hydration selection also
// colors SSR markup without changing React's initial attributes or class names.
export const colors: Colors = {
  ...Object.fromEntries(Object.keys(lightScales).map((key) => [key, `var(--theme-colors-${key})`])) as ColorScales,
  editor: Object.fromEntries(Object.keys(colorThemes[0].editor).map((key) => [key, `var(--editor-${key})`])) as unknown as EditorColors,
}

const rgb = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(" ")
const declarations = (theme: ColorTheme) => {
  const e = theme.editor
  const syntax = theme.syntax
  const scales: ColorScales = { ...(theme.scheme === "light" ? lightScales : darkScales) }
  const grays = [e.bg2, e.bg, e.bg3, e.line, e.line2, e.line2, e.fg4, e.fg4, e.fg3, e.fg3, e.fg2, e.fg]
  grays.forEach((value, i) => { scales[`gray${i + 1}` as keyof typeof scales] = value })
  const grass = [0.35, 0.6, 0.8, 1].map((weight) => `#${[1, 3, 5].map((start) => {
    const empty = parseInt(e.bg3.slice(start, start + 2), 16)
    const active = parseInt(syntax.inserted.slice(start, start + 2), 16)
    return Math.round(empty + (active - empty) * weight).toString(16).padStart(2, "0")
  }).join("")}`)
  const roles = {
    ink: e.fg, chrome: e.bg2, card: e.bg, elevated: e.bg3, sunken: e.gutter,
    hairline: e.line2, mute: e.fg3, soft: e.fg4, strong: e.fg2,
    signal: e.accent, "signal-50": e.accentSoft, "signal-200": e.accent3, "signal-900": e.fg2,
    cs: syntax.className, "cs-50": e.bg3, "cs-200": syntax.className, "cs-900": e.fg,
    paper: syntax.function, "paper-50": e.bg3, "paper-200": syntax.function, "paper-900": e.fg,
    research: syntax.keyword, "research-50": e.bg3, "research-200": syntax.keyword, "research-900": e.fg,
    "grass-1": grass[0], "grass-2": grass[1], "grass-3": grass[2], "grass-4": grass[3],
  }
  return [
    `color-scheme:${theme.scheme};`, `--fg-color:${e.fg};`, `--bg-color:${e.bg};`,
    ...Object.entries(e).map(([key, value]) => `--editor-${key}:${value};`),
    ...Object.entries(syntax).map(([key, value]) => `--syntax-${key}:${value};`),
    ...Object.entries(scales).map(([key, value]) => `--theme-colors-${key}:${value};`),
    ...Object.entries(roles).map(([key, value]) => `--c-${key}:${rgb(value)};`),
  ].join("")
}

export const getColorThemeCSS = (defaultPreference: unknown) => {
  const preference = getColorThemePreference(defaultPreference)
  const fallback = resolveColorTheme(preference)
  const systemLight = preference === "system"
    ? `@media(prefers-color-scheme:light){:root:not([data-color-theme]){${declarations(resolveColorTheme("system", false))}}}`
    : ""
  return `:root{${declarations(fallback)}}${systemLight}${colorThemes.map((theme) => `:root[data-color-theme="${theme.id}"]{${declarations(theme)}}`).join("")}`
}

export const getColorThemeBootstrap = (defaultPreference: unknown) => {
  const preference = getColorThemePreference(defaultPreference)
  const themeMap = Object.fromEntries(colorThemes.map((theme) => [theme.id, { scheme: theme.scheme, background: theme.editor.bg2 }]))
  return `(function(){var p=${JSON.stringify(preference)},themes=${JSON.stringify(themeMap)};try{var saved=localStorage.getItem(${JSON.stringify(COLOR_THEME_STORAGE_KEY)});if(saved==='system'||Object.prototype.hasOwnProperty.call(themes,saved))p=saved;}catch(e){}var dark=true;try{dark=matchMedia('(prefers-color-scheme: dark)').matches;}catch(e){}var id=p==='system'?(dark?'dark-modern':'light-modern'):p;var t=themes[id],root=document.documentElement;root.setAttribute('data-color-theme',id);root.setAttribute('data-theme',t.scheme);root.setAttribute('data-theme-preference',p);root.style.colorScheme=t.scheme;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',t.background);})();`
}
