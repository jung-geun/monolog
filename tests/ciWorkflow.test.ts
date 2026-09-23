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
 * test + build instead of max(test, build). The measured numbers behind that
 * change are in the body of the commit that added this file ("ci: run Build
 * Project in parallel with Run Tests", 95bf739). After a rebase or squash merge,
 * `git log --follow -- tests/ciWorkflow.test.ts` finds it.
 * This test keeps that parallelism, the job names, the triggers and the
 * GitHub-hosted runners from silently regressing.
 *
 * The runner check is a regression guard, not the security boundary. A pull
 * request can edit this workflow, and a self-hosted runner can carry a label
 * that looks GitHub-hosted. Runner-group repository limits and the fork pull
 * request approval setting are what keep pull_request code off self-hosted
 * runners.
 *
 * The workflow is parsed with plain indentation rules on purpose: js-yaml is
 * only a transitive dependency, so it is not imported here. The parser accepts
 * 2-space indentation, mapping keys with or without quotes, `branches` as an
 * inline `[...]` list or a block `- item` list, and `runs-on` as one inline
 * label or an inline `[...]` list of labels. Any other form fails the test.
 */

const REPO_ROOT = path.resolve(__dirname, "..")
const WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/test.yml")

/**
 * Labels of GitHub-hosted runners, for example ubuntu-latest, ubuntu-24.04,
 * ubuntu-24.04-arm, macos-15 or windows-2025.
 */
const GITHUB_HOSTED_LABEL = /^(ubuntu|windows|macos)-[A-Za-z0-9.-]+$/

interface Block {
  inline: string
  body: string
}

interface Workflow {
  file: string
  text: string
}

function readWorkflow(file: string): Workflow {
  return { file, text: fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") }
}

function describeFile(file: string): string {
  return path.relative(REPO_ROOT, file)
}

function isBlankOrComment(line: string): boolean {
  return /^\s*(#.*)?$/.test(line)
}

function stripComment(value: string): string {
  return value.replace(/\s+#.*$/, "").trim()
}

function unquote(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, "$2")
}

/**
 * Splits text into the mapping keys found at exactly `indent` spaces. A key
 * may be quoted ('on': or "on":). Each key maps to its inline value and to the
 * lines that follow it until the next key at the same indentation. The caller
 * passes a block that contains no lines indented less than `indent` (other
 * than blanks and comments).
 */
function splitBlocks(text: string, indent: number): Map<string, Block> {
  const keyPattern = new RegExp(`^ {${indent}}(['"]?)([A-Za-z0-9_-]+)\\1:(.*)$`)
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
      currentKey = match[2]
      inline = match[3]
      body = []
    } else if (currentKey !== null) {
      body.push(line)
    }
  }
  flush()
  return blocks
}

function requireBlock(
  blocks: Map<string, Block>,
  key: string,
  where: string
): Block {
  const block = blocks.get(key)
  if (!block) {
    throw new Error(`expected key "${key}" in ${where}`)
  }
  return block
}

function topLevel(workflow: Workflow): Map<string, Block> {
  return splitBlocks(workflow.text, 0)
}

function jobs(workflow: Workflow): Map<string, Block> {
  return splitBlocks(
    requireBlock(topLevel(workflow), "jobs", describeFile(workflow.file)).body,
    2
  )
}

function jobKeys(workflow: Workflow, jobId: string): Map<string, Block> {
  const where = `${describeFile(workflow.file)} jobs`
  return splitBlocks(requireBlock(jobs(workflow), jobId, where).body, 4)
}

/** Parses an inline `[a, b]` flow list, or returns null if `value` is not one. */
function flowList(value: string): string[] | null {
  const flow = /^\[([^\]]*)\]$/.exec(value)
  if (!flow) {
    return null
  }
  return flow[1].split(",").map(unquote).filter(Boolean)
}

/** Reads a YAML sequence written as an inline `[...]` list or as block `- item` lines. */
function sequence(block: Block, where: string): string[] {
  const inline = stripComment(block.inline)
  if (inline !== "") {
    const items = flowList(inline)
    if (!items) {
      throw new Error(
        `expected an inline [...] list or block "- item" lines for ${where}`
      )
    }
    return items
  }

  const items: string[] = []
  for (const line of block.body.split("\n")) {
    if (isBlankOrComment(line)) {
      continue
    }
    const item = /^\s*-\s+(.*)$/.exec(line)
    if (!item) {
      throw new Error(`unexpected line under ${where}: ${line.trim()}`)
    }
    items.push(unquote(stripComment(item[1])))
  }
  if (items.length === 0) {
    throw new Error(`expected at least one item under ${where}`)
  }
  return items
}

function triggerBranches(trigger: string): string[] {
  const workflow = readWorkflow(WORKFLOW_PATH)
  const where = describeFile(workflow.file)
  const triggers = splitBlocks(
    requireBlock(topLevel(workflow), "on", where).body,
    2
  )
  const triggerKeys = splitBlocks(
    requireBlock(triggers, trigger, `${where} on`).body,
    4
  )
  const branches = requireBlock(
    triggerKeys,
    "branches",
    `${where} on.${trigger}`
  )
  return sequence(branches, `${where} on.${trigger}.branches`)
}

/**
 * Returns the labels of an inline `runs-on`. Block forms (group:, labels:,
 * "- label" lines) and ${{ }} expressions throw: this parser cannot tell
 * whether they resolve to a self-hosted runner.
 */
function runnerLabels(runsOn: Block, where: string): string[] {
  const inline = stripComment(runsOn.inline)
  const extraLines = runsOn.body
    .split("\n")
    .filter((line) => !isBlankOrComment(line))
  if (inline === "" || extraLines.length > 0) {
    throw new Error(
      `${where}: runs-on must be one inline label or an inline [...] list of labels`
    )
  }
  if (inline.includes("${{")) {
    throw new Error(`${where}: runs-on must not be an expression (${inline})`)
  }
  return flowList(inline) ?? [unquote(inline)]
}

/**
 * Asserts that every job in `workflow` runs on GitHub-hosted runner labels.
 * A job that calls a reusable workflow has no runs-on; a local one is checked
 * the same way, and a remote one fails because its runners cannot be read here.
 */
function expectGitHubHostedRunners(
  workflow: Workflow,
  checked: Set<string>
): void {
  checked.add(workflow.file)
  const allJobs = jobs(workflow)
  expect(allJobs.size).toBeGreaterThan(0)

  for (const [jobId] of allJobs) {
    const keys = jobKeys(workflow, jobId)
    const where = `${describeFile(workflow.file)} jobs.${jobId}`

    const uses = keys.get("uses")
    if (uses) {
      const target = unquote(stripComment(uses.inline))
      const local = /^\.\/(\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml)$/.exec(
        target
      )
      if (!local) {
        throw new Error(
          `${where}: calls "${target}"; only local ./.github/workflows/*.yml reusable workflows can be checked for self-hosted runners`
        )
      }
      const calledFile = path.join(REPO_ROOT, local[1])
      if (!checked.has(calledFile)) {
        expectGitHubHostedRunners(readWorkflow(calledFile), checked)
      }
      continue
    }

    const labels = runnerLabels(requireBlock(keys, "runs-on", where), where)
    expect(labels.length).toBeGreaterThan(0)
    // Keep `where` in the compared value so a failure names the job.
    const notGitHubHosted = labels.filter(
      (label) => !GITHUB_HOSTED_LABEL.test(label)
    )
    expect({ where, notGitHubHosted }).toEqual({ where, notGitHubHosted: [] })
  }
}

describe(".github/workflows/test.yml CI shape", () => {
  const workflow = () => readWorkflow(WORKFLOW_PATH)

  it("keeps the Run Tests and Build Project job names", () => {
    expect(
      requireBlock(jobKeys(workflow(), "test"), "name", "jobs.test").inline
    ).toBe("Run Tests")
    expect(
      requireBlock(jobKeys(workflow(), "build"), "name", "jobs.build").inline
    ).toBe("Build Project")
  })

  it("runs Build Project in parallel with Run Tests (no needs: chain)", () => {
    const build = jobKeys(workflow(), "build")
    const test = jobKeys(workflow(), "test")

    // Guard against a vacuous pass: the parsed blocks must be the real jobs.
    expect(requireBlock(build, "name", "jobs.build").inline).toBe(
      "Build Project"
    )
    expect(build.has("steps")).toBe(true)
    expect(requireBlock(test, "name", "jobs.test").inline).toBe("Run Tests")
    expect(test.has("steps")).toBe(true)

    expect(build.has("needs")).toBe(false)
    expect(test.has("needs")).toBe(false)
  })

  it("keeps the gating commands in their jobs", () => {
    // Build Project keeps next build's TypeScript pass as the real type gate.
    expect(
      requireBlock(jobKeys(workflow(), "build"), "steps", "jobs.build").body
    ).toMatch(/^\s+run: yarn build\s*$/m)
    expect(
      requireBlock(jobKeys(workflow(), "test"), "steps", "jobs.test").body
    ).toMatch(/^\s+run: yarn test\s*$/m)
  })

  it("keeps push and pull_request triggers on main and dev", () => {
    expect(triggerBranches("push")).toEqual(
      expect.arrayContaining(["main", "dev"])
    )
    expect(triggerBranches("pull_request")).toEqual(
      expect.arrayContaining(["main", "dev"])
    )
  })

  it("runs every job, including local reusable workflows, on GitHub-hosted runner labels", () => {
    // The workflow accepts pull_request, so a self-hosted runner, a runner
    // group or an expression-chosen runner here would run pull request code
    // on a machine this check cannot see.
    const checked = new Set<string>()
    expectGitHubHostedRunners(workflow(), checked)
    expect(checked.has(WORKFLOW_PATH)).toBe(true)
  })
})
