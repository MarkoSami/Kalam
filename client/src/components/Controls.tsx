import { Mic, MicOff, Bot, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type ControlsProps = {
  muted: boolean;
  aiActive: boolean;
  aiStatus: string;
  onToggleMute: () => void;
  onToggleAi: () => void;
  onLeave: () => void;
};

export function Controls({
  muted,
  aiActive,
  aiStatus,
  onToggleMute,
  onToggleAi,
  onLeave,
}: ControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 p-4">
      <Button
        variant={muted ? "destructive" : "secondary"}
        size="icon-lg"
        onClick={onToggleMute}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>

      <Button
        variant={aiActive ? "default" : "outline"}
        size="lg"
        onClick={onToggleAi}
        disabled={aiStatus === "Connecting..."}
      >
        <Bot className="h-5 w-5 mr-2" />
        {aiActive ? "Remove AI" : aiStatus || "Add AI"}
      </Button>

      <Button variant="destructive" size="icon-lg" onClick={onLeave} title="Leave">
        <PhoneOff className="h-5 w-5" />
      </Button>
    </div>
  );
}
