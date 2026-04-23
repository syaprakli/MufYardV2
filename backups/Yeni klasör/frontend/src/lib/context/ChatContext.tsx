import { createContext, useContext, useState, type ReactNode } from 'react';

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
    // Check if room already open
    if (activeChats.find(c => c.roomId === roomId)) {
      // Move to front/focus logic could be added here
      return;
    }
    
    // Limit max 3-4 chats
    setActiveChats(prev => {
        const filtered = prev.length >= 3 ? prev.slice(1) : prev;
        return [...filtered, { roomId, title, type }];
    });
  };

  const closeChat = (roomId: string) => {
    setActiveChats(prev => prev.filter(c => c.roomId !== roomId));
  };

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
