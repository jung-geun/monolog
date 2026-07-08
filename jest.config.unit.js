const { createConfig } = require("./jest.config.base")

module.exports = createConfig({
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  testPathIgnorePatterns: [
    "<rootDir>/\\.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/tests/integration/",
    "<rootDir>/tests/.*\\.integration\\.test\\.(ts|tsx)$",
  ],
})

