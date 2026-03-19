import { useEffect, useRef, useState } from "react";
import { Link, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    aiActiveInRoom,
    toggleMute,
    replaceOutgoingTrack,
    restoreOriginalTrack,
    broadcastAiStarted,
    broadcastAiStopped,
    leave,
  } = useWebRTC(roomId, displayName);

  const { aiActive, aiStatus, startAi, stopAi, updateMix } = useElevenLabs({
    replaceOutgoingTrack,
    restoreOriginalTrack,
    broadcastAiStarted,
    broadcastAiStopped,
    localStream,
    peers,
  });

  const { speaking: localSpeaking, level: localLevel } =
    useAudioLevel(localStream);

  const [copied, setCopied] = useState(false);

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

  const handleCopyLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div>
          <h1 className="text-base font-semibold">{roomId}</h1>
          <p className="text-xs text-muted-foreground">
            {connected
              ? `${peers.size + 1} participant${peers.size > 0 ? "s" : ""}`
              : "Connecting..."}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyLink}
          className="gap-1.5 text-xs text-muted-foreground"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Link className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>

      {/* Participants */}
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

          {aiActiveInRoom && (
            <div className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border border-primary/50 bg-card text-card-foreground w-[130px]">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 animate-pulse">
                <span className="text-2xl">🤖</span>
              </div>
              <div className="w-full h-1 bg-primary/20 rounded-full" />
              <span className="text-sm font-medium">AI Agent</span>
              {aiActive && aiStatus && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {aiStatus}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <Controls
        muted={muted}
        aiActive={aiActive}
        aiActiveInRoom={aiActiveInRoom}
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
  peer: { displayName: string; stream: MediaStream | null; connectionState: string };
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
        connectionState={peer.connectionState}
      />
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
    </>
  );
}
