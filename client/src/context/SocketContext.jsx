import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext({ socket: null, connected: false });
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  // Connect only for a fully signed-in person; disconnect on logout
  const uid = user && !user.mustChangePassword ? user.id : null;

  useEffect(() => {
    if (!uid) return;
    const s = io({ path: "/socket.io", withCredentials: true });
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [uid]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

// Run a function every time the server sends this event
export function useLive(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler; // always the newest function
  });

  useEffect(() => {
    if (!socket) return;
    const fn = (payload) => ref.current(payload);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}