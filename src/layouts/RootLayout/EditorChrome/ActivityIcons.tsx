import React from "react"

type IconProps = {
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
})

export const ExplorerIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <line x1="12" y1="9" x2="17.5" y2="9" />
    <line x1="12" y1="13" x2="17.5" y2="13" />
    <line x1="12" y1="17" x2="15.5" y2="17" />
  </svg>
)

export const SearchIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="10.5" cy="10.5" r="6" />
    <line x1="15" y1="15" x2="20" y2="20" />
  </svg>
)

export const GraphIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <circle cx="12" cy="12" r="2.2" />
    <line x1="7.6" y1="7.6" x2="10.4" y2="10.4" />
    <line x1="16.4" y1="7.6" x2="13.6" y2="10.4" />
    <line x1="7.6" y1="16.4" x2="10.4" y2="13.6" />
    <line x1="16.4" y1="16.4" x2="13.6" y2="13.6" />
  </svg>
)

export const CommandIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 4.5a2.5 2.5 0 1 1-2.5 2.5V8h2.5" />
    <path d="M16 4.5a2.5 2.5 0 1 0 2.5 2.5V8H16" />
    <path d="M8 19.5a2.5 2.5 0 1 0-2.5-2.5V16h2.5" />
    <path d="M16 19.5a2.5 2.5 0 1 1 2.5-2.5V16H16" />
    <rect x="8" y="8" width="8" height="8" />
  </svg>
)

export const DraftsIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M14.5 4.5l5 5L9 20H4v-5z" />
    <line x1="13" y1="6" x2="18" y2="11" />
  </svg>
)

export const SunIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3.8" />
    <line x1="12" y1="3" x2="12" y2="5.5" />
    <line x1="12" y1="18.5" x2="12" y2="21" />
    <line x1="3" y1="12" x2="5.5" y2="12" />
    <line x1="18.5" y1="12" x2="21" y2="12" />
    <line x1="5.6" y1="5.6" x2="7.4" y2="7.4" />
    <line x1="16.6" y1="16.6" x2="18.4" y2="18.4" />
    <line x1="5.6" y1="18.4" x2="7.4" y2="16.6" />
    <line x1="16.6" y1="7.4" x2="18.4" y2="5.6" />
  </svg>
)

export const MoonIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
)

export const SettingsIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
)
