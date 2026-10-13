import { Theme } from "@emotion/react"
import { Colors, colors, ColorTheme } from "./colors"
import { variables } from "./variables"
import { zIndexes } from "./zIndexes"
import { SchemeType } from "src/types"

declare module "@emotion/react" {
  export interface Theme {
    scheme: SchemeType
    colorTheme: ColorTheme
    colors: Colors
    zIndexes: typeof zIndexes
    variables: typeof variables
  }
}

type Options = {
  colorTheme: ColorTheme
}

export const createTheme = (options: Options): Theme => ({
  scheme: options.colorTheme.scheme,
  colorTheme: options.colorTheme,
  colors,
  variables: variables,
  zIndexes: zIndexes,
})
