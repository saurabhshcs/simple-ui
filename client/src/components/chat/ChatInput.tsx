import { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useChat } from '../../hooks/useChat';
import { useChatStore } from '../../stores/chatStore';
import { apiClient } from '../../api/client';
import { FileAttachmentList } from './FileAttachment';
import type { UploadedFile } from '@simple-ui/shared';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

export function ChatInput() {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, isStreaming } = useChat();
  const addPendingFile = useChatStore((s) => s.addPendingFile);

  const onDrop = async (files: File[]) => {
    setUploadError('');
    setUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(`${file.name} is too large (max 5MB)`);
        continue;
      }
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await apiClient.post<UploadedFile>('/files/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        addPendingFile({ fileId: res.data.fileId, filename: res.data.filename, mimeType: res.data.mimeType, size: res.data.size });
      } catch {
        setUploadError(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    noClick: true,
    noKeyboard: true,
    maxSize: 5 * 1024 * 1024,
  });

  const handleSubmit = async () => {
    if (!text.trim() || isStreaming || uploading) return;
    const msg = text;
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className="border-t border-border-color bg-bg-primary">
      <FileAttachmentList />
      {uploadError && (
        <p className="text-red-400 text-xs px-4 pt-2">{uploadError}</p>
      )}
      <div
        {...getRootProps()}
        className={`relative m-4 rounded-2xl border border-border-color bg-bg-input transition-colors ${isDragActive ? 'border-accent bg-accent/10' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-10 bg-bg-primary/80">
            <p className="text-accent font-medium">Drop files here</p>
          </div>
        )}
        <div className="flex items-end gap-2 p-3">
          <button
            onClick={open}
            disabled={uploading}
            title="Attach file"
            className="text-text-secondary hover:text-text-primary transition-colors flex-shrink-0 pb-0.5 disabled:opacity-40"
          >
            {uploading ? '⏳' : '📎'}
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Shift+Enter for new line)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-text-primary placeholder-text-secondary resize-none focus:outline-none text-sm leading-relaxed max-h-40 disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isStreaming || uploading}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            {isStreaming ? '⏹' : '↑'}
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-text-secondary pb-3 -mt-2">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  );
}
