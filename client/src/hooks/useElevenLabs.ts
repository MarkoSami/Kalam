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
  const mixCtxRef = useRef<AudioContext | null>(null);
  const mixDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const peerSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(
    new Map()
  );
  const startingRef = useRef(false);

  const startAi = useCallback(async () => {
    // Guard against double-click / multiple activations
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

      // Build a mixed stream: local mic + all peer audio
      // This is what the AI will "hear"
      const mixCtx = new AudioContext();
      await mixCtx.resume();
      mixCtxRef.current = mixCtx;

      const mixDest = mixCtx.createMediaStreamDestination();
      mixDestRef.current = mixDest;

      if (localStream) {
        const localSource = mixCtx.createMediaStreamSource(localStream);
        localSource.connect(mixDest);
      }

      for (const [peerId, peer] of peers) {
        if (peer.stream) {
          const peerSource = mixCtx.createMediaStreamSource(peer.stream);
          peerSource.connect(mixDest);
          peerSourcesRef.current.set(peerId, peerSource);
        }
      }

      const mixedStream = mixDest.stream;

      // Temporarily override getUserMedia so ElevenLabs SDK
      // picks up the mixed stream (all participants) instead of just mic
      const originalGUM =
        navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints && typeof constraints === "object" && constraints.audio) {
          return mixedStream;
        }
        return originalGUM(constraints);
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
          restoreOriginalTrack();
        },
        onConnect: ({ conversationId }) => {
          console.log("[ElevenLabs] connected, id:", conversationId);
        },
      });

      // Restore original getUserMedia immediately
      navigator.mediaDevices.getUserMedia = originalGUM;

      conversationRef.current = conversation;

      // Capture AI audio output and mix it with the local mic
      // into a single track that replaces the outgoing WebRTC track.
      // This way peers hear: mic + AI audio, no renegotiation needed.
      const voiceConv = conversation as unknown as VoiceConversation;
      if (voiceConv.output && localStream) {
        const outCtx = new AudioContext();
        await outCtx.resume();

        const outDest = outCtx.createMediaStreamDestination();

        // Add local mic
        const micSource = outCtx.createMediaStreamSource(localStream);
        micSource.connect(outDest);

        // Add AI audio output
        const { gain } = voiceConv.output;
        // We need to connect the AI gain to our context, but they're in
        // different AudioContexts. Use a MediaStream bridge:
        const aiCaptureDest =
          voiceConv.output.context.createMediaStreamDestination();
        gain.connect(aiCaptureDest);
        const aiSource = outCtx.createMediaStreamSource(aiCaptureDest.stream);
        aiSource.connect(outDest);

        // Replace the outgoing track on all peer connections
        const mixedTrack = outDest.stream.getAudioTracks()[0];
        if (mixedTrack) {
          replaceOutgoingTrack(mixedTrack);
        }

        console.log(
          "[ElevenLabs] AI audio mixed with mic and sent to all peers"
        );
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
  }, [
    aiActive,
    replaceOutgoingTrack,
    restoreOriginalTrack,
    localStream,
    peers,
  ]);

  const updateMix = useCallback(
    (currentPeers: Map<string, PeerState>) => {
      const mixDest = mixDestRef.current;
      const mixCtx = mixCtxRef.current;
      if (!mixDest || !mixCtx || mixCtx.state === "closed") return;

      for (const [peerId, source] of peerSourcesRef.current) {
        if (!currentPeers.has(peerId)) {
          source.disconnect();
          peerSourcesRef.current.delete(peerId);
        }
      }

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

    peerSourcesRef.current.forEach((s) => s.disconnect());
    peerSourcesRef.current.clear();
    mixDestRef.current = null;
    mixCtxRef.current?.close();
    mixCtxRef.current = null;

    restoreOriginalTrack();
    setAiActive(false);
    setAiStatus("");
  }, [restoreOriginalTrack]);

  return { aiActive, aiStatus, startAi, stopAi, updateMix };
}
