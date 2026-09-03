/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/landing/**/*.{js,jsx}'],
  // Do not reset global app styles — landing utilities only
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
