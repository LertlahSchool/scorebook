import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sarabun: ['var(--font-sarabun)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
