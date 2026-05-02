/**
 * Debug logger that only logs in development environment
 */
export const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args)
  }
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
