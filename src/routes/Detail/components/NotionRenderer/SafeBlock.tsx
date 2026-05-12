import React from "react"

type Props = {
  children: React.ReactNode
  fallback?: React.ReactNode
  name?: string
}

type State = {
  hasError: boolean
}

/**
 * Localized error boundary for react-notion-x third-party block renderers.
 * Prevents a single block's crash (most commonly `<Code>` racing with portal
 * DOM mutation) from collapsing the entire page tree.
 */
export class SafeBlock extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[SafeBlock${this.props.name ? ` ${this.props.name}` : ""}] caught`, error, info)
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}
