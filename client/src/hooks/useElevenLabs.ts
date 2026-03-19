import { useCallback, useRef, useState } from "react";
import { Conversation, type VoiceConversation } from "@elevenlabs/client";
import type { PeerState } from "./useWebRTC";

type UseElevenLabsOptions = {
  replaceOutgoingTrack: (track: MediaStreamTrack) => void;
  restoreOriginalTrack: () => void;
  localStream: MediaStream | null;
  peers: Map<string, PeerState>;
};

export function useElevenLabs({
  replaceOutgoingTrack,
  restoreOriginalTrack,
  localStream,
  peers,
}: UseElevenLabsOptions) {
  const [aiActive, setAiActive] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>("");
  const conversationRef = useRef<Conversation | null>(null);
  const peerSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(
    new Map()
  );
  const outCtxRef = useRef<AudioContext | null>(null);
  const startingRef = useRef(false);

  const startAi = useCallback(async () => {
    if (startingRef.current || aiActive) return;
    startingRef.current = true;

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

      // Let ElevenLabs use the mic normally — no getUserMedia override
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
          restoreOriginalTrack();
        },
        onConnect: ({ conversationId }) => {
          console.log("[ElevenLabs] connected, id:", conversationId);
        },
      });

      conversationRef.current = conversation;
      const voiceConv = conversation as unknown as VoiceConversation;

      // After session starts, connect peer audio streams to the SDK's
      // input AudioContext so the AI hears all participants
      if (voiceConv.input) {
        const inputCtx = voiceConv.input.context;
        const inputWorklet = voiceConv.input.worklet;

        // Connect each peer's audio stream to the SDK's input worklet
        for (const [peerId, peer] of peers) {
          if (peer.stream) {
            try {
              const source = inputCtx.createMediaStreamSource(peer.stream);
              source.connect(inputWorklet);
              peerSourcesRef.current.set(peerId, source);
            } catch (e) {
              console.warn(`[ElevenLabs] Could not add peer ${peerId}:`, e);
            }
          }
        }
        console.log(
          `[ElevenLabs] Connected ${peerSourcesRef.current.size} peer streams to AI input`
        );
      }

      // Mix mic + AI audio into one outgoing track for peers
      if (voiceConv.output && localStream) {
        const outCtx = new AudioContext();
        await outCtx.resume();
        outCtxRef.current = outCtx;

        const outDest = outCtx.createMediaStreamDestination();

        // Local mic
        const micSource = outCtx.createMediaStreamSource(localStream);
        micSource.connect(outDest);

        // AI audio — bridge from the SDK's output AudioContext
        const aiCaptureDest =
          voiceConv.output.context.createMediaStreamDestination();
        voiceConv.output.gain.connect(aiCaptureDest);
        const aiSource = outCtx.createMediaStreamSource(aiCaptureDest.stream);
        aiSource.connect(outDest);

        const mixedTrack = outDest.stream.getAudioTracks()[0];
        if (mixedTrack) {
          replaceOutgoingTrack(mixedTrack);
          console.log("[ElevenLabs] Outgoing track replaced with mic+AI mix");
        }
      }

      setAiActive(true);
      setAiStatus("Connected");
    } catch (err) {
      console.error("[ElevenLabs] Failed to start AI:", err);
      setAiStatus("Failed");
      setTimeout(() => setAiStatus(""), 3000);
    } finally {
      startingRef.current = false;
    }
  }, [aiActive, replaceOutgoingTrack, restoreOriginalTrack, localStream, peers]);

  const updateMix = useCallback(
    (currentPeers: Map<string, PeerState>) => {
      const voiceConv = conversationRef.current as unknown as VoiceConversation;
      if (!voiceConv?.input) return;

      const inputCtx = voiceConv.input.context;
      const inputWorklet = voiceConv.input.worklet;

      // Remove departed peers
      for (const [peerId, source] of peerSourcesRef.current) {
        if (!currentPeers.has(peerId)) {
          source.disconnect();
          peerSourcesRef.current.delete(peerId);
        }
      }

      // Add new peers
      for (const [peerId, peer] of currentPeers) {
        if (peer.stream && !peerSourcesRef.current.has(peerId)) {
          try {
            const source = inputCtx.createMediaStreamSource(peer.stream);
            source.connect(inputWorklet);
            peerSourcesRef.current.set(peerId, source);
          } catch (e) {
            console.warn(`[ElevenLabs] Could not add peer ${peerId}:`, e);
          }
        }
      }
    },
    []
  );

  const stopAi = useCallback(async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }

    peerSourcesRef.current.forEach((s) => s.disconnect());
    peerSourcesRef.current.clear();
    outCtxRef.current?.close();
    outCtxRef.current = null;

    restoreOriginalTrack();
    setAiActive(false);
    setAiStatus("");
  }, [restoreOriginalTrack]);

  return { aiActive, aiStatus, startAi, stopAi, updateMix };
}
