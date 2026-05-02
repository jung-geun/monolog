import styled from "@emotion/styled"
import { CONFIG } from "site.config"

const HomeHero = () => (
  <StyledWrapper>
    <div className="frontmatter">
      <div>---</div>
      <div><span className="key">title</span>: pieroot.log</div>
      <div><span className="key">author</span>: {CONFIG.profile.name}</div>
      <div><span className="key">since</span>: {CONFIG.since || new Date().getFullYear()}</div>
      <div><span className="key">kind</span>: technical-notebook</div>
      <div>---</div>
    </div>

    <div className="hero">
      <div className="label"># pieroot.log</div>
      <h1>
        a <span className="underlined">technical notebook</span>
        <br />kept in the open.
      </h1>
      <p className="bio">
        <span className="comment">{"// "}</span>
        {CONFIG.profile.bio}
      </p>
    </div>
  </StyledWrapper>
)

export default HomeHero

const StyledWrapper = styled.div`
  margin-bottom: 36px;

  .frontmatter {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    margin-bottom: 28px;
    line-height: 1.7;

    .key { color: ${({ theme }) => theme.colors.editor.accent3}; }
  }

  .hero {
    .label {
      font-size: 13px;
      color: ${({ theme }) => theme.colors.editor.accent};
      font-family: var(--font-mono, monospace);
      margin-bottom: 6px;
    }

    h1 {
      font-family: var(--font-mono, monospace);
      font-size: clamp(36px, 5vw, 60px);
      line-height: 1.05;
      font-weight: 500;
      letter-spacing: -0.01em;
      margin: 0;
      color: ${({ theme }) => theme.colors.editor.fg};
      font-style: normal;

      &::before {
        content: "# ";
        color: ${({ theme }) => theme.colors.editor.accent};
        font-weight: 400;
      }
    }

    .underlined {
      text-decoration: underline;
      text-decoration-color: ${({ theme }) => theme.colors.editor.accent};
      text-decoration-thickness: 2px;
      text-underline-offset: 6px;
    }

    .bio {
      margin-top: 18px;
      font-family: var(--font-mono, monospace);
      font-size: 14px;
      color: ${({ theme }) => theme.colors.editor.fg2};
      line-height: 1.7;
      max-width: 620px;
      margin-bottom: 0;

      .comment { color: ${({ theme }) => theme.colors.editor.fg3}; }
    }
  }
`
