import React from "react"
import styled from "@emotion/styled"
import { TNotionDatabase, TDbRow } from "src/types"
import { renderCell, resolveViewProperties } from "./cells"

type Props = {
  database: TNotionDatabase
}

const ListRow: React.FC<{ row: TDbRow; database: TNotionDatabase }> = ({ row, database }) => {
  const allVisible = resolveViewProperties(database.viewProperties, database.properties)
  const titleSchema = allVisible.find((p) => p.type === "title")
  const metaSchemas = allVisible.filter((p) => p.type !== "title")

  const titleVal = titleSchema ? (row.values[titleSchema.name] as string) || "(untitled)" : "(untitled)"

  return (
    <Row>
      <RowTitle>{titleVal}</RowTitle>
      {metaSchemas.length > 0 && (
        <RowMeta>
          {metaSchemas.map((s) => (
            <span key={s.id}>{renderCell(s, row, { compact: true })}</span>
          ))}
        </RowMeta>
      )}
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
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RowMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  flex-shrink: 0;
  margin-left: 0.75rem;
`
