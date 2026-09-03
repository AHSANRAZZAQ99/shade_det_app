/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        steel: {
          50: "#f8fafc",
          100: "#e7edf6",
          200: "#d1d9e5",
          300: "#b4bfd0",
          400: "#7f8ea6",
          500: "#4a5e7c",
          600: "#2c4464",
          700: "#1f3657",
          800: "#172d4d",
          900: "#102543"
        }
      },
      boxShadow: {
        panel: "0 10px 30px rgba(12, 28, 52, 0.3)"
      }
    },
  },
  plugins: [],
}

