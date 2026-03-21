import { create } from 'zustand';
import { themes, defaultTheme, type Theme } from '../themes/themes';
import type { ModelInfo } from '@simple-ui/shared';

interface SettingsState {
  activeTheme: Theme;
  backgroundUrl: string | null;
  selectedModel: string;
  selectedProvider: 'openai' | 'anthropic' | 'gemini';
  modelsVersion: number;
  availableModels: ModelInfo[];
  setTheme: (themeId: string) => void;
  setBackground: (url: string | null) => void;
  setModel: (model: string, provider: 'openai' | 'anthropic' | 'gemini') => void;
  bumpModelsVersion: () => void;
  setAvailableModels: (models: ModelInfo[]) => void;
}

function applyTheme(theme: Theme) {
  for (const [key, value] of Object.entries(theme.variables)) {
    document.documentElement.style.setProperty(key, value);
  }
}

const storedThemeId = localStorage.getItem('theme_id');
const initialTheme = themes.find((t) => t.id === storedThemeId) ?? defaultTheme;
applyTheme(initialTheme);

export const useSettingsStore = create<SettingsState>((set) => ({
  activeTheme: initialTheme,
  backgroundUrl: localStorage.getItem('bg_url'),
  selectedModel: localStorage.getItem('model') ?? '',
  selectedProvider: (localStorage.getItem('provider') as SettingsState['selectedProvider']) ?? 'openai',
  modelsVersion: 0,
  availableModels: [],

  setTheme: (themeId) => {
    const theme = themes.find((t) => t.id === themeId) ?? defaultTheme;
    applyTheme(theme);
    localStorage.setItem('theme_id', themeId);
    set({ activeTheme: theme });
  },

  setBackground: (url) => {
    if (url) localStorage.setItem('bg_url', url);
    else localStorage.removeItem('bg_url');
    set({ backgroundUrl: url });
  },

  setModel: (model, provider) => {
    localStorage.setItem('model', model);
    localStorage.setItem('provider', provider);
    set({ selectedModel: model, selectedProvider: provider });
  },

  bumpModelsVersion: () => set((s) => ({ modelsVersion: s.modelsVersion + 1 })),

  setAvailableModels: (models) => set({ availableModels: models }),
}));
