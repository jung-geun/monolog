/**
 * @jest-environment node
 */

import fs from "fs"
import path from "path"

/**
 * Contract test for the CI shape of .github/workflows/.
 *
 * "Build Project" runs in parallel with "Run Tests" instead of waiting on it:
 * the two jobs share no artifacts, and the serial chain made the critical path
 * test + build instead of max(test, build). The measured baseline, the per-step
 * fixed costs, the projection and the pending post-merge measurement are in
 * docs/CI.md.
 *
 * For test.yml this pins the job names, the parallel jobs, the two real gates
 * (the `yarn test` and `yarn build` steps, which must not be skipped or
 * soft-failed), the exact triggers and branch filters, and the read-only token.
 * For every workflow in .github/workflows that a pull request or an outside
 * account can start, it requires GitHub-hosted runner labels.
 *
 * This only catches maintainer mistakes. It is not a security boundary: a
 * pull_request run uses the workflow files of the pull request's merge commit,
 * so a fork pull request can add a pull_request trigger to a self-hosted
 * workflow, or add a new workflow file, and that code runs before this test
 * can fail. Keeping pull request code off self-hosted runners needs repository
 * settings, and as of 2026-09-24 they are not in place (docs/CI.md, "self-hosted
 * runner 보안"):
 * - the owner is a User account, so runner groups are not available;
 * - 4 repository-level [self-hosted, Linux, X64] runners are registered, and
 *   docker-build.yml uses them;
 * - the fork pull request approval policy is first_time_contributors, so a
 *   returning contributor's fork pull request runs without approval;
 * - default_workflow_permissions is write, so the top-level
 *   `permissions: contents: read` pinned below is what keeps test.yml read-only.
 * Required: approval for all external contributors, and no self-hosted runner
 * that pull request code can reach.
 *
 * The workflows are parsed with plain indentation rules on purpose: js-yaml is
 * only a transitive dependency, so it is not imported here. The parser accepts
 * 2-space indentation, mapping keys with or without quotes, `on` as one event,
 * an inline `[...]` list, a block mapping or a block `- event` list, `branches`
 * as an inline `[...]` list or a block `- item` list, `runs-on` as one inline
 * label or an inline `[...]` list of labels, and `steps` as a block list of
 * mappings. Any other form fails the test.
 */

const REPO_ROOT = path.resolve(__dirname, "..")
const WORKFLOW_DIR = path.join(REPO_ROOT, ".github/workflows")
const WORKFLOW_PATH = path.join(WORKFLOW_DIR, "test.yml")

/**
 * Labels of GitHub-hosted runners, for example ubuntu-latest, ubuntu-24.04,
 * ubuntu-24.04-arm, macos-15 or windows-2025.
 */
const GITHUB_HOSTED_LABEL = /^(ubuntu|windows|macos)-[A-Za-z0-9.-]+$/

/**
 * Events that only an account with write access can start and that run a
 * workflow file from a branch or tag of this repository. A workflow with any
 * other event (pull_request, pull_request_target, pull_request_review,
 * issue_comment, workflow_run, merge_group, ...) can run pull request code or
 * be started by an outside account, so every one of its jobs must use
 * GitHub-hosted runners. workflow_call is listed because a reusable workflow
 * is checked through its callers: expectGitHubHostedRunners follows local
 * `uses:` targets.
 */
const TRUSTED_ONLY_EVENTS = new Set([
  "push",
  "schedule",
  "workflow_dispatch",
  "workflow_call",
])

/** Keys a gating step may have. `if:`, `shell:` and the rest could skip or neuter it. */
const GATE_STEP_KEYS = new Set([
  "name",
  "id",
  "run",
  "env",
  "timeout-minutes",
  "continue-on-error",
])

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

function workflowFiles(): string[] {
  return fs
    .readdirSync(WORKFLOW_DIR)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => path.join(WORKFLOW_DIR, name))
}

function describeFile(file: string): string {
  return path.relative(REPO_ROOT, file)
}

function isBlankOrComment(line: string): boolean {
  return /^\s*(#.*)?$/.test(line)
}

function hasContent(body: string): boolean {
  return body.split("\n").some((line) => !isBlankOrComment(line))
}

function stripComment(value: string): string {
  return value.replace(/\s+#.*$/, "").trim()
}

function unquote(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, "$2")
}

/** The inline value of a key, without a trailing comment or quotes. */
function scalar(block: Block): string {
  return unquote(stripComment(block.inline))
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

/** Keys of a block mapping written under `block` at `indent` spaces. */
function mappingKeys(
  block: Block,
  indent: number,
  where: string
): Map<string, Block> {
  if (stripComment(block.inline) !== "") {
    throw new Error(`${where}: expected a block mapping, got "${block.inline}"`)
  }
  return splitBlocks(block.body, indent)
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
    if (!items || hasContent(block.body)) {
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

/**
 * Returns the events that start `workflow`. `on` may be one event, an inline
 * `[...]` list, a block mapping of events or a block `- event` list. Any other
 * form (a `{...}` flow mapping, an empty value, events at another indentation)
 * throws, so a trigger this parser cannot read never counts as trusted.
 */
function workflowEvents(workflow: Workflow): string[] {
  const file = describeFile(workflow.file)
  const where = `${file} on`
  const on = requireBlock(topLevel(workflow), "on", file)
  const inline = stripComment(on.inline)

  if (inline !== "") {
    const single = /^(['"]?)([A-Za-z_]+)\1$/.exec(inline)
    const items = flowList(inline) ?? (single ? [single[2]] : null)
    if (!items || items.length === 0 || hasContent(on.body)) {
      throw new Error(
        `${where}: expected one event, an inline [...] list, a block mapping or block "- event" lines, got "${inline}"`
      )
    }
    return items
  }

  const events = [...splitBlocks(on.body, 2).keys()]
  if (events.length > 0) {
    return events
  }
  return sequence(on, where)
}

/**
 * Returns the steps of a job as key maps. Steps must be a block list at 6
 * spaces with their keys at 8 spaces; any other line throws.
 */
function jobSteps(workflow: Workflow, jobId: string): Map<string, Block>[] {
  const where = `${describeFile(workflow.file)} jobs.${jobId}.steps`
  const steps = requireBlock(jobKeys(workflow, jobId), "steps", where)
  if (stripComment(steps.inline) !== "") {
    throw new Error(`${where}: expected a block list of steps`)
  }

  const items: string[][] = []
  for (const line of steps.body.split("\n")) {
    const start = /^ {6}- (.*)$/.exec(line)
    if (start) {
      items.push([`        ${start[1]}`])
    } else if (isBlankOrComment(line)) {
      items[items.length - 1]?.push(line)
    } else if (items.length > 0 && /^ {8}/.test(line)) {
      items[items.length - 1].push(line)
    } else {
      throw new Error(`${where}: unexpected line: ${line.trim()}`)
    }
  }
  if (items.length === 0) {
    throw new Error(`${where}: expected at least one step`)
  }
  return items.map((lines) => splitBlocks(lines.join("\n"), 8))
}

/** Asserts that `continue-on-error` is absent or the literal `false`. */
function expectNoSoftFail(keys: Map<string, Block>, where: string): void {
  const softFail = keys.get("continue-on-error")
  expect({
    where,
    "continue-on-error": softFail ? scalar(softFail) : "absent",
  }).toEqual({
    where,
    "continue-on-error": softFail ? "false" : "absent",
  })
}

/**
 * Finds the one step in `jobId` whose whole `run:` is `command` and asserts it
 * cannot be skipped or soft-failed.
 */
function expectGateStep(
  workflow: Workflow,
  jobId: string,
  command: string
): void {
  const where = `${describeFile(workflow.file)} jobs.${jobId} step "run: ${command}"`
  const matching = jobSteps(workflow, jobId).filter((step) => {
    const run = step.get("run")
    return run !== undefined && scalar(run) === command && !hasContent(run.body)
  })
  expect({ where, count: matching.length }).toEqual({ where, count: 1 })

  const step = matching[0]
  const extraKeys = [...step.keys()].filter((key) => !GATE_STEP_KEYS.has(key))
  expect({ where, extraKeys }).toEqual({ where, extraKeys: [] })
  expectNoSoftFail(step, where)
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
  const file = describeFile(WORKFLOW_PATH)

  it("keeps the Run Tests and Build Project job names", () => {
    expect(
      scalar(requireBlock(jobKeys(workflow(), "test"), "name", "jobs.test"))
    ).toBe("Run Tests")
    expect(
      scalar(requireBlock(jobKeys(workflow(), "build"), "name", "jobs.build"))
    ).toBe("Build Project")
  })

  it("runs Build Project in parallel with Run Tests (no needs: chain)", () => {
    const build = jobKeys(workflow(), "build")
    const test = jobKeys(workflow(), "test")

    // Guard against a vacuous pass: the parsed blocks must be the real jobs.
    expect(scalar(requireBlock(build, "name", "jobs.build"))).toBe(
      "Build Project"
    )
    expect(build.has("steps")).toBe(true)
    expect(scalar(requireBlock(test, "name", "jobs.test"))).toBe("Run Tests")
    expect(test.has("steps")).toBe(true)

    expect(build.has("needs")).toBe(false)
    expect(test.has("needs")).toBe(false)
  })

  it("never skips or soft-fails the Run Tests and Build Project jobs", () => {
    // A job skipped by `if:` counts as passing, and job-level
    // continue-on-error turns a failure into a pass.
    for (const jobId of ["test", "build"]) {
      const keys = jobKeys(workflow(), jobId)
      const where = `${file} jobs.${jobId}`
      expect(keys.has("steps")).toBe(true)
      expect({ where, if: keys.has("if") }).toEqual({ where, if: false })
      expectNoSoftFail(keys, where)
    }
  })

  it("keeps yarn test and yarn build as hard gates in their jobs", () => {
    // ESLint and type-check are continue-on-error, so these two steps are the
    // only real gates. Build Project keeps next build's TypeScript pass as the
    // type gate.
    expectGateStep(workflow(), "test", "yarn test")
    expectGateStep(workflow(), "build", "yarn build")
  })

  it("keeps exactly the push, pull_request and workflow_dispatch triggers", () => {
    // An added pull_request_target, issue_comment or workflow_run trigger would
    // give pull request code a write token or secrets.
    const on = requireBlock(topLevel(workflow()), "on", file)
    const triggers = mappingKeys(on, 2, `${file} on`)
    expect([...triggers.keys()].sort()).toEqual([
      "pull_request",
      "push",
      "workflow_dispatch",
    ])
  })

  it("keeps push and pull_request on exactly main and dev, with no other filters", () => {
    const triggers = splitBlocks(
      requireBlock(topLevel(workflow()), "on", file).body,
      2
    )
    for (const trigger of ["push", "pull_request"]) {
      const where = `${file} on.${trigger}`
      const filters = mappingKeys(
        requireBlock(triggers, trigger, where),
        4,
        where
      )
      // paths, paths-ignore, branches-ignore or types would skip runs.
      expect({ where, filters: [...filters.keys()] }).toEqual({
        where,
        filters: ["branches"],
      })
      // Exact set: a '!dev' pattern or a wildcard would change which runs happen.
      expect({
        where,
        branches: [...new Set(triggerBranches(trigger))].sort(),
      }).toEqual({
        where,
        branches: ["dev", "main"],
      })
    }
  })

  it("keeps the token read-only: top-level permissions exactly contents: read, no job overrides", () => {
    // The repository default workflow token is write (docs/CI.md), so this
    // block is what keeps test.yml read-only.
    const permissions = requireBlock(topLevel(workflow()), "permissions", file)
    const scopes = mappingKeys(permissions, 2, `${file} permissions`)
    expect(
      [...scopes.entries()].map(([scope, block]) => [
        scope,
        scalar(block),
        hasContent(block.body),
      ])
    ).toEqual([["contents", "read", false]])

    for (const [jobId] of jobs(workflow())) {
      const where = `${file} jobs.${jobId}`
      expect({
        where,
        permissions: jobKeys(workflow(), jobId).has("permissions"),
      }).toEqual({
        where,
        permissions: false,
      })
    }
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

describe(".github/workflows runner policy", () => {
  it("runs every workflow that pull requests or outside accounts can start on GitHub-hosted runners", () => {
    const files = workflowFiles()
    // Guard against a vacuous pass: the directory listing must find test.yml.
    expect(files).toContain(WORKFLOW_PATH)

    const checked = new Set<string>()
    const untrusted: string[] = []
    for (const file of files) {
      const workflow = readWorkflow(file)
      // Throws when `on` cannot be read, so an unreadable trigger fails closed.
      const events = workflowEvents(workflow)
      expect({ file: describeFile(file), events: events.length > 0 }).toEqual({
        file: describeFile(file),
        events: true,
      })
      // The whole workflow counts, not the job: a pull request can edit `if:`.
      if (events.some((event) => !TRUSTED_ONLY_EVENTS.has(event))) {
        untrusted.push(file)
        expectGitHubHostedRunners(workflow, checked)
      }
    }

    // test.yml accepts pull_request, so it must have been checked.
    expect(untrusted).toContain(WORKFLOW_PATH)
    expect(checked.has(WORKFLOW_PATH)).toBe(true)
  })
})
