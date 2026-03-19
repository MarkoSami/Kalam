import { useEffect, useRef, useState } from "react";

const THRESHOLD = 0.01;

// Shared AudioContext — created once after user gesture (joining room)
let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

export function useAudioLevel(stream: MediaStream | null) {
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intervalRef = useRef<number>(0);

  useEffect(() => {
    if (!stream) return;

    const tracks = stream.getAudioTracks();
    if (tracks.length === 0 || tracks[0].readyState !== "live") return;

    const ctx = getAudioContext();

    // Resume if suspended (should work since user clicked "Join")
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    // Keep refs to prevent GC
    sourceRef.current = source;
    analyserRef.current = analyser;

    const buf = new Float32Array(analyser.fftSize);

    intervalRef.current = window.setInterval(() => {
      if (ctx.state !== "running") {
        ctx.resume();
        return;
      }
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      setLevel(Math.min(rms * 10, 1));
      setSpeaking(rms > THRESHOLD);
    }, 50);

    return () => {
      clearInterval(intervalRef.current);
      source.disconnect();
      analyser.disconnect();
      sourceRef.current = null;
      analyserRef.current = null;
      setSpeaking(false);
      setLevel(0);
    };
  }, [stream]);

  return { speaking, level };
}
