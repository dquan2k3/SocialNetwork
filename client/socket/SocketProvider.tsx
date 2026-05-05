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

type SocketType = Socket | null;

const SocketContext = createContext<SocketType>(null);
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<SocketType>(null);

  useEffect(() => {
    let cancelled = false;
    let s: Socket | null = null;

    connectSocket().then((sock) => {
      if (cancelled) {
        sock.removeAllListeners();
        sock.disconnect();
        return;
      }
      s = sock;
      setSocket(sock);
      sock.connect();

      function onConnect() {
        console.log("Client socket connected:", sock.id);
      }
      sock.on(SOCKET_EVENTS.CONNECT, onConnect);
    });

    return () => {
      cancelled = true;
      if (s) {
        s.off(SOCKET_EVENTS.CONNECT);
        s.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
