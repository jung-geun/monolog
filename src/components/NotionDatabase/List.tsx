import React from "react"
import styled from "@emotion/styled"
import { TNotionDatabase, TDbRow } from "src/types"
import { formatDate } from "src/libs/utils"
import { CONFIG } from "site.config"

type Props = {
  database: TNotionDatabase
}

function getTitleValue(row: TDbRow, properties: TNotionDatabase["properties"]): string {
  const titleProp = properties.find((p) => p.type === "title")
  if (!titleProp) return "(untitled)"
  return (row.values[titleProp.name] as string) || "(untitled)"
}

function getDateValue(row: TDbRow, properties: TNotionDatabase["properties"]): string | null {
  const dateProp = properties.find((p) => p.type === "date")
  if (!dateProp) return null
  const val = row.values[dateProp.name]
  if (!val || typeof val !== "string") return null
  return formatDate(val, CONFIG.lang)
}

function getTagsValue(row: TDbRow, properties: TNotionDatabase["properties"]): string[] {
  const tagProp = properties.find((p) => p.type === "multi_select")
  if (!tagProp) return []
  const val = row.values[tagProp.name]
  return Array.isArray(val) ? (val as string[]) : []
}

const ListRow: React.FC<{ row: TDbRow; database: TNotionDatabase }> = ({ row, database }) => {
  const title = getTitleValue(row, database.properties)
  const date = getDateValue(row, database.properties)
  const tags = getTagsValue(row, database.properties)

  return (
    <Row>
      <RowTitle>{title}</RowTitle>
      <RowMeta>
        {tags.slice(0, 3).map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
        {date && <span className="date">{date}</span>}
      </RowMeta>
    </Row>
  )
}

const ListDatabase: React.FC<Props> = ({ database }) => {
  return (
    <Wrapper>
      <Header>
        <span>📋</span>
        <span>{database.title}</span>
      </Header>
      {database.rows.map((row) => (
        <ListRow key={row.id} row={row} database={database} />
      ))}
    </Wrapper>
  )
}

export default ListDatabase

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

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray4};

  &:last-of-type {
    border-bottom: none;
  }
`

const RowTitle = styled.span`
  font-size: 0.9rem;
  font-weight: 500;
`

const RowMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;

  .tag {
    padding: 0.1rem 0.4rem;
    border-radius: 50px;
    background: ${({ theme }) => theme.colors.gray5};
    color: ${({ theme }) => theme.colors.gray10};
  }

  .date {
    color: ${({ theme }) => theme.colors.gray10};
  }
`
