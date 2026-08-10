import type { ExtendedRecordMap } from "notion-types"
import { getNotionRichTextPlainText } from "src/libs/utils/notion/richText"

jest.mock("notion-utils", () => ({
  uuidToId: (id: string) => id,
}))

import { extractToc } from "src/routes/Detail/PostDetail/RightRail"

describe("getNotionRichTextPlainText", () => {
  it("keeps every rich-text fragment, including inline code", () => {
    expect(getNotionRichTextPlainText([
      ["2. "],
      ["local_settings.py", [["c"]]],
      [" 설정"],
    ])).toBe("2. local_settings.py 설정")
  })

  it("omits malformed fragments without dropping later text", () => {
    expect(getNotionRichTextPlainText([
      ["앞"],
      null,
      ["뒤"],
    ])).toBe("앞뒤")
  })
})

describe("extractToc", () => {
  it("keeps inline-code fragments in outline headings", () => {
    const toc = extractToc({
      block: {
        "heading-with-code": {
          value: {
            type: "sub_header",
            properties: {
              title: [
                ["2. "],
                ["local_settings.py", [["c"]]],
                [" 설정"],
              ],
            },
          },
        },
      },
    } as unknown as ExtendedRecordMap)

    expect(toc).toEqual([
      { id: "heading-with-code", text: "2. local_settings.py 설정", level: 2 },
    ])
  })
})
