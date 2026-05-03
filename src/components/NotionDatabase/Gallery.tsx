import React from "react"
import styled from "@emotion/styled"
import Image from "next/image"
import { TNotionDatabase, TDbRow } from "src/types"
import Tag from "src/components/Tag"
import { formatDate } from "src/libs/utils"
import { CONFIG } from "site.config"

type Props = {
  database: TNotionDatabase
}

function getCoverUrl(row: TDbRow, database: TNotionDatabase): string | null {
  const filesProp = database.properties.find((p) => p.type === "files")
  if (filesProp) {
    const v = row.values[filesProp.name]
    if (v && typeof v === "string") return v
  }
  const urlProp = database.properties.find((p) => p.type === "url" && p.name.toLowerCase().includes("thumbnail"))
  if (urlProp) {
    const v = row.values[urlProp.name]
    if (v && typeof v === "string") return v
  }
  return null
}

function getTitleValue(row: TDbRow, database: TNotionDatabase): string {
  const p = database.properties.find((prop) => prop.type === "title")
  if (!p) return "(untitled)"
  return (row.values[p.name] as string) || "(untitled)"
}

function getTagsValue(row: TDbRow, database: TNotionDatabase): string[] {
  const p = database.properties.find((prop) => prop.type === "multi_select")
  if (!p) return []
  const v = row.values[p.name]
  return Array.isArray(v) ? (v as string[]) : []
}

function getDateValue(row: TDbRow, database: TNotionDatabase): string | null {
  const p = database.properties.find((prop) => prop.type === "date")
  if (!p) return null
  const v = row.values[p.name]
  if (!v || typeof v !== "string") return null
  return formatDate(v, CONFIG.lang)
}

const GalleryCard: React.FC<{ row: TDbRow; database: TNotionDatabase }> = ({ row, database }) => {
  const cover = getCoverUrl(row, database)
  const title = getTitleValue(row, database)
  const tags = getTagsValue(row, database)
  const date = getDateValue(row, database)

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
        {date && <CardDate>{date}</CardDate>}
        {tags.length > 0 && (
          <CardTags>
            {tags.slice(0, 3).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </CardTags>
        )}
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
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
`

const Card = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.gray5};
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

const CardDate = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.gray10};
`

const CardTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`
