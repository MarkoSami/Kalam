import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeviceInfo } from "@/hooks/useDevices";

export type VideoQuality = "low" | "medium" | "high" | "hd" | "source";

export const VIDEO_QUALITY_PRESETS: Record<
  VideoQuality,
  { width: number; height: number; frameRate: number; maxBitrate: number; label: string }
> = {
  low: { width: 640, height: 480, frameRate: 15, maxBitrate: 500_000, label: "480p 15fps" },
  medium: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000, label: "720p 30fps" },
  high: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 6_000_000, label: "1080p 30fps" },
  hd: { width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_000_000, label: "1080p 60fps" },
  source: { width: 3840, height: 2160, frameRate: 60, maxBitrate: 15_000_000, label: "4K 60fps" },
};

type DeviceSettingsProps = {
  microphones: DeviceInfo[];
  cameras: DeviceInfo[];
  speakers: DeviceInfo[];
  selectedMic: string;
  selectedCamera: string;
  selectedSpeaker: string;
  cameraQuality: VideoQuality;
  screenQuality: VideoQuality;
  onChangeMic: (deviceId: string) => void;
  onChangeCamera: (deviceId: string) => void;
  onChangeSpeaker: (deviceId: string) => void;
  onChangeCameraQuality: (quality: VideoQuality) => void;
  onChangeScreenQuality: (quality: VideoQuality) => void;
  onClose: () => void;
};

function DeviceSelect({
  label,
  devices,
  selected,
  onChange,
}: {
  label: string;
  devices: DeviceInfo[];
  selected: string;
  onChange: (id: string) => void;
}) {
  if (devices.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function QualitySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: VideoQuality;
  onChange: (q: VideoQuality) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as VideoQuality)}
        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {Object.entries(VIDEO_QUALITY_PRESETS).map(([key, preset]) => (
          <option key={key} value={key}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DeviceSettings({
  microphones,
  cameras,
  speakers,
  selectedMic,
  selectedCamera,
  selectedSpeaker,
  cameraQuality,
  screenQuality,
  onChangeMic,
  onChangeCamera,
  onChangeSpeaker,
  onChangeCameraQuality,
  onChangeScreenQuality,
  onClose,
}: DeviceSettingsProps) {
  return (
    <div className="w-80 border rounded-2xl bg-card shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2.5 border-b sticky top-0 bg-card z-10">
        <div className="flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Settings</span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="rounded-full"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Devices</p>
        <DeviceSelect
          label="Microphone"
          devices={microphones}
          selected={selectedMic}
          onChange={onChangeMic}
        />
        <DeviceSelect
          label="Camera"
          devices={cameras}
          selected={selectedCamera}
          onChange={onChangeCamera}
        />
        <DeviceSelect
          label="Speaker"
          devices={speakers}
          selected={selectedSpeaker}
          onChange={onChangeSpeaker}
        />

        <div className="border-t pt-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Quality</p>
          <div className="space-y-4">
            <QualitySelect
              label="Camera Quality"
              value={cameraQuality}
              onChange={onChangeCameraQuality}
            />
            <QualitySelect
              label="Screen Share Quality"
              value={screenQuality}
              onChange={onChangeScreenQuality}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
