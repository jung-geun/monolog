import React, { useState, useEffect } from "react"
import { TDbView, TNotionDatabase } from "src/types"
import TableDatabase from "./Table"
import GalleryDatabase from "./Gallery"
import ListDatabase from "./List"
import BoardDatabase from "./Board"
import ViewTabs from "./ViewTabs"

type Props = {
  database: TNotionDatabase
}

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
  if (!database.rows.length) return null

  const views = database.views ?? []
  const showTabs = views.length > 1
  const initialId = database.defaultViewId ?? views[0]?.id ?? null
  const [activeId, setActiveId] = useState<string | null>(initialId)

  // If views list changes (e.g. refetch) and activeId is no longer valid, reset.
  useEffect(() => {
    if (activeId && views.length > 0 && !views.find((v) => v.id === activeId)) {
      setActiveId(initialId)
    }
  }, [views, activeId, initialId])

  const active = views.find((v) => v.id === activeId) ?? null
  const activeType: TDbView = active?.type ?? database.view
  const activeProperties = active?.properties ?? database.viewProperties ?? null

  const dbForView: TNotionDatabase = active
    ? { ...database, view: activeType, viewProperties: activeProperties }
    : database

  return (
    <>
      {showTabs && (
        <ViewTabs views={views} activeId={activeId} onChange={setActiveId} />
      )}
      {renderView(activeType, dbForView)}
    </>
  )
}

export default NotionDatabase
