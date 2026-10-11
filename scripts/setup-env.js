const fs = require("node:fs/promises")
const path = require("node:path")
const crypto = require("node:crypto")
const dotenv = require("dotenv")

const envPath = path.resolve(__dirname, "..", ".env")
const notionVersion = "2026-03-11"

class SetupError extends Error {}

function isPlaceholder(value) {
  return /^(?:ntn_|secret_)?(?:x{3,}|\.{3,}|your(?:[-_ ].*)?|change[-_ ]?me|replace(?:[-_ ].*)?|paste(?:[-_ ].*)?|insert(?:[-_ ].*)?|todo|undefined|null|example(?:[-_ ].*)?|<.*>)$/i.test(value)
}

function uuid(value) {
  const compact = value.replace(/-/g, "")
  if (!/^[0-9a-f]{32}$/i.test(compact) || /^0{32}$/.test(compact)) return null
  if (value !== compact && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return null
  return compact.toLowerCase().replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")
}

async function resolveDataSource(value, token) {
  if (uuid(value)) return value

  let url
  try {
    url = new URL(value)
  } catch {
    throw new SetupError("Set NOTION_DATASOURCE_ID to a data-source UUID or a copied Notion database URL, then rerun yarn setup.")
  }
  const notionHost = /^(?:[a-z0-9-]+\.)*(?:notion\.so|notion\.com|notion\.site)$/i.test(url.hostname)
  const segment = url.pathname.replace(/\/$/, "").split("/").pop()
  const id = segment.match(/(?:^|-)([0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i)?.[1]
  const databaseId = id && uuid(id)
  if (url.protocol !== "https:" || !notionHost || url.username || url.password || !databaseId) {
    throw new SetupError("NOTION_DATASOURCE_ID must be a data-source UUID or an HTTPS Notion database URL containing its database UUID (not a view ID).")
  }

  let response
  try {
    response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": notionVersion,
      },
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    })
  } catch {
    throw new SetupError("Notion database lookup failed or timed out. Check network access to api.notion.com, then rerun yarn setup; .env has not been changed.")
  }
  if (!response.ok) {
    const advice = response.status === 401
      ? "Check NOTION_TOKEN in .env."
      : response.status === 403 || response.status === 404
        ? "Share the original database with your Notion integration and check its read-content capability; linked views are not source databases."
        : response.status === 429
          ? "Notion rate-limited the lookup; wait before rerunning yarn setup."
          : "Check the database URL and Notion service availability, then rerun yarn setup."
    throw new SetupError(`Notion database lookup returned HTTP ${response.status}. ${advice} .env has not been changed.`)
  }

  let database
  try {
    database = await response.json()
  } catch {
    throw new SetupError("Notion returned an unreadable database response; .env has not been changed.")
  }
  const sources = database?.data_sources
  if (!Array.isArray(sources) || sources.length === 0 || sources.some((source) => !source || typeof source.id !== "string" || !uuid(source.id))) {
    throw new SetupError("Notion returned no usable data sources. Share the original database with the integration, or set NOTION_DATASOURCE_ID to an explicit data-source UUID.")
  }
  if (sources.length > 1) {
    // Names are untrusted API content; escape control characters and redact the credential.
    const choices = sources.map((source) => {
      const name = String(source.name || "Unnamed data source").split(token).join("[redacted]")
      return `  ${JSON.stringify(name)}: ${uuid(source.id)}`
    }).join("\n")
    throw new SetupError(`This database has multiple data sources. Set NOTION_DATASOURCE_ID in .env to the intended data-source UUID, then rerun yarn setup:\n${choices}`)
  }
  return uuid(sources[0].id)
}

// Match dotenv assignments (including quoted multiline values) without normalizing
// unrelated settings. Managed assignments remain valid in dotenv, Compose and Bash.
function updateValues(text, updates) {
  const assignment = /^([\t ]*(?:export[\t ]+)?([\w.-]+)[\t ]*(?:=[\t ]*|:[\t ]+))('(?:\\'|[^'])*'|"(?:\\"|[^"])*"|`(?:\\`|[^`])*`|[^#\r\n]*)([\t ]*(?:#[^\r\n]*)?)(?=\r?$)/gm
  const seen = new Set()
  let result = text.replace(assignment, (whole, prefix, key, value, suffix) => {
    if (!updates.has(key)) return whole
    seen.add(key)
    const trailing = value.match(/[\t ]*$/)[0]
    // All written values are UUIDs or hexadecimal randomness: single quotes are
    // both shell-safe and literal under dotenv/Compose parsing.
    const shellPrefix = prefix.replace(/[\t ]*(?:=[\t ]*|:[\t ]+)$/, "=")
    const commentGap = suffix.startsWith("#") && !trailing ? " " : ""
    return `${shellPrefix}'${updates.get(key)}'${trailing}${commentGap}${suffix}`
  })
  const newline = text.includes("\r\n") ? "\r\n" : "\n"
  for (const [key, value] of updates) {
    if (seen.has(key)) continue
    if (result && !result.endsWith("\n")) result += newline
    result += `${key}='${value}'${newline}`
  }
  return result
}

async function main() {
  let original
  try {
    const info = await fs.lstat(envPath)
    if (!info.isFile()) throw new SetupError(".env must be a regular file, not a symlink or directory.")
    original = await fs.readFile(envPath)
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new SetupError("Create .env with cp .env.example .env, fill NOTION_TOKEN and NOTION_DATASOURCE_ID, then run yarn setup.")
    }
    throw error
  }

  const text = original.toString("utf8")
  if (!Buffer.from(text).equals(original)) throw new SetupError(".env must contain valid UTF-8; no changes were made.")
  const environment = dotenv.parse(original)
  const token = environment.NOTION_TOKEN?.trim()
  const source = environment.NOTION_DATASOURCE_ID?.trim()
  if (!token || token !== environment.NOTION_TOKEN || isPlaceholder(token) || /\s/.test(token)) {
    throw new SetupError("Set NOTION_TOKEN in .env to your integration token without whitespace from https://www.notion.so/my-integrations (not a placeholder), and share the original database with that integration.")
  }
  if (!source || isPlaceholder(source)) {
    throw new SetupError("Set NOTION_DATASOURCE_ID in .env to a data-source UUID or a copied Notion database URL (not a placeholder), then rerun yarn setup.")
  }

  const updates = new Map()
  const salts = [
    ["NOTION_COMMENTS_DATASOURCE_ID", "COMMENT_HASH_SALT"],
    ["NOTION_VISIT_STATS_DATASOURCE_ID", "VISITOR_HASH_SALT"],
  ]
  for (const [idKey] of salts) {
    const id = environment[idKey]?.trim()
    if (id && !uuid(id)) throw new SetupError(`${idKey} is optional: leave it blank/commented out, or set an explicit data-source UUID (not a database URL or placeholder).`)
    if (id && id !== environment[idKey]) updates.set(idKey, id)
  }
  for (const key of ["REVALIDATE_SECRET", ...salts.filter(([idKey]) => environment[idKey]?.trim()).map(([, saltKey]) => saltKey)]) {
    const value = environment[key]?.trim()
    if (!value) updates.set(key, crypto.randomBytes(32).toString("hex"))
    else if (isPlaceholder(value)) throw new SetupError(`${key} contains a placeholder. Clear it to let yarn setup generate it, or configure a real secret; existing secrets are never replaced.`)
  }

  const resolved = await resolveDataSource(source, token)
  if (resolved !== environment.NOTION_DATASOURCE_ID) updates.set("NOTION_DATASOURCE_ID", resolved)
  const updated = updateValues(text, updates)
  // Avoid replacing a file edited while the API request was in flight.
  const currentInfo = await fs.lstat(envPath)
  if (!currentInfo.isFile() || !(await fs.readFile(envPath)).equals(original)) {
    throw new SetupError(".env changed during setup; no changes were written. Rerun yarn setup with the updated file.")
  }
  if (updated === text) {
    await fs.chmod(envPath, 0o600)
  } else {
    const temporaryPath = `${envPath}.${crypto.randomBytes(12).toString("hex")}.tmp`
    let file
    let created = false
    try {
      file = await fs.open(temporaryPath, "wx", 0o600)
      created = true
      await file.chmod(0o600)
      await file.writeFile(updated, "utf8")
      await file.sync()
      await file.close()
      file = null
      await fs.rename(temporaryPath, envPath)
    } finally {
      if (file) await file.close()
      if (created) await fs.unlink(temporaryPath).catch((error) => { if (error.code !== "ENOENT") throw error })
    }
  }
  const fields = [...updates.keys()]
  console.log(`Setup complete: .env permissions are 0600. ${fields.length ? `Updated fields: ${fields.join(", ")}.` : "Existing settings and secrets were preserved."}`)
}

if (require.main === module) {
  if (process.argv.length > 2) {
    console.error("Usage: yarn setup (no arguments; reads the repository .env, not shell overrides).")
    process.exitCode = 1
  } else {
    main().catch((error) => {
      console.error(error instanceof SetupError ? error.message : "Setup failed while reading or writing .env. Check file access and available disk space; no credentials are logged.")
      process.exitCode = 1
    })
  }
}

module.exports = { main }
