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
  bg: "#faf7ee",
  bg2: "#efe9d9",
  bg3: "#e2d9c2",
  fg: "#1c1d1a",
  fg2: "#4a4d44",
  fg3: "#7a7c72",
  fg4: "#a8a89a",
  line: "#d6cfb9",
  line2: "#bdb499",
  gutter: "#ece5d2",
  accent: "#c2410c",
  accentSoft: "#f5dab9",
  accent2: "#0f6e57",
  accent3: "#1e4d6e",
}

const editorDark: EditorColors = {
  bg: "#0e0f13",
  bg2: "#16181f",
  bg3: "#1f2129",
  fg: "#ececea",
  fg2: "#a4a69e",
  fg3: "#888a80",
  fg4: "#6b6d63",
  line: "#262830",
  line2: "#383a42",
  gutter: "#131419",
  accent: "#ff7833",
  accentSoft: "#3a1f12",
  accent2: "#8ed26d",
  accent3: "#6cb8e8",
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
