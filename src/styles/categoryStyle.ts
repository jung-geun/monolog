export const getCategoryStyle = (cat: string) => {
  const normalized = cat.trim().toLowerCase()
  if (normalized.includes("doc")) {
    return {
      cardBorder: "hover:border-signal/45",
      stripHover: "group-hover:bg-signal",
      badgeBgText: "bg-signal-50 text-signal-900 dark:text-signal-200",
      titleHover: "group-hover:text-signal",
      arrowHover: "group-hover:text-signal",
    }
  }
  if (normalized.includes("computer") || normalized === "cs") {
    return {
      cardBorder: "hover:border-cs/45",
      stripHover: "group-hover:bg-cs",
      badgeBgText: "bg-cs-50 text-cs-900 dark:text-cs-200",
      titleHover: "group-hover:text-cs",
      arrowHover: "group-hover:text-cs",
    }
  }
  if (normalized.includes("paper") || normalized.includes("논문")) {
    return {
      cardBorder: "hover:border-paper/45",
      stripHover: "group-hover:bg-paper",
      badgeBgText: "bg-paper-50 text-paper-900 dark:text-paper-200",
      titleHover: "group-hover:text-paper",
      arrowHover: "group-hover:text-paper",
    }
  }
  if (normalized.includes("research")) {
    return {
      cardBorder: "hover:border-research/45",
      stripHover: "group-hover:bg-research",
      badgeBgText: "bg-research-50 text-research-900 dark:text-research-200",
      titleHover: "group-hover:text-research",
      arrowHover: "group-hover:text-research",
    }
  }
  return {
    cardBorder: "hover:border-signal/45",
    stripHover: "group-hover:bg-signal",
    badgeBgText: "bg-signal-50 text-signal-900 dark:text-signal-200",
    titleHover: "group-hover:text-signal",
    arrowHover: "group-hover:text-signal",
  }
}
