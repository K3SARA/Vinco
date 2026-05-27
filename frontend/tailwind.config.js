/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wood: {
          50: '#fcf8f4',
          100: '#f6ebd9',
          200: '#ebd1ba',
          300: '#dfb28e',
          400: '#cd8b5b',
          500: '#be6d3a',
          600: '#af5b2e',
          700: '#8c4823',
          800: '#743b1c',
          900: '#5c2d15',
          950: '#36180a',
        },
        forest: {
          50: '#f4f8f4',
          100: '#e4ebe4',
          200: '#cad8ca',
          300: '#a3bea3',
          400: '#759b75',
          500: '#547f54',
          600: '#416341',
          700: '#344f34',
          800: '#2a3f2a',
          900: '#203020',
        }
      }
    },
  },
  plugins: [],
}
