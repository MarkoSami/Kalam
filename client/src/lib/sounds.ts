let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  freq1: number,
  freq2: number,
  duration: number,
  delay: number
) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration + delay + 0.1);

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq1, now);
  osc1.connect(gain);
  osc1.start(now);
  osc1.stop(now + duration);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq2, now + delay);
  osc2.connect(gain);
  osc2.start(now + delay);
  osc2.stop(now + delay + duration);
}

/** Rising two-tone chime */
export function playJoinSound() {
  playTone(523, 659, 0.12, 0.13); // C5 → E5
}

/** Falling two-tone chime */
export function playLeaveSound() {
  playTone(659, 440, 0.12, 0.13); // E5 → A4
}

/** Short pop for chat message */
export function playMessageSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.1);
}
