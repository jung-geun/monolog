import { createRequire } from "module"
const require = createRequire(import.meta.url)

const nextConfig = require("eslint-config-next/core-web-vitals")

export default [
  ...nextConfig,
  {
    rules: {
      // New in react-hooks v5: calling setState synchronously in effects.
      // Existing code triggers this; demote to warn until refactored.
      "react-hooks/set-state-in-effect": "warn",
      // React Compiler compatibility rule — not applicable (no React Compiler).
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "coverage/**"],
  },
]
