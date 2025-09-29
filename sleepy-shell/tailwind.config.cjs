const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
      extend: {
        colors: {
          accent: '#0E7490', // cyan-800
          'accent-dark': '#155E75', // cyan-900
        },
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
        },
        animation: {
          'fade-in': 'fadeIn 0.5s ease-out',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0', transform: 'translateY(10px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
        },
      },
    },
    plugins: [
      require('@tailwindcss/typography'),
    ],
  }