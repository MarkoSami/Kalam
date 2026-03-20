import { useCallback, useEffect, useRef, useState } from "react";
import { useSignaling, type SignalingMessage } from "./useSignaling";
import { playJoinSound, playLeaveSound, playMessageSound } from "@/lib/sounds";

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
  videoStream: MediaStream | null;
  screenStream: MediaStream | null;
  connectionState: string;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: "turn:standard.relay.metered.ca:80",
      username: "b093b4e20fe0f2a4bf62b5e3",
      credential: "uLnpYOz8TYMYCz6H",
    },
    {
      urls: "turn:standard.relay.metered.ca:80?transport=tcp",
      username: "b093b4e20fe0f2a4bf62b5e3",
      credential: "uLnpYOz8TYMYCz6H",
    },
    {
      urls: "turn:standard.relay.metered.ca:443",
      username: "b093b4e20fe0f2a4bf62b5e3",
      credential: "uLnpYOz8TYMYCz6H",
    },
    {
      urls: "turns:standard.relay.metered.ca:443?transport=tcp",
      username: "b093b4e20fe0f2a4bf62b5e3",
      credential: "uLnpYOz8TYMYCz6H",
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTC(roomId: string, displayName: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const [muted, setMuted] = useState(false);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [aiActiveInRoom, setAiActiveInRoom] = useState(false);
  const [aiActivatedBy, setAiActivatedBy] = useState<string | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([]);
  const cameraSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());

  const connectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const makingOfferRef = useRef<Set<string>>(new Set());
  const joinedRef = useRef(false);
  const roomIdRef = useRef(roomId);
  const displayNameRef = useRef(displayName);
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
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
        playMessageSound();
        break;
      case "emoji": {
        const reaction: EmojiReaction = {
          id: crypto.randomUUID(),
          emoji: msg.emoji as string,
          displayName: msg.displayName as string,
        };
        setEmojiReactions((prev) => [...prev, reaction]);
        setTimeout(() => {
          setEmojiReactions((prev) => prev.filter((r) => r.id !== reaction.id));
        }, 3000);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReconnect = useCallback(() => {
    console.log("[WebRTC] Reconnecting to room", roomIdRef.current);
    joinedRef.current = false;
    connectionsRef.current.forEach((pc) => pc.close());
    connectionsRef.current.clear();
    setPeers(new Map());
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
      console.error("[WebRTC] getUserMedia not available — HTTPS required");
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
        console.log("[WebRTC] Got mic stream");
      })
      .catch((err) => console.error("[WebRTC] Failed to get microphone:", err));

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
      console.log("[WebRTC] Joining room", roomId);
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

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE ${peerId}: ${pc.iceConnectionState}`);
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const [remoteStream] = event.streams;
      console.log(`[WebRTC] Got ${track.kind} track from ${peerId}, streamId: ${remoteStream?.id}`);

      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        if (!existing) {
          next.set(peerId, {
            displayName: "Peer",
            stream: track.kind === "audio" ? remoteStream : null,
            videoStream: null,
            screenStream: track.kind === "video" ? remoteStream : null,
            connectionState: pc.connectionState,
          });
        } else if (track.kind === "video") {
          // If peer already has a video stream, this is likely screen share
          // First video = camera, second video = screen share
          if (!existing.videoStream) {
            next.set(peerId, { ...existing, videoStream: remoteStream });
          } else {
            next.set(peerId, { ...existing, screenStream: remoteStream });
          }
        } else {
          next.set(peerId, { ...existing, stream: remoteStream });
        }
        return next;
      });

      if (track.kind === "video") {
        track.onended = () => {
          setPeers((prev) => {
            const next = new Map(prev);
            const existing = next.get(peerId);
            if (!existing) return next;
            // Remove whichever video stream matches
            if (existing.videoStream?.id === remoteStream?.id) {
              next.set(peerId, { ...existing, videoStream: null });
            } else {
              next.set(peerId, { ...existing, screenStream: null });
            }
            return next;
          });
        };
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection ${peerId}: ${pc.connectionState}`);
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

      if (pc.connectionState === "failed") {
        console.log(`[WebRTC] Connection failed, attempting ICE restart for ${peerId}`);
        pc.restartIce();
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
        console.error("[WebRTC] Renegotiation error:", err);
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
    console.log(`[WebRTC] Joined as ${peerId}, ${existingPeers.length} peers in room`);

    for (const peer of existingPeers) {
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(peer.peerId, {
          displayName: peer.displayName,
          stream: null,
          videoStream: null,
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
        console.log(`[WebRTC] Sent offer to ${peer.peerId}`);
      } catch (err) {
        console.error("[WebRTC] Error creating offer:", err);
      }
    }
  }

  function handlePeerJoined(msg: SignalingMessage) {
    const peerId = msg.peerId as string;
    const name = msg.displayName as string;
    console.log(`[WebRTC] Peer joined: ${name} (${peerId})`);

    setPeers((prev) => {
      const next = new Map(prev);
      next.set(peerId, {
        displayName: name,
        stream: null,
        videoStream: null,
        screenStream: null,
        connectionState: "new",
      });
      return next;
    });

    playJoinSound();
  }

  function handlePeerLeft(msg: SignalingMessage) {
    const peerId = msg.peerId as string;
    console.log(`[WebRTC] Peer left: ${peerId}`);

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

    if (aiActivatedBy === peerId) {
      setAiActiveInRoom(false);
      setAiActivatedBy(null);
    }
  }

  async function handleOffer(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const sdp = msg.sdp as RTCSessionDescriptionInit;
    console.log(`[WebRTC] Received offer from ${fromPeerId}`);

    let pc = connectionsRef.current.get(fromPeerId);

    const isPolite =
      myPeerIdRef.current != null && myPeerIdRef.current < fromPeerId;

    if (pc && makingOfferRef.current.has(fromPeerId)) {
      if (!isPolite) {
        console.log(`[WebRTC] Ignoring offer (impolite peer)`);
        return;
      }
      await pc.setLocalDescription({ type: "rollback" });
    }

    if (!pc) {
      pc = createPeerConnection(fromPeerId);
      // Ensure peer is in state
      setPeers((prev) => {
        if (prev.has(fromPeerId)) return prev;
        const next = new Map(prev);
        next.set(fromPeerId, {
          displayName: "Peer",
          stream: null,
          videoStream: null,
          screenStream: null,
          connectionState: "new",
        });
        return next;
      });
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
      console.log(`[WebRTC] Sent answer to ${fromPeerId}`);
    } catch (err) {
      console.error("[WebRTC] Error handling offer:", err);
    }
  }

  async function handleAnswer(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const sdp = msg.sdp as RTCSessionDescriptionInit;

    const pc = connectionsRef.current.get(fromPeerId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log(`[WebRTC] Set answer from ${fromPeerId}`);
    } catch (err) {
      console.error("[WebRTC] Error handling answer:", err);
    }
  }

  async function handleIceCandidate(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const candidate = msg.candidate as RTCIceCandidateInit;

    const pc = connectionsRef.current.get(fromPeerId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore stale ICE candidates
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
        if (sender) sender.replaceTrack(newTrack);
      });
    },
    []
  );

  const restoreOriginalTrack = useCallback(() => {
    const originalTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!originalTrack) return;
    connectionsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) sender.replaceTrack(originalTrack);
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

  const toggleCamera = useCallback(async () => {
    if (cameraOn && cameraStream) {
      // Stop camera
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      setCameraOn(false);

      cameraSendersRef.current.forEach((sender, peerId) => {
        const pc = connectionsRef.current.get(peerId);
        if (pc) {
          try { pc.removeTrack(sender); } catch {}
        }
      });
      cameraSendersRef.current.clear();
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        setCameraStream(stream);
        setCameraOn(true);

        const videoTrack = stream.getVideoTracks()[0];
        connectionsRef.current.forEach((pc, peerId) => {
          const sender = pc.addTrack(videoTrack, stream);
          cameraSendersRef.current.set(peerId, sender);
        });

        videoTrack.onended = () => {
          setCameraStream(null);
          setCameraOn(false);
        };
      } catch (err) {
        console.error("[WebRTC] Camera failed:", err);
      }
    }
  }, [cameraOn, cameraStream]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      setScreenStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      connectionsRef.current.forEach((pc, peerId) => {
        const sender = pc.addTrack(videoTrack, stream);
        screenSendersRef.current.set(peerId, sender);
      });

      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("[WebRTC] Screen share failed:", err);
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

  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return;
    sendRef.current({
      type: "chat",
      displayName: displayNameRef.current,
      text: text.trim(),
    });
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
  }, []);

  const sendEmoji = useCallback((emoji: string) => {
    sendRef.current({
      type: "emoji",
      displayName: displayNameRef.current,
      emoji,
    });
    const reaction: EmojiReaction = {
      id: crypto.randomUUID(),
      emoji,
      displayName: displayNameRef.current,
    };
    setEmojiReactions((prev) => [...prev, reaction]);
    setTimeout(() => {
      setEmojiReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    }, 3000);
  }, []);

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
    cameraStream,
    cameraOn,
    chatMessages,
    emojiReactions,
    toggleMute,
    toggleCamera,
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
