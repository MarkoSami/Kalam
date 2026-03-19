import { useCallback, useRef, useState } from "react";
import { Conversation, type VoiceConversation } from "@elevenlabs/client";

type UseElevenLabsOptions = {
  addAiTrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  removeAiTrack: () => void;
};

export function useElevenLabs({
  addAiTrack,
  removeAiTrack,
}: UseElevenLabsOptions) {
  const [aiActive, setAiActive] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>("");
  const conversationRef = useRef<Conversation | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const startAi = useCallback(async () => {
    try {
      setAiStatus("Connecting...");

      const res = await fetch("/api/elevenlabs/signed-url", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to get signed URL: ${body}`);
      }
      const { signedUrl } = await res.json();

      // Conversation.startSession auto-delegates to VoiceConversation
      // when textOnly is not set. It handles mic + speaker internally.
      const conversation = await Conversation.startSession({
        signedUrl,
        onStatusChange: (status) => {
          console.log("[ElevenLabs] status:", status.status);
          setAiStatus(status.status);
        },
        onError: (error) => {
          console.error("[ElevenLabs] error:", error);
          setAiStatus("Error");
        },
        onDisconnect: (details) => {
          console.log("[ElevenLabs] disconnected:", details);
          setAiActive(false);
          setAiStatus("");
          removeAiTrack();
        },
        onConnect: ({ conversationId }) => {
          console.log("[ElevenLabs] connected, id:", conversationId);
        },
      });

      conversationRef.current = conversation;

      // The returned Conversation is actually a VoiceConversation instance
      // with public `output` (has context, gain, analyser) and `input` properties
      const voiceConv = conversation as unknown as VoiceConversation;

      if (voiceConv.output) {
        const { context, gain } = voiceConv.output;
        const dest = context.createMediaStreamDestination();
        gain.connect(dest);
        destNodeRef.current = dest;

        const aiStream = dest.stream;
        const aiTrack = aiStream.getAudioTracks()[0];
        if (aiTrack) {
          addAiTrack(aiTrack, aiStream);
        }
        console.log("[ElevenLabs] AI audio track captured for peers");
      } else {
        console.warn("[ElevenLabs] No output available - AI audio won't be shared with peers");
      }

      setAiActive(true);
      setAiStatus("Connected");
    } catch (err) {
      console.error("[ElevenLabs] Failed to start AI:", err);
      setAiStatus("Failed");
      setTimeout(() => setAiStatus(""), 3000);
    }
  }, [addAiTrack, removeAiTrack]);

  const stopAi = useCallback(async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }

    if (destNodeRef.current) {
      destNodeRef.current.disconnect();
      destNodeRef.current = null;
    }

    removeAiTrack();
    setAiActive(false);
    setAiStatus("");
  }, [removeAiTrack]);

  return { aiActive, aiStatus, startAi, stopAi };
}
