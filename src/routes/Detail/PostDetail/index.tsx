import { useMemo } from "react"
import styled from "@emotion/styled"
import React from "react"
import Image from "next/image"
import { FiExternalLink } from "react-icons/fi"
import usePostQuery from "src/hooks/usePostQuery"
import usePostsQuery from "src/hooks/usePostsQuery"
import NotionRenderer from "../components/NotionRenderer"
import Footer from "./PostFooter"
import SeriesNav from "./SeriesNav"
import CommentBox from "./CommentBox"
import Frontmatter from "src/components/Frontmatter"
import ReadingProgress from "./ReadingProgress"
import RightRail from "./RightRail"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import AdSlot from "src/components/AdSlot"
import { CONFIG } from "site.config"
import ActivityHeatmap from "src/routes/Detail/PageDetail/components/ActivityHeatmap"
import GitHubContributions from "src/routes/Detail/PageDetail/components/GitHubContributions"
import ContactBlock from "src/routes/Detail/PageDetail/components/ContactBlock"
import StackGrid from "src/routes/Detail/PageDetail/components/StackGrid"
import StatsGrid from "src/routes/Feed/StatsGrid"
import { getStats } from "src/libs/utils/stats"
import { markdownUrl, publishedDate, modifiedDate, calendarDate, summaryText } from "src/libs/seo"
import { getArticleDescription } from "src/libs/utils/notion/articleSummary"

const PostDetail: React.FC = () => {
  const data = usePostQuery()
  const allPosts = usePostsQuery()

  const isAbout = Boolean(CONFIG.aboutSlug) && data?.slug === CONFIG.aboutSlug
  const filename = data ? `${data.slug}.md` : ""
  const statusItems = useMemo(() => ["main", "Reading", "Markdown"], [])
  useRegisterChrome(filename, statusItems, isAbout ? "about" : "post")

  if (!data) return null

  const category = data.category?.[0] || undefined
  const published = publishedDate(data)
  const modified = modifiedDate(data)
  const meaningfulModified = modified && published && modified > published
    && calendarDate(modified) !== calendarDate(published) ? modified : undefined
  const authors = data.author?.map((author) => author.name.trim()).filter(Boolean)
  const summary = getArticleDescription(summaryText(data.summary), data.recordMap, data.id)

  if (isAbout) {
    const stats = getStats(allPosts)
    return (
      <StyledWrapper>
        <div className="scroll-area">
          <div className="content-grid content-grid--about">
            <div className="body">
              <h1 className="post-title">{data.title}</h1>
              {/* YAML frontmatter */}
              <div className="font-mono text-[13px] space-y-0.5 mb-6">
                <p className="text-mute">---</p>
                <p>
                  <span className="text-signal-900 dark:text-signal-200">author</span>
                  <span className="text-mute">{": "}</span>
                  <span className="text-strong">{CONFIG.profile.name}</span>
                </p>
                <p>
                  <span className="text-signal-900 dark:text-signal-200">role</span>
                  <span className="text-mute">{": "}</span>
                  <span className="text-strong">{CONFIG.profile.role}</span>
                </p>
                <p>
                  <span className="text-signal-900 dark:text-signal-200">bio</span>
                  <span className="text-mute">{": "}</span>
                  <span className="text-strong">{CONFIG.profile.bio}</span>
                </p>
                <p className="text-mute">---</p>
              </div>

              <StatsGrid stats={stats} />
              <ActivityHeatmap />
              <GitHubContributions username={CONFIG.profile.github} />
              <StackGrid />
              <ContactBlock />

              <hr className="border-hairline mb-6" />

              <div className="notion-content">
                <NotionRenderer recordMap={data.recordMap} />
              </div>
            </div>
          </div>
        </div>
      </StyledWrapper>
    )
  }

  return (
    <StyledWrapper className="post-detail">
      <ReadingProgress />

      <div className="post-actions">
        <a
          className="markdown-link"
          href={markdownUrl(data.slug)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Markdown으로 보기 (새 창)"
        >
          Markdown으로 보기
          <FiExternalLink aria-hidden="true" />
        </a>
      </div>
      <div className="scroll-area">
        <div className="content-grid">
          <div className="body">
            {data.thumbnail && (
              <div className="hero-thumb">
                <Image
                  src={data.thumbnail}
                  alt={data.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 760px"
                  priority
                  className="object-cover"
                />
              </div>
            )}

            <Frontmatter
              title={data.title}
              date={published}
              modifiedDate={meaningfulModified}
              authors={authors}
              category={category}
              tags={data.tags}
            />

            <h1 className="post-title">{data.title}</h1>
            {summary && (
              <section className="post-summary" aria-label="요약">
                <div className="summary-label">요약</div>
                <p>{summary}</p>
              </section>
            )}

            <div className="notion-content">
              <NotionRenderer recordMap={data.recordMap} />
            </div>
            <AdSlot slot={CONFIG.googleAdsense.config.slots.postBottom} className="my-8" />

            <SeriesNav post={data} allPosts={allPosts} />
            <CommentBox data={data} />
            <Footer />
          </div>
          <RightRail recordMap={data.recordMap} post={data} />
        </div>
      </div>
    </StyledWrapper>
  )
}

export default PostDetail

const BODY_MAX_WIDTH = 760
const RAIL_WIDTH = 240

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;

  &.post-detail {
    --post-actions-height: 48px;
  }

  .scroll-area {
    flex: 1;
    overflow-x: clip;
  }

  /* Keep the context rail at the editor's right edge; only the article is capped. */
  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) ${RAIL_WIDTH}px;
    width: 100%;
    min-height: 100%;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      grid-template-columns: minmax(0, 1fr);
    }

    &--about {
      grid-template-columns: minmax(0, 1fr);

      .body { max-width: 900px; }
    }
  }

  .body {
    padding: 40px 56px 64px;
    max-width: ${BODY_MAX_WIDTH}px;
    min-width: 0;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 24px 20px 60px;
    }
  }

  .hero-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    margin: 0 0 28px;
    border: 1px solid var(--color-hairline, rgb(var(--c-hairline)));
    border-radius: 12px;
    overflow: hidden;
    background: var(--color-card, rgb(var(--c-card)));
  }

  .post-title {
    font-family: var(--font-sans, "Pretendard Variable", Pretendard, system-ui, sans-serif);
    font-size: clamp(28px, 3.5vw, 40px);
    font-weight: 700;
    font-style: normal;
    margin: 0 0 28px;
    color: var(--color-strong, rgb(var(--c-strong)));
    line-height: 1.25;
    letter-spacing: -0.03em;
  }

  .post-actions {
    display: flex;
    position: sticky;
    top: ${({ theme }) => theme.variables.titleBarHeight + theme.variables.tabBarHeight}px;
    z-index: 10;
    height: var(--post-actions-height);
    flex-shrink: 0;
    align-items: center;
    padding: 6px 56px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
    background: ${({ theme }) => theme.colors.editor.bg};

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 6px 20px;
    }
  }

  .markdown-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 6px 10px;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    border-radius: 6px;
    background: ${({ theme }) => theme.colors.editor.bg2};
    color: ${({ theme }) => theme.colors.editor.fg};
    font-size: 13px;
    text-decoration: none;

    &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
    &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 2px; }
    svg { width: 14px; height: 14px; }
  }

  .post-summary {
    margin: 0 0 28px;
    line-height: 1.7;
    overflow-wrap: anywhere;

    .summary-label {
      font-family: var(--font-mono, "JetBrains Mono", monospace);
      font-size: 13px;
      color: var(--color-signal, rgb(var(--c-signal)));
      margin-bottom: 8px;
    }

    p {
      margin: 0;
      white-space: pre-wrap;
    }
  }

  .notion-content {
    .notion-page { padding: 0 !important; }

    code:not(pre code), .notion-inline-code {
      background: var(--color-sunken, rgb(var(--c-sunken)));
      color: var(--color-signal, rgb(var(--c-signal)));
      border-radius: 4px;
      padding: 2px 6px;
      font-family: var(--font-mono, "JetBrains Mono", monospace);
    }
  }
`
