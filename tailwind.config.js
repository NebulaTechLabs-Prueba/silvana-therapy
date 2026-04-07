/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:    '#fdfcfa',
        green: {
          lightest: '#f0f5f0',
          pale:     '#e2ede2',
          soft:     '#c8ddc8',
          mid:      '#8fb08f',
          deep:     '#4a7a4a',
        },
        text: {
          dark:  '#2a3528',
          mid:   '#4e6050',
          light: '#849884',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up':   'fadeUp 0.7s ease forwards',
        'fade-up-2': 'fadeUp 0.7s 0.15s ease both',
        'fade-up-3': 'fadeUp 0.7s 0.3s ease both',
        'fade-up-4': 'fadeUp 0.7s 0.45s ease both',
        'pop-in':    'popIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        'drift-1':   'drift 30s ease-in-out infinite',
        'drift-2':   'drift 24s ease-in-out infinite reverse',
        'drift-3':   'drift 18s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          from: { opacity: '0', transform: 'scale(0)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        drift: {
          '0%':   { transform: 'translate(0,0) scale(1)' },
          '33%':  { transform: 'translate(18px,-12px) scale(1.02)' },
          '66%':  { transform: 'translate(-10px,16px) scale(0.98)' },
          '100%': { transform: 'translate(0,0) scale(1)' },
        },
        pulseRing: {
          '0%, 100%': { transform: 'scale(1)',    opacity: '1' },
          '50%':      { transform: 'scale(1.06)', opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
