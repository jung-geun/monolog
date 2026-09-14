import styled from "@emotion/styled"

type Placement = "article" | "sidebar" | "mobile"

type AdPlaceholderProps = {
  placement: Placement
}

const LABELS: Record<Placement, string> = {
  article: "광고",
  sidebar: "광고",
  mobile: "광고",
}

const AdPlaceholder = ({ placement }: AdPlaceholderProps) => (
  <StyledPlaceholder
    data-placement={placement}
    aria-label={`${LABELS[placement]} 영역`}
  >
    <span>{LABELS[placement]}</span>
  </StyledPlaceholder>
)

export const InArticleAd = () => <AdPlaceholder placement="article" />
export const SidebarAd = () => <AdPlaceholder placement="sidebar" />
export const MobileAd = () => <AdPlaceholder placement="mobile" />

const StyledPlaceholder = styled.aside`
  align-items: center;
  justify-content: center;
  border: 1px dashed ${({ theme }) => theme.colors.editor.line2};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.editor.bg3};
  color: ${({ theme }) => theme.colors.editor.fg3};
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;

  &[data-placement="article"] {
    display: flex;
    width: 100%;
    min-height: 250px;
    margin: 36px 0;
  }

  &[data-placement="sidebar"] {
    display: flex;
    width: 200px;
    height: 200px;
    margin: 24px auto 0;
  }

  &[data-placement="mobile"] {
    display: none;
    width: min(320px, 100%);
    height: 100px;
    margin: 32px auto 20px;
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    &[data-placement="mobile"] {
      display: flex;
    }
  }
`
