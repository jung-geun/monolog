import React, { ReactNode } from "react"

type Props = {
  className?: string
  children?: ReactNode
}

export const Emoji = ({ className, children }: Props) => {
  return (
    <span 
      className={className} 
      style={{ 
        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' 
      }}
    >
      {children}
    </span>
  )
}
