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
          DEFAULT: '#FAF8F5',   // warm, soft cream background
          dark: '#F3F0EA',      // slightly darker sand for sidebar
          darker: '#EBE5DC',    // borders, active tabs, divider lines
          active: '#E4DDD2',    // darker hover states
        },
        ink: {
          DEFAULT: '#2C2A29',   // warm charcoal for readability
          muted: '#6E6A64',     // medium gray for icons and secondary text
          light: '#A5A097',     // light gray for line numbers and placeholders
        },
        terracotta: {
          DEFAULT: '#C2593F',   // soft earth red for primary button/accents
          hover: '#A3452F',
          light: '#F8EBE8',
        },
        amber: {
          DEFAULT: '#D97706',   // warm yellow for warning highlights
          light: '#FEF3C7',     // soft highlight background
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Lora', 'Merriweather', 'Georgia', 'serif'],
        mono: ['Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'paper-sm': '0 1px 2px rgba(44, 42, 41, 0.05)',
        'paper-md': '0 4px 6px -1px rgba(44, 42, 41, 0.08), 0 2px 4px -1px rgba(44, 42, 41, 0.03)',
      }
    },
  },
  plugins: [],
}
