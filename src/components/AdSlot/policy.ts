type AdSenseSettings = {
  enable: boolean
  config: {
    client: string
    mode: string
    autoAdsInPageDisabledConfirmed: boolean
    autoAdsDisabledConfirmed: boolean
    slots: { article: string; postBottom: string }
  }
}

/** Confirmations record account-side actions; they do not configure AdSense.
 * Automatic mode requires in-page ads OFF, allowing only overlay formats.
 */
export function canLoadAdSense(settings: AdSenseSettings): boolean {
  if (!settings.enable || !settings.config.client) return false
  if (settings.config.mode === "auto") return settings.config.autoAdsInPageDisabledConfirmed
  return canLoadManualAds(settings)
}

export function canLoadManualAds(settings: AdSenseSettings): boolean {
  return Boolean(
    settings.enable &&
    settings.config.client &&
    settings.config.mode === "manual" &&
    settings.config.autoAdsDisabledConfirmed &&
    (settings.config.slots.article || settings.config.slots.postBottom)
  )
}
