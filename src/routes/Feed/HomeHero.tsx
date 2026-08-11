import { CONFIG } from "site.config"

const HomeHero = () => (
  <div className="mb-10">
    <div className="flex items-center gap-2 font-mono text-xs text-mute mb-3">
      <span>{CONFIG.profile.name}</span>
      <span>·</span>
      <span>since {CONFIG.since || new Date().getFullYear()}</span>
    </div>
    <h1 className="font-sans text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-strong leading-tight">
      a technical notebook
      <br />kept in the open.
    </h1>
    <p className="mt-4 font-sans text-sm sm:text-base text-soft leading-relaxed max-w-2xl">
      {CONFIG.profile.bio}
    </p>
  </div>
)

export default HomeHero
