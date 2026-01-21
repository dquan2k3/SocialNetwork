"use client";

import { useState, useMemo, useEffect } from "react";
import {
    MessagePriorityContext,
    MessagePriority,
    GroupMessagePriority,
} from "./messagePriorityContext";

import {
    apiGetNotificationPriorities,
    apiUpdateMessagePriority,
    apiUpdateGroupMessagePriority,
} from "@/api/conversation.api";

type Props = {
    children: React.ReactNode;
};

export function MessagePriorityProvider({ children }: Props) {
    const [priority, setPriorityState] = useState<MessagePriority>("high");
    const [groupPriority, setGroupPriorityState] = useState<GroupMessagePriority>("high");

    useEffect(() => {
        apiGetNotificationPriorities()
            .then((res) => {
                if (res && res.success) {
                    if (res.messagePriority) setPriorityState(res.messagePriority);
                    if (res.groupMessagePriority) setGroupPriorityState(res.groupMessagePriority);
                }
                console.warn("Notification Priorities Response:", res);
            })
            .catch((err) => {
                console.error("Error fetching notification priorities:", err);
            });
    }, []);

    // Wrap the setters with API calls
    const setPriority = (newPriority: MessagePriority) => {
        setPriorityState(newPriority);
        apiUpdateMessagePriority(newPriority).catch((err) => {
            console.error("Failed to update private message priority", err);
        });
    };
    const setNone = () => setPriority("none");
    const setLow = () => setPriority("low");
    const setHigh = () => setPriority("high");

    const setGroupPriority = (newPriority: GroupMessagePriority) => {
        setGroupPriorityState(newPriority);
        apiUpdateGroupMessagePriority(newPriority).catch((err) => {
            console.error("Failed to update group message priority", err);
        });
    };
    const setGroupNone = () => setGroupPriority("none");
    const setGroupLow = () => setGroupPriority("low");
    const setGroupHigh = () => setGroupPriority("high");

    const value = useMemo(
        () => ({
            // Private message priority
            priority,
            setNone,
            setLow,
            setHigh,
            setPriority,

            // Group message priority
            groupPriority,
            setGroupNone,
            setGroupLow,
            setGroupHigh,
            setGroupPriority,
        }),
        [priority, groupPriority]
    );

    return (
        <MessagePriorityContext.Provider value={value}>
            {children}
        </MessagePriorityContext.Provider>
    );
}
