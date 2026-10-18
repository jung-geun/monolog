import styled from "@emotion/styled"

/**
 * Keep semantic blocks and the renderer's native media/collection layout intact.
 * Manual slots are React siblings after selected complete root-page blocks.
 * This layout does not disable Auto ads: the operator must turn them off in
 * AdSense before confirming manual mode. `google-anno-skip` only excludes
 * Ad intents. Never hide, remove or reparent an already served ad here.
 */
const ArticleFlow = styled.div`
  .article-ad-slot {
    align-self: stretch;
    flex-shrink: 0;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 2rem 0;
  }
`

export default ArticleFlow
