import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const socket = io(API_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// Helper to connect with token
export const connectSocket = (token) => {
  if (!token) return;
  
  socket.auth = { token };
  socket.connect();
};

// Helper to disconnect
export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};