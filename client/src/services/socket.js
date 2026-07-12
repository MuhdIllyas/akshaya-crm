import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL;

export const socket = io(API_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

let initialized = false;

export const connectSocket = (token) => {
  if (!token) return;
  if (initialized || socket.connected) return;

  socket.auth = { token };
  socket.connect();
  initialized = true;
};

export const disconnectSocket = () => {
  initialized = false;
  if (socket.connected) {
    socket.disconnect();
  }
};