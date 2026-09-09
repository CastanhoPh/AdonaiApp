// tailwind.config.ts — Tailwind v3
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#062430',
          lower: '#08303F',
          card: '#0A3648',
          raised: '#0B3C51',
          deep: '#041B24',
        },
        stroke: { frame: '#1B5470', list: '#103F53' },
        ink: {
          heading: '#E5E2D0',
          body: '#C6D2D6',
          caption: '#93A9B3',
          disabled: '#5E7681',
        },
        brand: {
          DEFAULT: '#A28F6A',
          strong: '#B39E77',
          soft: '#C9BC9B',
          ink: '#062430',
          secondary: '#3F708C',
        },
        state: {
          positive: '#369365',
          warning: '#DFA345',
          negative: '#C0372B',
          info: '#3F708C',
        },
      },
      borderRadius: { sm: '8px', md: '16px', pill: '999px' },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        brand: ['var(--font-suse)', 'var(--font-dm-sans)', 'sans-serif'],
        num: ['var(--font-manrope)', 'var(--font-dm-sans)', 'sans-serif'],
      },
      letterSpacing: { brand: '0.32em', label: '0.24em' },
      boxShadow: { none: 'none' }, // o sistema usa hairlines, não sombras
    },
  },
} satisfies Config;
