import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:      'rgb(var(--c-ink) / <alpha-value>)',
        chrome:   'rgb(var(--c-chrome) / <alpha-value>)',
        card:     'rgb(var(--c-card) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        sunken:   'rgb(var(--c-sunken) / <alpha-value>)',
        hairline: 'rgb(var(--c-hairline) / <alpha-value>)',
        mute:     'rgb(var(--c-mute) / <alpha-value>)',
        soft:     'rgb(var(--c-soft) / <alpha-value>)',
        strong:   'rgb(var(--c-strong) / <alpha-value>)',
        signal: {
          DEFAULT: 'rgb(var(--c-signal) / <alpha-value>)',
          50:      'rgb(var(--c-signal-50) / <alpha-value>)',
          200:     'rgb(var(--c-signal-200) / <alpha-value>)',
          900:     'rgb(var(--c-signal-900) / <alpha-value>)',
        },
        cs: {
          DEFAULT: 'rgb(var(--c-cs) / <alpha-value>)',
          50:      'rgb(var(--c-cs-50) / <alpha-value>)',
          200:     'rgb(var(--c-cs-200) / <alpha-value>)',
          900:     'rgb(var(--c-cs-900) / <alpha-value>)',
        },
        paper: {
          DEFAULT: 'rgb(var(--c-paper) / <alpha-value>)',
          50:      'rgb(var(--c-paper-50) / <alpha-value>)',
          200:     'rgb(var(--c-paper-200) / <alpha-value>)',
          900:     'rgb(var(--c-paper-900) / <alpha-value>)',
        },
        research: {
          DEFAULT: 'rgb(var(--c-research) / <alpha-value>)',
          50:      'rgb(var(--c-research-50) / <alpha-value>)',
          200:     'rgb(var(--c-research-200) / <alpha-value>)',
          900:     'rgb(var(--c-research-900) / <alpha-value>)',
        },
        grass: {
          1: 'rgb(var(--c-grass-1) / <alpha-value>)',
          2: 'rgb(var(--c-grass-2) / <alpha-value>)',
          3: 'rgb(var(--c-grass-3) / <alpha-value>)',
          4: 'rgb(var(--c-grass-4) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
