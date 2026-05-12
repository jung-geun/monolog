import React from "react"
import styled from "@emotion/styled"
import { TNotionDatabase } from "src/types"
import { renderCell, resolveViewProperties } from "./cells"

type Props = {
  database: TNotionDatabase
}

const TableDatabase: React.FC<Props> = ({ database }) => {
  const visibleProps = resolveViewProperties(database.viewProperties, database.properties)

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
