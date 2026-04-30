/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        surface: '#111827',
        primary: '#3B82F6',
        secondary: '#10B981',
        danger: '#EF4444',
      }
    },
  },
  plugins: [],
}
