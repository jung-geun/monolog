module.exports = {
  output: 'standalone',
  compiler: {
    emotion: true,
  },
  experimental: {
    turbopackSourceMaps: false,
  },
  async headers() {
    // CSP — Report-Only 모드로 시작. 브라우저 콘솔에서 위반 사항 모니터링 후
    // 안정되면 헤더 키를 'Content-Security-Policy'로 바꿔 enforce로 전환.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://*.google-analytics.com https://*.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://www.google.com https://utteranc.es",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.google-analytics.com https://*.googletagmanager.com https://*.doubleclick.net https://*.googlesyndication.com",
      "frame-src 'self' https://utteranc.es https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://*.googletagmanager.com",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')

    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy-Report-Only', value: csp },
    ]
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    localPatterns: [
      { pathname: '/api/image-proxy' },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'www.notion.so' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com' },
      { protocol: 'https', hostname: 'us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 's3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 's3-us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 'prod-files-secure.s3.us-west-2.amazonaws.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 480, 640, 828, 1080, 1280, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 86400,
  },
  // Generate 404 page instead of failing build for missing pages
  generateBuildId: async () => {
    return `build-${ Date.now() }`
  },
  // Error handling during static generation
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 2,
  }
}
