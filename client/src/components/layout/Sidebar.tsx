import { useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { clsx } from 'clsx';

interface Props {
  onNewChat: () => void;
}

export function Sidebar({ onNewChat }: Props) {
  const { conversations, activeConversationId, setConversations, setActiveConversation, removeConversation } = useChatStore();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    apiClient.get('/chat/conversations')
      .then(async (r) => {
        const list = r.data;
        setConversations(list);
        // Auto-load the most recent conversation on first visit
        if (list.length > 0 && !activeConversationId) {
          const latest = list[0];
          const res = await apiClient.get(`/chat/conversations/${latest.id}`);
          setActiveConversation(latest.id, res.data.messages.map((m: {
            id: string; role: string; content: string; fileIds: string[];
            created_at: number; model?: string; provider?: string;
          }) => ({
            id: m.id,
            conversationId: latest.id,
            role: m.role,
            content: m.content,
            fileIds: m.fileIds ?? [],
            model: m.model ?? undefined,
            provider: m.provider ?? undefined,
            createdAt: m.created_at,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const openConversation = async (id: string) => {
    if (id === activeConversationId) return;
    const res = await apiClient.get(`/chat/conversations/${id}`);
    setActiveConversation(id, res.data.messages.map((m: {
      id: string; role: string; content: string; fileIds: string[];
      created_at: number; model?: string; provider?: string;
    }) => ({
      id: m.id,
      conversationId: id,
      role: m.role,
      content: m.content,
      fileIds: m.fileIds ?? [],
      model: m.model ?? undefined,
      provider: m.provider ?? undefined,
      createdAt: m.created_at,
    })));
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiClient.delete(`/chat/conversations/${id}`);
    removeConversation(id);
  };

  return (
    <aside className="w-64 flex flex-col bg-bg-secondary border-r border-border-color h-full">
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-input transition-colors text-sm"
        >
          <span>＋</span> New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => openConversation(conv.id)}
            className={clsx(
              'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm',
              activeConversationId === conv.id
                ? 'bg-bg-input text-text-primary'
                : 'text-text-secondary hover:bg-bg-input hover:text-text-primary',
            )}
          >
            <span className="flex-1 truncate">{conv.title}</span>
            <button
              onClick={(e) => deleteConversation(conv.id, e)}
              className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-all text-xs"
            >
              🗑
            </button>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-xs text-text-secondary px-3 py-2">No conversations yet</p>
        )}
      </div>

      <div className="p-4 border-t border-border-color">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="text-xs text-text-secondary flex-1 truncate">{user?.email}</span>
          <button onClick={logout} className="text-xs text-text-secondary hover:text-red-400 transition-colors" title="Sign out">
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}
