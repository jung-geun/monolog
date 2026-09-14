import Head from "next/head"
import styled from "@emotion/styled"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

const STATUS_ITEMS = ["main", "Privacy", "UTF-8", "Markdown"]

const PrivacyPage = () => {
  useRegisterChrome("privacy.md", STATUS_ITEMS)

  return (
    <StyledWrapper>
      <Head>
        <title>Privacy & Ads — pieroot log</title>
        <meta
          name="description"
          content="pieroot log의 개인정보 처리 및 Google AdSense 광고 정책"
        />
      </Head>
      <div className="scroll-area">
        <main className="policy">
          <p className="eyebrow">privacy.md</p>
          <h1>Privacy & Ads</h1>
          <p className="updated">최종 업데이트: 2026년 4월 8일</p>

          <section>
            <h2>수집하는 정보</h2>
            <p>
              이 사이트는 서비스 운영과 품질 개선을 위해 방문 기록, 브라우저 및
              기기 정보, 대략적인 위치, 조회한 페이지와 같은 비식별 이용 정보를
              처리할 수 있습니다. 댓글을 남기면 입력한 닉네임과 댓글 내용이
              저장됩니다.
            </p>
          </section>

          <section>
            <h2>Google AdSense와 제3자 쿠키</h2>
            <p>
              이 사이트는 Google AdSense를 사용해 광고를 게재할 수 있습니다.
              Google과 그 파트너는 쿠키 또는 유사 기술을 사용해 이전 방문 기록을
              바탕으로 개인 맞춤 광고를 제공하거나, 개인 맞춤이 아닌 문맥 기반
              광고를 제공할 수 있습니다.
            </p>
            <p>
              Google의 광고 데이터 처리 방식은{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noreferrer"
              >
                Google 광고 정책
              </a>
              에서 확인할 수 있습니다.
            </p>
          </section>

          <section>
            <h2>광고 설정과 선택권</h2>
            <p>
              방문자는{" "}
              <a
                href="https://adssettings.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                Google 광고 설정
              </a>
              에서 개인 맞춤 광고 사용 여부를 관리하거나 해제할 수 있습니다.
              브라우저 설정에서 쿠키를 삭제하거나 차단할 수도 있으며, 이 경우
              사이트 또는 광고의 일부 기능이 제한될 수 있습니다.
            </p>
          </section>

          <section>
            <h2>문의</h2>
            <p>
              개인정보 처리 또는 광고 정책에 관한 문의는{" "}
              <a href="mailto:pieroot@konkuk.ac.kr">pieroot@konkuk.ac.kr</a>로
              보내주세요.
            </p>
          </section>
        </main>
      </div>
    </StyledWrapper>
  )
}

export default PrivacyPage

const StyledWrapper = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .scroll-area {
    flex: 1;
    overflow-y: auto;
  }

  .policy {
    width: min(760px, 100%);
    padding: 48px 56px 80px;
  }

  .eyebrow,
  .updated {
    color: ${({ theme }) => theme.colors.editor.fg3};
    font-family: var(--font-mono, monospace);
    font-size: 12px;
  }

  h1 {
    margin: 8px 0 10px;
    color: ${({ theme }) => theme.colors.editor.fg};
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: clamp(30px, 5vw, 44px);
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .updated {
    margin-bottom: 40px;
  }

  section {
    padding: 24px 0;
    border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
  }

  h2 {
    margin-bottom: 12px;
    color: ${({ theme }) => theme.colors.editor.fg};
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 20px;
    font-weight: 650;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.editor.fg2};
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 15px;
    line-height: 1.8;
  }

  p + p {
    margin-top: 12px;
  }

  a {
    color: ${({ theme }) => theme.colors.editor.accent3};
    text-underline-offset: 3px;
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    .policy {
      padding: 32px 20px 60px;
    }
  }
`
