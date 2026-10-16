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
  const resolveConfig = createJestConfig({
    ...BASE_JEST_OPTIONS,
    ...overrides,
  })
  return async () => {
    const config = await resolveConfig()
    // RNX and its utility dependencies ship ESM-only; exercise the actual
    // renderer rather than mocking away React text ownership regressions.
    const esmNotionPackages = "react-notion-x|notion-utils|notion-types|is-url-superb|memoize|mimic-function|normalize-url|p-queue|p-timeout"
    config.transformIgnorePatterns = config.transformIgnorePatterns.map(pattern =>
      pattern.startsWith("/node_modules/(?!.pnpm)")
        ? pattern.replace("/node_modules/", `/node_modules/(?!(${esmNotionPackages})/)`)
        : pattern
    )
    return config
  }
}

module.exports = {
  createConfig,
}
