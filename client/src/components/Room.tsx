import { useEffect, useRef } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useElevenLabs } from "@/hooks/useElevenLabs";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { Controls } from "./Controls";
import { ParticipantCard } from "./ParticipantCard";

type RoomProps = {
  roomId: string;
  displayName: string;
  onLeave: () => void;
};

export function Room({ roomId, displayName, onLeave }: RoomProps) {
  const {
    localStream,
    peers,
    muted,
    connected,
    toggleMute,
    addAiTrack,
    removeAiTrack,
    leave,
  } = useWebRTC(roomId, displayName);

  const { aiActive, aiStatus, startAi, stopAi, updateMix } = useElevenLabs({
    addAiTrack,
    removeAiTrack,
    localStream,
    peers,
  });

  const { speaking: localSpeaking, level: localLevel } =
    useAudioLevel(localStream);

  // Update AI audio mix when peers change
  useEffect(() => {
    if (aiActive) {
      updateMix(peers);
    }
  }, [peers, aiActive, updateMix]);

  const handleLeave = () => {
    stopAi();
    leave();
    onLeave();
  };

  const handleToggleAi = () => {
    if (aiActive) {
      stopAi();
    } else {
      startAi();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">Room: {roomId}</h1>
          <p className="text-sm text-muted-foreground">
            {connected ? `${peers.size + 1} participant(s)` : "Connecting..."}
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-wrap gap-4 justify-center">
          <ParticipantCard
            displayName={displayName}
            isLocal
            isMuted={muted}
            isSpeaking={localSpeaking}
            level={localLevel}
          />

          {Array.from(peers.entries()).map(([peerId, peer]) => (
            <PeerAudio key={peerId} peer={peer} />
          ))}

          {aiActive && (
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card text-card-foreground border-primary">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                <span className="text-2xl">🤖</span>
              </div>
              <span className="text-sm font-medium">AI Agent</span>
              <span className="text-xs text-muted-foreground">{aiStatus}</span>
            </div>
          )}
        </div>
      </div>

      <Controls
        muted={muted}
        aiActive={aiActive}
        aiStatus={aiStatus}
        onToggleMute={toggleMute}
        onToggleAi={handleToggleAi}
        onLeave={handleLeave}
      />
    </div>
  );
}

function PeerAudio({
  peer,
}: {
  peer: { displayName: string; stream: MediaStream | null };
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { speaking, level } = useAudioLevel(peer.stream);

  useEffect(() => {
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <>
      <ParticipantCard
        displayName={peer.displayName}
        isSpeaking={speaking}
        level={level}
      />
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
    </>
  );
}
