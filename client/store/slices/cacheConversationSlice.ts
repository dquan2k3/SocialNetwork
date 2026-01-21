import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Định nghĩa Conversation với các trường: conversationId, name, avatar, avatarCroppedArea

export interface Conversation {
  conversationId: string;
  name: string;
  avatar?: string;
  avatarCroppedArea?: any;
}

export interface CacheConversationsState {
  // Giữ một record cho truy xuất nhanh
  conversations: Record<string, Conversation>;
  // Giữ thứ tự conversationId theo thời gian thêm vào để biết cái cũ nhất
  order: string[];
}

const MAX_CONVERSATIONS = 50;

const initialState: CacheConversationsState = {
  conversations: {},
  order: [],
};

const cacheConversationsSlice = createSlice({
  name: "cacheConversations",
  initialState,
  reducers: {
    addConversation(state, action: PayloadAction<Conversation>) {
      const conversation = action.payload;
      const id = String(conversation.conversationId);

      // Nếu đã có thì xóa khỏi order cũ
      const idx = state.order.indexOf(id);
      if (idx !== -1) {
        state.order.splice(idx, 1);
      }

      // Thêm vào cuối cùng (mới nhất)
      state.order.push(id);

      // Nếu vượt quá 50 thì xóa cái cũ nhất
      while (state.order.length > MAX_CONVERSATIONS) {
        const oldestId = state.order.shift();
        if (oldestId !== undefined) {
          delete state.conversations[oldestId];
        }
      }

      state.conversations[id] = { ...conversation, conversationId: id };
    },
  },
});

export const { addConversation } = cacheConversationsSlice.actions;

export default cacheConversationsSlice.reducer;