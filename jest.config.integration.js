const { createConfig } = require("./jest.config.base")

module.exports = createConfig({
  testMatch: [
    "<rootDir>/tests/integration/**/*.integration.test.ts",
    "<rootDir>/tests/integration/**/*.integration.test.tsx",
    "<rootDir>/tests/integration/**/*.test.ts",
    "<rootDir>/tests/integration/**/*.test.tsx",
  ],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
})
