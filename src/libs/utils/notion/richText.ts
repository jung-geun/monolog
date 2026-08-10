export const getNotionRichTextPlainText = (richText: unknown): string => {
  if (!Array.isArray(richText)) return ""

  return richText.map((fragment) => (
    Array.isArray(fragment) && typeof fragment[0] === "string" ? fragment[0] : ""
  )).join("")
}
