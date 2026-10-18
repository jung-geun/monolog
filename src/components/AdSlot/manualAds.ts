type ManualAdSettings = {
  enable: boolean
  config: {
    client: string
    autoAdsDisabledConfirmed: boolean
    slots: { article: string; postBottom: string }
  }
}

/** This confirmation records an operator action; it cannot change AdSense account settings. */
export function canLoadManualAds(settings: ManualAdSettings): boolean {
  return Boolean(
    settings.enable &&
    settings.config.client &&
    settings.config.autoAdsDisabledConfirmed &&
    (settings.config.slots.article || settings.config.slots.postBottom)
  )
}
