import { useChatStore } from '../../stores/chatStore';
import { apiClient } from '../../api/client';

export function FileAttachmentList() {
  const { pendingFiles, removePendingFile } = useChatStore();
  if (pendingFiles.length === 0) return null;

  const remove = async (fileId: string) => {
    try { await apiClient.delete(`/files/${fileId}`); } catch { /* ignore */ }
    removePendingFile(fileId);
  };

  return (
    <div className="flex flex-wrap gap-2 px-4 pt-2">
      {pendingFiles.map((f) => (
        <div
          key={f.fileId}
          className="flex items-center gap-2 bg-bg-input border border-border-color rounded-lg px-3 py-1.5 text-sm text-text-primary"
        >
          <FileIcon mimeType={f.mimeType} />
          <span className="max-w-[140px] truncate">{f.filename}</span>
          <span className="text-text-secondary text-xs">{formatSize(f.size)}</span>
          <button
            onClick={() => remove(f.fileId)}
            className="text-text-secondary hover:text-red-400 transition-colors ml-1"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <span>🖼️</span>;
  if (mimeType === 'application/pdf') return <span>📄</span>;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <span>📊</span>;
  return <span>📝</span>;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
