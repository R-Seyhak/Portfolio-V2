/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           'var(--c-bg)',
        'bg-2':       'var(--c-bg-2)',
        'bg-3':       'var(--c-bg-3)',
        ink:          'var(--c-ink)',
        'ink-2':      'var(--c-ink-2)',
        'ink-3':      'var(--c-ink-3)',
        line:         'var(--c-line)',
        'line-2':     'var(--c-line-2)',
        accent:       'var(--c-accent)',
        'accent-soft':'var(--c-accent-soft)',
        'accent-deep':'var(--c-accent-deep)',
        ember:        'var(--c-ember)',
        'ember-soft': 'var(--c-ember-soft)',
      },
      fontFamily: {
        // Both stacks are defined once, in globals.css (:root).
        sans:    ['var(--font-sans)'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)'],
      },
      borderRadius: {
        design:    'var(--radius)',
        'design-sm': 'var(--radius-s)',
        'design-lg': 'var(--radius-l)',
      },
      animation: {
        marquee:       'marquee 32s linear infinite',
        'pulse-green': 'pulse-green 2s infinite',
        'fade-in':     'fade-in 0.2s',
        blink:         'blink 1s infinite',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        'pulse-green': {
          '0%':   { boxShadow: '0 0 0 0 oklch(62% 0.15 150 / 0.6)' },
          '70%':  { boxShadow: '0 0 0 8px oklch(62% 0.15 150 / 0)' },
          '100%': { boxShadow: '0 0 0 0 oklch(62% 0.15 150 / 0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        blink: {
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
