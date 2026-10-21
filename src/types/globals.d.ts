/// <reference types="gtag.js" />
import type { RuntimePublicConfig } from "src/libs/runtimeConfig"


declare global {
  interface Window {
    __TABLOG_RUNTIME_CONFIG__?: RuntimePublicConfig
    gtag: Gtag.Gtag
    adsbygoogle?: Record<string, unknown>[]
  }
}

export {}
