import { useCallback, useEffect, useState } from "react";

export type DeviceInfo = {
  deviceId: string;
  label: string;
};

export function useDevices() {
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<DeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");

  const enumerate = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 4)}`,
        }));

      const cams = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
        }));

      const spks = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 4)}`,
        }));

      setMicrophones(mics);
      setCameras(cams);
      setSpeakers(spks);

      // Set defaults if not already set
      if (!selectedMic && mics.length) setSelectedMic(mics[0].deviceId);
      if (!selectedCamera && cams.length) setSelectedCamera(cams[0].deviceId);
      if (!selectedSpeaker && spks.length) setSelectedSpeaker(spks[0].deviceId);
    } catch (err) {
      console.error("[Devices] Failed to enumerate:", err);
    }
  }, [selectedMic, selectedCamera, selectedSpeaker]);

  useEffect(() => {
    enumerate();
    navigator.mediaDevices?.addEventListener("devicechange", enumerate);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", enumerate);
    };
  }, [enumerate]);

  return {
    microphones,
    cameras,
    speakers,
    selectedMic,
    selectedCamera,
    selectedSpeaker,
    setSelectedMic,
    setSelectedCamera,
    setSelectedSpeaker,
  };
}
