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
        // ── New violet design system ─────────────────────────
        notura: {
          // Primary violet
          primary: "#7C3AED",
          "primary-light": "#EDE9FE",
          "primary-dark": "#5B21B6",
          accent: "#A78BFA",
          // Neutral
          ink: "#1E1B4B",
          secondary: "#6B7280",
          muted: "#9CA3AF",
          surface: "#FFFFFF",
          bg: "#FAFAFA",
          border: "#E5E7EB",
          // Status
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          // Legacy aliases kept for compatibility
          green: "#10B981",
          "green-light": "#D1FAE5",
          "green-dark": "#065F46",
          white: "#FFFFFF",
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
        xs: "6px",
        sm: "8px",
        md: "12px",
        lg: "16px",
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
        glow: "0 0 40px rgba(124, 58, 237, 0.15)",
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
