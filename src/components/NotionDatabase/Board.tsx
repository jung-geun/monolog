import React from "react"
import Image from "next/image"
import styled from "@emotion/styled"
import { TDbGroupOption, TDbRow, TNotionDatabase } from "src/types"

type Props = {
  database: TNotionDatabase
}

const UNGROUPED = "기타"

// Notion select/status colors → CSS (light/dark agnostic, soft pastel bg)
const NOTION_COLORS: Record<string, { bg: string; fg: string }> = {
  default: { bg: "rgba(155,154,151,0.18)", fg: "#787774" },
  gray: { bg: "rgba(155,154,151,0.22)", fg: "#787774" },
  brown: { bg: "rgba(140,46,0,0.18)", fg: "#9F6B53" },
  orange: { bg: "rgba(255,163,68,0.22)", fg: "#D9730D" },
  yellow: { bg: "rgba(233,168,0,0.22)", fg: "#CB912F" },
  green: { bg: "rgba(0,135,107,0.22)", fg: "#448361" },
  blue: { bg: "rgba(0,120,212,0.22)", fg: "#337EA9" },
  purple: { bg: "rgba(105,64,165,0.22)", fg: "#9065B0" },
  pink: { bg: "rgba(173,38,98,0.22)", fg: "#C14C8A" },
  red: { bg: "rgba(212,76,71,0.22)", fg: "#D44C47" },
}

function colorFor(color: string | undefined) {
  return NOTION_COLORS[color ?? "default"] ?? NOTION_COLORS.default
}

function rowMatchesGroup(row: TDbRow, groupBy: string, groupKey: string): boolean {
  const v = row.values[groupBy]
  if (Array.isArray(v)) return (v as unknown[]).map(String).includes(groupKey)
  if (v === null || v === undefined || v === "") return groupKey === UNGROUPED
  return String(v) === groupKey
}

function buildGroupList(rows: TDbRow[], groupBy: string, schemaOptions?: TDbGroupOption[]) {
  // Start with schema-defined order (Notion source of truth); fall back to insertion order from rows.
  const list: TDbGroupOption[] = []
  const seen = new Set<string>()

  if (schemaOptions) {
    for (const opt of schemaOptions) {
      if (!seen.has(opt.name)) {
        list.push(opt)
        seen.add(opt.name)
      }
    }
  }

  // Add any group values present in rows but missing from schema (e.g., legacy/orphaned).
  for (const row of rows) {
    const v = row.values[groupBy]
    const candidates = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [UNGROUPED]
    for (const key of candidates) {
      if (!seen.has(key)) {
        list.push({ name: key, color: "default" })
        seen.add(key)
      }
    }
  }

  return list
}

function getRowTitle(row: TDbRow, database: TNotionDatabase): string {
  const titleProp = database.properties.find((p) => p.type === "title")
  if (titleProp) {
    const v = row.values[titleProp.name]
    if (typeof v === "string" && v.length > 0) return v
  }
  return "제목 없음"
}

const Card: React.FC<{ row: TDbRow; title: string }> = ({ row, title }) => (
  <CardItem>
    {row.icon && (
      <IconBox>
        {row.icon.type === "emoji" ? (
          <span aria-hidden>{row.icon.emoji}</span>
        ) : (
          <Image src={row.icon.url} alt="" width={20} height={20} unoptimized />
        )}
      </IconBox>
    )}
    <CardTitle>{title}</CardTitle>
  </CardItem>
)

const Board: React.FC<Props> = ({ database }) => {
  const groupBy = database.groupBy
  if (!groupBy) return null

  const groups = buildGroupList(database.rows, groupBy, database.groupOptions)

  return (
    <Wrapper>
      <Header>
        <span>🗂️</span>
        <span>{database.title}</span>
      </Header>
      <Columns>
        {groups.map((group) => {
          const rows = database.rows.filter((r) => rowMatchesGroup(r, groupBy, group.name))
          if (rows.length === 0) return null
          const c = colorFor(group.color)
          return (
            <Column key={group.name}>
              <ColumnHeader>
                <GroupPill style={{ background: c.bg, color: c.fg }}>{group.name}</GroupPill>
                <Count>{rows.length}</Count>
              </ColumnHeader>
              <CardList>
                {rows.map((row) => (
                  <Card key={row.id} row={row} title={getRowTitle(row, database)} />
                ))}
              </CardList>
            </Column>
          )
        })}
      </Columns>
    </Wrapper>
  )
}

export default Board

const Wrapper = styled.div`
  margin: 1rem 0;
  border-radius: 0.5rem;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  overflow: hidden;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.95rem;
  background: ${({ theme }) => theme.colors.gray2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray6};
`

const Columns = styled.div`
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  overflow-x: auto;
  background: ${({ theme }) => theme.colors.gray1};
`

const Column = styled.div`
  flex: 0 0 240px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const ColumnHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.25rem;
`

const GroupPill = styled.div`
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
`

const Count = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.gray9};
`

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`

const CardItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.4rem;
  background: ${({ theme }) => theme.colors.gray2};
  border: 1px solid ${({ theme }) => theme.colors.gray5};
  color: ${({ theme }) => theme.colors.gray12};
  font-size: 0.875rem;
`

const IconBox = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 1rem;
  flex-shrink: 0;
`

const CardTitle = styled.span`
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
