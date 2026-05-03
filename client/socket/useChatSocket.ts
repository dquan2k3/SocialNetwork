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

    function listenCreateGroup(handler: (data: any) => void) {
        if (!socket) return;

        const createGroupEvent = SOCKET_EVENTS.CREATED_GROUP || "onCreateGroup";

        const createGroupHandler = (data: any) => {
            handler?.(data);
        };

        socket.on(createGroupEvent, createGroupHandler);

        return () => {
            socket.off(createGroupEvent, createGroupHandler);
        };
    }

    function listenDisbandGroup(handler: (data: any) => void) {
        if (!socket) return;

        const disbandGroupEvent = SOCKET_EVENTS.DISBAND_GROUP || "onDisbandGroup";

        const disbandGroupHandler = (data: any) => {
            handler?.(data);
        };

        socket.on(disbandGroupEvent, disbandGroupHandler);

        return () => {
            socket.off(disbandGroupEvent, disbandGroupHandler);
        };
    }

    // ==== ADD: Video Call socket helper functions ====
    // 1. Send a call "invite" to a user
    function callOffer(targetUserId: string, offer: any) {
        if (!socket || !socket.connected) return;
        socket.emit(SOCKET_EVENTS.CALL_OFFER, { targetUserId });
    }

    // 2. Listen for incoming call offers
    function listenCallOffer(handler: (data: any) => void) {
        if (!socket) return;

        const event = SOCKET_EVENTS.LISTEN_CALL_OFFER;
        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
        };
    }

    // 2b. Send "accept call" event to server (Client => Server)
    function acceptCall(targetUserId: string) {
        if (!socket || !socket.connected) return;
        socket.emit(SOCKET_EVENTS.CALL_ACCEPT, { targetUserId });
    }

    // 2c. Send "decline call" event to server (Client => Server)
    function declineCall(targetUserId: string) {
        if (!socket || !socket.connected) return;
        socket.emit(SOCKET_EVENTS.CALL_DECLINE, { targetUserId });
    }


    // Listen for "accept call" event from server
    function listenAcceptCall(handler: (data: any) => void) {
        if (!socket) return;

        const event = SOCKET_EVENTS.LISTEN_ACCEPT_CALL || "listenAcceptCall";
        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
        };
    }

    // 3. Send call answer to another user
    function callAnswer(targetUserId: string, answer: any) {
        if (!socket || !socket.connected) return;
        socket.emit(SOCKET_EVENTS.CALL_ANSWER, { targetUserId, answer, fromUserId: userId });
    }

    // 4. Listen for incoming call answers
    function listenCallAnswer(handler: (data: any) => void) {
        if (!socket) return;

        const event = SOCKET_EVENTS.CALL_ANSWER;
        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
        };
    }

    // 5. Send ICE candidate
    function sendCallIceCandidate(targetUserId: string, candidate: any) {
        if (!socket || !socket.connected) return;
        socket.emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, { targetUserId, candidate, fromUserId: userId });
    }

    // 6. Listen for ICE candidate
    function listenCallIceCandidate(handler: (data: any) => void) {
        if (!socket) return;

        const event = SOCKET_EVENTS.CALL_ICE_CANDIDATE;
        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
        };
    }

    // 7. Listen for call accepted
    function listenCallAccepted(handler: (data: any) => void) {
        if (!socket) return;

        const event = SOCKET_EVENTS.CALL_ACCEPTED;
        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
        };
    }

    // 8. Listen for call rejected
    function listenCallRejected(handler: (data: any) => void) {
        if (!socket) return;

        const event = SOCKET_EVENTS.CALL_REJECTED;
        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
        };
    }

    // 9. End call (emit event to both users or to server for broadcast)
    function endCall(targetUserId: string) {
        if (!socket || !socket.connected) return;
        socket.emit(SOCKET_EVENTS.CALL_ENDED, { targetUserId, fromUserId: userId });
    }

    // 10. Listen for end call
    function listenCallEnded(handler: (data: any) => void) {
        if (!socket) return;

        const event = SOCKET_EVENTS.CALL_ENDED;
        socket.on(event, handler);

        return () => {
            socket.off(event, handler);
        };
    }
    // ==== END Video Call helpers ====

    return {
        socket,
        joinRoom,
        leaveRoom,
        sendPrivateMessage,
        sendRoomMessage,
        listenMessages,
        listenNotification,
        listenCreateGroup,
        listenDisbandGroup,
        // Video call helpers
        callOffer,
        listenCallOffer,
        callAnswer,
        declineCall,
        listenCallAnswer,
        sendCallIceCandidate,
        listenCallIceCandidate,
        listenCallAccepted,
        listenCallRejected,
        endCall,
        listenCallEnded,
        acceptCall,
        listenAcceptCall
    };
}
