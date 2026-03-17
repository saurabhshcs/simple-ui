import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SettingsPanel } from './SettingsPanel';
import { ChatWindow } from '../chat/ChatWindow';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { backgroundUrl } = useSettingsStore();
  const { setActiveConversation } = useChatStore();

  const handleNewChat = () => setActiveConversation(null, []);

  return (
    <div
      className="flex h-screen overflow-hidden bg-bg-primary"
      style={backgroundUrl ? {
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {/* Overlay to keep chat readable over background image */}
      {backgroundUrl && (
        <div className="absolute inset-0 bg-bg-primary/85 pointer-events-none" />
      )}

      <div className="relative flex w-full h-full z-10">
        {sidebarOpen && <Sidebar onNewChat={handleNewChat} />}

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <div className="flex-1 overflow-hidden">
            <ChatWindow />
          </div>
        </div>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
