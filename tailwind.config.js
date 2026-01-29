/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#FEFBF6',
          primary: '#58B692',
          primaryDark: '#348D74',
          text: '#1A382E',
          deep: '#11241E',
          border: '#D4DDD9',
        },
      },
    },
  },
  plugins: [],
}
