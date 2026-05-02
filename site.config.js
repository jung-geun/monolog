const CONFIG = {
  // profile setting (required)
  profile: {
    name: "jung-geun",
    image: "/avatar.svg", // If you want to create your own notion avatar, check out https://notion-avatar.vercel.app
    role: "system developer",
    bio: "I develop everything using everyting.",
    email: "pieroot@konkuk.ac.kr",
    linkedin: "pieroot",
    github: "jung-geun",
    instagram: "__jung__02",
  },
  projects: [
    {
      name: `monolog`,
      href: "https://github.com/jung-geun/monolog",
    },
    {
      name: `openstack-afterglow`,
      href: "https://github.com/jung-geun/openstack-afterglow",
    },
    {
      name: `NFD2NFC`,
      href: "https://github.com/jung-geun/NFD2NFC",
    },
    {
      name: `animal-pose-classification`,
      href: "https://github.com/jung-geun/animal-pose-classification",
    },
  ],
  // blog setting (required)
  blog: {
    title: "pieroot log",
    description: "welcome to pieroot's logs!",
    scheme: "system", // 'light' | 'dark' | 'system'
  },

  // CONFIG configration (required)
  link: "https://blog.pieroot.xyz",
  since: 2026, // If leave this empty, current year will be used.
  lang: "ko-kr", // ['en-US', 'zh-CN', 'zh-HK', 'zh-TW', 'ja-JP', 'es-ES', 'ko-KR']
  ogImageGenerateURL: "https://og-image-korean.vercel.app", // The link to generate OG image, don't end with a slash

  // notion configuration (required)
  notionConfig: {
    dataSourceId: process.env.NOTION_DATASOURCE_ID,
  },

  // plugin configuration (optional)
  googleAnalytics: {
    enable: true,
    config: {
      measurementId: process.env.NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID || "",
    },
  },
  googleSearchConsole: {
    enable: false,
    config: {
      siteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
    },
  },
  naverSearchAdvisor: {
    enable: false,
    config: {
      siteVerification: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION || "",
    },
  },
  utterances: {
    enable: true,
    config: {
      repo: process.env.NEXT_PUBLIC_UTTERANCES_REPO || "",
      "issue-term": "og:title",
      label: "💬 Utterances",
    },
  },
  cusdis: {
    enable: false,
    config: {
      host: "https://cusdis.com",
      appid: "", // Embed Code -> data-app-id value
    },
  },
  isProd: process.env.VERCEL_ENV === "production", // distinguish between development and production environment (ref: https://vercel.com/docs/environment-variables#system-environment-variables)
  // revalidate time (in seconds) for ISR on pages like [slug] and index.
  // Can be configured via environment variable REVALIDATE_HOURS (e.g., 6 or 12).
  revalidateTime: (function () {
    const hours = parseInt(process.env.REVALIDATE_HOURS || process.env.NEXT_PUBLIC_REVALIDATE_HOURS || '6', 10)
    if (Number.isNaN(hours) || hours <= 0) return 6 * 3600
    return hours * 3600
  })(),
}

module.exports = { CONFIG }
