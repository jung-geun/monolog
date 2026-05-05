import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:      '#0F1115',
        chrome:   '#16191F',
        card:     '#1A1D24',
        elevated: '#22262E',
        sunken:   '#0a0c10',
        hairline: '#2A2E36',
        mute:     '#6A6E78',
        soft:     '#9C9E96',
        signal: {
          DEFAULT: '#D97706',
          200:     '#FAC775',
          50:      '#FAEEDA',
          900:     '#854F0B',
        },
        cs: {
          DEFAULT: '#1D9E75',
          50:      '#E1F5EE',
          900:     '#085041',
        },
        paper: {
          DEFAULT: '#534AB7',
          50:      '#EEEDFE',
          900:     '#3C3489',
        },
        research: {
          DEFAULT: '#D85A30',
          50:      '#FAECE7',
          900:     '#993C1D',
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
