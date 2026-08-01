import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Wick brand
        wick: {
          bg: "#0a0e1a",
          surface: "#111827",
          border: "#1f2937",
          muted: "#6b7280",
        },
        // Phase colours
        up: {
          DEFAULT: "#22c55e",
          dim: "#14532d",
          text: "#86efac",
        },
        down: {
          DEFAULT: "#ef4444",
          dim: "#7f1d1d",
          text: "#fca5a5",
        },
        void: {
          DEFAULT: "#6b7280",
          dim: "#1f2937",
          text: "#d1d5db",
        },
        phase: {
          open: "#3b82f6",
          locked: "#f59e0b",
          settling: "#8b5cf6",
        },
      },
      animation: {
        "pulse-fast": "pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
