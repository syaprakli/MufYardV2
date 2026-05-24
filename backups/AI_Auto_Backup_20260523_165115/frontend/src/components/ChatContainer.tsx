import { Suspense, lazy } from 'react';
import { useChat } from '../lib/context/ChatContext';

const FloatingChat = lazy(() => import('./FloatingChat'));

export default function ChatContainer() {
  const { activeChats, closeChat } = useChat();

  if (activeChats.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <div className="fixed bottom-0 right-8 z-[9999] flex items-end gap-4 pointer-events-none">
        {activeChats.map((chat) => (
          <div key={chat.roomId} className="pointer-events-auto">
            <FloatingChat
              roomId={chat.roomId}
              title={chat.title}
              type={chat.type}
              recipientId={chat.recipientId}
              onClose={() => closeChat(chat.roomId)}
            />
          </div>
        ))}
      </div>
    </Suspense>
  );
}
