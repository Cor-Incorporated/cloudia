/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./index.tsx",
    "./App.tsx",
  ],
  theme: {
    extend: {
      colors: {
        // サイト（corsweb）の主色の紺。NextStep.astro の bg-[#2d4a6b]、hover #1e3350 と同じ値。
        navy: {
          DEFAULT: '#2d4a6b',
          dark: '#1e3350',
        },
      },
    },
  },
  plugins: [],
}