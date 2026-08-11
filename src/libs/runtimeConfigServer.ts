import type { RuntimePublicConfig } from "src/libs/runtimeConfig"

export const getRuntimePublicConfigFromEnvironment = (
  environment: NodeJS.ProcessEnv = process.env
): RuntimePublicConfig => ({
  googleMeasurementId: environment["NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID"] || "",
  googleSiteVerification: environment["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"] || "",
  naverSiteVerification: environment["NEXT_PUBLIC_NAVER_SITE_VERIFICATION"] || "",
})
