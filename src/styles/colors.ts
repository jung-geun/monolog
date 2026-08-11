import {
  gray,
  blue,
  red,
  green,
  grayDark,
  blueDark,
  redDark,
  greenDark,
  indigo,
  indigoDark,
} from "@radix-ui/colors"

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

const editorLight: EditorColors = {
  bg: "#f8f8f8",
  bg2: "#ffffff",
  bg3: "#f2f2f2",
  fg: "#1f1f1f",
  fg2: "#3b3b3b",
  fg3: "#6e7681",
  fg4: "#868686",
  line: "#e5e5e5",
  line2: "#cecece",
  gutter: "#f2f2f2",
  accent: "#005fb8",
  accentSoft: "#dceeff",
  accent2: "#005fb8",
  accent3: "#004f9e",
}

const editorDark: EditorColors = {
  bg: "#181818",
  bg2: "#1f1f1f",
  bg3: "#252525",
  fg: "#e1e1e1",
  fg2: "#cccccc",
  fg3: "#9d9d9d",
  fg4: "#b3b3b3",
  line: "#2b2b2b",
  line2: "#3c3c3c",
  gutter: "#202020",
  accent: "#0078d4",
  accentSoft: "#06365c",
  accent2: "#0078d4",
  accent3: "#4daafc",
}

export type Colors = typeof colors.light & typeof colors.dark

export const colors = {
  light: {
    ...indigo,
    ...gray,
    ...blue,
    ...red,
    ...green,
    editor: editorLight,
  },
  dark: {
    ...indigoDark,
    ...grayDark,
    ...blueDark,
    ...redDark,
    ...greenDark,
    editor: editorDark,
  },
}
