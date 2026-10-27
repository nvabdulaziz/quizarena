/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Lilita One"', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#1a0b3b',
        grape: { 50: '#f4effd', 100: '#e6d9fb', 300: '#a67df0', 500: '#7c3aed', 600: '#6a28d9', 700: '#5420b0', 800: '#3d1785', 900: '#2a0f5c' },
        coral: '#ff4d6d',
        sky: '#3b82f6',
        sun: '#ffc233',
        mint: '#22c55e',
        bubble: '#ff5fb2',
      },
      boxShadow: {
        pop: '0 6px 0 rgba(0,0,0,.22)',
        popsm: '0 4px 0 rgba(0,0,0,.2)',
        glow: '0 10px 40px rgba(124,58,237,.35)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0) rotate(0deg)' }, '50%': { transform: 'translateY(-28px) rotate(12deg)' } },
        drift: { '0%': { transform: 'translate(0,0)' }, '50%': { transform: 'translate(40px,-30px)' }, '100%': { transform: 'translate(0,0)' } },
      },
      animation: { float: 'float 7s ease-in-out infinite', drift: 'drift 16s ease-in-out infinite' },
    },
  },
  plugins: [],
};
