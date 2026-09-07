import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#2563eb",
          soft: "#eff4ff",
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
      },
      animation: {
        "toast-in": "toast-in 0.22s cubic-bezier(0.21, 1.02, 0.73, 1)",
        "toast-out": "toast-out 0.18s ease-in forwards",
      },
    },
  },
  plugins: [],
};

export default config;
