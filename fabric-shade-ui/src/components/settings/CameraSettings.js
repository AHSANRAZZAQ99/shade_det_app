import React, { useEffect, useState } from "react";
import { useSettingsSection } from "../../hooks/useSettingsSection";

/* ── static option lists ─────────────────────────────────────── */
const CAMERA_DEVICES = [
  "USB Camera 0",
  "USB Camera 1",
  "IP Camera – RTSP 1",
  "IP Camera – RTSP 2",
  "GigE Vision Camera"
];

const RESOLUTIONS = [
  "3840 × 2160 (4K)",
  "2560 × 1440 (2K)",
  "1920 × 1080 (Full HD)",
  "1280 × 720 (HD)",
  "640 × 480 (SD)"
];

const WHITE_BALANCE_MODES = [
  "Auto",
  "Daylight (6500 K)",
  "Cloudy (7000 K)",
  "Shade (8000 K)",
  "Tungsten (3200 K)",
  "Fluorescent (4200 K)",
  "Manual"
];

const CAPTURE_MODES = ["Continuous", "Trigger"];

/* ── small shared primitives ─────────────────────────────────── */

function Label({ children }) {
  return (
    <span className="w-36 shrink-0 text-sm font-semibold text-[#24416a]">
      {children}
    </span>
  );
}

function Select({ value, onChange, options, id }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full max-w-xs rounded-md border border-[#9ab0c9] bg-white px-2 text-sm text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, unit, id }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-24 rounded-md border border-[#9ab0c9] bg-white px-2 text-center text-sm font-semibold text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
      />
      {unit && <span className="text-xs text-[#5b7a9b]">{unit}</span>}
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, step = 1, unit }) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <div className="flex flex-wrap items-center gap-3 py-1">
      <Label>{label}</Label>
      <div className="flex flex-1 min-w-[200px] items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#c0cfe0] accent-[#4f79ad]"
        />
        <span className="w-14 text-right text-sm font-bold text-[#1d3960]">
          {value}
          {unit && <span className="text-xs font-normal text-[#5b7a9b]"> {unit}</span>}
        </span>
        <span className="hidden text-xs text-[#8aa4be] sm:block">({pct}%)</span>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h4 className="mb-2 mt-5 border-b border-[#b3becc] pb-1 text-[13px] font-bold uppercase tracking-widest text-[#4f79ad]">
      {children}
    </h4>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#4f79ad] ${
        checked ? "border-[#4f79ad] bg-[#4f79ad]" : "border-[#9ab0c9] bg-[#c7d5e4]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/* ── status badge ─────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const styles = {
    idle: "bg-[#dde5ef] text-[#4a6080]",
    running: "bg-emerald-100 text-emerald-700",
    error: "bg-red-100 text-red-600"
  };
  const labels = { idle: "● Idle", running: "● Running", error: "● Error" };
  return (
    <span
      className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

/* ── main component ───────────────────────────────────────────── */
function CameraSettings() {
  const {
    settings,
    isSaving,
    error,
    save,
    reset,
    postAction
  } = useSettingsSection("camera", { pollMs: 5000 });

  const [device, setDevice] = useState(CAMERA_DEVICES[0]);
  const [resolution, setResolution] = useState(RESOLUTIONS[2]);
  const [fps, setFps] = useState(30);
  const [exposure, setExposure] = useState(50);
  const [brightness, setBrightness] = useState(50);
  const [contrast, setContrast] = useState(50);
  const [saturation, setSaturation] = useState(50);
  const [sharpness, setSharpness] = useState(50);
  const [whiteBalance, setWhiteBalance] = useState(WHITE_BALANCE_MODES[0]);
  const [autoFocus, setAutoFocus] = useState(true);
  const [captureMode, setCaptureMode] = useState(CAPTURE_MODES[0]);
  const [cameraStatus, setCameraStatus] = useState("idle");
  const [captureLog, setCaptureLog] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return;
    }

    setDevice(settings.device || CAMERA_DEVICES[0]);
    setResolution(settings.resolution || RESOLUTIONS[2]);
    setFps(Number(settings.fps ?? 30));
    setExposure(Number(settings.exposure ?? 50));
    setBrightness(Number(settings.brightness ?? 50));
    setContrast(Number(settings.contrast ?? 50));
    setSaturation(Number(settings.saturation ?? 50));
    setSharpness(Number(settings.sharpness ?? 50));
    setWhiteBalance(settings.whiteBalance || WHITE_BALANCE_MODES[0]);
    setAutoFocus(Boolean(settings.autoFocus ?? true));
    setCaptureMode(settings.captureMode || CAPTURE_MODES[0]);
    setHydrated(true);
  }, [settings]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    const saveTimer = window.setTimeout(() => {
      save({
        device,
        resolution,
        fps,
        exposure,
        brightness,
        contrast,
        saturation,
        sharpness,
        whiteBalance,
        autoFocus,
        captureMode
      });
    }, 250);

    return () => window.clearTimeout(saveTimer);
  }, [
    hydrated,
    device,
    resolution,
    fps,
    exposure,
    brightness,
    contrast,
    saturation,
    sharpness,
    whiteBalance,
    autoFocus,
    captureMode,
    save
  ]);

  const handleStartCamera = async () => {
    try {
      await postAction("/api/camera/start");
      setCameraStatus("running");
      setCaptureLog("");
    } catch {
      setCameraStatus("error");
      setCaptureLog("Unable to start camera from backend.");
    }
  };

  const handleStopCamera = async () => {
    try {
      await postAction("/api/camera/stop");
      setCameraStatus("idle");
      setCaptureLog("");
    } catch {
      setCameraStatus("error");
      setCaptureLog("Unable to stop camera from backend.");
    }
  };

  const handleTestCapture = async () => {
    try {
      const payload = await postAction("/api/camera/capture");
      const result = payload?.result || {};
      const now = new Date().toLocaleTimeString();
      setCaptureLog(
        `Test frame captured at ${now} — ${resolution} @ ${fps} FPS | ΔE ${Number(result.deltaE ?? 0).toFixed(2)} | Density ${Number(result.density ?? 0).toFixed(2)}`
      );
    } catch {
      setCaptureLog("Unable to capture test frame from backend.");
    }
  };

  const handleReset = async () => {
    const defaults = await reset();

    setDevice(defaults.device || CAMERA_DEVICES[0]);
    setResolution(defaults.resolution || RESOLUTIONS[2]);
    setFps(Number(defaults.fps ?? 30));
    setExposure(Number(defaults.exposure ?? 50));
    setBrightness(Number(defaults.brightness ?? 50));
    setContrast(Number(defaults.contrast ?? 50));
    setSaturation(Number(defaults.saturation ?? 50));
    setSharpness(Number(defaults.sharpness ?? 50));
    setAutoFocus(Boolean(defaults.autoFocus ?? true));
    setWhiteBalance(defaults.whiteBalance || WHITE_BALANCE_MODES[0]);
    setCaptureMode(defaults.captureMode || CAPTURE_MODES[0]);
    setCaptureLog("Settings reset to backend defaults.");
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Camera source ──────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Camera Source</SectionTitle>

        <Row label="Camera Device">
          <Select
            id="cam-device"
            value={device}
            onChange={setDevice}
            options={CAMERA_DEVICES}
          />
          <StatusBadge status={cameraStatus} />
        </Row>

        <Row label="Resolution">
          <Select
            id="cam-res"
            value={resolution}
            onChange={setResolution}
            options={RESOLUTIONS}
          />
        </Row>

        <Row label="Frame Rate (FPS)">
          <NumberInput
            id="cam-fps"
            value={fps}
            onChange={setFps}
            min={1}
            max={240}
            unit="fps"
          />
          <span className="text-xs text-[#7590ac]">Range: 1 – 240</span>
        </Row>

        <Row label="Capture Mode">
          <div className="flex gap-2">
            {CAPTURE_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCaptureMode(m)}
                className={`rounded-md border px-4 py-1.5 text-sm font-semibold transition ${
                  captureMode === m
                    ? "border-[#4f79ad] bg-[#4f79ad] text-white"
                    : "border-[#9ab0c9] bg-white text-[#24416a] hover:bg-[#eaf0f8]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Row>
      </div>

      {/* ── Manual Tuning ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Manual Tuning</SectionTitle>

        <SliderField
          label="Exposure"
          value={exposure}
          onChange={setExposure}
          min={0}
          max={100}
        />
        <SliderField
          label="Brightness"
          value={brightness}
          onChange={setBrightness}
          min={0}
          max={100}
        />
        <SliderField
          label="Contrast"
          value={contrast}
          onChange={setContrast}
          min={0}
          max={100}
        />
        <SliderField
          label="Saturation"
          value={saturation}
          onChange={setSaturation}
          min={0}
          max={100}
        />
        <SliderField
          label="Sharpness"
          value={sharpness}
          onChange={setSharpness}
          min={0}
          max={100}
        />

        <Row label="White Balance">
          <Select
            id="cam-wb"
            value={whiteBalance}
            onChange={setWhiteBalance}
            options={WHITE_BALANCE_MODES}
          />
        </Row>

        <Row label="Auto Focus">
          <Toggle
            checked={autoFocus}
            onChange={setAutoFocus}
            label="Auto Focus"
          />
          <span className="text-sm text-[#5b7a9b]">
            {autoFocus ? "Enabled" : "Disabled — manual focus active"}
          </span>
        </Row>
      </div>

      {/* ── Camera Controls ───────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Camera Controls</SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          {cameraStatus !== "running" ? (
            <button
              type="button"
              onClick={handleStartCamera}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              ▶ Start Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopCamera}
              className="rounded-md bg-red-500 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              ■ Stop Camera
            </button>
          )}

          <button
            type="button"
            onClick={handleTestCapture}
            disabled={cameraStatus !== "running"}
            className="rounded-md border border-[#4f79ad] bg-[#4f79ad] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#3d6394] focus:outline-none focus:ring-2 focus:ring-[#4f79ad] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ◎ Test Capture
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-[#9ab0c9] bg-[#edf2f8] px-5 py-2 text-sm font-semibold text-[#24416a] shadow transition hover:bg-[#dde7f3] focus:outline-none focus:ring-2 focus:ring-[#9ab0c9]"
          >
            ↺ Reset Defaults
          </button>
        </div>

        {captureLog && (
          <div className="mt-3 rounded-md border border-[#b3becc] bg-[#f4f7fb] px-4 py-2 text-xs font-mono text-[#2e4f6e]">
            {captureLog}
          </div>
        )}

        {(error || isSaving) && (
          <div className="mt-2 text-xs font-semibold text-[#4f79ad]">
            {error || "Syncing camera settings with backend..."}
          </div>
        )}
      </div>

    </div>
  );
}

export default CameraSettings;
