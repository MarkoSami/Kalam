import {
  Mic,
  MicOff,
  Bot,
  PhoneOff,
  BotOff,
  Monitor,
  MonitorOff,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "./EmojiReactions";

type ControlsProps = {
  muted: boolean;
  aiActive: boolean;
  aiActiveInRoom: boolean;
  aiStatus: string;
  isScreenSharing: boolean;
  chatOpen: boolean;
  onToggleMute: () => void;
  onToggleAi: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onSendEmoji: (emoji: string) => void;
  onLeave: () => void;
  unreadCount: number;
};

export function Controls({
  muted,
  aiActive,
  aiActiveInRoom,
  aiStatus,
  isScreenSharing,
  chatOpen,
  onToggleMute,
  onToggleAi,
  onToggleScreenShare,
  onToggleChat,
  onSendEmoji,
  onLeave,
  unreadCount,
}: ControlsProps) {
  const aiDisabled =
    aiStatus === "Connecting..." || (aiActiveInRoom && !aiActive);

  return (
    <div className="flex flex-col items-center gap-2 p-4 pb-6">
      <EmojiPicker onSelect={onSendEmoji} />

      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/80 backdrop-blur-sm border">
        <Button
          variant={muted ? "destructive" : "ghost"}
          size="icon"
          onClick={onToggleMute}
          title={muted ? "Unmute" : "Mute"}
          className="rounded-full"
        >
          {muted ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        {/* Hide screen share on mobile — getDisplayMedia not supported */}
        {"getDisplayMedia" in (navigator.mediaDevices || {}) && (
          <Button
            variant={isScreenSharing ? "default" : "ghost"}
            size="icon"
            onClick={onToggleScreenShare}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
            className="rounded-full"
          >
            {isScreenSharing ? (
              <MonitorOff className="h-4 w-4" />
            ) : (
              <Monitor className="h-4 w-4" />
            )}
          </Button>
        )}

        <Button
          variant={aiActive ? "default" : "ghost"}
          size="sm"
          onClick={onToggleAi}
          disabled={aiDisabled}
          className="rounded-full gap-1.5"
          title={
            aiActiveInRoom && !aiActive
              ? "AI already active in this room"
              : aiActive
              ? "Remove AI"
              : "Add AI to call"
          }
        >
          {aiActive ? (
            <BotOff className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
          <span className="text-xs">
            {aiActive
              ? "Remove AI"
              : aiActiveInRoom
              ? "AI Active"
              : aiStatus || "AI"}
          </span>
        </Button>

        <div className="relative">
          <Button
            variant={chatOpen ? "default" : "ghost"}
            size="icon"
            onClick={onToggleChat}
            title="Chat"
            className="rounded-full"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          {unreadCount > 0 && !chatOpen && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onLeave}
          title="Leave"
          className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
