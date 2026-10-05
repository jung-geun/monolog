const { createConfig } = require("./jest.config.base")

// next/jest loads local .env; unit tests must not open its persistent Redis client.
process.env.REDIS_URL = ""

module.exports = createConfig({
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  testPathIgnorePatterns: [
    "<rootDir>/\\.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/tests/integration/",
    "<rootDir>/tests/.*\\.integration\\.test\\.(ts|tsx)$",
  ],
})

