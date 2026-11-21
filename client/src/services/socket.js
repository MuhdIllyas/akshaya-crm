import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL;

export const socket = io(API_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  // Never give up: after a Wi-Fi drop, sleep or server restart the person would
  // otherwise look offline (and miss messages) until they refresh.
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
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