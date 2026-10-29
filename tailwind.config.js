/** @type {import('tailwindcss').Config} */
// Bill Book design tokens. See DESIGN.md.
// `brand.*` keeps its old names so every page inherits the system; values are AA-checked.
const ink = '#14231E';
const inkMuted = '#4A5E57';
const rule = '#D5DFDA';
const paper = '#F4F7F5';
const green = '#1B7F65'; // primary: white text 4.9:1
const greenDeep = '#16654F';
const greenLogo = '#229A7A'; // logo green: rules, focus, large marks only (3.5:1)
const rail = '#0F3D31';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Light only: the app is used on office laptops in daylight. Stray dark: classes stay inert.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Source Code Pro"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      // Readability floor: nothing below 13px; body copy at 15px.
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }],
        '3xl': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
      },
      colors: {
        brand: {
          bg: paper,
          primary: green,
          primaryDark: greenDeep,
          primaryActive: '#12503F',
          logo: greenLogo,
          text: ink,
          deep: rail,
          border: rule,
        },
        ink: { DEFAULT: ink, muted: inkMuted, faint: '#5F706A' }, // faint ≥4.5:1 on white, paper and sunk
        paper: { DEFAULT: paper, sheet: '#FFFFFF', sunk: '#EBF0ED' },
        rule: { DEFAULT: rule, strong: '#B9C7C0' },
        rail: { DEFAULT: rail, hover: '#164C3E', active: '#1D5C4B', text: '#E3EFEA', muted: '#A9CBBE', mark: '#7FD3B4' },
        scrim: '#0B2A22',
        // Carbon-copy state tints (text colour first, tint second): text on tint 5.15:1 (void) to 7.61:1 (paid).
        draft: { DEFAULT: '#6B5200', tint: '#FFF4C2', rule: '#E8D27A' },
        overdue: { DEFAULT: '#8A1C33', tint: '#FBE1E6', rule: '#EDB2BF' },
        final: { DEFAULT: greenDeep, tint: '#E4F3EC', rule: '#A6D5C2' },
        stamp: { DEFAULT: '#4636A8', tint: '#EEEBFA', rule: '#C4BCEB' },
        partial: { DEFAULT: '#9A4A00', tint: '#FFF6E5', rule: '#F0C98A' },
        void: { DEFAULT: '#5D6763', tint: '#EEF1F0', rule: '#C7CECB' },
        info: { DEFAULT: '#1E5AA8', tint: '#EBF2FC', rule: '#B5CDEE' },
        danger: { DEFAULT: '#B42318', tint: '#FEF0EE', rule: '#F4B8B1', hover: '#931C13' },
        // shadcn-style aliases used by older pages: give them real values.
        background: paper,
        foreground: ink,
        primary: { DEFAULT: green, foreground: '#FFFFFF' },
        muted: { DEFAULT: '#EBF0ED', foreground: inkMuted },
        destructive: { DEFAULT: '#B42318', foreground: '#FFFFFF' },
        input: rule,
        ring: greenLogo,
      },
      boxShadow: {
        sheet: '0 1px 2px rgba(15, 61, 49, 0.06), 0 1px 1px rgba(15, 61, 49, 0.04)',
        lift: '0 8px 24px -6px rgba(15, 61, 49, 0.18), 0 2px 6px rgba(15, 61, 49, 0.08)',
        dialog: '0 24px 48px -12px rgba(15, 61, 49, 0.28), 0 4px 12px rgba(15, 61, 49, 0.10)',
      },
      borderRadius: {
        sheet: '10px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
