import { Mic, MicOff, Bot, PhoneOff, BotOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type ControlsProps = {
  muted: boolean;
  aiActive: boolean;
  aiActiveInRoom: boolean;
  aiStatus: string;
  onToggleMute: () => void;
  onToggleAi: () => void;
  onLeave: () => void;
};

export function Controls({
  muted,
  aiActive,
  aiActiveInRoom,
  aiStatus,
  onToggleMute,
  onToggleAi,
  onLeave,
}: ControlsProps) {
  const aiDisabled =
    aiStatus === "Connecting..." || (aiActiveInRoom && !aiActive);

  return (
    <div className="flex justify-center p-4 pb-6">
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
