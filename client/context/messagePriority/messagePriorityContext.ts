import { createContext } from "react";

/**
 * none  : không ưu tiên
 * low   : ưu tiên thấp (toast, không auto-open)
 * high  : ưu tiên cao (auto-open)
 */
export type MessagePriority = "none" | "low" | "high";

/**
 * Group message priority, same as MessagePriority but
 * you can extend here for group-specific logic later if desired
 */
export type GroupMessagePriority = "none" | "low" | "high";

export type MessagePriorityContextType = {
  // For private messages
  priority: MessagePriority;
  setNone: () => void;
  setLow: () => void;
  setHigh: () => void;
  setPriority: (priority: MessagePriority) => void;

  // For group messages
  groupPriority?: GroupMessagePriority;
  setGroupNone?: () => void;
  setGroupLow?: () => void;
  setGroupHigh?: () => void;
  setGroupPriority?: (priority: GroupMessagePriority) => void;
};

export const MessagePriorityContext =
  createContext<MessagePriorityContextType | null>(null);
