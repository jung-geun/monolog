/**
 * @jest-environment node
 */

import { createHmac } from "crypto"
import { Readable } from "stream"
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("src/libs/content", () => ({ enqueueContentEvent: jest.fn(), reconcileContent: jest.fn() }))
jest.mock("src/libs/utils/logger", () => ({ warnLog: jest.fn() }))

import handler from "src/pages/api/notion-webhook"
import { enqueueContentEvent, reconcileContent } from "src/libs/content"
import { warnLog } from "src/libs/utils/logger"

const TOKEN = "secret_webhookVerificationFixture"
const PAGE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const event = JSON.stringify({ id: "event-1", type: "page.content_updated", entity: { id: PAGE_ID, type: "page" } })

async function invoke(body: string, signature?: string) {
  const req = Object.assign(Readable.from([Buffer.from(body)]), {
    method: "POST",
    headers: signature ? { "x-notion-signature": signature } : {},
  })
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: jest.fn(),
    revalidate: jest.fn(),
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(value: unknown) {
      res.body = value
      return res
    },
  }
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse)
  return res
}

const sign = (body: string, secret = TOKEN) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN
})

describe("/api/notion-webhook", () => {
  it("accepts only Notion's subscription handshake before a signing secret is configured", async () => {
    const handshake = await invoke(JSON.stringify({ verification_token: TOKEN }))
    expect(handshake.statusCode).toBe(200)
    expect(jest.mocked(warnLog).mock.calls[0][0]).toContain(TOKEN)

    const unsigned = await invoke(event)
    expect(unsigned.statusCode).toBe(503)
    expect(enqueueContentEvent).not.toHaveBeenCalled()
  })

  it.each([
    ["no signature", undefined],
    ["another secret", sign(event, "secret_attackerControlledValue000")],
  ])("rejects an event with %s without touching content state", async (_case, signature) => {
    process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = TOKEN

    const res = await invoke(event, signature)

    expect(res.statusCode).toBe(401)
    expect(enqueueContentEvent).not.toHaveBeenCalled()
    expect(reconcileContent).not.toHaveBeenCalled()
  })

  it("queues the signed page hint and publishes it before reporting success", async () => {
    process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = TOKEN
    jest.mocked(reconcileContent).mockResolvedValue({ completed: 3, changed: 1, failed: [], pending: [], revision: 2, maintenancePending: 1, notificationsPending: 0 })

    const res = await invoke(event, sign(event))

    expect(res.statusCode).toBe(200)
    expect(enqueueContentEvent).toHaveBeenCalledWith("event-1", [PAGE_ID])
    expect(res.body).toMatchObject({ status: "completed", changed: 1 })
  })
})
