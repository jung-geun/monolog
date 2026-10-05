/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("src/libs/content", () => ({ reconcileContent: jest.fn() }))
jest.mock("src/libs/utils/auth/verifyToken", () => ({ verifyRevalidateToken: jest.fn(() => true) }))

import handler from "src/pages/api/revalidate"
import { reconcileContent } from "src/libs/content"

const reconcile = jest.mocked(reconcileContent)

async function invoke(query: Record<string, string>) {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: jest.fn(),
    revalidate: jest.fn(),
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.body = body
      return res
    },
  }
  await handler({ method: "GET", query } as unknown as NextApiRequest, res as unknown as NextApiResponse)
  return res
}

const result = { completed: 1, changed: 0, failed: [], revision: 3, maintenancePending: 0, notificationsPending: 0 }

beforeEach(() => reconcile.mockReset())

describe("/api/revalidate", () => {
  it.each(["//evil.example/post", "https://evil.example/post", "/post?draft=1", "relative"])(
    "rejects %s before any content work",
    async path => {
      const res = await invoke({ path })

      expect(res.statusCode).toBe(400)
      expect(reconcile).not.toHaveBeenCalled()
    },
  )

  it.each([
    [[], 200, "completed"],
    [["/alpha"], 503, "pending"],
  ] as const)("reports pending %j as HTTP %i so schedulers retry unfinished routes", async (pending, code, status) => {
    reconcile.mockResolvedValue({ ...result, pending: [...pending] })

    const res = await invoke({ path: "/alpha" })

    expect(res.statusCode).toBe(code)
    expect(res.body).toMatchObject({ status, pending: pending.length })
  })
})
