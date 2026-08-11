export type RuntimePublicConfig = {
  googleMeasurementId: string
  googleSiteVerification: string
  naverSiteVerification: string
}

const emptyRuntimePublicConfig: RuntimePublicConfig = {
  googleMeasurementId: "",
  googleSiteVerification: "",
  naverSiteVerification: "",
}

export const getRuntimePublicConfig = (): RuntimePublicConfig => {
  if (typeof window === "undefined") return emptyRuntimePublicConfig

  const config = window.__MONOLOG_RUNTIME_CONFIG__
  if (!config) return emptyRuntimePublicConfig

  return {
    googleMeasurementId:
      typeof config.googleMeasurementId === "string" ? config.googleMeasurementId : "",
    googleSiteVerification:
      typeof config.googleSiteVerification === "string"
        ? config.googleSiteVerification
        : "",
    naverSiteVerification:
      typeof config.naverSiteVerification === "string"
        ? config.naverSiteVerification
        : "",
  }
}

export const isGoogleMeasurementId = (value: unknown): value is string =>
  typeof value === "string" && /^G-[A-Z0-9]+$/i.test(value)
