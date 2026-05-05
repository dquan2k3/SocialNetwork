"use client";

import instance from "@/axiosConfig";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocketServerURL(): string {
  const env = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return "http://localhost:5000";
}

/** Socket tới Render: cookie không đi theo cross-origin WS → lấy JWT qua `/auth/socket-token` (same-origin proxy). */
export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const url = getSocketServerURL();

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  let authToken: string | undefined;
  try {
    const { data } = await instance.get<{ success?: boolean; token?: string }>(
      "/auth/socket-token"
    );
    if (data?.success && data?.token) authToken = data.token;
  } catch {
    /* chưa đăng nhập */
  }

  socket = io(url, {
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
    ...(authToken ? { auth: { token: authToken } } : {}),
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}
