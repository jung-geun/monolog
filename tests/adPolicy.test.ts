import { canLoadAdSense, canLoadManualAds } from "src/components/AdSlot/policy"

const settings = () => ({
  enable: true,
  config: {
    client: "ca-pub-test",
    mode: "manual",
    autoAdsInPageDisabledConfirmed: false,
    autoAdsDisabledConfirmed: true,
    slots: { article: "1234567890", postBottom: "" },
  },
})

it("permits manual units only with a client, unit and explicit account-setting confirmation", () => {
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

it("requires every manual prerequisite independently", () => {
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

it("loads the overlay-only automatic SDK with in-page-off confirmation without requiring manual units", () => {
  const auto = settings()
  auto.config.mode = "auto"
  auto.config.autoAdsInPageDisabledConfirmed = true
  auto.config.autoAdsDisabledConfirmed = false
  auto.config.slots.article = ""
  expect(canLoadAdSense(auto)).toBe(true)
  auto.config.autoAdsInPageDisabledConfirmed = false
  expect(canLoadAdSense(auto)).toBe(false)
})

it("does not mistake manual-mode confirmation or unit IDs for automatic in-page-off confirmation", () => {
  const auto = settings()
  auto.config.mode = "auto"
  expect(canLoadAdSense(auto)).toBe(false)
})

it("never permits manual placements in automatic mode even with leftover manual settings", () => {
  const auto = settings()
  auto.config.mode = "auto"
  auto.config.autoAdsInPageDisabledConfirmed = true
  expect(canLoadManualAds(auto)).toBe(false)
})

it("still requires a real unit and Auto ads OFF confirmation for the manual SDK", () => {
  const manual = settings()
  manual.config.autoAdsInPageDisabledConfirmed = true
  expect(canLoadAdSense(manual)).toBe(true)
  manual.config.slots.article = ""
  expect(canLoadAdSense(manual)).toBe(false)
  manual.config.slots.article = "1234567890"
  manual.config.autoAdsDisabledConfirmed = false
  expect(canLoadAdSense(manual)).toBe(false)
})

it("honors the global disable switch and missing client in confirmed automatic mode", () => {
  const auto = settings()
  auto.config.mode = "auto"
  auto.config.autoAdsInPageDisabledConfirmed = true
  auto.enable = false
  expect(canLoadAdSense(auto)).toBe(false)
  auto.enable = true
  auto.config.client = ""
  expect(canLoadAdSense(auto)).toBe(false)
})

it.each(["", "AUTO", "unknown"])("fails closed for an unrecognized mode %j", mode => {
  const config = settings()
  config.config.mode = mode
  config.config.autoAdsInPageDisabledConfirmed = true
  expect(canLoadAdSense(config)).toBe(false)
  expect(canLoadManualAds(config)).toBe(false)
})
