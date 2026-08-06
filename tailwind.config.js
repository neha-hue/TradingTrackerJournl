/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          input: 'var(--bg-input)',
        },
        border: {
          DEFAULT: 'var(--border)',
          hover: 'var(--border-hover)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          glow: 'var(--accent-glow)',
        },
        green: {
          DEFAULT: 'var(--green)',
          bg: 'var(--green-bg)',
        },
        red: {
          DEFAULT: 'var(--red)',
          bg: 'var(--red-bg)',
        },
        yellow: {
          DEFAULT: 'var(--yellow)',
          bg: 'var(--yellow-bg)',
        },
        purple: {
          DEFAULT: 'var(--purple)',
          bg: 'var(--purple-bg)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xl': ['24px', { lineHeight: '1.3', letterSpacing: '-0.8px' }],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        lg: '16px',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },
      zIndex: {
        '50': '50',
        '100': '100',
        '200': '200',
        '1000': '1000',
        '2000': '2000',
        '3000': '3000',
      },
      transitionProperty: {
        DEFAULT: 'all 0.2s ease',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn .3s ease',
        modalIn: 'modalIn .2s ease',
        toastIn: 'toastIn .3s ease',
      },
    },
  },
  plugins: [],
};
