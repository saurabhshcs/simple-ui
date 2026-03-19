import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useSettingsStore } from '../stores/settingsStore';
import { themes, defaultTheme } from '../themes/themes';

beforeEach(() => {
  localStorage.clear();
  // Reset to a known state between tests
  act(() => {
    useSettingsStore.setState({
      activeTheme: defaultTheme,
      backgroundUrl: null,
      selectedModel: '',
      selectedProvider: 'openai',
      modelsVersion: 0,
    });
  });
});

describe('settingsStore', () => {
  describe('setTheme', () => {
    it('updates activeTheme to the requested theme', () => {
      const target = themes.find((t) => t.id !== defaultTheme.id)!;
      act(() => useSettingsStore.getState().setTheme(target.id));
      expect(useSettingsStore.getState().activeTheme.id).toBe(target.id);
    });

    it('persists the theme id to localStorage', () => {
      act(() => useSettingsStore.getState().setTheme(themes[0]!.id));
      expect(localStorage.getItem('theme_id')).toBe(themes[0]!.id);
    });

    it('falls back to defaultTheme for an unknown theme id', () => {
      act(() => useSettingsStore.getState().setTheme('nonexistent-theme'));
      expect(useSettingsStore.getState().activeTheme.id).toBe(defaultTheme.id);
    });

    it('applies CSS variables to document.documentElement', () => {
      const target = themes[0]!;
      act(() => useSettingsStore.getState().setTheme(target.id));

      const firstVar = Object.keys(target.variables)[0]!;
      const expected = target.variables[firstVar]!;
      expect(document.documentElement.style.getPropertyValue(firstVar)).toBe(expected);
    });
  });

  describe('setModel', () => {
    it('updates selectedModel and selectedProvider', () => {
      act(() => useSettingsStore.getState().setModel('claude-3-5-sonnet', 'anthropic'));
      const s = useSettingsStore.getState();
      expect(s.selectedModel).toBe('claude-3-5-sonnet');
      expect(s.selectedProvider).toBe('anthropic');
    });

    it('persists model and provider to localStorage', () => {
      act(() => useSettingsStore.getState().setModel('gemini-pro', 'gemini'));
      expect(localStorage.getItem('model')).toBe('gemini-pro');
      expect(localStorage.getItem('provider')).toBe('gemini');
    });
  });

  describe('setBackground', () => {
    it('sets backgroundUrl and persists to localStorage', () => {
      act(() => useSettingsStore.getState().setBackground('/uploads/bg.jpg'));
      expect(useSettingsStore.getState().backgroundUrl).toBe('/uploads/bg.jpg');
      expect(localStorage.getItem('bg_url')).toBe('/uploads/bg.jpg');
    });

    it('clears backgroundUrl and removes from localStorage when null', () => {
      act(() => {
        useSettingsStore.getState().setBackground('/uploads/bg.jpg');
        useSettingsStore.getState().setBackground(null);
      });
      expect(useSettingsStore.getState().backgroundUrl).toBeNull();
      expect(localStorage.getItem('bg_url')).toBeNull();
    });
  });

  describe('bumpModelsVersion', () => {
    it('increments modelsVersion by 1 each call', () => {
      act(() => useSettingsStore.getState().bumpModelsVersion());
      expect(useSettingsStore.getState().modelsVersion).toBe(1);
      act(() => useSettingsStore.getState().bumpModelsVersion());
      expect(useSettingsStore.getState().modelsVersion).toBe(2);
    });
  });
});
