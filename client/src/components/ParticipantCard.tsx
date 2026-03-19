import { User } from "lucide-react";

type ParticipantCardProps = {
  displayName: string;
  isLocal?: boolean;
  isMuted?: boolean;
};

export function ParticipantCard({
  displayName,
  isLocal,
  isMuted,
}: ParticipantCardProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card text-card-foreground">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted">
        <User className="h-7 w-7 text-muted-foreground" />
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
