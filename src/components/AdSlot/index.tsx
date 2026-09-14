import { useEffect, useRef } from "react"
import { useRouter } from "next/router"
import { CONFIG } from "site.config"

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
  const ref = useRef<HTMLModElement>(null)
  const client = CONFIG.googleAdsense?.enable
    ? CONFIG.googleAdsense.config.client
    : ""
  const active = Boolean(client && slot)

  useEffect(() => {
    const ins = ref.current
    if (!active || !ins) return
    if (ins.getAttribute("data-adsbygoogle-status")) return
    if (ins.offsetWidth === 0) return

    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (error) {
      console.error("[adsense] push failed", error)
    }
  }, [active, asPath, slot])

  if (!active) return null

  return (
    <div className={className}>
      <ins
        key={asPath}
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
