import { useCallback, useEffect, useRef, useState } from "react";
import { useSignaling, type SignalingMessage } from "./useSignaling";

export type PeerState = {
  displayName: string;
  stream: MediaStream | null;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(roomId: string, displayName: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const [muted, setMuted] = useState(false);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);

  const connectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const aiSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const joinedRef = useRef(false);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { send, connected } = useSignaling({ onMessage });
  const sendRef = useRef(send);
  sendRef.current = send;

  // Get user media on mount
  useEffect(() => {
    let cancelled = false;

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
          // StrictMode cleanup ran before getUserMedia resolved — discard
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        console.log("[WebRTC] Got mic stream, tracks:", stream.getAudioTracks().map(t => `${t.label} (${t.readyState})`));
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

  // Join room when connected and stream ready (guard against StrictMode double-fire)
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
    const pc = new RTCPeerConnection(ICE_SERVERS);
    connectionsRef.current.set(peerId, pc);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRef.current({
          type: "ice-candidate",
          targetPeerId: peerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setPeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        if (existing) {
          next.set(peerId, { ...existing, stream: remoteStream });
        }
        return next;
      });
    };

    // Handle renegotiation
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.add(peerId);
        const offer = await pc.createOffer();
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

    // Create connections to all existing peers (we are the newcomer, so we offer)
    for (const peer of existingPeers) {
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(peer.peerId, {
          displayName: peer.displayName,
          stream: null,
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
      next.set(peerId, { displayName: name, stream: null });
      return next;
    });

    // Don't create offer — the newcomer will offer to us
  }

  function handlePeerLeft(msg: SignalingMessage) {
    const peerId = msg.peerId as string;

    const pc = connectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      connectionsRef.current.delete(peerId);
    }

    aiSendersRef.current.delete(peerId);

    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }

  async function handleOffer(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const sdp = msg.sdp as RTCSessionDescriptionInit;

    let pc = connectionsRef.current.get(fromPeerId);

    // Polite peer pattern: if we're making an offer too, the lower peerId yields
    const isPolite =
      myPeerIdRef.current != null &&
      myPeerIdRef.current < fromPeerId;

    if (pc && makingOfferRef.current.has(fromPeerId)) {
      if (!isPolite) {
        // We're impolite — ignore their offer
        return;
      }
      // We're polite — rollback our offer
      await pc.setLocalDescription({ type: "rollback" });
    }

    if (!pc) {
      pc = createPeerConnection(fromPeerId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendRef.current({
      type: "answer",
      targetPeerId: fromPeerId,
      sdp: pc.localDescription!.toJSON(),
    });
  }

  async function handleAnswer(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const sdp = msg.sdp as RTCSessionDescriptionInit;

    const pc = connectionsRef.current.get(fromPeerId);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async function handleIceCandidate(msg: SignalingMessage) {
    const fromPeerId = msg.fromPeerId as string;
    const candidate = msg.candidate as RTCIceCandidateInit;

    const pc = connectionsRef.current.get(fromPeerId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
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

  const addAiTrack = useCallback(
    (track: MediaStreamTrack, stream: MediaStream) => {
      connectionsRef.current.forEach((pc, peerId) => {
        const sender = pc.addTrack(track, stream);
        aiSendersRef.current.set(peerId, sender);
      });
    },
    []
  );

  const removeAiTrack = useCallback(() => {
    aiSendersRef.current.forEach((sender, peerId) => {
      const pc = connectionsRef.current.get(peerId);
      if (pc) {
        pc.removeTrack(sender);
      }
    });
    aiSendersRef.current.clear();
  }, []);

  const leave = useCallback(() => {
    sendRef.current({ type: "leave" });
    connectionsRef.current.forEach((pc) => pc.close());
    connectionsRef.current.clear();
    aiSendersRef.current.clear();
    setPeers(new Map());
  }, []);

  return {
    localStream,
    peers,
    muted,
    myPeerId,
    connected,
    toggleMute,
    addAiTrack,
    removeAiTrack,
    leave,
  };
}
