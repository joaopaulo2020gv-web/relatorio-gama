/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f8f0',
          100: '#e6f0de',
          200: '#cfe0be',
          300: '#adc992',
          400: '#86ad62',
          500: '#5c903a', // Verde SkyAgro aproximado
          600: '#48722c',
          700: '#385924',
          800: '#2f4820',
          900: '#273e1c',
          950: '#13230c',
        },
      },
    },
  },
  plugins: [],
}
