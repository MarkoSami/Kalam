import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Room } from "@/components/Room";
import { MicTest } from "@/components/MicTest";

function parseRoomFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/room\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function App() {
  const [displayName, setDisplayName] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [inRoom, setInRoom] = useState<{
    roomId: string;
    displayName: string;
  } | null>(null);
  const [showMicTest, setShowMicTest] = useState(false);
  const [urlRoomId] = useState(parseRoomFromUrl);

  // Pre-fill room ID from URL
  useEffect(() => {
    if (urlRoomId) {
      setRoomIdInput(urlRoomId);
    }
  }, [urlRoomId]);

  const handleJoinRoom = (roomId: string) => {
    if (!displayName.trim()) return;
    const id = roomId.trim();
    if (!id) return;
    window.history.pushState(null, "", `/room/${id}`);
    setInRoom({ roomId: id, displayName: displayName.trim() });
  };

  const handleCreateRoom = () => {
    const token = crypto.randomUUID().slice(0, 8);
    setRoomIdInput(token);
    if (displayName.trim()) {
      handleJoinRoom(token);
    }
  };

  const handleLeave = () => {
    setInRoom(null);
    window.history.pushState(null, "", "/");
  };

  if (inRoom) {
    return (
      <Room
        roomId={inRoom.roomId}
        displayName={inRoom.displayName}
        onLeave={handleLeave}
      />
    );
  }

  if (showMicTest) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <MicTest onClose={() => setShowMicTest(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Kalam</h1>
          <p className="text-muted-foreground">
            Voice chat with AI
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter" && roomIdInput) {
                handleJoinRoom(roomIdInput);
              }
            }}
          />

          {urlRoomId ? (
            // Direct room link — just show join button
            <Button
              className="w-full h-11"
              onClick={() => handleJoinRoom(urlRoomId)}
              disabled={!displayName.trim()}
            >
              Join Room
            </Button>
          ) : (
            // Full lobby — create or join
            <>
              <Button
                className="w-full h-11"
                onClick={handleCreateRoom}
                disabled={!displayName.trim()}
              >
                Create Room
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    or join existing
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Room ID"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoinRoom(roomIdInput);
                  }}
                />
                <Button
                  variant="secondary"
                  className="h-11 shrink-0"
                  onClick={() => handleJoinRoom(roomIdInput)}
                  disabled={!displayName.trim() || !roomIdInput.trim()}
                >
                  Join
                </Button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setShowMicTest(true)}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Test microphone
        </button>
      </div>
    </div>
  );
}

export default App;
