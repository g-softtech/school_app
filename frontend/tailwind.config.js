/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fdf8e7',
          100: '#faf0c0',
          200: '#f5e08a',
          300: '#eecf55',
          400: '#e5be2e',
          500: '#C9A227',  // main gold
          600: '#b08a1e',
          700: '#8a6c17',
          800: '#654f10',
          900: '#40320a',
        },
        secondary: {
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',  // main dark
          900: '#111827',
        },
        surface: '#F9FAFB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-md':  '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        'card-lg':  '0 10px 30px 0 rgb(0 0 0 / 0.10), 0 4px 8px -2px rgb(0 0 0 / 0.08)',
        'card-xl':  '0 20px 50px 0 rgb(0 0 0 / 0.12), 0 8px 16px -4px rgb(0 0 0 / 0.10)',
        'inner-sm': 'inset 0 1px 3px 0 rgb(0 0 0 / 0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'fade-in':       'fadeIn 0.15s ease-out both',
        'fade-slide-up': 'fadeSlideUp 0.2s cubic-bezier(0.34,1.2,0.64,1) both',
        'slide-down':    'slideInDown 0.18s ease-out both',
        'bounce-in':     'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse-dot':     'pulseDot 1.5s ease-in-out infinite',
        'shimmer':       'shimmer 1.4s ease-in-out infinite',
        'spin-slow':     'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeSlideUp: {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.97)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideInDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        bounceIn: {
          '0%':   { opacity: '0', transform: 'scale(0.5)' },
          '60%':  { opacity: '1', transform: 'scale(1.05)' },
          '80%':  { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(1.4)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      transitionTimingFunction: {
        'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth':      'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      spacing: {
        '0.5': '0.125rem',
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '18':  '4.5rem',
      },
    },
  },
  plugins: [],
};
