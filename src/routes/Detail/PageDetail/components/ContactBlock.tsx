import { CONFIG } from "site.config"

type ContactEntry = { key: string; value: string; href?: string }

function buildEntries(): ContactEntry[] {
  const p = CONFIG.profile
  const entries: ContactEntry[] = []

  if (p.email) entries.push({ key: "email", value: p.email, href: `mailto:${p.email}` })
  if (p.github) entries.push({ key: "github", value: `github.com/${p.github}`, href: `https://github.com/${p.github}` })
  if (p.linkedin) entries.push({ key: "linkedin", value: `linkedin.com/in/${p.linkedin}`, href: `https://linkedin.com/in/${p.linkedin}` })
  if (p.instagram) entries.push({ key: "instagram", value: `@${p.instagram}`, href: `https://instagram.com/${p.instagram}` })

  return entries
}

const ContactBlock = () => {
  const entries = buildEntries()
  if (!entries.length) return null

  return (
    <div className="mb-8">
      <p className="font-mono text-[13px] mb-2">
        <span className="text-signal">{"### "}</span>
        <span className="text-zinc-300">contact</span>
      </p>
      <div className="font-mono text-[13px] space-y-1 pl-4 border-l border-hairline">
        <p className="text-mute">---</p>
        {entries.map(({ key, value, href }) => (
          <p key={key}>
            <span className="text-signal-200">{key}</span>
            <span className="text-mute">{": "}</span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 underline underline-offset-2 decoration-hairline hover:text-signal transition-colors"
              >
                {value}
              </a>
            ) : (
              <span className="text-zinc-300">{value}</span>
            )}
          </p>
        ))}
        <p className="text-mute">---</p>
      </div>
    </div>
  )
}

export default ContactBlock
