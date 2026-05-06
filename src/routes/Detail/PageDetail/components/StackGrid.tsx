import { CONFIG } from "site.config"

const CAT_COLORS: Record<string, { border: string; label: string }> = {
  Languages:     { border: "border-signal/30",   label: "text-signal-200" },
  Infra:         { border: "border-cs/30",        label: "text-cs-50" },
  "AI / ML":     { border: "border-paper/30",     label: "text-paper-50" },
  Observability: { border: "border-research/30",  label: "text-research-50" },
  Editors:       { border: "border-signal/20",    label: "text-signal-200" },
  OS:            { border: "border-cs/20",        label: "text-cs-50" },
}

const DEFAULT_COLORS = { border: "border-hairline", label: "text-soft" }

const StackGrid = () => {
  const stack = (CONFIG as any).stack as Record<string, string[]> | undefined
  if (!stack || !Object.keys(stack).length) return null

  const entries = Object.entries(stack)

  return (
    <div className="mb-8">
      <p className="font-mono text-[13px] mb-3">
        <span className="text-signal">{"### "}</span>
        <span className="text-zinc-300">stack</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {entries.map(([cat, items]) => {
          const colors = CAT_COLORS[cat] ?? DEFAULT_COLORS
          return (
            <div
              key={cat}
              className={`rounded-md border ${colors.border} bg-card/60 p-3`}
            >
              <p className={`font-mono text-[10px] font-medium tracking-widest uppercase mb-2 ${colors.label}`}>
                {cat}
              </p>
              <div className="flex flex-wrap gap-1">
                {items.map((item) => (
                  <span
                    key={item}
                    className="font-mono text-[11px] text-soft bg-elevated px-1.5 py-0.5 rounded"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default StackGrid
