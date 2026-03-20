import { useMemo } from "react";
import type { EmojiReaction } from "@/hooks/useWebRTC";

const EMOJIS = ["👍", "❤️", "😂", "🔥", "👏", "🎉", "😮", "💀"];

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
};

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className="flex gap-1">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-lg transition-transform hover:scale-125 active:scale-95"
        >
          {emoji}
        </button>
      ))}
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
  // Stable random position based on ID — won't change on re-render
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
