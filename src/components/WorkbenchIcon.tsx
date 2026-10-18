import type { IconBaseProps } from "react-icons"
import {
  VscFiles, VscSearch, VscGraph, VscTerminal, VscSettingsGear, VscClose,
  VscChevronRight, VscChevronDown, VscArrowLeft, VscArrowRight,
  VscLayoutSidebarLeft, VscLayoutPanel, VscLayoutSidebarRight, VscSplitHorizontal,
  VscPreview, VscCode, VscBook, VscLink, VscComment, VscPinned, VscHistory,
  VscEllipsis, VscCollapseAll, VscCheck, VscLinkExternal, VscColorMode,
  VscFolder, VscInfo, VscRemote,
} from "react-icons/vsc"

const icons = {
  files: VscFiles, search: VscSearch, graph: VscGraph, command: VscTerminal,
  settings: VscSettingsGear, close: VscClose, "chevron-right": VscChevronRight,
  "chevron-down": VscChevronDown, "arrow-left": VscArrowLeft, "arrow-right": VscArrowRight,
  "layout-sidebar": VscLayoutSidebarLeft, "layout-panel": VscLayoutPanel,
  "layout-right": VscLayoutSidebarRight, split: VscSplitHorizontal, preview: VscPreview,
  code: VscCode, book: VscBook, link: VscLink, comment: VscComment, pin: VscPinned,
  history: VscHistory, more: VscEllipsis, "collapse-all": VscCollapseAll,
  check: VscCheck, external: VscLinkExternal, sun: VscColorMode, moon: VscColorMode,
  folder: VscFolder, info: VscInfo, remote: VscRemote,
} as const

export type WorkbenchIconName = keyof typeof icons

export default function WorkbenchIcon({ name, size = 16, ...props }: IconBaseProps & { name: WorkbenchIconName }) {
  const Icon = icons[name]
  return <Icon size={size} aria-hidden="true" focusable="false" {...props} />
}
