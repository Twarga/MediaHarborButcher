/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm near-black surfaces (slight blue cast)
        ink: {
          900: "#08090c",
          800: "#0d0e13",
          700: "#13141a",
          600: "#1a1c23",
          500: "#24262f",
          400: "#2f323d",
          300: "#40434f",
        },
        // Warm off-white text
        paper: {
          50: "#fbf7f0",
          100: "#f4f0e6",
          200: "#e8e2d2",
          300: "#c9c3b4",
          400: "#9a958a",
          500: "#6e6a62",
        },
        // Primary: warm amber — harbor lantern / warning signal
        amber: {
          50:  "#fff4e6",
          100: "#ffe3bf",
          200: "#ffcb8a",
          300: "#ffab55",
          400: "#ff8a3d", // primary
          500: "#f57315",
          600: "#d35b0a",
          700: "#a14608",
          800: "#6e3005",
          900: "#3e1a02",
        },
        // Secondary: coral red — butcher accent, danger/error
        coral: {
          300: "#ff8a8e",
          400: "#ff6b70",
          500: "#ef4852",
          600: "#d63440",
        },
        // Teal success (not generic green)
        teal: {
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'glow-amber': '0 0 0 1px rgba(255, 138, 61, 0.2), 0 8px 32px -8px rgba(255, 138, 61, 0.4)',
        'glow-coral': '0 0 0 1px rgba(239, 72, 82, 0.2), 0 8px 32px -8px rgba(239, 72, 82, 0.3)',
        'inset-top': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
      },
      backgroundImage: {
        'grid-faint': "radial-gradient(rgba(244, 240, 230, 0.04) 1px, transparent 1px)",
        'mesh': "radial-gradient(at 20% 10%, rgba(255, 138, 61, 0.15) 0, transparent 50%), radial-gradient(at 80% 90%, rgba(239, 72, 82, 0.08) 0, transparent 50%)",
      },
    },
  },
  plugins: [],
}
