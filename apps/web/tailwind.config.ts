import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0F0F1A',
        card: '#1A1A2E',
        elevated: '#1E1E35',
        primary: '#7C6FFF',
        'primary-light': '#A89FFF',
        secondary: '#4ECDC4',
        focus: '#4CAF50',
        warn: '#FFC107',
        danger: '#FF5252',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
