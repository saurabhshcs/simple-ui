import { useRef } from 'react';
import { apiClient } from '../../api/client';
import { useSettingsStore } from '../../stores/settingsStore';

export function BackgroundUploader() {
  const { backgroundUrl, setBackground } = useSettingsStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }

    const form = new FormData();
    form.append('image', file);
    const res = await apiClient.put('/settings/background', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setBackground(res.data.url);
  };

  const handleRemove = async () => {
    if (backgroundUrl) {
      const filename = backgroundUrl.split('/').pop();
      await apiClient.delete('/settings/background', { data: { filename } });
    }
    setBackground(null);
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-text-primary mb-3">Background Image</h3>
      {backgroundUrl ? (
        <div className="flex items-center gap-3">
          <img src={backgroundUrl} alt="Background" className="w-16 h-10 rounded object-cover border border-border-color" />
          <button onClick={handleRemove} className="text-sm text-red-400 hover:underline">
            Remove
          </button>
        </div>
      ) : (
        <div>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 text-sm rounded-lg border border-border-color text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
          >
            Upload image
          </button>
          <p className="text-xs text-text-secondary mt-2">Max 2MB. Applied as a subtle overlay.</p>
        </div>
      )}
    </div>
  );
}
