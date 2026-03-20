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
    if (chatOpen) setLastReadCount(chatMessages.length);
  }, [chatOpen, chatMessages.length]);

  useEffect(() => {
    if (aiActive) updateMix(peers);
  }, [peers, aiActive, updateMix]);

  const handleLeave = () => {
    stopAi();
    stopScreenShare();
    leave();
    onLeave();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Collect all video feeds
  const activeScreen =
    screenStream ||
    Array.from(peers.values()).find((p) => p.screenStream)?.screenStream ||
    null;

  const videoFeeds: { label: string; stream: MediaStream }[] = [];
  if (cameraStream) {
    videoFeeds.push({ label: `${displayName} (You)`, stream: cameraStream });
  }
  for (const [, peer] of peers) {
    if (peer.videoStream) {
      videoFeeds.push({ label: peer.displayName, stream: peer.videoStream });
    }
  }

  const hasVideo = !!activeScreen || videoFeeds.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background relative">
      <FloatingEmojis reactions={emojiReactions} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b shrink-0">
        <div>
          <h1 className="text-sm sm:text-base font-semibold">{roomId}</h1>
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
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">
        {/* Video area */}
        {hasVideo && (
          <div className="flex-1 flex flex-col gap-2 p-2 sm:p-4 min-h-0">
            {/* Screen share — full width */}
            {activeScreen && (
              <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden min-h-0">
                <VideoElement stream={activeScreen} className="w-full h-full object-contain" />
              </div>
            )}

            {/* Camera feeds grid */}
            {videoFeeds.length > 0 && (
              <div className={`flex gap-2 ${activeScreen ? "h-24 sm:h-32 shrink-0" : "flex-1"} overflow-x-auto`}>
                {videoFeeds.map((feed, i) => (
                  <div
                    key={i}
                    className={`relative bg-black rounded-lg overflow-hidden ${
                      activeScreen
                        ? "w-24 sm:w-40 shrink-0"
                        : "flex-1 min-w-[200px]"
                    }`}
                  >
                    <VideoElement
                      stream={feed.stream}
                      muted={feed.label.includes("(You)")}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 left-2 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded">
                      {feed.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Participants sidebar / main area */}
        <div
          className={`${
            hasVideo ? "w-full sm:w-56 border-t sm:border-t-0 sm:border-l shrink-0" : "flex-1"
          } flex flex-col`}
        >
          <div
            className={`flex-1 flex items-center justify-center p-3 sm:p-4 overflow-y-auto`}
          >
            <div
              className={`flex flex-wrap gap-2 sm:gap-3 justify-center ${
                hasVideo ? "sm:flex-col sm:items-center" : ""
              }`}
            >
              <ParticipantCard
                displayName={displayName}
                isLocal
                isMuted={muted}
                isSpeaking={localSpeaking}
                level={localLevel}
                compact={hasVideo}
              />

              {Array.from(peers.entries()).map(([peerId, peer]) => (
                <PeerAudio key={peerId} peer={peer} compact={hasVideo} />
              ))}

              {aiActiveInRoom && (
                <div
                  className={`flex ${
                    hasVideo ? "items-center gap-2 px-3 py-2 w-full" : "flex-col items-center gap-2 p-4 w-[120px]"
                  } rounded-xl border border-primary/50 bg-card`}
                >
                  <div className={`flex items-center justify-center ${hasVideo ? "w-8 h-8" : "w-10 h-10"} rounded-full bg-primary/10 animate-pulse shrink-0`}>
                    <span className={hasVideo ? "text-base" : "text-xl"}>🤖</span>
                  </div>
                  <span className="text-xs font-medium">AI Agent</span>
                  {aiActive && aiStatus && (
                    <span className="text-[10px] text-muted-foreground">{aiStatus}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="absolute bottom-28 right-2 sm:right-4 z-40">
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
        cameraOn={cameraOn}
        aiActive={aiActive}
        aiActiveInRoom={aiActiveInRoom}
        aiStatus={aiStatus}
        isScreenSharing={!!screenStream}
        chatOpen={chatOpen}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleAi={() => (aiActive ? stopAi() : startAi())}
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
    videoStream: MediaStream | null;
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

function VideoElement({
  stream,
  muted,
  className,
}: {
  stream: MediaStream;
  muted?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}
