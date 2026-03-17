export interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  variables: Record<string, string>;
}

export const themes: Theme[] = [
  {
    id: 'ocean-dark',
    name: 'Ocean Dark',
    isDark: true,
    variables: {
      '--color-bg-primary':         '#0f1117',
      '--color-bg-secondary':       '#1a1d2e',
      '--color-bg-input':           '#252840',
      '--color-text-primary':       '#e8eaf6',
      '--color-text-secondary':     '#9fa8da',
      '--color-accent':             '#5c6bc0',
      '--color-accent-hover':       '#7986cb',
      '--color-border':             '#2a2d4a',
      '--color-user-bubble':        '#3949ab',
      '--color-assistant-bubble':   '#1a1d2e',
      '--color-code-bg':            '#12141f',
      '--color-scrollbar':          '#2a2d4a',
    },
  },
  {
    id: 'slate-light',
    name: 'Slate Light',
    isDark: false,
    variables: {
      '--color-bg-primary':         '#f8f9fa',
      '--color-bg-secondary':       '#ffffff',
      '--color-bg-input':           '#f1f3f4',
      '--color-text-primary':       '#202124',
      '--color-text-secondary':     '#5f6368',
      '--color-accent':             '#1a73e8',
      '--color-accent-hover':       '#1557b0',
      '--color-border':             '#dadce0',
      '--color-user-bubble':        '#e8f0fe',
      '--color-assistant-bubble':   '#ffffff',
      '--color-code-bg':            '#f1f3f4',
      '--color-scrollbar':          '#dadce0',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    isDark: true,
    variables: {
      '--color-bg-primary':         '#0d1f0d',
      '--color-bg-secondary':       '#142014',
      '--color-bg-input':           '#1e3020',
      '--color-text-primary':       '#d4edda',
      '--color-text-secondary':     '#81c784',
      '--color-accent':             '#43a047',
      '--color-accent-hover':       '#66bb6a',
      '--color-border':             '#1e3a1e',
      '--color-user-bubble':        '#2e7d32',
      '--color-assistant-bubble':   '#142014',
      '--color-code-bg':            '#0a180a',
      '--color-scrollbar':          '#1e3a1e',
    },
  },
  {
    id: 'warm-sand',
    name: 'Warm Sand',
    isDark: false,
    variables: {
      '--color-bg-primary':         '#fdf6e3',
      '--color-bg-secondary':       '#ffffff',
      '--color-bg-input':           '#f5ede0',
      '--color-text-primary':       '#3c2e1e',
      '--color-text-secondary':     '#7c6f5b',
      '--color-accent':             '#c17f24',
      '--color-accent-hover':       '#a06618',
      '--color-border':             '#e8d8c0',
      '--color-user-bubble':        '#fdebd0',
      '--color-assistant-bubble':   '#ffffff',
      '--color-code-bg':            '#f0e6d4',
      '--color-scrollbar':          '#e8d8c0',
    },
  },
  {
    id: 'sunset-purple',
    name: 'Sunset Purple',
    isDark: true,
    variables: {
      '--color-bg-primary':         '#1a0a2e',
      '--color-bg-secondary':       '#2d1b4e',
      '--color-bg-input':           '#3d2460',
      '--color-text-primary':       '#f3e8ff',
      '--color-text-secondary':     '#ce93d8',
      '--color-accent':             '#ab47bc',
      '--color-accent-hover':       '#ce93d8',
      '--color-border':             '#3d2460',
      '--color-user-bubble':        '#6a1b9a',
      '--color-assistant-bubble':   '#2d1b4e',
      '--color-code-bg':            '#120720',
      '--color-scrollbar':          '#3d2460',
    },
  },
];

export const defaultTheme = themes[0]!;
