import type { RealtimeChannel } from "@supabase/supabase-js";

import type { VerifyQrResponse } from "./api";
import { getSupabaseClient } from "./supabaseClient";

export type HandshakeCompletion = {
  challengeId: string;
  expiresAt: number;
  overlaps: VerifyQrResponse["overlaps"];
  viewerCubid: string;
  targetCubid: string;
};

const CHANNEL_PREFIX = "handshake:";
const EVENT_NAME = "handshake-complete";

async function ensureSubscribed(channel: RealtimeChannel): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error(`Realtime channel error: ${status}`));
      }
    });
  });
}

export async function notifyHandshakeComplete(payload: HandshakeCompletion): Promise<void> {
  const supabase = getSupabaseClient();
  const channel = supabase.channel(`${CHANNEL_PREFIX}${payload.targetCubid}`, {
    config: { broadcast: { ack: true } },
  });

  try {
    await ensureSubscribed(channel);
    const response = await channel.send({
      type: "broadcast",
      event: EVENT_NAME,
      payload,
    });

    if (response === "timed out") {
      throw new Error("Timed out broadcasting handshake completion");
    }

    if (response === "error") {
      throw new Error("Failed to broadcast handshake completion");
    }
  } finally {
    await channel.unsubscribe();
  }
}

export function subscribeToHandshake(
  targetCubid: string,
  onComplete: (payload: HandshakeCompletion) => void,
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase.channel(`${CHANNEL_PREFIX}${targetCubid}`);

  channel.on("broadcast", { event: EVENT_NAME }, (event) => {
    const payload = event.payload as HandshakeCompletion | null;
    if (!payload) return;
    onComplete(payload);
  });

  channel.subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
