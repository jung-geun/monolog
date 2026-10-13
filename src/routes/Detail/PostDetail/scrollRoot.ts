export function getReadingScrollRoot(): HTMLElement | Window {
  const splitPreview = document.querySelector<HTMLElement>('.document-panes--split .document-preview')
  if (splitPreview && /auto|scroll/.test(getComputedStyle(splitPreview).overflowY)) return splitPreview
  const editor = document.querySelector<HTMLElement>('.page-content')
  return editor && /auto|scroll/.test(getComputedStyle(editor).overflowY) ? editor : window
}

export function readingScrollOffset(root: HTMLElement | Window): number {
  return root instanceof HTMLElement ? root.getBoundingClientRect().top : 0
}
