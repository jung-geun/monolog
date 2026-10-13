import {
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_COLOR_THEME,
  colorThemes,
  getColorThemeBootstrap,
  getColorThemeCSS,
  getColorThemePreference,
  isColorThemePreference,
  resolveColorTheme,
} from "src/styles/colors"
import { createTheme } from "src/styles/theme"

const bootstrap = (operatorDefault: unknown, visitor: string | null, systemDark = true, denied = false) => {
  const root = document.createElement("html")
  const meta = document.createElement("meta")
  new Function("document", "localStorage", "matchMedia", getColorThemeBootstrap(operatorDefault))(
    { documentElement: root, querySelector: () => meta },
    { getItem: (key: string) => { if (denied) throw new Error("Storage denied"); return key === COLOR_THEME_STORAGE_KEY ? visitor : null } },
    () => ({ matches: systemDark }),
  )
  return { root, meta }
}

describe("authentic named color themes", () => {
  it("uses official names, distinct editor/chrome colors, and consistent syntax palettes", () => {
    expect(colorThemes.map((theme) => theme.label)).toEqual(["One Dark Pro Mix", "Dark Modern", "Light Modern"])
    expect(resolveColorTheme("one-dark-pro-mix").editor).toMatchObject({ bg: "#282c34", bg2: "#21252b" })
    expect(resolveColorTheme("dark-modern").editor).toMatchObject({ bg: "#1f1f1f", bg2: "#181818" })
    expect(resolveColorTheme("light-modern").editor).toMatchObject({ bg: "#ffffff", bg2: "#f8f8f8" })
    expect(resolveColorTheme("one-dark-pro-mix").syntax.keyword).toBe("#c678dd")
  })

  it.each([undefined, null, "", "dark", "light", "invalid", 123, {}, "toString"])("rejects invalid preference %p", (value) => {
    expect(isColorThemePreference(value)).toBe(false)
    expect(getColorThemePreference(value)).toBe(DEFAULT_COLOR_THEME)
  })

  it("resolves System to the matching genuine Modern theme", () => {
    expect(resolveColorTheme("system", true).id).toBe("dark-modern")
    expect(resolveColorTheme("system", false).id).toBe("light-modern")
  })

  it("maps Emotion surface colors to first-paint CSS variables", () => {
    const theme = createTheme({ colorTheme: resolveColorTheme("one-dark-pro-mix") })
    expect(theme.colors.editor.bg).toBe("var(--editor-bg)")
    expect(theme.colors.editor.bg2).toBe("var(--editor-bg2)")
    expect(theme.colors.gray12).toBe("var(--theme-colors-gray12)")
    const css = getColorThemeCSS("one-dark-pro-mix")
    expect(css).toContain('--c-card:40 44 52;')
    expect(css).toContain('--c-chrome:33 37 43;')
    expect(css).toContain('--syntax-keyword:#c678dd;')
    expect(css).toContain(':root[data-color-theme="light-modern"]')
    expect(getColorThemeCSS("system")).toContain("@media(prefers-color-scheme:light)")
  })
})

describe("theme first-paint bootstrap", () => {
  it("restores a valid visitor choice ahead of the operator default", () => {
    const { root, meta } = bootstrap("one-dark-pro-mix", "light-modern")
    expect(root.dataset.colorTheme).toBe("light-modern")
    expect(root.dataset.themePreference).toBe("light-modern")
    expect(root.dataset.theme).toBe("light")
    expect(meta.getAttribute("content")).toBe("#f8f8f8")
  })

  it.each([null, "unknown", "dark", "constructor", "__proto__"])("uses the valid operator default for visitor %p", (visitor) => {
    expect(bootstrap("light-modern", visitor).root.dataset.colorTheme).toBe("light-modern")
  })

  it("safely falls back for an invalid operator default and denied storage", () => {
    expect(bootstrap("unknown", null, false, true).root.dataset.colorTheme).toBe(DEFAULT_COLOR_THEME)
    expect(bootstrap("dark-modern", "light-modern", false, true).root.dataset.colorTheme).toBe("dark-modern")
  })

  it("restores System without freezing it to a binary visitor preference", () => {
    const { root } = bootstrap("one-dark-pro-mix", "system", false)
    expect(root.dataset.themePreference).toBe("system")
    expect(root.dataset.colorTheme).toBe("light-modern")
    expect(bootstrap("system", null, true).root.dataset.colorTheme).toBe("dark-modern")
  })
})
