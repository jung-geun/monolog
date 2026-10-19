import { useEffect, useRef } from "react"
import { useRouter } from "next/router"
import { CONFIG } from "site.config"
import { canLoadManualAds } from "./policy"

type Props = {
  slot: string
  format?: string
  fullWidthResponsive?: boolean
  className?: string
}

const AdSlot = ({
  slot,
  format = "auto",
  fullWidthResponsive = true,
  className,
}: Props) => {
  const { asPath } = useRouter()
  const documentPath = asPath.split(/[?#]/, 1)[0]
  const ref = useRef<HTMLModElement>(null)
  const requested = useRef<HTMLModElement | null>(null)
  const client = canLoadManualAds(CONFIG.googleAdsense)
    ? CONFIG.googleAdsense.config.client
    : ""
  const active = Boolean(client && slot)

  useEffect(() => {
    const ins = ref.current
    if (!active || !ins) return
    let observer: ResizeObserver | undefined
    const request = () => {
      if (ref.current !== ins) return
      if (requested.current === ins || ins.getAttribute("data-adsbygoogle-status")) {
        observer?.disconnect()
        return
      }
      if (ins.offsetWidth === 0) return

      // Mark before queuing: Google may not set its status until the SDK loads.
      requested.current = ins
      observer?.disconnect()
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch (error) {
        console.error("[adsense] push failed", error)
      }
    }

    request()
    if (requested.current === ins || ins.getAttribute("data-adsbygoogle-status")) return
    // Source-only/compact panes can mount at zero width, then become visible.
    if (typeof ResizeObserver === "undefined") return
    observer = new ResizeObserver(request)
    observer.observe(ins)
    return () => observer?.disconnect()
  }, [active, documentPath, slot])

  if (!active) return null

  return (
    <div className={className}>
      <ins
        key={`${documentPath}:${slot}`}
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  )
}

export default AdSlot
