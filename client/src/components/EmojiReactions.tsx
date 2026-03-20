import { useMemo, useState } from "react";
import { SmilePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmojiReaction } from "@/hooks/useWebRTC";

const EMOJIS = ["👍", "❤️", "😂", "🔥", "👏", "🎉", "😮", "💀", "🙌", "💯", "😍", "🤔"];

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
};

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="rounded-full"
        title="Send reaction"
      >
        <SmilePlus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-card border shadow-lg animate-in fade-in zoom-in-95 duration-150">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            setOpen(false);
          }}
          className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-base transition-transform hover:scale-125 active:scale-95"
        >
          {emoji}
        </button>
      ))}
      <button
        onClick={() => setOpen(false)}
        className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center ml-0.5"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

type FloatingEmojisProps = {
  reactions: EmojiReaction[];
};

export function FloatingEmojis({ reactions }: FloatingEmojisProps) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {reactions.map((reaction) => (
        <FloatingEmoji key={reaction.id} reaction={reaction} />
      ))}
    </div>
  );
}

function FloatingEmoji({ reaction }: { reaction: EmojiReaction }) {
  const left = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < reaction.id.length; i++) {
      hash = reaction.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return 10 + (Math.abs(hash) % 80);
  }, [reaction.id]);

  return (
    <div
      className="absolute animate-float-up"
      style={{
        left: `${left}%`,
        bottom: "100px",
        willChange: "transform, opacity",
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-4xl drop-shadow-lg">{reaction.emoji}</span>
        <span className="text-[10px] text-foreground/60 font-medium bg-background/80 px-1.5 py-0.5 rounded-full whitespace-nowrap">
          {reaction.displayName}
        </span>
      </div>
    </div>
  );
}
