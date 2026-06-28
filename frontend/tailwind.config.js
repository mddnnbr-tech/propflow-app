/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#f5f7fa',
          card:    '#ffffff',
          sidebar: '#0a0f1e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.05)',
        'card-hover': '0 4px 16px rgba(0,0,0,.10), 0 1px 4px rgba(0,0,0,.06)',
        glow:  '0 0 0 3px rgba(99,102,241,.15)',
        'btn-primary': '0 2px 8px rgba(79,70,229,.35)',
      },
      backgroundImage: {
        'brand-gradient':    'linear-gradient(135deg,#4f46e5 0%,#2563eb 100%)',
        'sidebar-gradient':  'linear-gradient(180deg,#0a0f1e 0%,#0d1530 100%)',
        'hero-gradient':     'linear-gradient(135deg,#0a0f1e 0%,#111c3e 50%,#0f1f3d 100%)',
        'success-gradient':  'linear-gradient(135deg,#059669 0%,#10b981 100%)',
        'warning-gradient':  'linear-gradient(135deg,#d97706 0%,#f59e0b 100%)',
        'danger-gradient':   'linear-gradient(135deg,#dc2626 0%,#ef4444 100%)',
      },
      animation: {
        'fade-up': 'fadeUp .35s ease both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
