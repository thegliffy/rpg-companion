import type http from "node:http";
import type { RequestHandler } from "express";
import { Server } from "socket.io";
import { getMembership } from "../services/campaigns.service.js";

let ioInstance: Server | null = null;

export function createSocketServer(httpServer: http.Server, sessionMiddleware: RequestHandler) {
  const io = new Server(httpServer);

  // Share the express session with socket.io's underlying engine so
  // socket.request.session is populated without a second auth handshake.
  io.engine.use(sessionMiddleware);

  io.on("connection", (socket) => {
    const session = (socket.request as unknown as { session?: { userId?: number } }).session;

    socket.on("campaign:join", ({ campaignId }: { campaignId: number }) => {
      const userId = session?.userId;
      if (!userId) return;

      const membership = getMembership(campaignId, userId);
      if (!membership) return; // never trust a client-held campaign id

      socket.join(`campaign:${campaignId}`);
    });

    socket.on("campaign:leave", ({ campaignId }: { campaignId: number }) => {
      socket.leave(`campaign:${campaignId}`);
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): Server {
  if (!ioInstance) throw new Error("Socket.IO server not initialized");
  return ioInstance;
}

export function emitToCampaign(campaignId: number, event: string, payload: unknown) {
  getIO().to(`campaign:${campaignId}`).emit(event, payload);
}
