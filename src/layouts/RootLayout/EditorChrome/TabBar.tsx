import Link from "next/link"
import { useRouter } from "next/router"
import styled from "@emotion/styled"

type Tab = {
  label: string
  href: string
  icon?: string
}

type Props = {
  tabs: Tab[]
  activeIdx: number
}

const TabBar = ({ tabs, activeIdx }: Props) => (
  <StyledWrapper>
    {tabs.map((tab, i) => (
      <Link key={tab.href} href={tab.href} className={`tab${i === activeIdx ? " active" : ""}`}>
        <span className="icon">{tab.icon ?? "◧"}</span>
        {tab.label}
        <span className="close">×</span>
      </Link>
    ))}
    <div className="filler" />
  </StyledWrapper>
)

export default TabBar

const StyledWrapper = styled.div`
  height: ${({ theme }) => theme.variables.tabBarHeight}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  display: flex;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  flex-shrink: 0;
  overflow: hidden;

  .tab {
    position: relative;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
    color: ${({ theme }) => theme.colors.editor.fg3};
    background: transparent;
    white-space: nowrap;
    cursor: pointer;
    text-decoration: none;

    &.active {
      background: ${({ theme }) => theme.colors.editor.bg};
      color: ${({ theme }) => theme.colors.editor.fg};

      &::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
        height: 2px;
        background: ${({ theme }) => theme.colors.editor.accent};
      }
    }

    .icon {
      color: ${({ theme }) => theme.colors.editor.accent2};
    }
    .close {
      color: ${({ theme }) => theme.colors.editor.fg4};
    }
  }

  .filler {
    flex: 1;
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  }
`
