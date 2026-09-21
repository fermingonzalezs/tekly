import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        grotesk: [
          "var(--font-space-grotesk)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        accent: {
          DEFAULT: "#4f49bd", // índigo — marca + interacción (toda la app)
          soft: "#edecf8",
        },
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateX(24px) scale(0.96)" },
          to: { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "toast-out": {
          from: { opacity: "1", transform: "translateX(0) scale(1)" },
          to: { opacity: "0", transform: "translateX(24px) scale(0.96)" },
        },
        "celebrate-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "celebrate-check": {
          "0%": { transform: "scale(0)" },
          "60%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "drawer-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.22s cubic-bezier(0.21, 1.02, 0.73, 1)",
        "toast-out": "toast-out 0.18s ease-in forwards",
        "celebrate-in": "celebrate-in 0.25s ease-out",
        "celebrate-check": "celebrate-check 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both",
        "fade-in": "fade-in 0.18s ease-out",
        "drawer-in": "drawer-in 0.22s cubic-bezier(0.21, 1.02, 0.73, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
