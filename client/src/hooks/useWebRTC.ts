import { useCallback, useEffect, useRef, useState } from "react";
import { useSignaling, type SignalingMessage } from "./useSignaling";
import { playJoinSound, playLeaveSound } from "@/lib/sounds";

export type ChatMessage = {
  id: string;
  peerId: string;
  displayName: string;
  text: string;
  timestamp: number;
};

export type EmojiReaction = {
  id: string;
  emoji: string;
  displayName: string;
};

export type PeerState = {
  displayName: string;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  connectionState: string;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export function useWebRTC(roomId: string, displayName: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const [muted, setMuted] = useState(false);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [aiActiveInRoom, setAiActiveInRoom] = useState(false);
  const [aiActivatedBy, setAiActivatedBy] = useState<string | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([]);
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());

  const connectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const makingOfferRef = useRef<Set<string>>(new Set());
  const joinedRef = useRef(false);
  const roomIdRef = useRef(roomId);
  const displayNameRef = useRef(displayName);
  roomIdRef.current = roomId;
  displayNameRef.current = displayName;

  const onMessage = useCallback((msg: SignalingMessage) => {
    switch (msg.type) {
      case "joined":
        handleJoined(msg);
        break;
      case "peer-joined":
        handlePeerJoined(msg);
        break;
      case "peer-left":
        handlePeerLeft(msg);
        break;
      case "offer":
        handleOffer(msg);
        break;
      case "answer":
        handleAnswer(msg);
        break;
      case "ice-candidate":
        handleIceCandidate(msg);
        break;
      case "ai-started":
        setAiActiveInRoom(true);
        setAiActivatedBy(msg.peerId as string);
        break;
      case "ai-stopped":
        setAiActiveInRoom(false);
        setAiActivatedBy(null);
        break;
      case "chat":
        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            peerId: msg.peerId as string,
            displayName: msg.displayName as string,
            text: msg.text as string,
            timestamp: Date.now(),
          },
        ]);
        break;
      case "emoji":
        {
          const reaction: EmojiReaction = {
            id: crypto.randomUUID(),
            emoji: msg.emoji as string,
            displayName: msg.displayName as string,
          };
          setEmojiReactions((prev) => [...prev, reaction]);
          setTimeout(() => {
            setEmojiReactions((prev) =>
              prev.filter((r) => r.id !== reaction.id)
            );
          }, 3000);
        }
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReconnect = useCallback(() => {
    // Re-join the room after WebSocket reconnects
    console.log("[WebRTC] Reconnecting to room", roomIdRef.current);
    joinedRef.current = false;
    // Close stale connections
    connectionsRef.current.forEach((pc) => pc.close());
    connectionsRef.current.clear();
    setPeers(new Map());
    // Re-join
    sendRef.current({
      type: "join",
      roomId: roomIdRef.current,
      displayName: displayNameRef.current,
    });
  }, []);

  const { send, connected } = useSignaling({ onMessage, onReconnect });
  const sendRef = useRef(send);
  sendRef.current = send;

  // Get user media on mount
  useEffect(() => {
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("getUserMedia not available — HTTPS required");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      })
      .catch((err) => console.error("Failed to get microphone:", err));

    return () => {
      cancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  // Join room when connected and stream ready
  useEffect(() => {
    if (connected && localStream && !joinedRef.current) {
      joinedRef.current = true;
      sendRef.current({ type: "join", roomId, displayName });
    }
  }, [connected, localStream, roomId, displayName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionsRef.current.forEach((pc) => pc.close());
      connectionsRef.current.clear();
    };
  }, []);

  function createPeerConnection(peerId: string): RTCPeerConnection {
    // Close existing connection if any
    const existing = connectionsRef.current.get(peerId);
    if (existing) {
      existing.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    connectionsRef.current.set(peerId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRef.current({
          type: "ice-candidate",
          targetPeerId: peerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const [remoteStream] = event.streams;
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        if (!existing) return next;

        if (track.kind === "video") {
          next.set(peerId, { ...existing, screenStream: remoteStream });
        } else {
          next.set(peerId, { ...existing, stream: remoteStream });
        }
        return next;
      });

      // Clear screen stream when video track ends
      if (track.kind === "video") {
        track.onended = () => {
          setPeers((prev) => {
            const next = new Map(prev);
            const existing = next.get(peerId);
            if (existing) {
              next.set(peerId, { ...existing, screenStream: null });
            }
            return next;
          });
        };
      }
    };

    pc.onconnectionstatechange = () => {
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        if (existing) {
          next.set(peerId, {
            ...existing,
            connectionState: pc.connectionState,
          });
        }
        return next;
      });

      // Auto-cleanup failed connections
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        console.log(`[WebRTC] Peer ${peerId} connection ${pc.connectionState}`);
        connectionsRef.current.delete(peerId);
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.add(peerId);
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        sendRef.current({
          type: "offer",
          targetPeerId: peerId,
          sdp: pc.localDescription!.toJSON(),
        });
      } catch (err) {
        console.error("Renegotiation error:", err);
      } finally {
        makingOfferRef.current.delete(peerId);
      }
    };

    return pc;
  }

  async function handleJoined(msg: SignalingMessage) {
    const peerId = msg.peerId as string;
    const existingPeers = msg.peers as {
      peerId: string;
      displayName: string;
    }[];

    myPeerIdRef.current = peerId;
    setMyPeerId(peerId);

    for (const peer of existingPeers) {
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(peer.peerId, {
          displayName: peer.displayName,
          stream: null,
          screenStream: null,
          connectionState: "new",
        });
        return next;
      });

      const pc = createPeerConnection(peer.peerId);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendRef.current({
          type: "offer",
          targetPeerId: peer.peerId,
          sdp: pc.localDescription!.toJSON(),
        });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    }
  }

  function handlePeerJoined(msg: SignalingMessage) {
    const peerId = msg.peerId as string;
    const name = msg.displayName as string;

    setPeers((prev) => {
      const next = new Map(prev);
      next.set(peerId, {
        displayName: name,
        stream: null,
        connectionState: "new",
        screenStream: null,
      });
      return next;
    });

    playJoinSound();
  }

  function handlePeerLeft(msg: SignalingMessage) {
    const peerId = msg.peerId as string;

    const pc = connectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      connectionsRef.current.delete(peerId);
    }

    playLeaveSound();

    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });

    // If the peer who activated AI left, mark AI as stopped
    if (aiActivatedBy === peerId) {
      setAiActiveInRoom(false);
      setAiActivatedBy(null);
    }
  }

  async function handleOffer(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const sdp = msg.sdp as RTCSessionDescriptionInit;

    let pc = connectionsRef.current.get(fromPeerId);

    const isPolite =
      myPeerIdRef.current != null && myPeerIdRef.current < fromPeerId;

    if (pc && makingOfferRef.current.has(fromPeerId)) {
      if (!isPolite) return;
      await pc.setLocalDescription({ type: "rollback" });
    }

    if (!pc) {
      pc = createPeerConnection(fromPeerId);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendRef.current({
        type: "answer",
        targetPeerId: fromPeerId,
        sdp: pc.localDescription!.toJSON(),
      });
    } catch (err) {
      console.error("Error handling offer:", err);
    }
  }

  async function handleAnswer(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const sdp = msg.sdp as RTCSessionDescriptionInit;

    const pc = connectionsRef.current.get(fromPeerId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error("Error handling answer:", err);
    }
  }

  async function handleIceCandidate(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const candidate = msg.candidate as RTCIceCandidateInit;

    const pc = connectionsRef.current.get(fromPeerId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Ignore ICE candidate errors for stale connections
    }
  }

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setMuted(!track.enabled);
      }
    }
  }, []);

  const replaceOutgoingTrack = useCallback(
    (newTrack: MediaStreamTrack) => {
      connectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      });
    },
    []
  );

  const restoreOriginalTrack = useCallback(() => {
    const originalTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!originalTrack) return;
    connectionsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) {
        sender.replaceTrack(originalTrack);
      }
    });
  }, []);

  const broadcastAiStarted = useCallback(() => {
    if (!myPeerIdRef.current) return;
    sendRef.current({ type: "ai-started", peerId: myPeerIdRef.current });
    setAiActiveInRoom(true);
    setAiActivatedBy(myPeerIdRef.current);
  }, []);

  const broadcastAiStopped = useCallback(() => {
    sendRef.current({ type: "ai-stopped" });
    setAiActiveInRoom(false);
    setAiActivatedBy(null);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      setScreenStream(stream);

      const videoTrack = stream.getVideoTracks()[0];

      // Add screen track to all peer connections
      connectionsRef.current.forEach((pc, peerId) => {
        const sender = pc.addTrack(videoTrack, stream);
        screenSendersRef.current.set(peerId, sender);
      });

      // When user stops sharing via browser UI
      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);

    screenSendersRef.current.forEach((sender, peerId) => {
      const pc = connectionsRef.current.get(peerId);
      if (pc) {
        try {
          pc.removeTrack(sender);
        } catch {
          // ignore
        }
      }
    });
    screenSendersRef.current.clear();
  }, [screenStream]);

  const sendChat = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendRef.current({
        type: "chat",
        displayName: displayNameRef.current,
        text: text.trim(),
      });
      // Add to local messages too
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          peerId: myPeerIdRef.current || "local",
          displayName: displayNameRef.current,
          text: text.trim(),
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  const sendEmoji = useCallback(
    (emoji: string) => {
      sendRef.current({
        type: "emoji",
        displayName: displayNameRef.current,
        emoji,
      });
      // Show locally too
      const reaction: EmojiReaction = {
        id: crypto.randomUUID(),
        emoji,
        displayName: displayNameRef.current,
      };
      setEmojiReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setEmojiReactions((prev) =>
          prev.filter((r) => r.id !== reaction.id)
        );
      }, 3000);
    },
    []
  );

  const leave = useCallback(() => {
    sendRef.current({ type: "leave" });
    connectionsRef.current.forEach((pc) => pc.close());
    connectionsRef.current.clear();
    setPeers(new Map());
    joinedRef.current = false;
  }, []);

  return {
    localStream,
    peers,
    muted,
    myPeerId,
    connected,
    aiActiveInRoom,
    aiActivatedBy,
    screenStream,
    chatMessages,
    emojiReactions,
    toggleMute,
    replaceOutgoingTrack,
    restoreOriginalTrack,
    broadcastAiStarted,
    broadcastAiStopped,
    startScreenShare,
    stopScreenShare,
    sendChat,
    sendEmoji,
    leave,
  };
}
