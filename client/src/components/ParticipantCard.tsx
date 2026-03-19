import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type ParticipantCardProps = {
  displayName: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  level?: number;
};

export function ParticipantCard({
  displayName,
  isLocal,
  isMuted,
  isSpeaking,
  level = 0,
}: ParticipantCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl border bg-card text-card-foreground transition-all duration-150",
        isSpeaking && !isMuted && "border-green-500 ring-2 ring-green-500/30"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-14 h-14 rounded-full bg-muted transition-colors duration-150",
          isSpeaking && !isMuted && "bg-green-500/20"
        )}
      >
        <User
          className={cn(
            "h-7 w-7 text-muted-foreground transition-colors duration-150",
            isSpeaking && !isMuted && "text-green-500"
          )}
        />
      </div>

      {/* Audio level bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-75"
          style={{ width: `${(isMuted ? 0 : level) * 100}%` }}
        />
      </div>

      <span className="text-sm font-medium truncate max-w-[120px]">
        {displayName}
        {isLocal && " (You)"}
      </span>
      {isMuted && (
        <span className="text-xs text-muted-foreground">Muted</span>
      )}
    </div>
  );
}
