import { ApiKeyManager } from '../settings/ApiKeyManager';
import { ThemePicker } from '../settings/ThemePicker';
import { BackgroundUploader } from '../settings/BackgroundUploader';

interface Props { onClose: () => void; }

export function SettingsPanel({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary rounded-2xl border border-border-color w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors text-xl">
            ✕
          </button>
        </div>
        <div className="p-6 space-y-8">
          <ApiKeyManager />
          <div className="border-t border-border-color pt-6">
            <ThemePicker />
          </div>
          <div className="border-t border-border-color pt-6">
            <BackgroundUploader />
          </div>
        </div>
      </div>
    </div>
  );
}
