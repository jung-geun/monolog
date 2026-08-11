import { getRuntimePublicConfig, isGoogleMeasurementId } from "src/libs/runtimeConfig"

describe("runtime public configuration", () => {
  afterEach(() => {
    delete window.__MONOLOG_RUNTIME_CONFIG__
  })

  it("uses empty defaults when the container has no public configuration", () => {
    expect(getRuntimePublicConfig()).toEqual({
      googleMeasurementId: "",
      googleSiteVerification: "",
      naverSiteVerification: "",
    })
  })

  it("reads an injected analytics measurement ID", () => {
    window.__MONOLOG_RUNTIME_CONFIG__ = {
      googleMeasurementId: "G-TEST123",
      googleSiteVerification: "",
      naverSiteVerification: "",
    }

    expect(getRuntimePublicConfig().googleMeasurementId).toBe("G-TEST123")
    expect(isGoogleMeasurementId("G-TEST123")).toBe(true)
    expect(isGoogleMeasurementId("not-a-measurement-id")).toBe(false)
  })

  it("drops malformed global values instead of exposing them to integrations", () => {
    window.__MONOLOG_RUNTIME_CONFIG__ = {
      googleMeasurementId: 1 as unknown as string,
      googleSiteVerification: null as unknown as string,
      naverSiteVerification: "naver-token",
    }

    expect(getRuntimePublicConfig()).toEqual({
      googleMeasurementId: "",
      googleSiteVerification: "",
      naverSiteVerification: "naver-token",
    })
  })
})
