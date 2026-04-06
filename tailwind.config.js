/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F5F7F0',
          100: '#E8EDE0',
          200: '#D1DBC1',
          300: '#A8BD8E',
          400: '#7F9E5B',
          500: '#4A6741',  // Primary green
          600: '#3D5636',
          700: '#2F422A',
          800: '#222F1E',
          900: '#151D13',
        },
        cream: {
          50:  '#FEFDFB',
          100: '#FAF8F4',
          200: '#F3F0E8',
          300: '#E8E4D9',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
