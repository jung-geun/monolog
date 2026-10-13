import { ThemeProvider as _ThemeProvider } from "@emotion/react"
import { Global } from "./Global"
import { createTheme } from "src/styles"
import { ColorTheme } from "src/styles/colors"

type Props = {
  colorTheme: ColorTheme
  children?: React.ReactNode
}

export const ThemeProvider = ({ colorTheme, children }: Props) => {
  const theme = createTheme({ colorTheme })

  return (
    <_ThemeProvider theme={theme}>
        <Global />
        {children}
    </_ThemeProvider>
  )
}
