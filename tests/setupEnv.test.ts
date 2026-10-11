/**
 * @jest-environment node
 */

import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { parse } from "dotenv"

const repositoryRoot = path.resolve(__dirname, "..")
const token = "ntn_setup_regression_credential"
const sourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const databaseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const otherSourceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

// Run the real CLI in a disposable repository, never against the developer's .env.
describe("minimum environment setup", () => {
  let directory: string
  let envPath: string
  let scriptPath: string

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "monolog-setup-"))
    envPath = path.join(directory, ".env")
    fs.mkdirSync(path.join(directory, "scripts"))
    scriptPath = path.join(directory, "scripts", "setup-env.js")
    fs.copyFileSync(path.join(repositoryRoot, "scripts", "setup-env.js"), scriptPath)
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  function run(response?: { status: number; body: unknown }) {
    const hook = path.join(directory, "notion-fixture.js")
    fs.writeFileSync(hook, response
      ? `global.fetch = async input => {
          if (new URL(input).pathname !== '/v1/databases/${databaseId}') return new Response('{}', { status: 404 });
          return new Response(${JSON.stringify(JSON.stringify(response.body))}, { status: ${response.status} });
        };`
      : "global.fetch = async () => { throw new Error('Unexpected network access'); };"
    )
    return spawnSync(process.execPath, ["--require", hook, scriptPath], {
      cwd: os.tmpdir(),
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        NODE_PATH: path.join(repositoryRoot, "node_modules"),
        NOTION_TOKEN: "ignored_shell_override",
        NOTION_DATASOURCE_ID: "ignored_shell_override",
        REVALIDATE_SECRET: "ignored_shell_override",
      },
    })
  }

  it("generates once, preserves unrelated bytes and existing secrets, and restricts file access", () => {
    const untouched = '# retained comment\r\nEXTRA="line one\r\nline two # literal"\r\n'
    fs.writeFileSync(envPath, `${untouched}NOTION_TOKEN=${token}\r\nNOTION_DATASOURCE_ID=${sourceId}\r\nREVALIDATE_SECRET= # generated here\r\n`, { mode: 0o644 })

    const first = run()
    expect(first.status).toBe(0)
    const configured = fs.readFileSync(envPath, "utf8")
    const values = parse(configured)
    expect(configured.startsWith(untouched)).toBe(true)
    expect(configured).toContain(" # generated here\r\n")
    expect(values.REVALIDATE_SECRET).toMatch(/^[0-9a-f]{64}$/)
    expect(values.COMMENT_HASH_SALT).toBeUndefined()
    expect(values.VISITOR_HASH_SALT).toBeUndefined()
    expect(fs.statSync(envPath).mode & 0o777).toBe(0o600)
    expect(first.stdout + first.stderr).not.toContain(token)
    expect(first.stdout + first.stderr).not.toContain(values.REVALIDATE_SECRET)

    fs.chmodSync(envPath, 0o644)
    expect(run().status).toBe(0)
    expect(fs.readFileSync(envPath, "utf8")).toBe(configured)
    expect(fs.statSync(envPath).mode & 0o777).toBe(0o600)
  })

  it("keeps generated values sourceable when a blank assignment has an inline comment", () => {
    fs.writeFileSync(envPath, `NOTION_TOKEN=${token}\nNOTION_DATASOURCE_ID=${sourceId}\nexport REVALIDATE_SECRET = # retained comment\n`)
    expect(run().status).toBe(0)
    const sourced = spawnSync("bash", [
      "-eu", "-c", '. "$1"; test "${#REVALIDATE_SECRET}" -eq 64', "setup-test", envPath,
    ], { encoding: "utf8", timeout: 10000 })
    expect(sourced.status).toBe(0)
    expect(fs.readFileSync(envPath, "utf8")).toContain(" # retained comment\n")
  })

  it("generates independent optional salts without rotating a configured revalidation secret", () => {
    fs.writeFileSync(envPath, `NOTION_TOKEN=${token}\nNOTION_DATASOURCE_ID=${sourceId}\nREVALIDATE_SECRET=existing-private-key\nNOTION_COMMENTS_DATASOURCE_ID=${sourceId}\nNOTION_VISIT_STATS_DATASOURCE_ID=${otherSourceId}\n`)
    expect(run().status).toBe(0)
    const configured = fs.readFileSync(envPath, "utf8")
    const values = parse(configured)
    expect(values.REVALIDATE_SECRET).toBe("existing-private-key")
    expect(values.COMMENT_HASH_SALT).toMatch(/^[0-9a-f]{64}$/)
    expect(values.VISITOR_HASH_SALT).toMatch(/^[0-9a-f]{64}$/)
    expect(values.COMMENT_HASH_SALT).not.toBe(values.VISITOR_HASH_SALT)
    expect(run().status).toBe(0)
    expect(fs.readFileSync(envPath, "utf8")).toBe(configured)
  })

  it("persists accepted UUIDs without padding so runtime Notion calls receive valid IDs", () => {
    fs.writeFileSync(envPath, `NOTION_TOKEN=${token}\nNOTION_DATASOURCE_ID=' ${sourceId} '\nNOTION_COMMENTS_DATASOURCE_ID=' ${otherSourceId} '\n`)
    expect(run().status).toBe(0)
    const values = parse(fs.readFileSync(envPath))
    expect(values.NOTION_DATASOURCE_ID).toBe(sourceId)
    expect(values.NOTION_COMMENTS_DATASOURCE_ID).toBe(otherSourceId)
  })

  it("resolves a database URL rather than mistaking its view UUID for a data source", () => {
    fs.writeFileSync(envPath, `NOTION_TOKEN=${token}\nNOTION_DATASOURCE_ID=https://www.notion.so/Blog-${databaseId.replace(/-/g, "")}?v=${otherSourceId.replace(/-/g, "")}\n`)
    expect(run({ status: 200, body: { data_sources: [{ id: sourceId, name: "Blog" }] } }).status).toBe(0)
    expect(parse(fs.readFileSync(envPath)).NOTION_DATASOURCE_ID).toBe(sourceId)
  })

  it("requires explicit selection for multiple data sources without changing the file or leaking credentials", () => {
    const original = `NOTION_TOKEN=${token}\nNOTION_DATASOURCE_ID=https://notion.so/${databaseId.replace(/-/g, "")}\n`
    fs.writeFileSync(envPath, original)
    const result = run({ status: 200, body: { data_sources: [
      { id: sourceId, name: `Blog\n${token}` },
      { id: otherSourceId, name: "Other" },
    ] } })
    expect(result.status).toBe(1)
    expect(fs.readFileSync(envPath, "utf8")).toBe(original)
    expect(result.stdout + result.stderr).not.toContain(token)
    expect(result.stderr).toContain(sourceId)
    expect(result.stderr).toContain(otherSourceId)
  })

  it("leaves .env intact when Notion rejects database access", () => {
    const original = `NOTION_TOKEN=${token}\nNOTION_DATASOURCE_ID=https://notion.so/${databaseId.replace(/-/g, "")}\n`
    fs.writeFileSync(envPath, original)
    const result = run({ status: 403, body: { message: token } })
    expect(result.status).toBe(1)
    expect(fs.readFileSync(envPath, "utf8")).toBe(original)
    expect(result.stdout + result.stderr).not.toContain(token)
  })

  it.each([
    `NOTION_TOKEN=ntn_xxxxx\nNOTION_DATASOURCE_ID=${sourceId}\n`,
    `NOTION_TOKEN=' ${token} '\nNOTION_DATASOURCE_ID=${sourceId}\n`,
    `NOTION_TOKEN=${token}\nNOTION_DATASOURCE_ID=https://notion.so.attacker.example/${databaseId.replace(/-/g, "")}\n`,
    `NOTION_TOKEN=${token}\nNOTION_DATASOURCE_ID=${sourceId}\nNOTION_COMMENTS_DATASOURCE_ID=not-a-uuid\n`,
  ])("rejects unusable input without a partial write", original => {
    fs.writeFileSync(envPath, original)
    const result = run()
    expect(result.status).toBe(1)
    expect(fs.readFileSync(envPath, "utf8")).toBe(original)
    expect(result.stdout + result.stderr).not.toContain(token)
  })
})
