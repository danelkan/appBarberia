/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Hardcoded — not theme-switched
        black: '#0f0f0f',        // True black (gold button text, etc.)
        page: '#F7F8FA',         // Admin light page background
        gold: {
          DEFAULT: '#C9A84C',
          light: '#E8C96A',
          dark: '#A07830',
          subtle: '#FEF3C7',
        },

        // Theme-aware via CSS variables — switches between light (admin) and dark (public)
        // Supports opacity modifiers (e.g., text-cream/40) via the <alpha-value> syntax
        cream: 'rgb(var(--tw-cream) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--tw-surface) / <alpha-value>)',
          2: 'rgb(var(--tw-surface-2) / <alpha-value>)',
          3: 'rgb(var(--tw-surface-3) / <alpha-value>)',
        },
        border: 'rgb(var(--tw-border) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'fade-in': 'fadeIn 0.3s ease forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gold-shimmer': 'linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.12) 50%, transparent 100%)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)',
        modal: '0 24px 64px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
