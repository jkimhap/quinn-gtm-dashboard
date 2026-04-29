/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        quinn: {
          50:  "#f0fafb",
          100: "#d9f2f5",
          200: "#b3e5eb",
          300: "#7dd0da",
          400: "#40b3c2",
          500: "#2897a8",
          600: "#1e7a8f",
          700: "#1d6375",
          800: "#1e5160",
          900: "#1e4452",
          950: "#0e2a35",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
