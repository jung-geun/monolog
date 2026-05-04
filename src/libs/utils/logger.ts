const DEBUG_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.MONOLOG_DEBUG === "1"

export const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) console.log(...args)
}

/**
 * Error logger that always logs (even in production)
 */
export const errorLog = (...args: any[]) => {
  console.error(...args)
}

/**
 * Warning logger that always logs (even in production)
 */
export const warnLog = (...args: any[]) => {
  console.warn(...args)
}
