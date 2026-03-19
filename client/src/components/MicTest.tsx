import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function MicTest({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number>(0);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      streamRef.current = stream;

      // Play back your own voice through speakers
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }

      // Set up level meter
      const context = new AudioContext();
      if (context.state === "suspended") await context.resume();
      contextRef.current = context;

      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Float32Array(analyser.fftSize);

      intervalRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setLevel(Math.min(rms * 10, 1)); // normalize to 0-1
      }, 50);

      setActive(true);
      setError("");
    } catch (err) {
      setError(`Mic error: ${err}`);
    }
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    contextRef.current?.close();
    contextRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setActive(false);
    setLevel(0);
  };

  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 p-8 max-w-sm mx-auto">
      <h2 className="text-xl font-semibold">Mic Test</h2>
      <p className="text-sm text-muted-foreground text-center">
        Test your microphone. You'll hear your own voice played back.
      </p>

      {/* Level meter */}
      <div className="w-full h-8 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-75 rounded-full"
          style={{ width: `${level * 100}%` }}
        />
      </div>

      <p className="text-sm font-mono">
        {active
          ? level > 0.01
            ? "Hearing you!"
            : "Speak into your mic..."
          : "Click Start to test"}
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Hidden audio element for loopback */}
      <audio ref={audioRef} autoPlay playsInline />

      <div className="flex gap-3">
        {!active ? (
          <Button onClick={start}>Start Test</Button>
        ) : (
          <Button variant="secondary" onClick={stop}>
            Stop Test
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Back
        </Button>
      </div>
    </div>
  );
}
