"use client";

import { useEffect } from "react";
import { useSocket } from "@/socket/SocketProvider";
import { SOCKET_EVENTS } from "@/socket/socket-events";

export function useChatSocket(userId: string, name?: string) {
    const socket = useSocket();

    // ---- Đăng ký user khi connect ----
    useEffect(() => {        
        if (!socket || !userId) return;
        console.log("[useChatSocket] useEffect chạy vì dependency(s) thay đổi:", { socket, userId });
        socket.emit(SOCKET_EVENTS.USER_CONNECT, name);
    }, [socket, userId]);

    // ---- Gửi tin nhắn cá nhân ----
    function sendPrivateMessage(receiverId: string, message: string, conversationId?: string) {
        if (!socket || !socket.connected) return;

        const payload: any = {
            senderId: userId,
            receiverId,
            message,
        };
        if (conversationId) {
            payload.conversationId = conversationId;
        }

        socket.emit(SOCKET_EVENTS.SEND_MESSAGE, payload);
    }

    // ---- Gửi tin nhắn nhóm (room) ----
    function sendRoomMessage(roomId: string, message: string) {
        if (!socket || !socket.connected) return;

        const messageData = {
            roomId,
            senderId: userId,
            senderName: name,
            message,
            createdAt: new Date(),
        };
        console.log("[useChatSocket] sendRoomMessage - messageData:", messageData);

        socket.emit(SOCKET_EVENTS.SEND_ROOM_MESSAGE, messageData);
    }

    // ---- Join group ----
    function joinRoom(roomId: string) {
        if (!socket) return;
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, roomId);
    }

    // ---- Leave group ----
    function leaveRoom(roomId: string) {
        if (!socket) return;
        socket.emit(SOCKET_EVENTS.LEAVE_ROOM, roomId);
    }

    // ---- Lắng nghe message riêng & message group ----
    function listenMessages({
        onPrivateMessage,
        onRoomMessage,
    }: {
        onPrivateMessage?: (msg: any) => void;
        onRoomMessage?: (msg: any) => void;
    }) {
        if (!socket) return;

        // private
        const privateHandler = (data: any) => {
            onPrivateMessage?.(data);
        };

        // room
        const roomHandler = (data: any) => {
            console.log("[socket] RECEIVE_ROOM_MESSAGE", data);
            onRoomMessage?.(data);
        };

        socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, privateHandler);
        socket.on(SOCKET_EVENTS.RECEIVE_ROOM_MESSAGE, roomHandler);

        return () => {
            socket.off(SOCKET_EVENTS.RECEIVE_MESSAGE, privateHandler);
            socket.off(SOCKET_EVENTS.RECEIVE_ROOM_MESSAGE, roomHandler);
        };
    }

    function listenNotification(options: {
        onMessageNotification?: (data: any) => void;
        onNotification?: (data: any) => void;
        onOnlineUser?: (data: any) => void;
    }) {
        if (!socket) return;

        const { onMessageNotification, onNotification, onOnlineUser } = options;

        // Nếu trong SOCKET_EVENTS có sự kiện "MESSAGE_NOTIFICATION" thì dùng, nếu chưa thì hardcode hoặc bổ sung vào SOCKET_EVENTS
        const messageNotificationEvent = SOCKET_EVENTS.MESSAGE_NOTIFICATION || "messageNotification";
        const notificationEvent = SOCKET_EVENTS.NOTIFICATION || "notification";
        const onlineUserEvent = SOCKET_EVENTS.ONLINE_USER || "onlineUser";

        const messageNotificationHandler = (data: any) => {
            onMessageNotification?.(data);
        };

        const notificationHandler = (data: any) => {
            onNotification?.(data);
        };

        const onlineUserHandler = (data: any) => {
            onOnlineUser?.(data);
        };

        socket.on(messageNotificationEvent, messageNotificationHandler);
        socket.on(notificationEvent, notificationHandler);
        socket.on(onlineUserEvent, onlineUserHandler);

        return () => {
            socket.off(messageNotificationEvent, messageNotificationHandler);
            socket.off(notificationEvent, notificationHandler);
            socket.off(onlineUserEvent, onlineUserHandler);
        };
    }

    return {
        socket,
        joinRoom,
        leaveRoom,
        sendPrivateMessage,
        sendRoomMessage,
        listenMessages,
        listenNotification,
    };
}
