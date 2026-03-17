import { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { ApiKeyEntry, Provider } from '@simple-ui/shared';
import { useSettingsStore } from '../../stores/settingsStore';

const PROVIDERS: { id: Provider; name: string; placeholder: string }[] = [
  { id: 'openai',    name: 'OpenAI',    placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'gemini',    name: 'Google Gemini', placeholder: 'AIza...' },
];

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [saving, setSaving] = useState(false);
  const bumpModelsVersion = useSettingsStore((s) => s.bumpModelsVersion);

  useEffect(() => {
    apiClient.get('/settings/api-keys').then((r) => setKeys(r.data));
  }, []);

  const save = async (provider: Provider) => {
    if (!draftKey.trim()) return;
    setSaving(true);
    await apiClient.put(`/settings/api-keys/${provider}`, { keyValue: draftKey });
    const refreshed = await apiClient.get('/settings/api-keys');
    setKeys(refreshed.data);
    setEditing(null);
    setDraftKey('');
    setSaving(false);
    bumpModelsVersion();
  };

  const remove = async (provider: Provider) => {
    await apiClient.delete(`/settings/api-keys/${provider}`);
    setKeys((k) => k.filter((e) => e.provider !== provider));
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-text-primary mb-3">API Keys</h3>
      <div className="space-y-3">
        {PROVIDERS.map(({ id, name, placeholder }) => {
          const entry = keys.find((k) => k.provider === id);
          return (
            <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-border-color bg-bg-input">
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{name}</p>
                {editing === id ? (
                  <input
                    type="password"
                    value={draftKey}
                    onChange={(e) => setDraftKey(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                    className="mt-1 w-full bg-bg-secondary border border-border-color rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                ) : (
                  <p className="text-xs text-text-secondary mt-0.5 font-mono">
                    {entry ? entry.maskedKey : 'Not configured'}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {editing === id ? (
                  <>
                    <button
                      onClick={() => save(id)}
                      disabled={saving}
                      className="text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button onClick={() => { setEditing(null); setDraftKey(''); }} className="text-xs text-text-secondary hover:underline">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditing(id)} className="text-xs text-accent hover:underline">
                      {entry ? 'Edit' : 'Add'}
                    </button>
                    {entry && (
                      <button onClick={() => remove(id)} className="text-xs text-red-400 hover:underline">
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-text-secondary mt-3">
        Keys are encrypted at rest and never exposed in responses.
      </p>
    </div>
  );
}
