/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b0c10",
        surface: "#1f2833",
        primary: "#66fcf1",
        secondary: "#45a29e",
        muted: "#c5c6c7",
        risk: {
          critical: "#ef4444",
          warning: "#f59e0b",
          healthy: "#10b981",
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
