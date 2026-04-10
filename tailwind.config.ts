import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        // ── Adaptive design system (CSS-variable based) ────
        notura: {
          // Brand purple (static)
          primary: "#6851FF",
          "primary-light": "#8B7AFF",
          "primary-dark": "#5740EE",
          "primary-glow": "rgba(104,81,255,0.3)",
          secondary: "#BA2BF2",
          processing: "#E43790",
          // Adaptive backgrounds
          bg: "rgb(var(--cn-bg) / <alpha-value>)",
          "bg-secondary": "rgb(var(--cn-bg2) / <alpha-value>)",
          surface: "rgb(var(--cn-surface) / <alpha-value>)",
          "surface-2": "rgb(var(--cn-surface2) / <alpha-value>)",
          // Adaptive text
          ink: "rgb(var(--cn-ink) / <alpha-value>)",
          "ink-secondary": "rgb(var(--cn-ink2) / <alpha-value>)",
          muted: "rgb(var(--cn-muted) / <alpha-value>)",
          // Adaptive borders
          border: "rgb(var(--cn-border) / <alpha-value>)",
          // Status (static)
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
        },
        violet: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#1E1B4B",
        },
        // Material Design 3 tokens – landing page
        "surface": "#f8f9fc",
        "on-surface": "#191c1e",
        "on-surface-variant": "#4a4455",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f3f6",
        "surface-container": "#edeef1",
        "surface-container-high": "#e7e8eb",
        "surface-container-highest": "#e1e2e5",
        "on-primary": "#ffffff",
        "primary-container": "#7c3aed",
        "on-primary-container": "#ede0ff",
        "primary-fixed-dim": "#d2bbff",
        "tertiary-fixed": "#a2eeff",
        "on-tertiary-fixed": "#001f25",
        "tertiary-container": "#007181",
        "on-tertiary-container": "#aef0ff",
        "outline-variant": "#ccc3d8",
        "outline": "#7b7487",
        "inverse-surface": "#2e3133",
        "inverse-on-surface": "#f0f1f4",
      },
      fontFamily: {
        manrope: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        // Legacy aliases
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      fontSize: {
        "display-xl": ["56px", { fontWeight: "800", lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["40px", { fontWeight: "700", lineHeight: "1.2" }],
        "display-md": ["28px", { fontWeight: "600", lineHeight: "1.3" }],
        "display-sm": ["20px", { fontWeight: "600" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "6px",
        xl: "24px",
        "2xl": "32px",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.05)",
        DEFAULT: "0 1px 2px rgba(0,0,0,0.05)",
        md: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)",
        lg: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)",
        xl: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
        glow: "0 0 40px rgba(104, 81, 255, 0.25)",
        // Legacy
        subtle: "0 1px 3px rgba(0,0,0,0.08)",
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        elevated: "0 4px 12px rgba(0,0,0,0.08)",
      },
      spacing: {
        "4.5": "18px",
        "13": "52px",
        "15": "60px",
        "18": "72px",
        "22": "88px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "slide-up": "slideUp 0.4s cubic-bezier(0,0,0.2,1)",
        "slide-down": "slideDown 0.4s cubic-bezier(0,0,0.2,1)",
        "fade-in": "fadeIn 0.3s ease-out",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.15s ease-out",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      backgroundImage: {
        "gradient-mesh": "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 40%, #FAF5FF 100%)",
        "gradient-violet": "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
