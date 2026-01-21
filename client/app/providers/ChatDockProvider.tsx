"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import ChatDock from "@/components/ui/ChatDock";

// Định nghĩa lại interface để khớp với ChatDock.tsx
export interface ChatMessage {
  id: string | number;
  userId?: string;
  text: string;
  createdAt: string | Date;
  isOutgoing: boolean;
}

export interface ChatConversation {
  id: string | number;
  title: string;
  avatarUrl?: string;
  messages?: ChatMessage[];
  conversationId?: string; // Truyền conversationId qua tab chat
  type?: "private" | "group" | "self"; // Thêm type "self"
  owner?: string; // Thêm biến owner
}

type OpenChatPayload = {
  id: ChatConversation["id"];
  title: string;
  avatarUrl?: string;
  conversationId?: string;
  type?: "private" | "group" | "self"; // Thêm type "self" vào payload
  owner?: string; // Thêm biến owner
};

type ChatDockContextValue = {
  /** Gọi ở bất kỳ trang/component nào để mở 1 tab chat (global) */
  openChat: (payload: OpenChatPayload) => void;
};

const ChatDockContext = createContext<ChatDockContextValue | null>(null);

export const useChatDock = () => {
  const ctx = useContext(ChatDockContext);
  if (!ctx) {
    return {
      openChat: () => {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[useChatDock] ChatDockProvider chưa được mount ở cấp root."
          );
        }
      },
    };
  }
  return ctx;
};

const ChatDockProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [openRequestId, setOpenRequestId] = useState<string | number | null>(null);

  // Helper: alert khi có dữ liệu truyền vào
  const alertOpenChatPayload = (payload: OpenChatPayload) => {
    console.warn("ALL PAYLOAD : ", payload)
  };

  const openChat = useCallback((payload: OpenChatPayload) => {
    alertOpenChatPayload(payload);

    setConversations((prev) => {
      const exists = prev.find((c) => c.id === payload.id);
      if (exists) {
        return prev.map((c) =>
          c.id === payload.id
            ? {
                ...c,
                title: payload.title || c.title,
                avatarUrl: payload.avatarUrl ?? c.avatarUrl,
                messages: c.messages || [],
                conversationId: payload.conversationId ?? c.conversationId,
                type: payload.type ?? c.type, // Ưu tiên nhận type mới, fallback type cũ nếu có
                owner: payload.owner ?? c.owner, // Ưu tiên nhận owner mới, fallback owner cũ nếu có
              }
            : c
        );
      }
      return [
        ...prev,
        {
          id: payload.id,
          title: payload.title,
          avatarUrl: payload.avatarUrl,
          conversationId: payload.conversationId,
          messages: [],
          type: payload.type, // Thêm type (private|group|self)
          owner: payload.owner, // Thêm owner
        },
      ];
    });

    setOpenRequestId(payload.id);
  }, []);

  const handleSendMessage = useCallback(
    (conversationId: ChatConversation["id"], text: string) => {
      alert(
        `handleSendMessage invoked!\nConversation ID: ${conversationId}\nText: ${text}`
      );
      const newMessage: ChatMessage = {
        id: Date.now(),
        userId: "local",
        isOutgoing: true,
        text,
        createdAt: new Date(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...(c.messages || []), newMessage] }
            : c
        )
      );
    },
    []
  );

  // Log data before opening a chat tab
  if (openRequestId) {
    const matchedConversation = conversations.find(c => c.id === openRequestId);
    console.log("Opening chat tab with data:", matchedConversation);
  }

  return (
    <ChatDockContext.Provider value={{ openChat }}>
      {children}
      <ChatDock
        conversations={conversations.map(({ messages, ...rest }) => ({
          ...rest,
          messages: messages || [],
        }))}
        defaultOpenIds={openRequestId ? [openRequestId] : []}
        onSendMessage={handleSendMessage}
      />
    </ChatDockContext.Provider>
  );
}

export default ChatDockProvider;
