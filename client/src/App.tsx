import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Room } from "@/components/Room";
import { MicTest } from "@/components/MicTest";

function App() {
  const [roomId, setRoomId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inRoom, setInRoom] = useState<{
    roomId: string;
    displayName: string;
  } | null>(null);
  const [showMicTest, setShowMicTest] = useState(false);

  if (inRoom) {
    return (
      <Room
        roomId={inRoom.roomId}
        displayName={inRoom.displayName}
        onLeave={() => setInRoom(null)}
      />
    );
  }

  if (showMicTest) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <MicTest onClose={() => setShowMicTest(false)} />
      </div>
    );
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim() && displayName.trim()) {
      setInRoom({ roomId: roomId.trim(), displayName: displayName.trim() });
    }
  };

  const handleCreateRoom = () => {
    const token = crypto.randomUUID().slice(0, 8);
    setRoomId(token);
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

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateRoom}
            className="shrink-0"
          >
            Generate
          </Button>
        </div>

        <Button type="submit" disabled={!roomId.trim() || !displayName.trim()}>
          Join Room
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setShowMicTest(true)}
        >
          Test Microphone
        </Button>
      </form>
    </div>
  );
}

export default App;
