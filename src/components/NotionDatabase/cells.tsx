import React from "react"
import Tag from "src/components/Tag"
import { formatDate } from "src/libs/utils"
import { CONFIG } from "site.config"
import { TDbPropertySchema, TDbRow, TDbViewProperty, TNotionDatabase } from "src/types"
import styled from "@emotion/styled"

/** Resolve visible, ordered property schemas from viewProperties + full schema list. */
export function resolveViewProperties(
  viewProperties: TDbViewProperty[] | null | undefined,
  schemas: TDbPropertySchema[]
): TDbPropertySchema[] {
  if (!viewProperties || viewProperties.length === 0) return schemas

  const byId = new Map(schemas.map((s) => [s.id, s]))
  const byName = new Map(schemas.map((s) => [s.name, s]))

  return viewProperties
    .filter((vp) => vp.visible)
    .map((vp) => byId.get(vp.propertyId) ?? byName.get(vp.name))
    .filter((s): s is TDbPropertySchema => s !== undefined)
}

type RenderOpts = { compact?: boolean }

export function renderCell(
  schema: TDbPropertySchema,
  row: TDbRow,
  opts?: RenderOpts
): React.ReactNode {
  const val = row.values[schema.name]
  if (val === null || val === undefined || val === "")
    return <span style={{ opacity: 0.3 }}>—</span>

  switch (schema.type) {
    case "title":
      return opts?.compact ? (
        <span style={{ fontWeight: 500 }}>{String(val)}</span>
      ) : (
        <TitleText>{String(val)}</TitleText>
      )
    case "select":
      return <Tag>{String(val)}</Tag>
    case "multi_select":
      return (
        <TagList compact={opts?.compact}>
          {(val as string[]).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </TagList>
      )
    case "status":
      return <Tag>{String(val)}</Tag>
    case "date": {
      if (typeof val === "string") {
        return <span>{formatDate(val, CONFIG.lang)}</span>
      }
      if (val && typeof val === "object" && "start" in (val as object)) {
        const v = val as { start: string; end?: string }
        const start = formatDate(v.start, CONFIG.lang)
        if (v.end) {
          const end = formatDate(v.end, CONFIG.lang)
          return <span>{`${start} → ${end}`}</span>
        }
        return <span>{start}</span>
      }
      return null
    }
    case "url":
      return (
        <ExternalLink href={val as string} target="_blank" rel="noopener noreferrer">
          {String(val)}
        </ExternalLink>
      )
    case "checkbox":
      return <span>{val ? "✓" : "✗"}</span>
    case "number":
      return <span>{String(val)}</span>
    case "files":
      return val ? (
        <ExternalLink href={val as string} target="_blank" rel="noopener noreferrer">
          파일
        </ExternalLink>
      ) : null
    case "people":
      return Array.isArray(val) ? (
        <span>{(val as string[]).join(", ")}</span>
      ) : (
        <span>{String(val)}</span>
      )
    default:
      return <span>{String(val)}</span>
  }
}

export function getCoverUrl(row: TDbRow, database: TNotionDatabase): string | null {
  const filesProp = database.properties.find((p) => p.type === "files")
  if (filesProp) {
    const v = row.values[filesProp.name]
    if (v && typeof v === "string") return v
  }
  const urlProp = database.properties.find(
    (p) => p.type === "url" && p.name.toLowerCase().includes("thumbnail")
  )
  if (urlProp) {
    const v = row.values[urlProp.name]
    if (v && typeof v === "string") return v
  }
  return null
}

const TitleText = styled.span`
  font-weight: 500;
`

const ExternalLink = styled.a`
  color: ${({ theme }) => theme.colors.gray10};
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
`

const TagList = styled.div<{ compact?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ compact }) => (compact ? "0.2rem" : "0.25rem")};
`
