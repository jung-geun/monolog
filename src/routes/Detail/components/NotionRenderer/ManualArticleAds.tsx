import { createContext, useContext, useMemo, type ComponentProps, type ReactNode } from "react"
import type { ExtendedRecordMap } from "notion-types"
import { CONFIG } from "site.config"
import AdSlot from "src/components/AdSlot"
import { canLoadManualAds } from "src/components/AdSlot/manualAds"
import { Code } from "./Code"
import { Equation } from "./Equation"
import { planManualAdBoundaries } from "./manualAdPlacement"

const PlacementContext = createContext<ReadonlySet<string> | null>(null)

export function ManualArticleAds({ recordMap, enabled, children }: {
  recordMap: ExtendedRecordMap | null
  enabled: boolean
  children: ReactNode
}) {
  const active = enabled && canLoadManualAds(CONFIG.googleAdsense) && Boolean(CONFIG.googleAdsense.config.slots.article)
  const boundaries = useMemo(() => active ? planManualAdBoundaries(recordMap) : null, [active, recordMap])
  return <PlacementContext.Provider value={boundaries}>{children}</PlacementContext.Provider>
}

function AdAfterBlock({ blockId }: { blockId: string }) {
  const boundaries = useContext(PlacementContext)
  if (!boundaries?.has(blockId)) return null
  return <AdSlot slot={CONFIG.googleAdsense.config.slots.article} className="article-ad-slot" />
}

// Stable component identities retain code state/selection across translation updates.
export function ArticleCode(props: ComponentProps<typeof Code>) {
  return <><Code {...props} /><AdAfterBlock blockId={props.block.id} /></>
}

export function ArticleEquation(props: ComponentProps<typeof Equation>) {
  return <><Equation {...props} />{props.block && !props.inline && <AdAfterBlock blockId={props.block.id} />}</>
}
