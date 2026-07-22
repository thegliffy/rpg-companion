import { useEffect } from "react";
import { socket } from "./client";

export function useSocketEvent<T>(event: string, handler: (payload: T) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, handler, enabled]);
}

export function useCampaignRoom(campaignId: number | null) {
  useEffect(() => {
    if (campaignId === null) return;
    const join = () => socket.emit("campaign:join", { campaignId });
    join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      socket.emit("campaign:leave", { campaignId });
    };
  }, [campaignId]);
}
