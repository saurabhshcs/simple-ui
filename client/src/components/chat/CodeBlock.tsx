import { useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useSettingsStore } from '../../stores/settingsStore';

interface Props { language: string; code: string; }

export function CodeBlock({ language, code }: Props) {
  const [copied, setCopied] = useState(false);
  const isDark = useSettingsStore((s) => s.activeTheme.isDark);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border-color my-2">
      <div className="flex items-center justify-between px-4 py-2 bg-code-bg border-b border-border-color">
        <span className="text-xs text-text-secondary font-mono">{language || 'code'}</span>
        <button
          onClick={copy}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={isDark ? atomOneDark : atomOneLight}
        customStyle={{ margin: 0, background: 'var(--color-code-bg)', fontSize: '0.85em' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
