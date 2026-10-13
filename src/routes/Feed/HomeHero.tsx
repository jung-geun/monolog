import Image from "next/image"
import Link from "next/link"
import { CONFIG } from "site.config"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useWorkbench } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import { useRouteChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

const HomeHero = () => {
  const { setSidebarView, setSettingsOpen } = useWorkbench()
  const { setFileTreeOpen } = useRouteChrome()
  return <>
    <header className="welcome-header">
      <h1>Welcome</h1><p className="workspace-name">{CONFIG.blog.title}</p>
      <div className="author-identity">
        {CONFIG.profile.image && <Image src={CONFIG.profile.image} alt="" width={36} height={36} />}
        <div><Link href={`/${CONFIG.aboutSlug}`}>{CONFIG.profile.name}</Link><span>{CONFIG.profile.role}</span></div>
      </div>
      <p className="author-bio">{CONFIG.profile.bio}</p>
    </header>
    <section className="start-section" aria-labelledby="start-heading">
      <h2 id="start-heading">Start</h2>
      <nav className="start-actions" aria-label="Workspace actions">
        <button type="button" onClick={() => { setSidebarView("search"); setFileTreeOpen(true) }}><WorkbenchIcon name="search" /><span>Search publications<small>Find a title, summary or tag</small></span></button>
        <Link href="/search"><WorkbenchIcon name="files" /><span>Browse all entries<small>Open the searchable archive</small></span></Link>
        <button type="button" onClick={() => { setSidebarView("knowledge"); setFileTreeOpen(true) }}><WorkbenchIcon name="graph" /><span>Explore knowledge<small>Tags, series and connected posts</small></span></button>
        <button type="button" onClick={() => setSettingsOpen(true)}><WorkbenchIcon name="settings" /><span>Customize workspace<small>Color theme and reading layout</small></span></button>
      </nav>
    </section>
  </>
}

export default HomeHero
