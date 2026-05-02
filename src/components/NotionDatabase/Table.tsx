import React from "react"
import styled from "@emotion/styled"
import { TDbPropertySchema, TDbRow, TNotionDatabase } from "src/types"
import Tag from "src/components/Tag"
import { formatDate } from "src/libs/utils"
import { CONFIG } from "site.config"

type Props = {
  database: TNotionDatabase
}

function renderCell(schema: TDbPropertySchema, row: TDbRow): React.ReactNode {
  const val = row.values[schema.name]
  if (val === null || val === undefined || val === "") return <span style={{ opacity: 0.3 }}>—</span>

  switch (schema.type) {
    case "title":
      return <TitleText>{String(val)}</TitleText>
    case "select":
      return <Tag>{String(val)}</Tag>
    case "multi_select":
      return (
        <TagList>
          {(val as string[]).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </TagList>
      )
    case "date":
      return <span>{formatDate(val as string, CONFIG.lang)}</span>
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
    default:
      return <span>{String(val)}</span>
  }
}

const TableDatabase: React.FC<Props> = ({ database }) => {
  const visibleProps = database.properties.filter((p) => p.type !== "people")

  return (
    <Wrapper>
      <TableTitle>
        <span>🗄️</span>
        <span>{database.title}</span>
      </TableTitle>
      <TableScroll>
        <StyledTable>
          <thead>
            <tr>
              {visibleProps.map((p) => (
                <Th key={p.id}>{p.name}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {database.rows.map((row) => (
              <tr key={row.id}>
                {visibleProps.map((p) => (
                  <Td key={p.id}>{renderCell(p, row)}</Td>
                ))}
              </tr>
            ))}
          </tbody>
        </StyledTable>
      </TableScroll>
    </Wrapper>
  )
}

export default TableDatabase

const Wrapper = styled.div`
  margin: 1rem 0;
  border-radius: 0.5rem;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  overflow: hidden;
`

const TableTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.95rem;
  background: ${({ theme }) => theme.colors.gray2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray6};
`

const TableScroll = styled.div`
  overflow-x: auto;
`

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
`

const Th = styled.th`
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray10};
  background: ${({ theme }) => theme.colors.gray2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray6};
  white-space: nowrap;
  position: sticky;
  top: 0;
`

const Td = styled.td`
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray4};
  vertical-align: middle;

  tr:last-of-type & {
    border-bottom: none;
  }

  tr:hover & {
    background: ${({ theme }) => theme.colors.gray3};
  }
`

const TitleText = styled.span`
  font-weight: 500;
`

const ExternalLink = styled.a`
  color: ${({ theme }) => theme.colors.gray10};
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
`

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`
