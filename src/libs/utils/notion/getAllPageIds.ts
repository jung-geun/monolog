import { idToUuid } from "notion-utils"
import { ExtendedRecordMap, ID } from "notion-types"

export default function getAllPageIds(
  response: ExtendedRecordMap,
  viewId?: string
) {
  const collectionQuery = response.collection_query
  
  // collectionQuery가 비어있거나 유효하지 않은 경우 처리
  if (!collectionQuery || Object.keys(collectionQuery).length === 0) {
    console.warn('Collection query is empty or undefined - API may have returned incomplete data')
    return []
  }
  
  const views = Object.values(collectionQuery)[0]
  
  // views가 유효하지 않은 경우 처리
  if (!views) {
    console.warn('Views is undefined or null in collection query')
    return []
  }

  let pageIds: ID[] = []
  if (viewId) {
    const vId = idToUuid(viewId)
    pageIds = views[vId]?.blockIds || []
  } else {
    const pageSet = new Set<ID>()
    // * type not exist
    Object.values(views).forEach((view: any) => {
      view?.collection_group_results?.blockIds?.forEach((id: ID) =>
        pageSet.add(id)
      )
    })
    pageIds = [...pageSet]
  }
  return pageIds
}
