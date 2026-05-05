import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ChatWindow {
  roomId: string;
  title: string;
  type: 'dm' | 'audit' | 'global';
}

interface ChatContextType {
  activeChats: ChatWindow[];
  openChat: (roomId: string, title: string, type: 'dm' | 'audit' | 'global') => void;
  closeChat: (roomId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeChats, setActiveChats] = useState<ChatWindow[]>([]);

  const openChat = (roomId: string, title: string, type: 'dm' | 'audit' | 'global') => {
    const normalizedRoomId = type === 'dm' && !roomId.startsWith('dm_') ? `dm_${roomId}` : roomId;
    // Check if room already open
    if (activeChats.find(c => c.roomId === normalizedRoomId)) {
      return;
    }
    
    // Limit max 3 chats
    setActiveChats(prev => {
        const filtered = prev.length >= 3 ? prev.slice(1) : prev;
        return [...filtered, { roomId: normalizedRoomId, title, type }];
    });
  };

  const closeChat = (roomId: string) => {
    setActiveChats(prev => prev.filter(c => c.roomId !== roomId));
  };

  // dm:open custom event dinle → DM bildirimi gelince balonu aç
  useEffect(() => {
    const handler = (e: Event) => {
      const { roomId, title } = (e as CustomEvent).detail;
      openChat(roomId, title, 'dm');
    };
    window.addEventListener('dm:open', handler);
    return () => window.removeEventListener('dm:open', handler);
  }, [activeChats]);

  return (
    <ChatContext.Provider value={{ activeChats, openChat, closeChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
