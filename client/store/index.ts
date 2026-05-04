import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import userReducer from "./slices/userSlice";
import cacheConversationsReducer from "./slices/cacheConversationSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    cacheConversations: cacheConversationsReducer,
  },
  devTools: true,
//  devTools: process.env.NODE_ENV !== "production",
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;