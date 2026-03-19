import { useCallback, useRef, useState } from "react";
import { Conversation, type VoiceConversation } from "@elevenlabs/client";
import type { PeerState } from "./useWebRTC";

type UseElevenLabsOptions = {
  addAiTrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  removeAiTrack: () => void;
  localStream: MediaStream | null;
  peers: Map<string, PeerState>;
};

export function useElevenLabs({
  addAiTrack,
  removeAiTrack,
  localStream,
  peers,
}: UseElevenLabsOptions) {
  const [aiActive, setAiActive] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>("");
  const conversationRef = useRef<Conversation | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mixCtxRef = useRef<AudioContext | null>(null);
  const mixDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const peerSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(
    new Map()
  );

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

      // Create a mixed audio stream: local mic + all peer streams
      const mixCtx = new AudioContext();
      await mixCtx.resume();
      mixCtxRef.current = mixCtx;

      const mixDest = mixCtx.createMediaStreamDestination();
      mixDestRef.current = mixDest;

      // Add local mic to mix
      if (localStream) {
        const localSource = mixCtx.createMediaStreamSource(localStream);
        localSource.connect(mixDest);
      }

      // Add all peer streams to mix
      for (const [peerId, peer] of peers) {
        if (peer.stream) {
          const peerSource = mixCtx.createMediaStreamSource(peer.stream);
          peerSource.connect(mixDest);
          peerSourcesRef.current.set(peerId, peerSource);
        }
      }

      const mixedStream = mixDest.stream;

      // Temporarily override getUserMedia so ElevenLabs SDK
      // picks up our mixed stream instead of just the mic
      const originalGetUserMedia =
        navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

      navigator.mediaDevices.getUserMedia = async (constraints) => {
        // Only intercept audio requests (let video pass through)
        if (constraints && typeof constraints === "object" && constraints.audio) {
          return mixedStream;
        }
        return originalGetUserMedia(constraints);
      };

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

      // Restore original getUserMedia
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;

      conversationRef.current = conversation;

      // Capture AI audio output for peers
      const voiceConv = conversation as unknown as VoiceConversation;
      if (voiceConv.output) {
        const { context, gain } = voiceConv.output;
        const dest = context.createMediaStreamDestination();
        gain.connect(dest);
        destNodeRef.current = dest;

        const aiTrack = dest.stream.getAudioTracks()[0];
        if (aiTrack) {
          addAiTrack(aiTrack, dest.stream);
        }
        console.log("[ElevenLabs] AI audio track captured for peers");
      }

      setAiActive(true);
      setAiStatus("Connected");
    } catch (err) {
      console.error("[ElevenLabs] Failed to start AI:", err);
      setAiStatus("Failed");
      setTimeout(() => setAiStatus(""), 3000);
    }
  }, [addAiTrack, removeAiTrack, localStream, peers]);

  // Update mix when peers change (call from Room when peers update)
  const updateMix = useCallback(
    (currentPeers: Map<string, PeerState>) => {
      const mixDest = mixDestRef.current;
      const mixCtx = mixCtxRef.current;
      if (!mixDest || !mixCtx || mixCtx.state === "closed") return;

      // Remove old peer sources that are no longer present
      for (const [peerId, source] of peerSourcesRef.current) {
        if (!currentPeers.has(peerId)) {
          source.disconnect();
          peerSourcesRef.current.delete(peerId);
        }
      }

      // Add new peer sources
      for (const [peerId, peer] of currentPeers) {
        if (peer.stream && !peerSourcesRef.current.has(peerId)) {
          const source = mixCtx.createMediaStreamSource(peer.stream);
          source.connect(mixDest);
          peerSourcesRef.current.set(peerId, source);
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

    if (destNodeRef.current) {
      destNodeRef.current.disconnect();
      destNodeRef.current = null;
    }

    // Clean up mixer
    peerSourcesRef.current.forEach((s) => s.disconnect());
    peerSourcesRef.current.clear();
    mixDestRef.current = null;
    mixCtxRef.current?.close();
    mixCtxRef.current = null;

    removeAiTrack();
    setAiActive(false);
    setAiStatus("");
  }, [removeAiTrack]);

  return { aiActive, aiStatus, startAi, stopAi, updateMix };
}
