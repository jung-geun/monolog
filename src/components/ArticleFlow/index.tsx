import styled from "@emotion/styled"

/**
 * Keep semantic blocks and the renderer's native media/collection layout intact.
 * Auto ads choose placements; injected siblings can stretch in native columns
 * without creating ad slots, reserved heights, or empty spacers.
 */
const ArticleFlow = styled.div`
  .notion-page > .google-auto-placed,
  .notion-page-content > .google-auto-placed,
  .notion-page-content-inner > .google-auto-placed {
    align-self: stretch;
    flex-shrink: 0;
  }
`

export default ArticleFlow
