import { useMemo } from "react"
import styled from "@emotion/styled"
import React from "react"
import Image from "next/image"
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
import { CONFIG } from "site.config"
import ActivityHeatmap from "src/routes/Detail/PageDetail/components/ActivityHeatmap"
import ContactBlock from "src/routes/Detail/PageDetail/components/ContactBlock"
import StackGrid from "src/routes/Detail/PageDetail/components/StackGrid"
import StatsGrid from "src/routes/Feed/StatsGrid"
import { getStats } from "src/libs/utils/stats"

const aboutSlug = (CONFIG as any).aboutSlug ?? "about"

const PostDetail: React.FC = () => {
  const data = usePostQuery()
  const allPosts = usePostsQuery()

  const filename = data ? `${data.slug}.md` : "loading.md"
  const statusItems = useMemo(() => ["main", "Reading", "Markdown"], [])
  useRegisterChrome(filename, statusItems)

  if (!data) return null

  const isAbout = data.slug === aboutSlug
  const category = data.category?.[0] || undefined
  const dateStr = data.date?.start_date || data.createdTime?.slice(0, 10) || ""

  if (isAbout) {
    const stats = getStats(allPosts)
    return (
      <StyledWrapper>
        <div className="scroll-area">
          <div className="content-grid content-grid--about">
            <div className="body">
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
    <StyledWrapper>
      <ReadingProgress />

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
              date={dateStr}
              category={category}
              tags={data.tags}
            />

            <h1 className="post-title">{data.title}</h1>

            <div className="notion-content">
              <NotionRenderer recordMap={data.recordMap} />
            </div>

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

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  .content-grid {
    display: grid;
    grid-template-columns: 1fr 240px;
    min-height: 100%;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      grid-template-columns: 1fr;
    }

    &--about {
      grid-template-columns: 1fr;

      .body { max-width: 900px; }

      @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
        grid-template-columns: 1fr;
      }
    }
  }

  .body {
    padding: 40px 56px 64px;
    max-width: 760px;
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

  .notion-content {
    .notion-page { padding: 0 !important; }

    code, .notion-inline-code {
      background: var(--color-sunken, rgb(var(--c-sunken)));
      color: var(--color-signal, rgb(var(--c-signal)));
      border-radius: 4px;
      padding: 2px 6px;
      font-family: var(--font-mono, "JetBrains Mono", monospace);
    }
  }
`
