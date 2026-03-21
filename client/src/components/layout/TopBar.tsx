import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useSettingsStore } from '../../stores/settingsStore';
import { themes } from '../../themes/themes';
import type { ModelInfo } from '@simple-ui/shared';

interface Props {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ onToggleSidebar, onOpenSettings }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const { selectedModel, setModel, setTheme, activeTheme, modelsVersion, setAvailableModels } = useSettingsStore();

  useEffect(() => {
    apiClient.get('/models')
      .then((r) => {
        const fetched: ModelInfo[] = r.data;
        setModels(fetched);
        setAvailableModels(fetched);  // Share with ChatInput via store
        // Auto-select first available model if none selected or stored model no longer exists
        if (fetched.length > 0 && !fetched.find((m) => m.id === selectedModel)) {
          setModel(fetched[0]!.id, fetched[0]!.provider);
        }
      })
      .catch(() => {});
  }, [modelsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = models.find((m) => m.id === e.target.value);
    if (selected) setModel(selected.id, selected.provider);
  };

  const nextTheme = () => {
    const idx = themes.findIndex((t) => t.id === activeTheme.id);
    const next = themes[(idx + 1) % themes.length]!;
    setTheme(next.id);
  };

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-border-color bg-bg-secondary flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="text-text-secondary hover:text-text-primary transition-colors"
        title="Toggle sidebar"
      >
        ☰
      </button>

      <div className="flex-1">
        {models.length > 0 ? (
          <select
            value={selectedModel}
            onChange={handleModelChange}
            className="bg-bg-input border border-border-color text-text-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {(['openai', 'anthropic', 'gemini'] as const).map((provider) => {
              const providerModels = models.filter((m) => m.provider === provider);
              if (providerModels.length === 0) return null;
              return (
                <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                  {providerModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.supportsVision ? ' 👁' : ''}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        ) : (
          <span className="text-sm text-text-secondary">Add an API key in Settings to select a model</span>
        )}
      </div>

      <button
        onClick={nextTheme}
        title={`Theme: ${activeTheme.name}`}
        className="w-7 h-7 rounded-full border-2 border-border-color hover:border-accent transition-colors flex-shrink-0"
        style={{ background: activeTheme.variables['--color-accent'] }}
      />

      <button
        onClick={onOpenSettings}
        className="text-text-secondary hover:text-text-primary transition-colors"
        title="Settings"
      >
        ⚙️
      </button>
    </header>
  );
}
