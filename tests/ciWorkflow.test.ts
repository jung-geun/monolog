/**
 * @jest-environment node
 */

import fs from "fs"
import path from "path"

/**
 * Contract test for the CI shape of .github/workflows/.
 *
 * "Build Project" runs in parallel with "Run Tests" instead of waiting on it:
 * the two jobs share no artifacts, Build Project publishes nothing, and the
 * serial chain made the critical path test + build instead of max(test, build).
 * The measured baseline, the per-step fixed costs, the projection and the
 * pending post-merge measurement are in docs/CI.md.
 *
 * For test.yml this pins the job names, the parallel jobs, the `yarn test` and
 * `yarn build` steps (they must not be skipped, soft-failed, or given another
 * shell or working directory), the exact triggers and branch filters, and the
 * read-only token. A failing `yarn test` or `yarn build` fails its job and the
 * Test Suite run. As of 2026-09-24 nothing consumes that result: the main
 * ruleset has no required status check (only deletion and non_fast_forward
 * rules) and no workflow waits on Test Suite, so a red run blocks neither a
 * merge nor the GHCR publish in docker-build.yml (docs/CI.md, "게이팅").
 *
 * For every workflow in .github/workflows that a pull request, an outside
 * account or a Dependabot push can start, it requires GitHub-hosted runner
 * labels.
 *
 * These YAML checks, like the `if:` guards in the workflows, are a control
 * against maintainer mistakes, and they stay. They cannot be the only control:
 * a pull_request run uses the workflow files of the pull request's merge
 * commit, so a fork pull request can add a pull_request trigger to a
 * self-hosted workflow, or add a new workflow file, and that code runs before
 * this test can fail. The rule therefore also needs repository settings, and
 * as of 2026-09-24 they are not in place (docs/CI.md, "self-hosted runner
 * 보안"):
 * - the owner is a User account, so runner groups are not available;
 * - 4 repository-level [self-hosted, Linux, X64] runners are registered, and
 *   docker-build.yml uses them;
 * - the fork pull request approval policy is first_time_contributors, so a
 *   returning contributor's fork pull request runs without approval;
 * - default_workflow_permissions is write, so the top-level
 *   `permissions: contents: read` pinned below is what keeps test.yml read-only.
 * Required, as owner actions: approval for all external contributors, and no
 * self-hosted runner that pull request code can reach.
 *
 * The workflows are parsed with plain indentation rules on purpose: js-yaml is
 * only a transitive dependency, so it is not imported here. The parser reads
 * 2-space indentation, `key:` lines with the key bare or quoted, `on` as one
 * event, an inline `[...]` list, a block mapping or a block `- event` list,
 * `branches` and `tags` as an inline `[...]` list or block `- item` lines,
 * `runs-on` as one inline label or an inline `[...]` list of labels, and
 * `steps` as a block list of mappings. It fails closed in the mappings it
 * reads (the top level, `on`, trigger filters, `jobs`, each job, each step and
 * `permissions`): a non-comment line before the first key, a line at or left
 * of the key indentation that is not a `key:` line (for example `key :` or
 * `? key`) and a duplicate key all throw, and so do `on` and `runs-on` values
 * in other forms. It does not read the mappings nested below those keys
 * (`env`, `with`, `strategy`, ...).
 */

const REPO_ROOT = path.resolve(__dirname, "..")
const WORKFLOW_DIR = path.join(REPO_ROOT, ".github/workflows")
const WORKFLOW_PATH = path.join(WORKFLOW_DIR, "test.yml")
const DOCKER_BUILD_PATH = path.join(WORKFLOW_DIR, "docker-build.yml")

/**
 * GitHub-hosted runner labels, listed exactly. A pattern such as `ubuntu-*`
 * would also accept a custom self-hosted label like ubuntu-selfhosted. Add a
 * label only after finding it in GitHub's runner-images list. This list cannot
 * see which labels the registered self-hosted runners carry; docs/CI.md
 * records them.
 */
const GITHUB_HOSTED_LABELS = new Set([
  "ubuntu-latest",
  "ubuntu-24.04",
  "ubuntu-22.04",
  "ubuntu-24.04-arm",
  "ubuntu-22.04-arm",
  "windows-latest",
  "windows-2025",
  "windows-2022",
  "macos-latest",
  "macos-26",
  "macos-15",
  "macos-14",
])

/**
 * Events that only an account with write access can start and that run a
 * workflow file from a branch or tag of this repository. A workflow with any
 * other event (pull_request, pull_request_target, pull_request_review,
 * issue_comment, workflow_run, merge_group, ...) can run pull request code or
 * be started by an outside account, so every one of its jobs must use
 * GitHub-hosted runners. push also needs an exact filter (isTrustedEvent).
 * workflow_call is listed because a reusable workflow is checked through its
 * callers: expectGitHubHostedRunners follows local `uses:` targets.
 */
const TRUSTED_ONLY_EVENTS = new Set([
  "push",
  "schedule",
  "workflow_dispatch",
  "workflow_call",
])

/** A push `branches:` item that names one branch: no glob or `!` characters. */
const EXACT_BRANCH = /^[A-Za-z0-9._\/-]+$/

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

/** Drops a trailing ` # comment`, or the whole value if it is only a comment. */
function stripComment(value: string): string {
  return value.replace(/(^|\s)#.*$/, "").trim()
}

function unquote(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, "$2")
}

/** The inline value of a key, without a trailing comment or quotes. */
function scalar(block: Block): string {
  return unquote(stripComment(block.inline))
}

/** Leading spaces only: YAML does not indent with tabs, so a tab counts as 0. */
function indentOf(line: string): number {
  return line.length - line.replace(/^ +/, "").length
}

/**
 * Splits text into the mapping keys found at exactly `indent` spaces. A key
 * may be quoted ('on': or "on":). Each key maps to its inline value and to the
 * lines that follow it until the next key at the same indentation.
 *
 * Fails closed: a non-comment line before the first key, a line at or left of
 * `indent` that is not a `key:` line, and a duplicate key throw, so a key
 * this parser does not read (`key :`, `? key`, `key:value`) is never skipped.
 * The one line at `indent` that is not a key is a `- item` right after a key
 * with no inline value: a compact sequence such as `branches:` over `- main`.
 */
function splitBlocks(
  text: string,
  indent: number,
  where: string
): Map<string, Block> {
  const keyPattern = new RegExp(
    `^ {${indent}}(['"]?)([A-Za-z0-9_-]+)\\1:(\\s.*)?$`
  )
  const compactItem = new RegExp(`^ {${indent}}-(\\s|$)`)
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
      if (blocks.has(match[2])) {
        throw new Error(`${where}: duplicate key "${match[2]}"`)
      }
      currentKey = match[2]
      inline = match[3] ?? ""
      body = []
    } else if (isBlankOrComment(line)) {
      if (currentKey !== null) {
        body.push(line)
      }
    } else if (currentKey === null) {
      throw new Error(
        `${where}: expected a key at ${indent} spaces before "${line.trim()}"`
      )
    } else if (
      indentOf(line) > indent ||
      (compactItem.test(line) && stripComment(inline) === "")
    ) {
      body.push(line)
    } else {
      throw new Error(
        `${where}: expected "key:" at ${indent} spaces, got "${line.trim()}"`
      )
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
  return splitBlocks(block.body, indent, where)
}

function topLevel(workflow: Workflow): Map<string, Block> {
  return splitBlocks(workflow.text, 0, describeFile(workflow.file))
}

function jobs(workflow: Workflow): Map<string, Block> {
  const file = describeFile(workflow.file)
  return mappingKeys(
    requireBlock(topLevel(workflow), "jobs", file),
    2,
    `${file} jobs`
  )
}

function jobKeys(workflow: Workflow, jobId: string): Map<string, Block> {
  const where = `${describeFile(workflow.file)} jobs`
  return mappingKeys(
    requireBlock(jobs(workflow), jobId, where),
    4,
    `${where}.${jobId}`
  )
}

/** The events of an `on:` written as a block mapping. */
function triggerKeys(workflow: Workflow): Map<string, Block> {
  const file = describeFile(workflow.file)
  return mappingKeys(
    requireBlock(topLevel(workflow), "on", file),
    2,
    `${file} on`
  )
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
 * Returns the events that start `workflow`, each with its block when `on` is a
 * block mapping (null otherwise). `on` may be one event, an inline `[...]`
 * list, a block `- event` list or a block mapping of events. Any other form (a
 * `{...}` flow mapping, an empty value, a line splitBlocks rejects) throws, so
 * a trigger this parser cannot read never counts as trusted.
 */
function workflowEvents(workflow: Workflow): Map<string, Block | null> {
  const file = describeFile(workflow.file)
  const where = `${file} on`
  const on = requireBlock(topLevel(workflow), "on", file)
  const inline = stripComment(on.inline)
  const events = new Map<string, Block | null>()

  if (inline !== "") {
    const single = /^(['"]?)([A-Za-z_]+)\1$/.exec(inline)
    const items = flowList(inline) ?? (single ? [single[2]] : null)
    if (!items || items.length === 0 || hasContent(on.body)) {
      throw new Error(
        `${where}: expected one event, an inline [...] list, a block mapping or block "- event" lines, got "${inline}"`
      )
    }
    items.forEach((event) => events.set(event, null))
  } else {
    const first = on.body.split("\n").find((line) => !isBlankOrComment(line))
    if (first !== undefined && /^\s*-(\s|$)/.test(first)) {
      sequence(on, where).forEach((event) => events.set(event, null))
    } else {
      for (const [event, block] of splitBlocks(on.body, 2, where)) {
        events.set(event, block)
      }
    }
  }

  if (events.size === 0) {
    throw new Error(`${where}: expected at least one event`)
  }
  return events
}

/**
 * Whether only an account with write access can start `event`. Dependabot
 * pushes its own dependabot/** branches in this repository (npm,
 * github-actions and docker updates are enabled in .github/dependabot.yml),
 * and those pushes run the bumped third-party code. So push counts only with a
 * `branches:` filter of exact branch names outside dependabot/, a `tags:`
 * filter, or both, and no other filter key. An unfiltered push, a wildcard or
 * `!` pattern, `branches-ignore`, `tags-ignore` and `paths` filters do not
 * count, even the ones that could not match a dependabot/ branch: the rule
 * stays simple.
 */
function isTrustedEvent(
  event: string,
  block: Block | null,
  where: string
): boolean {
  if (!TRUSTED_ONLY_EVENTS.has(event)) {
    return false
  }
  if (event !== "push") {
    return true
  }
  if (block === null || stripComment(block.inline) !== "") {
    return false
  }

  const filters = splitBlocks(block.body, 4, `${where}.push`)
  const keys = [...filters.keys()]
  if (
    keys.length === 0 ||
    keys.some((key) => key !== "branches" && key !== "tags")
  ) {
    return false
  }
  const tags = filters.get("tags")
  if (tags) {
    // Only checks that the list can be read. Tags are not Dependabot's.
    sequence(tags, `${where}.push.tags`)
  }
  const branches = filters.get("branches")
  return (
    branches === undefined ||
    sequence(branches, `${where}.push.branches`).every(
      (branch) => EXACT_BRANCH.test(branch) && !branch.startsWith("dependabot/")
    )
  )
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
  return items.map((lines, index) =>
    splitBlocks(lines.join("\n"), 8, `${where}[${index}]`)
  )
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

/**
 * Asserts the `yarn test` and `yarn build` steps of test.yml: each is one step
 * with no key that could skip or neuter it, and there is no `defaults` at the
 * workflow level or in the test and build jobs, because `defaults.run.shell`
 * (for example `shell: "true {0}"`) or `defaults.run.working-directory`
 * applies to those steps too.
 */
function expectGates(workflow: Workflow): void {
  const file = describeFile(workflow.file)
  expect({ where: file, defaults: topLevel(workflow).has("defaults") }).toEqual(
    { where: file, defaults: false }
  )
  for (const [jobId, command] of [
    ["test", "yarn test"],
    ["build", "yarn build"],
  ]) {
    const where = `${file} jobs.${jobId}`
    expect({
      where,
      defaults: jobKeys(workflow, jobId).has("defaults"),
    }).toEqual({ where, defaults: false })
    expectGateStep(workflow, jobId, command)
  }
}

function triggerBranches(workflow: Workflow, trigger: string): string[] {
  const where = `${describeFile(workflow.file)} on.${trigger}`
  const filters = mappingKeys(
    requireBlock(triggerKeys(workflow), trigger, where),
    4,
    where
  )
  return sequence(requireBlock(filters, "branches", where), `${where}.branches`)
}

/**
 * Returns the labels of an inline `runs-on`. Block forms (group:, labels:,
 * "- label" lines) and ${{ }} expressions throw: this parser cannot tell
 * whether they resolve to a self-hosted runner.
 */
function runnerLabels(runsOn: Block, where: string): string[] {
  const inline = stripComment(runsOn.inline)
  if (inline === "" || hasContent(runsOn.body)) {
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
      (label) => !GITHUB_HOSTED_LABELS.has(label)
    )
    expect({ where, notGitHubHosted }).toEqual({ where, notGitHubHosted: [] })
  }
}

/**
 * Applies the runner policy to one workflow and returns whether it had to use
 * GitHub-hosted runners. The whole workflow counts, not the job: a pull
 * request can edit `if:`. workflowEvents throws when `on` cannot be read, so
 * an unreadable trigger fails closed.
 */
function expectRunnerPolicy(workflow: Workflow, checked: Set<string>): boolean {
  const where = `${describeFile(workflow.file)} on`
  const untrusted = [...workflowEvents(workflow)].some(
    ([event, block]) => !isTrustedEvent(event, block, where)
  )
  if (untrusted) {
    expectGitHubHostedRunners(workflow, checked)
  }
  return untrusted
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

  it("keeps yarn test and yarn build as failing steps, with no defaults: shell or working directory", () => {
    // ESLint and type-check are continue-on-error, so of the checks only these
    // two steps fail their jobs. Build Project keeps next build's TypeScript
    // pass as the type check. Nothing consumes the result yet (see header).
    expectGates(workflow())
  })

  it("keeps exactly the push, pull_request and workflow_dispatch triggers", () => {
    // An added pull_request_target, issue_comment or workflow_run trigger would
    // give pull request code a write token or secrets.
    expect([...triggerKeys(workflow()).keys()].sort()).toEqual([
      "pull_request",
      "push",
      "workflow_dispatch",
    ])
  })

  it("keeps push and pull_request on exactly main and dev, with no other filters", () => {
    const triggers = triggerKeys(workflow())
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
        branches: [...new Set(triggerBranches(workflow(), trigger))].sort(),
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
  it("runs every workflow that pull requests, outside accounts or Dependabot pushes can start on GitHub-hosted runners", () => {
    const files = workflowFiles()
    // Guard against a vacuous pass: the directory listing must find both.
    expect(files).toContain(WORKFLOW_PATH)
    expect(files).toContain(DOCKER_BUILD_PATH)

    const checked = new Set<string>()
    const untrusted: string[] = []
    for (const file of files) {
      if (expectRunnerPolicy(readWorkflow(file), checked)) {
        untrusted.push(file)
      }
    }

    // test.yml accepts pull_request, so it must have been checked.
    expect(untrusted).toContain(WORKFLOW_PATH)
    expect(checked.has(WORKFLOW_PATH)).toBe(true)
  })
})

describe("CI contract regressions", () => {
  // Fixtures in the shape of test.yml and docker-build.yml. They are written
  // here, not read from disk, so a harmless reformat of a real workflow does
  // not break these cases; the tests above check the real files.
  const testYml = [
    "name: Test Suite",
    "on:",
    "  push:",
    "    branches: [ main, dev ]",
    "  pull_request:",
    "    branches: [ main, dev ]",
    "  workflow_dispatch:",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  test:",
    "    name: Run Tests",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: yarn test",
    "  build:",
    "    name: Build Project",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: yarn build",
    "",
  ].join("\n")
  const dockerYml = [
    "name: Docker Build and Push",
    "on:",
    "  push:",
    "    branches:",
    "      - main",
    "    tags:",
    "      - 'v*'",
    "jobs:",
    "  build-and-push:",
    "    runs-on: [self-hosted, Linux, X64]",
    "    steps:",
    "      - run: echo push",
    "",
  ].join("\n")
  const selfHostedJob =
    "jobs:\n  build:\n    runs-on: [self-hosted, Linux, X64]\n    steps:\n      - run: echo hi\n"

  /** Replaces `anchor` once and fails if it is gone, so no case passes vacuously. */
  function edit(text: string, anchor: string, replacement: string): string {
    expect(text).toContain(anchor)
    return text.replace(anchor, () => replacement)
  }

  function scratch(name: string, text: string): Workflow {
    return { file: path.join(WORKFLOW_DIR, name), text }
  }

  it("passes the unedited fixtures, so each failure below comes from its edit", () => {
    const test = scratch("test.yml", testYml)
    expect([...triggerKeys(test).keys()]).toEqual([
      "push",
      "pull_request",
      "workflow_dispatch",
    ])
    expect(triggerBranches(test, "push")).toEqual(["main", "dev"])
    expectGates(test)
    expect(expectRunnerPolicy(test, new Set())).toBe(true)
    expect(
      expectRunnerPolicy(scratch("docker-build.yml", dockerYml), new Set())
    ).toBe(false)
  })

  it("rejects an event written as `pull_request_target :` in test.yml", () => {
    const workflow = scratch(
      "test.yml",
      edit(
        testYml,
        "  workflow_dispatch:\n",
        "  workflow_dispatch:\n  pull_request_target :\n"
      )
    )
    expect(() => triggerKeys(workflow)).toThrow(/pull_request_target :/)
    expect(() => workflowEvents(workflow)).toThrow(/pull_request_target :/)
  })

  it("rejects a self-hosted job written as `evil :` before the test job", () => {
    const workflow = scratch(
      "test.yml",
      edit(
        testYml,
        "jobs:\n  test:\n",
        `${selfHostedJob.replace("  build:", "  evil :")}  test:\n`
      )
    )
    expect(() => jobs(workflow)).toThrow(/evil :/)
    expect(() => expectRunnerPolicy(workflow, new Set())).toThrow(/evil :/)
  })

  it.each([
    ["before push", "on:\n  push:\n", "on:\n  pull_request :\n  push:\n"],
    ["after push", "      - 'v*'\n", "      - 'v*'\n  pull_request :\n"],
  ])(
    "rejects `pull_request :` %s in docker-build.yml",
    (_, anchor, replacement) => {
      const workflow = scratch(
        "docker-build.yml",
        edit(dockerYml, anchor, replacement)
      )
      expect(() => expectRunnerPolicy(workflow, new Set())).toThrow(
        /pull_request :/
      )
    }
  )

  it.each<[string, string, RegExp]>([
    [
      "a complex `? pull_request` key",
      "name: X\non:\n  ? pull_request\n",
      /\? pull_request/,
    ],
    [
      "`pull_request:x` (a plain scalar in YAML)",
      "name: X\non:\n  push:\n    branches: [main]\n  pull_request:x\n",
      /pull_request:x/,
    ],
    [
      "a duplicate `on` key",
      "name: X\non: push\non: pull_request\n",
      /duplicate key "on"/,
    ],
    [
      "an indented line before the first key",
      "  pull_request:\nname: X\non: push\n",
      /before "pull_request:"/,
    ],
  ])("rejects %s", (_, head, message) => {
    const workflow = scratch("scratch.yml", `${head}${selfHostedJob}`)
    expect(() => expectRunnerPolicy(workflow, new Set())).toThrow(message)
  })

  it.each([
    [
      "the workflow",
      "\njobs:\n",
      '\ndefaults:\n  run:\n    shell: "true {0}"\njobs:\n',
    ],
    [
      "the Run Tests job",
      "    name: Run Tests\n",
      '    name: Run Tests\n    defaults:\n      run:\n        shell: "true {0}"\n',
    ],
    [
      "the Build Project job",
      "    name: Build Project\n",
      "    name: Build Project\n    defaults:\n      run:\n        working-directory: docs\n",
    ],
  ])("rejects defaults: in %s", (_, anchor, replacement) => {
    const workflow = scratch("test.yml", edit(testYml, anchor, replacement))
    expect(() => expectGates(workflow)).toThrow(/defaults/)
  })

  it("rejects a runner label shaped like a hosted one (ubuntu-selfhosted)", () => {
    const workflow = scratch(
      "test.yml",
      edit(
        testYml,
        "    name: Build Project\n    runs-on: ubuntu-latest\n",
        "    name: Build Project\n    runs-on: ubuntu-selfhosted\n"
      )
    )
    expect(() => expectGitHubHostedRunners(workflow, new Set())).toThrow(
      /ubuntu-selfhosted/
    )
  })

  it.each([
    ["on: push", "on: push\n"],
    ["on: [push, workflow_dispatch]", "on: [push, workflow_dispatch]\n"],
    ["a block - push list", "on:\n  - push\n"],
    ["push with no filter", "on:\n  push:\n  workflow_dispatch:\n"],
    ["push: {}", "on:\n  push: {}\n"],
    ["branches: ['**']", "on:\n  push:\n    branches: ['**']\n"],
    [
      "a releases/* pattern",
      "on:\n  push:\n    branches: [main, 'releases/*']\n",
    ],
    [
      "a dependabot/ branch",
      "on:\n  push:\n    branches:\n      - dependabot/npm_and_yarn/next-16.0.0\n",
    ],
    ["branches-ignore", "on:\n  push:\n    branches-ignore: [gh-pages]\n"],
    ["only paths", "on:\n  push:\n    paths: ['src/**']\n"],
    [
      "branches and paths",
      "on:\n  push:\n    branches: [main]\n    paths: ['src/**']\n",
    ],
  ])("requires GitHub-hosted runners for a push workflow with %s", (_, on) => {
    const workflow = scratch("scratch.yml", `name: X\n${on}${selfHostedJob}`)
    expect(() => expectRunnerPolicy(workflow, new Set())).toThrow(
      /notGitHubHosted/
    )
  })

  it("requires GitHub-hosted runners in docker-build.yml if push is widened to '**'", () => {
    const workflow = scratch(
      "docker-build.yml",
      edit(dockerYml, "      - main\n", "      - '**'\n")
    )
    expect(() => expectRunnerPolicy(workflow, new Set())).toThrow(
      /notGitHubHosted/
    )
  })

  it.each([
    [
      "exact branches and workflow_dispatch",
      "on:\n  push:\n    branches: [main]\n  workflow_dispatch:\n",
    ],
    ["only tags", "on:\n  push:\n    tags: ['v*']\n"],
    [
      "compact branches at indent 4 and a schedule",
      "on:\n  push:\n    branches:\n    - main\n    - 'release-1'  # pinned\n  schedule:\n    - cron: '0 1 * * 0'\n",
    ],
  ])("allows self-hosted runners for push with %s", (_, on) => {
    const workflow = scratch("scratch.yml", `name: X\n${on}${selfHostedJob}`)
    expect(expectRunnerPolicy(workflow, new Set())).toBe(false)
  })

  it("reads the other forms the header lists", () => {
    const blockEvents = scratch(
      "scratch.yml",
      [
        "# a comment before the first key",
        "name: X",
        '"on":',
        "  - push",
        "  - pull_request  # comment",
        "jobs:",
        "  # a comment before the first job",
        '  "build": # quoted job id',
        "    runs-on: 'ubuntu-latest' # hosted",
        "    continue-on-error: false",
        "    steps:",
        "      - run: echo hi",
        "",
      ].join("\n")
    )
    expect([...workflowEvents(blockEvents).keys()]).toEqual([
      "push",
      "pull_request",
    ])
    expect(expectRunnerPolicy(blockEvents, new Set())).toBe(true)

    const compactEvents = scratch(
      "scratch.yml",
      `name: X\non:\n- push\n- workflow_dispatch\n${selfHostedJob}`
    )
    expect([...workflowEvents(compactEvents).keys()]).toEqual([
      "push",
      "workflow_dispatch",
    ])

    const compactBranches = scratch(
      "test.yml",
      edit(
        testYml,
        "  push:\n    branches: [ main, dev ]\n",
        "  push:\n    branches:\n    - 'main'  # prod\n    - \"dev\"\n"
      )
    )
    expect(triggerBranches(compactBranches, "push")).toEqual(["main", "dev"])
    expectGates(compactBranches)
  })
})
