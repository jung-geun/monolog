import { Block, ExtendedRecordMap } from "notion-types"

type Boxed = NonNullable<ExtendedRecordMap["block"][string]>

export function unwrapBlock(boxed: Boxed | undefined): Block | undefined {
  if (!boxed) return undefined
  const v = boxed.value as Block | { role: unknown; value: Block } | undefined
  if (v && typeof v === "object" && "value" in v && "role" in v) {
    return (v as { value: Block }).value
  }
  return v as Block | undefined
}

export function getBlockById(
  recordMap: ExtendedRecordMap | null | undefined,
  id: string
): Block | undefined {
  if (!recordMap) return undefined
  return unwrapBlock(recordMap.block[id])
}
