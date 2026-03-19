import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/hooks/useWebRTC";

type ChatProps = {
  messages: ChatMessage[];
  myPeerId: string | null;
  onSend: (text: string) => void;
  onClose: () => void;
};

export function Chat({ messages, myPeerId, onSend, onClose }: ChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col w-80 h-96 border rounded-2xl bg-card shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <span className="text-sm font-medium">Chat</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="rounded-full"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center pt-4">
            No messages yet
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.peerId === myPeerId || msg.peerId === "local";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              {!isMe && (
                <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                  {msg.displayName}
                </span>
              )}
              <div
                className={`px-3 py-1.5 rounded-2xl text-sm max-w-[85%] break-words ${
                  isMe
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-2.5 border-t">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 h-8 rounded-full border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          size="icon-xs"
          disabled={!input.trim()}
          className="rounded-full shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
