/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tf: {
          bg: 'var(--tf-bg)',
          card: 'var(--tf-card)',
          border: 'var(--tf-border)',
          text: 'var(--tf-text)',
          muted: 'var(--tf-muted)',
          accent: 'var(--tf-accent)',
        },
      },
    },
  },
  plugins: [],
}
