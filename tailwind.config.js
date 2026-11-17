/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: 'var(--color-paper)',
          dark: 'var(--color-paper-dark)',
          darker: 'var(--color-paper-darker)',
          active: 'var(--color-paper-active)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          muted: 'var(--color-ink-muted)',
          light: 'var(--color-ink-light)',
        },
        terracotta: {
          DEFAULT: 'var(--color-terracotta)',
          hover: 'var(--color-terracotta-hover)',
          light: 'var(--color-terracotta-light)',
        },
        amber: {
          DEFAULT: 'var(--color-amber)',
          light: 'var(--color-amber-light)',
        }
      },
      fontFamily: {
        sans: ['"SF Pro Text"', '"SF Pro"', '-apple-system', 'BlinkMacSystemFont', 'Geist', 'Inter', 'sans-serif'],
        serif: ['"SF Pro Text"', '"SF Pro"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"SF Mono"', 'Geist Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'paper-sm': 'var(--shadow-paper-sm)',
        'paper-md': 'var(--shadow-paper-md)',
      }
    },
  },
  plugins: [],
}
