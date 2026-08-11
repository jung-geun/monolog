/// <reference types="gtag.js" />
import type { RuntimePublicConfig } from "src/libs/runtimeConfig"


declare global {
  interface Window {
    __MONOLOG_RUNTIME_CONFIG__?: RuntimePublicConfig
    gtag: Gtag.Gtag
  }
}

export {}
