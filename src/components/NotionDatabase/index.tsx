import React, { useState } from "react"
import { TDbView, TNotionDatabase } from "src/types"
import TableDatabase from "./Table"
import GalleryDatabase from "./Gallery"
import ListDatabase from "./List"
import BoardDatabase from "./Board"
import ViewTabs from "./ViewTabs"

type Props = {
  database: TNotionDatabase
}

const EMPTY_VIEWS: NonNullable<TNotionDatabase["views"]> = []

function renderView(view: TDbView, db: TNotionDatabase): React.ReactNode {
  switch (view) {
    case "board":
      return <BoardDatabase database={db} />
    case "gallery":
      return <GalleryDatabase database={db} />
    case "list":
      return <ListDatabase database={db} />
    case "table":
    default:
      return <TableDatabase database={db} />
  }
}

const NotionDatabase: React.FC<Props> = ({ database }) => {
  const views = database.views ?? EMPTY_VIEWS
  const showTabs = views.length > 1
  const initialId = database.defaultViewId ?? views[0]?.id ?? null
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const activeId =
    selectedId && views.some((view) => view.id === selectedId)
      ? selectedId
      : initialId

  if (!database.rows.length) return null

  const active = views.find((v) => v.id === activeId) ?? null
  const activeType: TDbView = active?.type ?? database.view
  const activeProperties = active?.properties ?? database.viewProperties ?? null

  const dbForView: TNotionDatabase = active
    ? { ...database, view: activeType, viewProperties: activeProperties }
    : database

  return (
    <>
      {showTabs && (
        <ViewTabs views={views} activeId={activeId} onChange={setSelectedId} />
      )}
      {renderView(activeType, dbForView)}
    </>
  )
}

export default NotionDatabase
