import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Room } from "@/components/Room";

function App() {
  const [roomId, setRoomId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inRoom, setInRoom] = useState<{
    roomId: string;
    displayName: string;
  } | null>(null);

  if (inRoom) {
    return (
      <Room
        roomId={inRoom.roomId}
        displayName={inRoom.displayName}
        onLeave={() => setInRoom(null)}
      />
    );
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim() && displayName.trim()) {
      setInRoom({ roomId: roomId.trim(), displayName: displayName.trim() });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form
        onSubmit={handleJoin}
        className="flex flex-col gap-4 w-full max-w-sm p-6"
      >
        <h1 className="text-2xl font-bold text-center">Kalam</h1>
        <p className="text-sm text-muted-foreground text-center">
          Voice chat with AI
        </p>

        <input
          type="text"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />

        <input
          type="text"
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />

        <Button type="submit" disabled={!roomId.trim() || !displayName.trim()}>
          Join Room
        </Button>
      </form>
    </div>
  );
}

export default App;
