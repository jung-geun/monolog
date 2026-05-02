import { useQuery, useQueryClient } from "@tanstack/react-query"
import { TNotionDatabase } from "src/types"
import { queryKey } from "src/constants/queryKey"

export function useDatabaseQuery(databaseId: string): TNotionDatabase | null {
  const client = useQueryClient()
  const cached = client.getQueryData<TNotionDatabase>(queryKey.database(databaseId))
  return cached ?? null
}
