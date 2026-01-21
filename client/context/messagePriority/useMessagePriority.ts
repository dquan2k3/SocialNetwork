import { useContext } from "react";
import { MessagePriorityContext } from "./messagePriorityContext";

export function useMessagePriority() {
  const ctx = useContext(MessagePriorityContext);

  if (!ctx) {
    throw new Error(
      "useMessagePriority must be used within MessagePriorityProvider"
    );
  }

  return ctx;
}
