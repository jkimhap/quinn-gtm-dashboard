/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Inverted gray scale — 950 is warm cream (page bg), 50 is near-black (primary text)
        gray: {
          50:  "#1a1714",
          100: "#2d2a26",
          200: "#3f3b36",
          300: "#5a5650",
          400: "#7a7168",
          500: "#9e9890",
          600: "#bdb5ac",
          700: "#d5cec5",
          800: "#e4ddd5",
          900: "#f0ebe4",
          950: "#f8f4ef",
        },
        // Sage green — replaces teal quinn palette
        quinn: {
          50:  "#eef5f1",
          100: "#d4e8dc",
          200: "#a6d0b8",
          300: "#74b593",
          400: "#4d9a72",
          500: "#3d7d5c",
          600: "#2d6047",
          700: "#1e4432",
          800: "#122b1f",
          900: "#09160f",
          950: "#040c07",
        },
      },
      fontFamily: {
        sans:  ["Inter", "system-ui", "sans-serif"],
        serif: ["EB Garamond", "Georgia", "serif"],
        mono:  ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
