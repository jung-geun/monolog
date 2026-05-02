// Compatibility shim — delegates to the unified cacheStore.
// Will be removed in a follow-up PR.
const { cacheStore } = require("./cache/cacheStore")

const notionCache = {
  get: (key) => {
    // Synchronous shim: return null — actual reads use cacheStore.getOrSet
    return null
  },
  set: (key, data) => {
    // no-op; cacheStore handles writes
  },
  clear: async () => {
    await cacheStore.clear()
  },
}

module.exports = { notionCache }
