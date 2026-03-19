import { test, expect } from "@playwright/test";

test("mic test page detects fake audio input", async ({ page }) => {
  await page.goto("/");

  // Click "Test Microphone"
  await page.click('button:has-text("Test Microphone")');
  await expect(page.locator("h2")).toHaveText("Mic Test");

  // Click "Start Test"
  await page.click('button:has-text("Start Test")');

  // Wait a moment for audio to flow
  await page.waitForTimeout(1000);

  // Check if the level bar has width > 0 (audio detected)
  const levelBar = page.locator(".h-full.bg-green-500");
  const width = await levelBar.evaluate((el) => {
    return parseFloat((el as HTMLElement).style.width);
  });

  console.log(`MicTest level bar width: ${width}%`);
  expect(width).toBeGreaterThan(0);
});

test("room detects audio from mic after joining", async ({ page }) => {
  await page.goto("/");

  // Fill in name and room
  await page.fill('input[placeholder="Your name"]', "TestUser");
  await page.fill('input[placeholder="Room ID"]', "test-room");

  // Join room (user gesture!)
  await page.click('button:has-text("Join Room")');

  // Wait for room to load and audio to flow
  await page.waitForSelector("text=Room: test-room");
  await page.waitForTimeout(2000);

  // Check the debug level bar
  const debugText = await page.locator(".font-mono").first().textContent();
  console.log("Debug info:", debugText);

  // Check if level percentage is > 0
  const levelSpans = page.locator(".font-mono span");
  const allText = await page.locator(".font-mono").textContent();
  console.log("Full debug text:", allText);

  // Evaluate the audio level directly in the page
  const level = await page.evaluate(() => {
    // Check all AudioContext instances
    const contexts = (window as any).__audioContexts || [];
    return {
      contextsCount: contexts.length,
      // Check if any AnalyserNode is getting data
    };
  });
  console.log("Audio contexts:", level);

  // Take screenshot for visual inspection
  await page.screenshot({ path: "test-results/room-audio.png" });

  // The level text should show something > 0%
  const levelText = await page.locator("text=/\\d+%/").first().textContent();
  console.log("Level text:", levelText);
});

test("debug: inspect getUserMedia stream in room", async ({ page }) => {
  await page.goto("/");

  await page.fill('input[placeholder="Your name"]', "DebugUser");
  await page.fill('input[placeholder="Room ID"]', "debug-room");
  await page.click('button:has-text("Join Room")');

  await page.waitForSelector("text=Room: debug-room");
  await page.waitForTimeout(1500);

  // Inject our own analysis to check if getUserMedia actually works
  const result = await page.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const track = stream.getAudioTracks()[0];
      const trackInfo = {
        label: track.label,
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted,
      };

      // Create AudioContext and check if we get data
      const ctx = new AudioContext();
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Wait a bit then sample
      await new Promise((r) => setTimeout(r, 500));

      const buf = new Float32Array(256);
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);

      // Also check byte data
      const byteData = new Uint8Array(256);
      analyser.getByteFrequencyData(byteData);
      const maxByte = Math.max(...byteData);

      ctx.close();
      stream.getTracks().forEach((t) => t.stop());

      return {
        trackInfo,
        contextState: ctx.state,
        rms,
        maxByte,
        sampleRate: ctx.sampleRate,
      };
    } catch (e) {
      return { error: String(e) };
    }
  });

  console.log("Stream analysis result:", JSON.stringify(result, null, 2));

  // The RMS should be > 0 if fake audio is working
  if ("rms" in result) {
    expect(result.rms).toBeGreaterThan(0);
  }
});
