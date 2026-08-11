/**
 * @jest-environment node
 */

import nextConfig from "../next.config"

describe("next.config.js rewrites", () => {
  it("returns exact rewrites shape", async () => {
    const rewrites = await nextConfig.rewrites()
    expect(rewrites).toEqual({
      beforeFiles: [],
      afterFiles: [
        {
          source: "/:slug\\.md",
          destination: "/api/markdown/:slug",
        },
      ],
      fallback: [],
    })
  })
})
