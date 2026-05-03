"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const API_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000";

export function getSocket() {
  if (!socket) {
    const url = API_URL || process.env.NEXT_PUBLIC_SOCKET_URL!;
    console.log("Creating socket to:", url);

    socket = io(url, {
      autoConnect: false,
      transports: ["websocket"],
      withCredentials: true, 
    });
  }
  return socket;
}
