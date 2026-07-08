const nextJest = require("next/jest")

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: "./",
})

const BASE_JEST_OPTIONS = {
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^src/(.*)$": "<rootDir>/src/$1",
    "^site\\.config$": "<rootDir>/site.config.js",
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["@swc/jest", {
      jsc: {
        parser: { syntax: "typescript", tsx: true, decorators: false },
        transform: { react: { runtime: "automatic" } },
      },
    }],
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{ts,tsx}",
  ],
}

function createConfig(overrides = {}) {
  return createJestConfig({
    ...BASE_JEST_OPTIONS,
    ...overrides,
  })
}

module.exports = {
  createConfig,
}
