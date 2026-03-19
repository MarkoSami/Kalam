import { useCallback, useRef, useState } from "react";
import { Conversation } from "@elevenlabs/client";

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

      // Get signed URL from our server
      const res = await fetch("/api/elevenlabs/signed-url", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to get signed URL");
      }
      const { signedUrl } = await res.json();

      // Start ElevenLabs conversation
      const conversation = await Conversation.startSession({
        signedUrl,
        onStatusChange: (status) => {
          setAiStatus(status.status);
        },
        onError: (error) => {
          console.error("ElevenLabs error:", error);
          setAiStatus("Error");
        },
        onDisconnect: () => {
          setAiActive(false);
          setAiStatus("");
          removeAiTrack();
        },
      });

      conversationRef.current = conversation;

      // Tap into the output gain node to capture AI audio as a MediaStream
      // The Output class exposes: context (AudioContext), gain (GainNode)
      // We create a MediaStreamAudioDestinationNode and connect the gain to it
      // This gives us a MediaStream we can inject into peer connections
      const output = (conversation as unknown as { options: { output: { context: AudioContext; gain: GainNode } } }).options;

      // Access the output through the conversation's internal structure
      // The Conversation extends BaseConversation which has options.output
      // We need to access the AudioContext and GainNode
      // Let's try accessing via getOutputByteFrequencyData which implies analyser exists

      // Alternative approach: capture audio from the audio element
      const audioElement = document.querySelector("audio[data-elevenlabs]") as HTMLAudioElement | null;

      // Best approach: Use Web Audio API to capture from the conversation
      // The @elevenlabs/client creates an Output with public context and gain
      // We access it through the conversation object
      const conv = conversation as unknown as Record<string, unknown>;

      // Try to find the output object in the conversation
      let audioContext: AudioContext | null = null;
      let gainNode: GainNode | null = null;

      // The BaseConversation stores options which includes the Output instance
      // Look for it in the object
      if (conv.options && typeof conv.options === "object") {
        const opts = conv.options as Record<string, unknown>;
        if (opts.output && typeof opts.output === "object") {
          const out = opts.output as { context?: AudioContext; gain?: GainNode };
          audioContext = out.context ?? null;
          gainNode = out.gain ?? null;
        }
      }

      if (audioContext && gainNode) {
        const dest = audioContext.createMediaStreamDestination();
        gainNode.connect(dest);
        destNodeRef.current = dest;

        const aiStream = dest.stream;
        const aiTrack = aiStream.getAudioTracks()[0];
        if (aiTrack) {
          addAiTrack(aiTrack, aiStream);
        }
      } else {
        console.warn(
          "Could not access ElevenLabs audio internals. AI audio won't be shared with peers."
        );
      }

      setAiActive(true);
      setAiStatus("Connected");
    } catch (err) {
      console.error("Failed to start AI:", err);
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
