import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is not defined");
}

export const socket = io(API_URL, {
  autoConnect: false,
  transports: ["websocket","polling"],
  secure: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

export const connectSocket = (token) => {
  if (!token) return;
  
  socket.auth = { token };
  socket.connect();
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
