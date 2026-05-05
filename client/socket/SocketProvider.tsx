"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { connectSocket } from "./socket";
import type { Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "./socket-events";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";

type SocketType = Socket | null;

const SocketContext = createContext<SocketType>(null);
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<SocketType>(null);
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  useEffect(() => {
    let cancelled = false;
    let s: Socket | null = null;

    async function run() {
      if (!isAuthenticated) {
        // Ensure we never keep a stale socket while logged out.
        if (socket) {
          socket.removeAllListeners();
          socket.disconnect();
        }
        setSocket(null);
        return;
      }

      const sock = await connectSocket();
      if (cancelled) {
        sock.removeAllListeners();
        sock.disconnect();
        return;
      }

      s = sock;
      setSocket(sock);

      function onConnect() {
        console.log("Client socket connected:", sock.id);
      }
      sock.on(SOCKET_EVENTS.CONNECT, onConnect);

      if (!sock.connected) sock.connect();
    }

    run();

    return () => {
      cancelled = true;
      if (s) {
        s.off(SOCKET_EVENTS.CONNECT);
        s.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
