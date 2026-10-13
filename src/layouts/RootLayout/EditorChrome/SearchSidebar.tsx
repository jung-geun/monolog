import { useState } from "react"
import styled from "@emotion/styled"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { variables } from "src/styles/variables"
import SearchExperience from "src/routes/Search/SearchExperience"
import { useWorkbench } from "./WorkbenchContext"
import { useRouteChrome } from "./RouteChromeContext"

export default function SearchSidebar() {
  const [query, setQuery] = useState("")
  const { setSidebarView } = useWorkbench()
  const { setFileTreeOpen } = useRouteChrome()
  const closeOnMobile = () => {
    if (window.matchMedia(`(max-width: ${variables.breakpoint}px)`).matches) setFileTreeOpen(false)
  }
  return <StyledSidebar aria-label="Search sidebar">
    <header><h2>SEARCH</h2><button type="button" aria-label="Return to Explorer" title="Return to Explorer" onClick={() => setSidebarView("explorer")}><WorkbenchIcon name="files" /></button></header>
    <div className="content"><SearchExperience query={query} onQueryChange={setQuery} sidebar onEscape={() => setFileTreeOpen(false)} onSelect={closeOnMobile} /></div>
  </StyledSidebar>
}

const StyledSidebar = styled.aside`
  height: 100%; min-height: 0; display: flex; flex-direction: column;
  background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.fg2};
  font-family: var(--font-ui, sans-serif);
  header { display: flex; align-items: center; padding: 8px 12px 8px 18px; min-height: 35px; gap: 8px; }
  h2 { margin: 0; flex: 1; font-size: 11px; font-weight: 400; letter-spacing: 0.5px; }
  header button { display: flex; background: transparent; border: 0; color: inherit; cursor: pointer; padding: 4px; }
  header button:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
  button:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; }
  .content { overflow-y: auto; min-height: 0; padding: 4px 12px 20px; scrollbar-width: thin; }
`
