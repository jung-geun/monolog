import WorkbenchIcon from "src/components/WorkbenchIcon"
import FileIcon from "src/components/FileIcon"
import type { Tab } from "./RouteChromeContext"

const TabIcon = ({ tab }: { tab: Tab }) => {
  if (tab.kind === "readme") return <WorkbenchIcon name="book" />
  if (tab.kind === "graph" || tab.href.split(/[?#]/, 1)[0] === "/ontology") return <WorkbenchIcon name="graph" />
  if (tab.href.split(/[?#]/, 1)[0] === "/search") return <WorkbenchIcon name="search" />
  if (tab.kind === "series" || tab.kind === "category") return <WorkbenchIcon name="folder" />
  return <FileIcon name={tab.label} />
}
export default TabIcon
