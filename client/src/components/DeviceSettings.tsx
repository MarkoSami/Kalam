import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeviceInfo } from "@/hooks/useDevices";

type DeviceSettingsProps = {
  microphones: DeviceInfo[];
  cameras: DeviceInfo[];
  speakers: DeviceInfo[];
  selectedMic: string;
  selectedCamera: string;
  selectedSpeaker: string;
  onChangeMic: (deviceId: string) => void;
  onChangeCamera: (deviceId: string) => void;
  onChangeSpeaker: (deviceId: string) => void;
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

export function DeviceSettings({
  microphones,
  cameras,
  speakers,
  selectedMic,
  selectedCamera,
  selectedSpeaker,
  onChangeMic,
  onChangeCamera,
  onChangeSpeaker,
  onClose,
}: DeviceSettingsProps) {
  return (
    <div className="w-80 border rounded-2xl bg-card shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Device Settings</span>
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
      </div>
    </div>
  );
}
