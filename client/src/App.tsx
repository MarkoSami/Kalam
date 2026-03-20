import { useState, useEffect } from "react";
import { Plus, LogIn, Mic as MicIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Room } from "@/components/Room";
import { MicTest } from "@/components/MicTest";

function parseRoomFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/room\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function App() {
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("kalam-name") || ""
  );
  const [roomIdInput, setRoomIdInput] = useState("");
  const [inRoom, setInRoom] = useState<{
    roomId: string;
    displayName: string;
  } | null>(null);
  const [showMicTest, setShowMicTest] = useState(false);
  const [urlRoomId] = useState(parseRoomFromUrl);

  useEffect(() => {
    if (urlRoomId) setRoomIdInput(urlRoomId);
  }, [urlRoomId]);

  // Remember name
  useEffect(() => {
    if (displayName.trim()) {
      localStorage.setItem("kalam-name", displayName.trim());
    }
  }, [displayName]);

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
      <div className="min-h-screen bg-background">
        <Nav onCreateRoom={handleCreateRoom} displayName={displayName} />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 57px)" }}>
          <MicTest onClose={() => setShowMicTest(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav onCreateRoom={handleCreateRoom} displayName={displayName} />

      <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 57px)" }}>
        <div className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Kalam</h1>
            <p className="text-muted-foreground">Voice chat with AI</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter" && roomIdInput) handleJoinRoom(roomIdInput);
              }}
            />

            {urlRoomId ? (
              <Button
                className="w-full h-11"
                onClick={() => handleJoinRoom(urlRoomId)}
                disabled={!displayName.trim()}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Join Room
              </Button>
            ) : (
              <>
                <Button
                  className="w-full h-11"
                  onClick={handleCreateRoom}
                  disabled={!displayName.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
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
                    <LogIn className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowMicTest(true)}
            className="flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MicIcon className="h-3 w-3" />
            Test microphone
          </button>
        </div>
      </div>
    </div>
  );
}

function Nav({
  onCreateRoom,
  displayName,
}: {
  onCreateRoom: () => void;
  displayName: string;
}) {
  return (
    <nav className="flex items-center justify-between px-4 sm:px-6 h-14 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <a
        href="/"
        className="text-base font-bold tracking-tight hover:opacity-80 transition-opacity"
        onClick={(e) => {
          e.preventDefault();
          window.history.pushState(null, "", "/");
          window.location.reload();
        }}
      >
        Kalam
      </a>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onCreateRoom}
          disabled={!displayName.trim()}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Room</span>
        </Button>
      </div>
    </nav>
  );
}

export default App;
