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
  bg: "#fbfaf6",
  bg2: "#f3f1ea",
  bg3: "#e9e6dc",
  fg: "#1c1d1a",
  fg2: "#5a5c54",
  fg3: "#65675f",
  fg4: "#b8bab0",
  line: "#e2dfd1",
  line2: "#cfcbb8",
  gutter: "#f0ede2",
  accent: "#ee5a1c",
  accentSoft: "#ffe2cf",
  accent2: "#2d6a2c",
  accent3: "#1f5a8a",
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
