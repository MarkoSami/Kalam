import { useCallback, useRef, useState } from "react";
import { Conversation, type VoiceConversation } from "@elevenlabs/client";
import type { PeerState } from "./useWebRTC";

type UseElevenLabsOptions = {
  replaceOutgoingTrack: (track: MediaStreamTrack) => void;
  restoreOriginalTrack: () => void;
  broadcastAiStarted: () => void;
  broadcastAiStopped: () => void;
  localStream: MediaStream | null;
  peers: Map<string, PeerState>;
};

export function useElevenLabs({
  replaceOutgoingTrack,
  restoreOriginalTrack,
  broadcastAiStarted,
  broadcastAiStopped,
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

      const conversation = await Conversation.startSession({
        signedUrl,
        onStatusChange: (status) => {
          setAiStatus(status.status);
        },
        onError: (error) => {
          console.error("[ElevenLabs] error:", error);
          setAiStatus("Error");
        },
        onDisconnect: () => {
          setAiActive(false);
          setAiStatus("");
          restoreOriginalTrack();
          broadcastAiStopped();
        },
        onConnect: ({ conversationId }) => {
          console.log("[ElevenLabs] connected, id:", conversationId);
        },
      });

      conversationRef.current = conversation;
      const voiceConv = conversation as unknown as VoiceConversation;

      // Connect peer audio to AI input so it hears everyone
      if (voiceConv.input) {
        const inputCtx = voiceConv.input.context;
        const inputWorklet = voiceConv.input.worklet;

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
      }

      // Mix mic + AI audio into one outgoing track
      if (voiceConv.output && localStream) {
        const outCtx = new AudioContext();
        await outCtx.resume();
        outCtxRef.current = outCtx;

        const outDest = outCtx.createMediaStreamDestination();
        const micSource = outCtx.createMediaStreamSource(localStream);
        micSource.connect(outDest);

        const aiCaptureDest =
          voiceConv.output.context.createMediaStreamDestination();
        voiceConv.output.gain.connect(aiCaptureDest);
        const aiSource = outCtx.createMediaStreamSource(aiCaptureDest.stream);
        aiSource.connect(outDest);

        const mixedTrack = outDest.stream.getAudioTracks()[0];
        if (mixedTrack) {
          replaceOutgoingTrack(mixedTrack);
        }
      }

      setAiActive(true);
      setAiStatus("Connected");
      broadcastAiStarted();
    } catch (err) {
      console.error("[ElevenLabs] Failed to start AI:", err);
      setAiStatus("Failed");
      setTimeout(() => setAiStatus(""), 3000);
    } finally {
      startingRef.current = false;
    }
  }, [
    aiActive,
    replaceOutgoingTrack,
    restoreOriginalTrack,
    broadcastAiStarted,
    broadcastAiStopped,
    localStream,
    peers,
  ]);

  const updateMix = useCallback(
    (currentPeers: Map<string, PeerState>) => {
      const voiceConv = conversationRef.current as unknown as VoiceConversation;
      if (!voiceConv?.input) return;

      const inputCtx = voiceConv.input.context;
      const inputWorklet = voiceConv.input.worklet;

      for (const [peerId, source] of peerSourcesRef.current) {
        if (!currentPeers.has(peerId)) {
          source.disconnect();
          peerSourcesRef.current.delete(peerId);
        }
      }

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
    broadcastAiStopped();
    setAiActive(false);
    setAiStatus("");
  }, [restoreOriginalTrack, broadcastAiStopped]);

  return { aiActive, aiStatus, startAi, stopAi, updateMix };
}
