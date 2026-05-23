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
          DEFAULT: '#FAF8F5',   // warm off-white parchment
          dark: '#F2EFE9',      // slightly deeper warm white for sidebars/panels
          darker: '#E4DDD4',    // warm stone border
          active: '#EDE8E1',    // hover/active state
        },
        ink: {
          DEFAULT: '#2C2A29',   // warm near-black
          muted: '#7A736A',     // warm medium gray
          light: '#B0A89E',     // warm light gray for gutters/placeholders
        },
        terracotta: {
          DEFAULT: '#C0694E',   // warm terracotta red
          hover: '#A8553C',     // darker terracotta on hover
          light: '#FDF0EC',     // light blush tint for alert backgrounds
        },
        amber: {
          DEFAULT: '#C97A1A',   // warm amber/gold
          light: '#FEF6E4',     // soft cream amber alert
        }
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'sans-serif'],
        serif: ['EB Garamond', 'Lora', 'Merriweather', 'Georgia', 'serif'],
        mono: ['Geist Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'paper-sm': '0 1px 2px rgba(44, 42, 41, 0.05)',
        'paper-md': '0 4px 6px -1px rgba(44, 42, 41, 0.08), 0 2px 4px -1px rgba(44, 42, 41, 0.03)',
      }
    },
  },
  plugins: [],
}
