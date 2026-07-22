import { io, type Socket } from "socket.io-client";

export const socket: Socket = io({ autoConnect: true });
