/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("src/libs/content", () => ({ reconcileContent: jest.fn() }))
jest.mock("src/libs/utils/auth/verifyToken", () => ({ verifyRevalidateToken: jest.fn(() => true) }))

import handler from "src/pages/api/init"
import { reconcileContent } from "src/libs/content"

const reconcile = jest.mocked(reconcileContent)

async function invoke() {
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
  await handler({ method: "GET" } as NextApiRequest, res as unknown as NextApiResponse)
  return res
}

describe("/api/init", () => {
  it("does not report a cold warmup as successful while routes or pages remain pending", async () => {
    reconcile.mockResolvedValueOnce({ completed: 4, changed: 2, failed: [], pending: ["/beta"], revision: 1, maintenancePending: 1, notificationsPending: 0 })
    const pending = await invoke()
    expect(pending.statusCode).toBe(503)

    reconcile.mockResolvedValueOnce({ completed: 1, changed: 0, failed: [], pending: [], revision: 1, maintenancePending: 1, notificationsPending: 1 })
    const warmed = await invoke()
    expect(warmed.statusCode).toBe(200)
    expect(warmed.body).toMatchObject({ status: "completed", maintenancePending: 1, notificationsPending: 1 })
  })
})
