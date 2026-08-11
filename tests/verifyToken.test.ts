/**
 * @jest-environment node
 */

import type { NextApiRequest } from "next"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"

const originalSecret = process.env.REVALIDATE_SECRET
const originalLegacySecret = process.env.TOKEN_FOR_REVALIDATE

function request(authorization?: string, query: Record<string, string> = {}): NextApiRequest {
  return {
    headers: authorization ? { authorization } : {},
    query,
  } as NextApiRequest
}

function setSecrets(secret: string | undefined, legacySecret: string | undefined): void {
  if (secret === undefined) delete process.env.REVALIDATE_SECRET
  else process.env.REVALIDATE_SECRET = secret

  if (legacySecret === undefined) delete process.env.TOKEN_FOR_REVALIDATE
  else process.env.TOKEN_FOR_REVALIDATE = legacySecret
}

afterEach(() => {
  setSecrets(originalSecret, originalLegacySecret)
  jest.restoreAllMocks()
})

describe("verifyRevalidateToken", () => {
  it("accepts only the configured Bearer token", () => {
    setSecrets("expected-secret", undefined)

    expect(verifyRevalidateToken(request("Bearer expected-secret"))).toBe(true)
    expect(verifyRevalidateToken(request("Bearer wrong-secret"))).toBe(false)
  })

  it("rejects the removed query token and legacy environment alias", () => {
    setSecrets(undefined, "legacy-secret")
    jest.spyOn(console, "error").mockImplementation(() => undefined)

    expect(verifyRevalidateToken(request(undefined, { secret: "legacy-secret" }))).toBe(false)
  })
})
