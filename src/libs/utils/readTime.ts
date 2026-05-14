import { TPostType } from "src/types"

export type ReadTimeInput = {
  text: string
  imageCount: number
  codeLines: number
  otherSec: number
  typeWeight: number
}

export function computeReadTime(input: ReadTimeInput): number {
  const { text, imageCount, codeLines, otherSec, typeWeight } = input

  const koreanChars = (text.match(/[가-힣]/g) ?? []).length
  const koreanSec = (koreanChars / 500) * 60

  const textWithoutKorean = text.replace(/[가-힣]/g, " ")
  const englishWords = textWithoutKorean.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w)).length
  const englishSec = (englishWords / 220) * 60

  const codeSec = codeLines * 2

  let imageSec = 0
  for (let i = 1; i <= imageCount; i++) {
    imageSec += Math.max(3, 13 - i)
  }

  const totalSec = (koreanSec + englishSec + codeSec + imageSec + otherSec) * typeWeight
  return Math.max(1, Math.ceil(totalSec / 60))
}

export function readTimeTypeWeight(types?: TPostType[]): number {
  const t = types?.[0]
  if (t === "Paper") return 1.3
  if (t === "Page") return 0.7
  return 1.0
}
