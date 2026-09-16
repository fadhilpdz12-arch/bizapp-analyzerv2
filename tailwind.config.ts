import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables in globals.css so the accent can be changed
        // at runtime. Channels are space-separated RGB to keep <alpha-value>.
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          ink: "rgb(var(--accent-ink) / <alpha-value>)",
          wash: "rgb(var(--accent-wash) / <alpha-value>)",
        },
        // surface: page background, cards, fills, borders (lightest → strongest)
        surface: {
          950: "#F4F6FA", // page
          900: "#FFFFFF", // inputs
          800: "#FFFFFF", // cards
          700: "#EEF1F7", // subtle fill, progress track
          600: "#E8ECF3", // hairline border
          500: "#D4DBE8", // stronger border
        },
        // content: text, darkest first
        content: {
          100: "#1A2233",
          200: "#3C475E",
          300: "#5A6784",
        },
        stamp: {
          green: "#12A150",
          greenDark: "#0B7238",
          red: "#E8203C",
          redDark: "#B4142C",
          amber: "#C67C08",
          amberDark: "#8A5605",
          slate: "#5A6784",
        },
        // Kept for the few places that still reference it; now a neutral ink.
        brass: "#5A6784",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "grain": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        ticket: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 30px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
export default config;
