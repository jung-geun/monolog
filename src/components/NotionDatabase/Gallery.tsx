import React from "react"
import styled from "@emotion/styled"
import Image from "next/image"
import { TNotionDatabase, TDbRow } from "src/types"
import { getCoverUrl, renderCell, resolveViewProperties } from "./cells"

type Props = {
  database: TNotionDatabase
}

const GalleryCard: React.FC<{ row: TDbRow; database: TNotionDatabase }> = ({ row, database }) => {
  const cover = getCoverUrl(row, database)

  const allVisible = resolveViewProperties(database.viewProperties, database.properties)
  const titleSchema = allVisible.find((p) => p.type === "title")
  const metaSchemas = allVisible.filter((p) => p.type !== "title" && p.type !== "files")

  const title = titleSchema ? (row.values[titleSchema.name] as string) || "(untitled)" : "(untitled)"

  return (
    <Card>
      {cover ? (
        <CoverImg>
          <Image src={cover} alt={title} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, 280px" />
        </CoverImg>
      ) : (
        <CoverPlaceholder>
          <span>🗄️</span>
        </CoverPlaceholder>
      )}
      <CardBody>
        <CardTitle>{title}</CardTitle>
        {metaSchemas.map((s) => {
          const node = renderCell(s, row, { compact: true })
          if (!node) return null
          return (
            <CardMeta key={s.id}>{node}</CardMeta>
          )
        })}
      </CardBody>
    </Card>
  )
}

const GalleryDatabase: React.FC<Props> = ({ database }) => {
  return (
    <Wrapper>
      <GalleryTitle>
        <span>🖼️</span>
        <span>{database.title}</span>
      </GalleryTitle>
      <Grid>
        {database.rows.map((row) => (
          <GalleryCard key={row.id} row={row} database={database} />
        ))}
      </Grid>
    </Wrapper>
  )
}

export default GalleryDatabase

const Wrapper = styled.div`
  margin: 1rem 0;
  width: 100%;
`

const GalleryTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray6};
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  width: 100%;
`

const Card = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.gray5};
  min-width: 0;
`

const CoverImg = styled.div`
  position: relative;
  width: 100%;
  height: 130px;
  background: ${({ theme }) => theme.colors.gray4};
`

const CoverPlaceholder = styled.div`
  width: 100%;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.gray3};
  font-size: 2rem;
`

const CardBody = styled.div`
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`

const CardTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
`

const CardMeta = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.gray10};
`
