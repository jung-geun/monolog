import { keys } from "src/libs/cache/keys"

describe("builtGraph cache key", () => {
  it("invalidates layouts built with the previous node-radius scale", () => {
    expect(keys.builtGraph("graph-hash")).toBe("builtGraph:v4:graph-hash")
  })
})
