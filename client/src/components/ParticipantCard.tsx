import { cn } from "@/lib/utils";

type ParticipantCardProps = {
  displayName: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  level?: number;
  connectionState?: string;
  compact?: boolean;
  handRaised?: boolean;
};

const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ParticipantCard({
  displayName,
  isLocal,
  isMuted,
  isSpeaking,
  level = 0,
  connectionState,
  compact,
  handRaised,
}: ParticipantCardProps) {
  const isConnecting =
    connectionState === "new" || connectionState === "connecting";
  const isDisconnected =
    connectionState === "disconnected" || connectionState === "failed";

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-card w-full transition-all duration-150",
          isSpeaking && !isMuted && "border-green-500 ring-1 ring-green-500/25",
          isDisconnected && "opacity-50"
        )}
      >
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-white font-medium text-xs",
              getColor(displayName)
            )}
          >
            {getInitials(displayName)}
          </div>
          {handRaised && (
            <span className="absolute -top-1 -right-1 text-sm animate-bounce">✋</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium truncate block">
            {displayName}
            {isLocal && " (You)"}
          </span>
          <div className="w-full h-0.5 bg-muted rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-75"
              style={{ width: `${(isMuted ? 0 : level) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2.5 p-5 rounded-2xl border bg-card text-card-foreground transition-all duration-150 w-[130px]",
        isSpeaking && !isMuted && "border-green-500 ring-2 ring-green-500/25",
        isDisconnected && "opacity-50"
      )}
    >
      <div className="relative">
        <div
          className={cn(
            "flex items-center justify-center w-14 h-14 rounded-full text-white font-semibold text-lg transition-all duration-150",
            getColor(displayName),
            isSpeaking && !isMuted && "scale-110"
          )}
        >
          {getInitials(displayName)}
        </div>
        {handRaised && (
          <span className="absolute -top-2 -right-2 text-xl animate-bounce">✋</span>
        )}
      </div>

      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-75"
          style={{ width: `${(isMuted ? 0 : level) * 100}%` }}
        />
      </div>

      <span className="text-sm font-medium truncate w-full text-center">
        {displayName}
        {isLocal && " (You)"}
      </span>

      {isMuted && (
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Muted
        </span>
      )}

      {isConnecting && !isLocal && (
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Connecting...
        </span>
      )}
    </div>
  );
}
