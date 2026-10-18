import { canLoadManualAds } from "src/components/AdSlot/manualAds"

const settings = () => ({
  enable: true,
  config: {
    client: "ca-pub-test",
    autoAdsDisabledConfirmed: true,
    slots: { article: "1234567890", postBottom: "" },
  },
})

it("permits the SDK only with a client, unit and explicit account-setting confirmation", () => {
  expect(canLoadManualAds(settings())).toBe(true)
  const bottomOnly = settings()
  bottomOnly.config.slots = { article: "", postBottom: "9876543210" }
  expect(canLoadManualAds(bottomOnly)).toBe(true)
})

it("does not load the SDK with client-only legacy configuration", () => {
  const config = settings()
  config.config.slots.article = ""
  config.config.autoAdsDisabledConfirmed = false
  expect(canLoadManualAds(config)).toBe(false)
})

it("requires every prerequisite independently", () => {
  const disabled = settings()
  disabled.enable = false
  expect(canLoadManualAds(disabled)).toBe(false)
  const noClient = settings()
  noClient.config.client = ""
  expect(canLoadManualAds(noClient)).toBe(false)
  const unconfirmed = settings()
  unconfirmed.config.autoAdsDisabledConfirmed = false
  expect(canLoadManualAds(unconfirmed)).toBe(false)
  const noUnit = settings()
  noUnit.config.slots.article = ""
  expect(canLoadManualAds(noUnit)).toBe(false)
})
