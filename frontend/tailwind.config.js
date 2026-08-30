/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0a0d14',
          card: '#111726',
          border: '#1e293b',
          accent: '#00f0ff',
          neonGreen: '#10b981',
          neonRed: '#ef4444',
          neonAmber: '#f59e0b'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
