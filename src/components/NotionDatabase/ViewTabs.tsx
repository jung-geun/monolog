import React from "react"
import styled from "@emotion/styled"
import { TDbView, TDbViewMeta } from "src/types"

type Props = {
  views: TDbViewMeta[]
  activeId: string | null
  onChange: (id: string) => void
}

const VIEW_ICONS: Record<TDbView, string> = {
  table: "⊞",
  board: "⊟",
  gallery: "⊞",
  list: "☰",
}

const VIEW_LABELS: Record<TDbView, string> = {
  table: "Table",
  board: "Board",
  gallery: "Gallery",
  list: "List",
}

const ViewTabs: React.FC<Props> = ({ views, activeId, onChange }) => {
  return (
    <TabBar role="tablist">
      {views.map((v) => (
        <Tab
          key={v.id}
          role="tab"
          aria-selected={v.id === activeId}
          active={v.id === activeId}
          onClick={() => onChange(v.id)}
        >
          <TabIcon>{VIEW_ICONS[v.type]}</TabIcon>
          <TabLabel>{v.name || VIEW_LABELS[v.type]}</TabLabel>
        </Tab>
      ))}
    </TabBar>
  )
}

export default ViewTabs

const TabBar = styled.div`
  display: flex;
  gap: 0;
  overflow-x: auto;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray6};
  margin-bottom: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`

const Tab = styled.button<{ active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border: none;
  border-bottom: 2px solid ${({ active, theme }) =>
    active ? theme.colors.gray12 : "transparent"};
  background: none;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: ${({ active }) => (active ? 600 : 400)};
  color: ${({ active, theme }) =>
    active ? theme.colors.gray12 : theme.colors.gray9};
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
  &:hover {
    color: ${({ theme }) => theme.colors.gray12};
    background: ${({ theme }) => theme.colors.gray3};
  }
`

const TabIcon = styled.span`
  font-size: 0.9rem;
  line-height: 1;
`

const TabLabel = styled.span``
