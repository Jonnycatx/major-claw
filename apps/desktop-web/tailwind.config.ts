import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0a0a0a",
        lobster: "#ff3b00",
        cyan: "#00f0ff",
        text: {
          primary: "#f1f1f1",
          secondary: "#a1a1aa"
        },
        panel: "#111113"
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["SF Mono", "JetBrains Mono", "ui-monospace", "monospace"]
      },
      boxShadow: {
        "lobster-glow": "0 0 0 1px rgba(255,59,0,0.25), 0 0 26px rgba(255,59,0,0.16)",
        "lobster-glow-strong": "0 0 0 1px rgba(255,59,0,0.35), 0 0 36px rgba(255,59,0,0.28)",
        "cyan-glow": "0 0 18px rgba(0,240,255,0.2)",
        "cyan-glow-strong": "0 0 26px rgba(0,240,255,0.32)"
      },
      keyframes: {
        pulseLive: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" }
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,59,0,0.2)" },
          "50%": { boxShadow: "0 0 18px 2px rgba(255,59,0,0.35)" }
        },
        drift: {
          "0%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-8px,0)" },
          "100%": { transform: "translate3d(0,0,0)" }
        },
        tabSlide: {
          "0%": { transform: "scaleX(0.4)", opacity: "0.2" },
          "100%": { transform: "scaleX(1)", opacity: "1" }
        },
        snap: {
          "0%": { transform: "scale(1)" },
          "60%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1.02)" }
        }
      },
      animation: {
        live: "pulseLive 2.2s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        pulseGlow: "pulseGlow 2.5s ease-in-out infinite",
        tabSlide: "tabSlide 200ms ease-in-out",
        snap: "snap 180ms ease-out"
      },
      transitionDuration: {
        200: "200ms"
      }
    }
  },
  plugins: []
};

export default config;
