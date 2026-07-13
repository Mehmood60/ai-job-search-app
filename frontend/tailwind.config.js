/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#b00020',
          dark: '#8a0019',
          light: '#e23a52',
        },
      },
    },
  },
  plugins: [],
};
