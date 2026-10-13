import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import SearchExperience from "./SearchExperience"
import { searchPosts, type SearchField } from "./query"

const Search = () => {
  const router = useRouter()
  const urlQuery = typeof router.query.q === "string" ? router.query.q : ""
  const [query, setQuery] = useState(urlQuery)
  const [field, setField] = useState<SearchField>("all")
  const pendingQuery = useRef<string | null>(null)
  const queryRequest = useRef(0)
  const posts = usePostsQuery()
  const count = useMemo(() => searchPosts(posts, query, field).length, [posts, query, field])

  useEffect(() => {
    if (!router.isReady) return
    if (pendingQuery.current !== null && pendingQuery.current !== urlQuery) return
    pendingQuery.current = null
    setQuery(urlQuery)
  }, [router.isReady, urlQuery])

  useEffect(() => {
    const syncNavigation = (url: string) => {
      const destination = new URL(url, window.location.origin)
      if ((destination.searchParams.get("q") ?? "") !== pendingQuery.current) pendingQuery.current = null
    }
    router.events.on("routeChangeStart", syncNavigation)
    return () => router.events.off("routeChangeStart", syncNavigation)
  }, [router.events])

  const changeQuery = (value: string) => {
    setQuery(value)
    pendingQuery.current = value
    const request = ++queryRequest.current
    const next = { ...router.query }
    if (value) next.q = value
    else delete next.q
    void router.replace({ pathname: router.pathname, query: next }, undefined, { shallow: true, scroll: false }).then(() => {
      if (request === queryRequest.current) pendingQuery.current = null
    })
  }
  const statusItems = useMemo(() => ["Search Editor", `${count} entries`, "Publication metadata"], [count])
  useRegisterChrome("Search", statusItems, "page")

  return <StyledWrapper>
    <header><WorkbenchIcon name="search" size={20} /><h1>Search</h1><span>Publication metadata</span></header>
    <SearchExperience query={query} onQueryChange={changeQuery} field={field} onFieldChange={setField} />
  </StyledWrapper>
}

export default Search

const StyledWrapper = styled.main`
  flex: 1;
  min-width: 0;
  padding: 24px 32px 40px;
  max-width: 980px;
  width: 100%;
  box-sizing: border-box;
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-family: var(--font-ui, sans-serif); }
  h1 { font-size: 20px; font-weight: 500; margin: 0; color: ${({ theme }) => theme.colors.editor.fg}; }
  header > span { font-size: 12px; color: ${({ theme }) => theme.colors.editor.fg3}; margin-left: auto; }
  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) { padding: 20px 16px 32px; header > span { display: none; } }
`
