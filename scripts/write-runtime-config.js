const fs = require("fs")
const path = require("path")

const verificationMetaNames = [
  ["google-site-verification", "googleSiteVerification"],
  ["naver-site-verification", "naverSiteVerification"],
]

const publicConfig = (environment = process.env) => ({
  googleMeasurementId: environment.NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID || "",
  googleSiteVerification: environment.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  naverSiteVerification: environment.NEXT_PUBLIC_NAVER_SITE_VERIFICATION || "",
})

const escapeHtmlAttribute = (value) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character])

const renderVerificationMetaTags = (config) => {
  const tags = verificationMetaNames
    .filter(([, key]) => config[key])
    .map(
      ([name, key]) =>
        `<meta name="${name}" content="${escapeHtmlAttribute(config[key])}">`
    )

  if (tags.length === 0) return ""

  return `<!-- monolog-runtime-verification:start -->${tags.join("")}<!-- monolog-runtime-verification:end -->`
}

const serializeRuntimeConfig = (config) =>
  JSON.stringify(config)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")

const renderRuntimeConfig = (config) => `window.__MONOLOG_RUNTIME_CONFIG__ = Object.freeze(${serializeRuntimeConfig(config)});

;(function (config) {
  if (typeof document === "undefined") return;

  [
    ["google-site-verification", config.googleSiteVerification],
    ["naver-site-verification", config.naverSiteVerification],
  ].forEach(function ([name, content]) {
    if (!content || document.querySelector('meta[name="' + name + '"]')) return;

    var meta = document.createElement("meta");
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
  });
})(window.__MONOLOG_RUNTIME_CONFIG__);
`

const listHtmlFiles = (directory) => {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listHtmlFiles(entryPath)
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : []
  })
}

const stripVerificationMetaTags = (html) =>
  verificationMetaNames.reduce(
    (result, [name]) =>
      result.replace(
        new RegExp(`<meta\\b[^>]*\\bname=(?:["']${name}["']|${name})[^>]*>\\s*`, "gi"),
        ""
      ),
    html.replace(
      /<!-- monolog-runtime-verification:start -->[\s\S]*?<!-- monolog-runtime-verification:end -->\s*/g,
      ""
    )
  )

const injectRuntimeVerificationMetaTags = ({ config, staticPagesDirectory }) => {
  const verificationMetaTags = renderVerificationMetaTags(config)

  return listHtmlFiles(staticPagesDirectory).reduce((updatedFiles, filePath) => {
    const original = fs.readFileSync(filePath, "utf8")
    const stripped = stripVerificationMetaTags(original)
    const updated = verificationMetaTags
      ? stripped.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${verificationMetaTags}`)
      : stripped

    if (updated !== original) {
      fs.writeFileSync(filePath, updated, "utf8")
      return updatedFiles + 1
    }

    return updatedFiles
  }, 0)
}

const writeRuntimeConfig = ({
  environment = process.env,
  outputPath,
  staticPagesDirectory = path.join(process.cwd(), ".next", "server", "pages"),
} = {}) => {
  const config = publicConfig(environment)
  const target = outputPath || path.join(process.cwd(), "public", "runtime-config.js")
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, renderRuntimeConfig(config), "utf8")

  if (staticPagesDirectory) {
    injectRuntimeVerificationMetaTags({ config, staticPagesDirectory })
  }

  return target
}

if (require.main === module) {
  writeRuntimeConfig()
}

module.exports = {
  escapeHtmlAttribute,
  injectRuntimeVerificationMetaTags,
  publicConfig,
  renderRuntimeConfig,
  renderVerificationMetaTags,
  serializeRuntimeConfig,
  writeRuntimeConfig,
}
