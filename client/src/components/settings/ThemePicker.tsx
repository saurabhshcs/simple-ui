import { themes } from '../../themes/themes';
import { useSettingsStore } from '../../stores/settingsStore';
import { clsx } from 'clsx';

export function ThemePicker() {
  const { activeTheme, setTheme } = useSettingsStore();

  return (
    <div>
      <h3 className="text-sm font-medium text-text-primary mb-3">Colour Theme</h3>
      <div className="grid grid-cols-2 gap-3">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className={clsx(
              'p-3 rounded-lg border-2 transition-all text-left',
              activeTheme.id === theme.id
                ? 'border-accent'
                : 'border-border-color hover:border-text-secondary',
            )}
            style={{
              background: theme.variables['--color-bg-secondary'],
              color: theme.variables['--color-text-primary'],
            }}
          >
            <div className="flex gap-1 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ background: theme.variables['--color-accent'] }} />
              <div className="w-3 h-3 rounded-full" style={{ background: theme.variables['--color-user-bubble'] }} />
              <div className="w-3 h-3 rounded-full" style={{ background: theme.variables['--color-bg-input'] }} />
            </div>
            <span className="text-xs font-medium">{theme.name}</span>
            {theme.isDark ? (
              <span className="ml-2 text-xs opacity-60">Dark</span>
            ) : (
              <span className="ml-2 text-xs opacity-60">Light</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
