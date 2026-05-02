import React from "react"
import { TNotionDatabase } from "src/types"
import TableDatabase from "./Table"
import GalleryDatabase from "./Gallery"
import ListDatabase from "./List"
import BoardDatabase from "./Board"

type Props = {
  database: TNotionDatabase
}

const NotionDatabase: React.FC<Props> = ({ database }) => {
  if (!database.rows.length) return null

  switch (database.view) {
    case "board":
      return <BoardDatabase database={database} />
    case "gallery":
      return <GalleryDatabase database={database} />
    case "list":
      return <ListDatabase database={database} />
    case "table":
    default:
      return <TableDatabase database={database} />
  }
}

export default NotionDatabase
