import { getTextContent, getDateValue } from "notion-utils"
import { BlockMap, CollectionPropertySchemaMap } from "notion-types"

async function getPageProperties(
  id: string,
  block: BlockMap,
  schema: CollectionPropertySchemaMap
) {
  const rawProperties = Object.entries(block?.[id]?.value?.properties || [])
  const excludeProperties = ["date", "select", "multi_select", "person", "file"]
  const properties: any = {}
  for (let i = 0; i < rawProperties.length; i++) {
    const [key, val]: any = rawProperties[i]
    properties.id = id
    if (schema[key]?.type && !excludeProperties.includes(schema[key].type)) {
      properties[schema[key].name] = getTextContent(val)
    } else {
      switch (schema[key]?.type) {
        case "file": {
          try {
            const url: string = val[0][1][0][1]
            properties[schema[key].name] = url
          } catch (error) {
            properties[schema[key].name] = undefined
          }
          break
        }
        case "date": {
          const dateProperty: any = getDateValue(val)
          delete dateProperty.type
          properties[schema[key].name] = dateProperty
          break
        }
        case "select": {
          const selects = getTextContent(val)
          if (selects[0]?.length) {
            properties[schema[key].name] = selects.split(",")
          }
          break
        }
        case "multi_select": {
          const selects = getTextContent(val)
          if (selects[0]?.length) {
            properties[schema[key].name] = selects.split(",")
          }
          break
        }
        case "person": {
          // Person property is not supported with official API in this legacy utility
          // Consider migrating to official API data structures
          properties[schema[key].name] = []
          break
        }
        default:
          break
      }
    }
  }
  return properties
}

export { getPageProperties as default }
