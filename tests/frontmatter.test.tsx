import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Frontmatter from "src/components/Frontmatter"
import { ThemeProvider } from "@emotion/react"
import { createTheme } from "src/styles/theme"
import { resolveColorTheme } from "src/styles/colors"

it("renders KST calendar days while preserving machine-readable UTC timestamps", () => {
  const published = "2026-10-04T23:00:00.000Z"
  const modified = "2026-10-05T16:00:00.000Z"
  const host = document.createElement("div")
  host.innerHTML = renderToStaticMarkup(<ThemeProvider theme={createTheme({ colorTheme: resolveColorTheme("one-dark-pro-mix") })}><Frontmatter title="Scheduled publication" date={published} modifiedDate={modified} /></ThemeProvider>)

  const [date, edited] = host.querySelectorAll("time")
  expect(date.textContent).toBe("2026-10-05")
  expect(date).toHaveAttribute("datetime", published)
  expect(edited.textContent).toBe("2026-10-06")
  expect(edited).toHaveAttribute("datetime", modified)
})
