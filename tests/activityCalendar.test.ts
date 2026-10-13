/**
 * @jest-environment node
 */

import { spawnSync } from "child_process"
import path from "path"
import type { HeatmapCell, HeatmapMonth } from "src/routes/Detail/PageDetail/components/HeatmapGrid"

it("keeps hydrated civil dates and publication counts identical across server and visitor timezones", () => {
  const modulePath = path.resolve(__dirname, "../src/routes/Detail/PageDetail/components/activityGrid.ts")
  const script = `
    const { pathToFileURL } = require("node:url")
    import(pathToFileURL(process.argv[1]).href).then(({ buildActivityGrid }) => {
      const posts = Array.from({ length: 6 }, () => ({ date: { start_date: "2024-03-03" }, createdTime: "2024-03-03" }))
      console.log(JSON.stringify(buildActivityGrid(posts, Date.parse("2024-03-10T00:30:00Z"))))
    }).catch(error => { console.error(error); process.exit(1) })
  `
  const grids = ["UTC", "Asia/Seoul", "America/Los_Angeles"].map(TZ => {
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "-e", script, modulePath], {
      env: { ...process.env, TZ }, encoding: "utf8", timeout: 10000,
    })
    if (result.status !== 0) throw new Error(result.stderr || String(result.error))
    return JSON.parse(result.stdout) as { weeks: HeatmapCell[][]; months: HeatmapMonth[] }
  })

  expect(grids[1]).toEqual(grids[0])
  expect(grids[2]).toEqual(grids[0])
  const cells = grids[0].weeks.flat()
  expect(cells.find(cell => cell.date === "2024-03-03")).toEqual({ date: "2024-03-03", count: 6, level: 4 })
  expect(cells.find(cell => cell.date === "2024-02-29")).toEqual({ date: "2024-02-29", count: 0, level: 0 })
  for (let index = 1; index < cells.length; index++) {
    expect(Date.parse(cells[index].date) - Date.parse(cells[index - 1].date)).toBe(24 * 60 * 60 * 1000)
  }
})
