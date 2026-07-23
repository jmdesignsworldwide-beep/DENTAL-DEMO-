import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta clínica — se referencia vía CSS vars para soportar ambos temas.
        clinical: {
          DEFAULT: "#0066CC",
          50: "#E8F4FD",
          100: "#D1E9FB",
          200: "#A3D3F7",
          300: "#6BB6F0",
          400: "#3391E6",
          500: "#0066CC",
          600: "#0052A3",
          700: "#003D7A",
          800: "#002952",
          900: "#001429",
        },
        ice: "#E8F4FD",
        navy: {
          DEFAULT: "#0A1628",
          light: "#0F1F38",
          lighter: "#152847",
        },
        mint: "#00C896",
        amber: "#F59E0B",
        danger: "#EF4444",
        gold: {
          DEFAULT: "#C9A84C",
          light: "#E0C876",
          dark: "#A88A38",
        },
        // Tokens semánticos (mapeados a CSS vars en globals.css).
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        fg: "hsl(var(--fg) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        // Sombras en capas — sensación de software hospitalario premium.
        card: "0 1px 2px rgba(10,22,40,0.04), 0 4px 12px rgba(10,22,40,0.06), 0 12px 32px rgba(10,22,40,0.05)",
        "card-hover":
          "0 2px 4px rgba(10,22,40,0.06), 0 8px 20px rgba(10,22,40,0.10), 0 20px 48px rgba(10,22,40,0.08)",
        glow: "0 0 0 1px rgba(0,102,204,0.15), 0 0 24px rgba(0,102,204,0.25)",
        "glow-gold": "0 0 0 1px rgba(201,168,76,0.20), 0 0 28px rgba(201,168,76,0.30)",
        "inner-top": "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      keyframes: {
        aurora: {
          "0%, 100%": { transform: "translate(0,0) scale(1)", opacity: "0.55" },
          "33%": { transform: "translate(6%,-4%) scale(1.15)", opacity: "0.75" },
          "66%": { transform: "translate(-5%,5%) scale(1.05)", opacity: "0.5" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        aurora: "aurora 18s ease-in-out infinite",
        "spin-slow": "spin-slow 1.2s linear infinite",
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.4s ease-out both",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
