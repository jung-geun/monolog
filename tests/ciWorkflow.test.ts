/**
 * @jest-environment node
 */

import fs from "fs"
import path from "path"

/**
 * Contract test for the CI shape of .github/workflows/test.yml.
 *
 * "Build Project" runs in parallel with "Run Tests" instead of waiting on it:
 * the two jobs share no artifacts, and the serial chain made the critical path
 * test + build (median 176s over 36 green runs) instead of max(test, build).
 * This test keeps that parallelism, the job names, the triggers and the
 * GitHub-hosted runners from silently regressing.
 *
 * The workflow is parsed with plain indentation rules on purpose: js-yaml is
 * only a transitive dependency, so it is not imported here.
 */

const WORKFLOW_PATH = path.resolve(__dirname, "../.github/workflows/test.yml")

interface Block {
  inline: string
  body: string
}

function readWorkflow(): string {
  return fs.readFileSync(WORKFLOW_PATH, "utf8").replace(/\r\n/g, "\n")
}

/**
 * Splits text into the mapping keys found at exactly `indent` spaces. Each
 * key maps to its inline value and to the lines that follow it until the next
 * key at the same indentation. The caller passes a block that contains no
 * lines indented less than `indent` (other than blanks and comments).
 */
function splitBlocks(text: string, indent: number): Map<string, Block> {
  const keyPattern = new RegExp(`^ {${indent}}([A-Za-z0-9_-]+):(.*)$`)
  const blocks = new Map<string, Block>()
  let currentKey: string | null = null
  let inline = ""
  let body: string[] = []

  const flush = () => {
    if (currentKey !== null) {
      blocks.set(currentKey, { inline: inline.trim(), body: body.join("\n") })
    }
  }

  for (const line of text.split("\n")) {
    const match = keyPattern.exec(line)
    if (match) {
      flush()
      currentKey = match[1]
      inline = match[2]
      body = []
    } else if (currentKey !== null) {
      body.push(line)
    }
  }
  flush()
  return blocks
}

function requireBlock(blocks: Map<string, Block>, key: string): Block {
  const block = blocks.get(key)
  if (!block) {
    throw new Error(`expected key "${key}" in ${WORKFLOW_PATH}`)
  }
  return block
}

function topLevel(): Map<string, Block> {
  return splitBlocks(readWorkflow(), 0)
}

function jobs(): Map<string, Block> {
  return splitBlocks(requireBlock(topLevel(), "jobs").body, 2)
}

function jobKeys(jobId: string): Map<string, Block> {
  return splitBlocks(requireBlock(jobs(), jobId).body, 4)
}

function triggerBranches(trigger: string): string[] {
  const triggers = splitBlocks(requireBlock(topLevel(), "on").body, 2)
  const branchesLine = /branches:\s*\[([^\]]*)\]/.exec(requireBlock(triggers, trigger).body)
  if (!branchesLine) {
    throw new Error(`expected an inline "branches: [...]" list under on.${trigger}`)
  }
  return branchesLine[1]
    .split(",")
    .map((branch) => branch.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean)
}

describe(".github/workflows/test.yml CI shape", () => {
  it("keeps the Run Tests and Build Project job names", () => {
    expect(requireBlock(jobKeys("test"), "name").inline).toBe("Run Tests")
    expect(requireBlock(jobKeys("build"), "name").inline).toBe("Build Project")
  })

  it("runs Build Project in parallel with Run Tests (no needs: chain)", () => {
    const build = jobKeys("build")
    const test = jobKeys("test")

    // Guard against a vacuous pass: the parsed blocks must be the real jobs.
    expect(requireBlock(build, "name").inline).toBe("Build Project")
    expect(build.has("steps")).toBe(true)
    expect(requireBlock(test, "name").inline).toBe("Run Tests")
    expect(test.has("steps")).toBe(true)

    expect(build.has("needs")).toBe(false)
    expect(test.has("needs")).toBe(false)
  })

  it("keeps the gating commands in their jobs", () => {
    // Build Project keeps next build's TypeScript pass as the real type gate.
    expect(requireBlock(jobKeys("build"), "steps").body).toMatch(/^\s+run: yarn build\s*$/m)
    expect(requireBlock(jobKeys("test"), "steps").body).toMatch(/^\s+run: yarn test\s*$/m)
  })

  it("keeps push and pull_request triggers on main and dev", () => {
    expect(triggerBranches("push")).toEqual(expect.arrayContaining(["main", "dev"]))
    expect(triggerBranches("pull_request")).toEqual(expect.arrayContaining(["main", "dev"]))
  })

  it("never runs pull_request code on self-hosted runners", () => {
    const allJobs = jobs()
    expect(allJobs.size).toBeGreaterThan(0)

    for (const [jobId] of allJobs) {
      const runsOn = requireBlock(jobKeys(jobId), "runs-on")
      expect(`${runsOn.inline}${runsOn.body}`.trim()).not.toBe("")
      expect(`${runsOn.inline}\n${runsOn.body}`).not.toMatch(/self-hosted/)
    }
  })
})
