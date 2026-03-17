/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // All colours reference CSS custom properties set by ThemeProvider
        'bg-primary':    'var(--color-bg-primary)',
        'bg-secondary':  'var(--color-bg-secondary)',
        'bg-input':      'var(--color-bg-input)',
        'text-primary':  'var(--color-text-primary)',
        'text-secondary':'var(--color-text-secondary)',
        'accent':        'var(--color-accent)',
        'accent-hover':  'var(--color-accent-hover)',
        'border-color':  'var(--color-border)',
        'user-bubble':   'var(--color-user-bubble)',
        'ai-bubble':     'var(--color-assistant-bubble)',
        'code-bg':       'var(--color-code-bg)',
      },
    },
  },
  plugins: [],
};
