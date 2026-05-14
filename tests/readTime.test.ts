import { computeReadTime, readTimeTypeWeight } from "src/libs/utils/readTime"

describe("computeReadTime", () => {
  it("순수 한글 1000자 → 2분", () => {
    const text = "가".repeat(1000)
    expect(computeReadTime({ text, imageCount: 0, codeLines: 0, otherSec: 0, typeWeight: 1.0 })).toBe(2)
  })

  it("순수 영문 440 단어 → 2분", () => {
    const text = Array.from({ length: 440 }, (_, i) => `word${i}`).join(" ")
    expect(computeReadTime({ text, imageCount: 0, codeLines: 0, otherSec: 0, typeWeight: 1.0 })).toBe(2)
  })

  it("한·영 혼합: 한글 500자 + 영문 220 단어 → 2분", () => {
    const korean = "가".repeat(500)
    const english = Array.from({ length: 220 }, (_, i) => `word${i}`).join(" ")
    const text = korean + " " + english
    expect(computeReadTime({ text, imageCount: 0, codeLines: 0, otherSec: 0, typeWeight: 1.0 })).toBe(2)
  })

  it("코드 60줄 → 2분", () => {
    // 60줄 = 59 newlines + 1
    const codeLines = 60
    expect(computeReadTime({ text: "", imageCount: 0, codeLines, otherSec: 0, typeWeight: 1.0 })).toBe(2)
  })

  it("이미지 3장 → 1분 (33초)", () => {
    // 12 + 11 + 10 = 33 sec → ceil(33/60) = 1
    expect(computeReadTime({ text: "", imageCount: 3, codeLines: 0, otherSec: 0, typeWeight: 1.0 })).toBe(1)
  })

  it("이미지 20장 → 2분 (105초)", () => {
    // 1..10: 12+11+10+9+8+7+6+5+4+3 = 75, 11..20: 3*10 = 30 → 105 sec → ceil(105/60) = 2
    expect(computeReadTime({ text: "", imageCount: 20, codeLines: 0, otherSec: 0, typeWeight: 1.0 })).toBe(2)
  })

  it("Paper 가중치 × 1.3 적용", () => {
    const text = "가".repeat(500) // 60 sec without weight
    const base = computeReadTime({ text, imageCount: 0, codeLines: 0, otherSec: 0, typeWeight: 1.0 })
    const paper = computeReadTime({ text, imageCount: 0, codeLines: 0, otherSec: 0, typeWeight: 1.3 })
    expect(paper).toBeGreaterThan(base)
  })

  it("빈 입력 → 최소 1분", () => {
    expect(computeReadTime({ text: "", imageCount: 0, codeLines: 0, otherSec: 0, typeWeight: 1.0 })).toBe(1)
  })
})

describe("readTimeTypeWeight", () => {
  it("Paper → 1.3", () => {
    expect(readTimeTypeWeight(["Paper"])).toBe(1.3)
  })

  it("Post → 1.0", () => {
    expect(readTimeTypeWeight(["Post"])).toBe(1.0)
  })

  it("Page → 0.7", () => {
    expect(readTimeTypeWeight(["Page"])).toBeCloseTo(0.7)
  })

  it("undefined → 1.0", () => {
    expect(readTimeTypeWeight(undefined)).toBe(1.0)
  })

  it("빈 배열 → 1.0", () => {
    expect(readTimeTypeWeight([])).toBe(1.0)
  })
})
