import styled from "@emotion/styled"
import { useRouteChrome } from "./RouteChromeContext"

type Props = {
  preferencesOpen: boolean
  onClosePreferences: () => void
}

const TabSessionControls = ({ preferencesOpen, onClosePreferences }: Props) => {
  const { tabs, tabStorageConsent, allowTabStorage, disallowTabStorage } = useRouteChrome()
  const shouldPrompt = tabStorageConsent === "prompt" && tabs.some((tab) => tab.kind === "post")
  const isUnavailable = tabStorageConsent === "unavailable"

  if (tabStorageConsent === "loading" || (!preferencesOpen && !shouldPrompt)) {
    return null
  }

  const chooseStorage = (enabled: boolean) => {
    if (enabled) allowTabStorage()
    else disallowTabStorage()
    onClosePreferences()
  }

  return (
    <StyledPanel
      id="editor-tab-session-controls"
      role="region"
      aria-labelledby="editor-tab-session-heading"
    >
      <div className="panel-heading">
        <h2 id="editor-tab-session-heading">탭 저장 설정</h2>
        {preferencesOpen && (
          <button type="button" className="dismiss" onClick={onClosePreferences} aria-label="탭 저장 설정 닫기">
            ×
          </button>
        )}
      </div>
      <p>
        동의하면 열린 탭과 최근에 닫은 글의 제목·주소를 이 브라우저에 저장해 새로고침 후에도 복원합니다.
        글 본문은 저장하지 않으며, 이 정보는 서버로 전송하지 않습니다.
      </p>
      {tabStorageConsent === "enabled" && (
        <p className="storage-status" role="status">이 브라우저에 저장 중입니다.</p>
      )}
      {tabStorageConsent === "disabled" && (
        <p className="storage-status" role="status">저장하지 않고 이번 방문 동안만 탭을 유지합니다.</p>
      )}
      {isUnavailable && (
        <p className="storage-status" role="status">
          브라우저 저장소에 접근할 수 없어 탭 저장이 중단되었습니다. 이전에 저장된 탭은 남아 있을 수 있습니다.
        </p>
      )}
      {tabStorageConsent === "enabled" || isUnavailable ? (
        <div className="choices">
          <button type="button" onClick={() => chooseStorage(false)}>저장 해제 및 저장된 탭 삭제</button>
          <span className="choice-note">지금 열린 탭은 닫히지 않습니다.</span>
        </div>
      ) : (
        <div className="choices">
          <button type="button" onClick={() => chooseStorage(true)}>이 브라우저에 저장</button>
          <button type="button" onClick={() => chooseStorage(false)}>저장 안함 (이번 방문)</button>
        </div>
      )}
      {preferencesOpen && (
        <div className="shortcut-help">
          <p>
            글 닫기: <kbd>Alt/Option+W</kbd> · 닫은 글 다시 열기: <kbd>Alt/Option+Shift+T</kbd>.
            입력 중에는 작동하지 않습니다. 탭의 닫기 버튼과 다시 열기 버튼도 사용할 수 있습니다.
          </p>
          <p>
            <kbd>Cmd/Ctrl+W</kbd>와 <kbd>Cmd/Ctrl+Shift+T</kbd>는 브라우저가 우선 처리합니다.
            페이지에 전달될 때만 글 탭에 적용되므로, 내부 탭 조작에는 위 대체 단축키나 버튼을 사용하세요.
          </p>
        </div>
      )}
    </StyledPanel>
  )
}

export default TabSessionControls

const StyledPanel = styled.section`
  flex-shrink: 0;
  min-width: 0;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  background: ${({ theme }) => theme.colors.editor.bg2};
  color: ${({ theme }) => theme.colors.editor.fg2};
  font-size: 12px;
  line-height: 1.65;
  overflow-wrap: anywhere;

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  h2 {
    margin: 0;
    font: inherit;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.editor.fg};
  }

  p { margin: 6px 0; max-width: 78ch; }
  .storage-status { color: ${({ theme }) => theme.colors.editor.fg}; }

  button {
    min-height: 36px;
    padding: 6px 12px;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    border-radius: 3px;
    background: ${({ theme }) => theme.colors.editor.bg};
    color: ${({ theme }) => theme.colors.editor.fg};
    font: inherit;
    line-height: 1.4;
    cursor: pointer;

    &:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.editor.accent};
      outline-offset: 2px;
    }
  }

  .dismiss { width: 36px; padding: 0; flex-shrink: 0; font-size: 18px; }
  .choices { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
  .choices button { flex: 0 1 auto; }
  .choice-note { max-width: 100%; }
  .shortcut-help { margin-top: 12px; border-top: 1px solid ${({ theme }) => theme.colors.editor.line}; padding-top: 6px; }
  kbd { font: inherit; color: ${({ theme }) => theme.colors.editor.fg}; }

  @media (max-width: 480px) {
    padding: 10px 12px;
    .choices button { flex: 1 1 100%; min-height: 40px; }
  }
`
