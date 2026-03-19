import { useEffect, useRef, useState } from "react";
import { Link, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useElevenLabs } from "@/hooks/useElevenLabs";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { Controls } from "./Controls";
import { ParticipantCard } from "./ParticipantCard";
import { Chat } from "./Chat";
import { FloatingEmojis } from "./EmojiReactions";

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
    myPeerId,
    connected,
    aiActiveInRoom,
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
  const [chatOpen, setChatOpen] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);

  const unreadCount = chatOpen ? 0 : chatMessages.length - lastReadCount;

  useEffect(() => {
    if (chatOpen) {
      setLastReadCount(chatMessages.length);
    }
  }, [chatOpen, chatMessages.length]);

  useEffect(() => {
    if (aiActive) {
      updateMix(peers);
    }
  }, [peers, aiActive, updateMix]);

  const handleLeave = () => {
    stopAi();
    stopScreenShare();
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

  // Find any active screen share (local or remote)
  const activeScreen =
    screenStream ||
    Array.from(peers.values()).find((p) => p.screenStream)?.screenStream ||
    null;

  return (
    <div className="flex flex-col h-screen bg-background relative">
      {/* Floating emoji reactions */}
      <FloatingEmojis reactions={emojiReactions} />

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

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Screen share view */}
        {activeScreen && (
          <div className="flex-1 flex items-center justify-center bg-black p-4">
            <ScreenVideo stream={activeScreen} />
          </div>
        )}

        {/* Participants + Chat sidebar */}
        <div
          className={`${
            activeScreen ? "w-64 border-l" : "flex-1"
          } flex flex-col`}
        >
          <div
            className={`flex-1 flex items-center justify-center p-4 ${
              activeScreen ? "overflow-y-auto" : ""
            }`}
          >
            <div
              className={`flex flex-wrap gap-3 justify-center ${
                activeScreen ? "flex-col items-center" : ""
              }`}
            >
              <ParticipantCard
                displayName={displayName}
                isLocal
                isMuted={muted}
                isSpeaking={localSpeaking}
                level={localLevel}
                compact={!!activeScreen}
              />

              {Array.from(peers.entries()).map(([peerId, peer]) => (
                <PeerAudio
                  key={peerId}
                  peer={peer}
                  compact={!!activeScreen}
                />
              ))}

              {aiActiveInRoom && (
                <div
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-primary/50 bg-card ${
                    activeScreen ? "w-full" : "w-[130px]"
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 animate-pulse">
                    <span className="text-xl">🤖</span>
                  </div>
                  <span className="text-xs font-medium">AI Agent</span>
                  {aiActive && aiStatus && (
                    <span className="text-[10px] text-muted-foreground">
                      {aiStatus}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="absolute bottom-24 right-4 z-40">
            <Chat
              messages={chatMessages}
              myPeerId={myPeerId}
              onSend={sendChat}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <Controls
        muted={muted}
        aiActive={aiActive}
        aiActiveInRoom={aiActiveInRoom}
        aiStatus={aiStatus}
        isScreenSharing={!!screenStream}
        chatOpen={chatOpen}
        onToggleMute={toggleMute}
        onToggleAi={handleToggleAi}
        onToggleScreenShare={() =>
          screenStream ? stopScreenShare() : startScreenShare()
        }
        onToggleChat={() => setChatOpen(!chatOpen)}
        onSendEmoji={sendEmoji}
        onLeave={handleLeave}
        unreadCount={unreadCount}
      />
    </div>
  );
}

function PeerAudio({
  peer,
  compact,
}: {
  peer: {
    displayName: string;
    stream: MediaStream | null;
    screenStream: MediaStream | null;
    connectionState: string;
  };
  compact?: boolean;
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
        compact={compact}
      />
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
    </>
  );
}

function ScreenVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="max-w-full max-h-full rounded-lg"
    />
  );
}
