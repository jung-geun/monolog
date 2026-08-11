/**
 * @jest-environment node
 */

import fs from "fs"
import os from "os"
import path from "path"

const {
  renderRuntimeConfig,
  writeRuntimeConfig,
} = require("../scripts/write-runtime-config") as {
  renderRuntimeConfig: (config: Record<string, string>) => string
  writeRuntimeConfig: (options: {
    environment: NodeJS.ProcessEnv
    outputPath: string
    staticPagesDirectory: string
  }) => string
}

describe("runtime config startup writer", () => {
  let temporaryDirectory: string

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "monolog-runtime-config-"))
  })

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it("writes only allowlisted public values and patches static verification tags", () => {
    const outputPath = path.join(temporaryDirectory, "public", "runtime-config.js")
    const staticPagesDirectory = path.join(temporaryDirectory, ".next", "server", "pages")
    fs.mkdirSync(staticPagesDirectory, { recursive: true })
    const pagePath = path.join(staticPagesDirectory, "index.html")
    fs.writeFileSync(
      pagePath,
      '<html><head><meta name="google-site-verification" content="old-token"></head><body></body></html>'
    )

    writeRuntimeConfig({
      environment: {
        NODE_ENV: "test",
        NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID: "G-TEST123",
        NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: 'token-"<&',
        NOTION_TOKEN: "must-not-be-exposed",
      },
      outputPath,
      staticPagesDirectory,
    })

    const runtimeConfig = fs.readFileSync(outputPath, "utf8")
    const page = fs.readFileSync(pagePath, "utf8")

    expect(runtimeConfig).toContain('"googleMeasurementId":"G-TEST123"')
    expect(runtimeConfig).not.toContain("must-not-be-exposed")
    expect(page).toContain('content="token-&quot;&lt;&amp;"')
    expect(page).not.toContain("old-token")
  })

  it("serializes public values without making an empty configuration fail", () => {
    expect(
      renderRuntimeConfig({
        googleMeasurementId: "",
        googleSiteVerification: "",
        naverSiteVerification: "",
      })
    ).toContain("window.__MONOLOG_RUNTIME_CONFIG__")
  })

  it("does not permit a public value to terminate the runtime script", () => {
    const script = renderRuntimeConfig({
      googleMeasurementId: "G-TEST123</script>",
      googleSiteVerification: "",
      naverSiteVerification: "",
    })

    expect(script).not.toContain("</script>")
    expect(script).toContain("G-TEST123\\u003c/script>")
  })
})
