/**
 * @jest-environment node
 */

jest.mock("src/apis", () => ({
  getPosts: jest.fn(),
}))

jest.mock("src/libs/utils/auth/verifyToken", () => ({
  verifyRevalidateToken: jest.fn(),
}))

jest.mock("src/libs/utils/security", () => ({
  getInternalOrigin: jest.fn(),
}))

import { getPosts } from "src/apis"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"
import type { NextApiRequest, NextApiResponse } from "next"
import { getInternalOrigin } from "src/libs/utils/security"
import handler from "src/pages/api/init"

const json = jest.fn()
const status = jest.fn(() => ({ json }))
const revalidate = jest.fn().mockResolvedValue(undefined)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getPosts as jest.Mock).mockResolvedValue([
    { slug: "a" },
    { slug: "b" },
  ])
  ;(verifyRevalidateToken as jest.Mock).mockReturnValue(true)
  ;(getInternalOrigin as jest.Mock).mockReturnValue("http://localhost:3000")
  global.fetch = jest.fn().mockResolvedValue(new Response(""))
})

describe("/api/init", () => {
  it("warms post and index routes before reporting success", async () => {
    let activeRevalidations = 0
    let maxActiveRevalidations = 0
    revalidate.mockImplementation(async () => {
      activeRevalidations += 1
      maxActiveRevalidations = Math.max(maxActiveRevalidations, activeRevalidations)
      const { promise, resolve } = Promise.withResolvers<void>()
      setImmediate(resolve)
      await promise
      activeRevalidations -= 1
    })
    const res = { revalidate, status, json }
    await handler({} as NextApiRequest, res as unknown as NextApiResponse)

    expect(new Set(revalidate.mock.calls.map(([path]) => path))).toEqual(
      new Set([
        "/a",
        "/b",
        "/",
        "/search",
        "/series",
        "/graph",
        "/ontology",
      ])
    )
    expect(maxActiveRevalidations).toBe(1)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, postsRevalidated: 2 })
    )
  })
})
