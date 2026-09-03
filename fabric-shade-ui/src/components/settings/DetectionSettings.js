import React, { useEffect, useState } from "react";
import { useSettingsSection } from "../../hooks/useSettingsSection";

/* ── option constants ─────────────────────────────────────────── */
const ZONE_SENSITIVITY_LEVELS = ["Low", "Medium", "High", "Custom"];

const ALERT_LEVELS = [
  { id: "critical", label: "Critical", desc: "Stop line immediately", color: "bg-red-500", ring: "focus:ring-red-400" },
  { id: "warning",  label: "Warning",  desc: "Flag & continue",      color: "bg-amber-400", ring: "focus:ring-amber-400" },
  { id: "info",     label: "Info",     desc: "Log only",             color: "bg-blue-400",  ring: "focus:ring-blue-400" }
];

const COLOR_SPACES = ["CIE Lab (ΔE)", "BGR", "HSV", "YCrCb"];

/* ── shared primitives (local — same visual language as CameraSettings) ── */
function Label({ children, sub }) {
  return (
    <div className="w-52 shrink-0">
      <span className="text-sm font-semibold text-[#24416a]">{children}</span>
      {sub && <p className="mt-0.5 text-[11px] leading-tight text-[#6e90b0]">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h4 className="mb-3 mt-5 border-b border-[#b3becc] pb-1 text-[13px] font-bold uppercase tracking-widest text-[#4f79ad] first:mt-0">
      {children}
    </h4>
  );
}

function Row({ children }) {
  return (
    <div className="flex flex-wrap items-start gap-3 py-1.5">
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#4f79ad] ${
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

function PrecisionInput({ id, value, onChange, min, max, step, unit, width = "w-24" }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`h-9 ${width} rounded-md border border-[#9ab0c9] bg-white px-2 text-center text-sm font-bold text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad]`}
      />
      {unit && <span className="text-xs text-[#5b7a9b]">{unit}</span>}
    </div>
  );
}

function SliderRow({ label, sub, value, onChange, min, max, step = 0.01, unit, decimals = 2 }) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <Row>
      <Label sub={sub}>{label}</Label>
      <div className="flex flex-1 min-w-[220px] items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#c0cfe0] accent-[#4f79ad]"
        />
        <span className="w-16 text-right text-sm font-bold text-[#1d3960]">
          {value.toFixed(decimals)}
          {unit && <span className="text-[10px] font-normal text-[#5b7a9b]"> {unit}</span>}
        </span>
        <span className="hidden text-xs text-[#8aa4be] sm:block">({pct}%)</span>
      </div>
    </Row>
  );
}

function Select({ id, value, onChange, options }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-[#9ab0c9] bg-white px-2 text-sm text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

/* ── LCR Zone configuration sub-panel ──────────────────────────── */
function LCRPanel({ enabled, zones, sensMap, onZonesChange, onSensitivityMapChange }) {

  const toggleZone = (z) => onZonesChange({ ...zones, [z]: !zones[z] });
  const setSens = (z, v) => onSensitivityMapChange({ ...sensMap, [z]: v });

  if (!enabled) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-[#b0becc] bg-[#f4f7fb] px-4 py-3 text-sm text-[#7a97b3]">
        Enable LCR Detection above to configure individual zone overrides.
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {["Left", "Center", "Right"].map((z) => (
        <div
          key={z}
          className={`rounded-lg border p-3 transition ${
            zones[z] ? "border-[#4f79ad] bg-[#eef4fc]" : "border-[#c0cfe0] bg-[#f4f7fb] opacity-60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#24416a]">{z}</span>
            <Toggle checked={zones[z]} onChange={() => toggleZone(z)} label={`${z} zone`} />
          </div>
          <div className="mt-2">
            <span className="text-[11px] text-[#5b7a9b]">Sensitivity</span>
            <select
              disabled={!zones[z]}
              value={sensMap[z]}
              onChange={(e) => setSens(z, e.target.value)}
              className="mt-1 h-8 w-full rounded border border-[#9ab0c9] bg-white px-1 text-xs text-[#1d2f49] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-[#4f79ad]"
            >
              {ZONE_SENSITIVITY_LEVELS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── engine status badge ─────────────────────────────────────── */
function EngineBadge({ active }) {
  return (
    <span
      className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : "bg-[#dde5ef] text-[#4a6080]"
      }`}
    >
      {active ? "● Engine Active" : "● Engine Stopped"}
    </span>
  );
}

/* ── main component ──────────────────────────────────────────── */
function DetectionSettings() {
  const { settings, isSaving, error, save, reset } = useSettingsSection("detection", { pollMs: 5000 });

  /* core thresholds */
  const [deltaE, setDeltaE]           = useState(3.0);
  const [pixelDensity, setPixelDensity] = useState(0.05);
  const [minDefectArea, setMinDefectArea] = useState(100);
  const [colorSpace, setColorSpace]   = useState(COLOR_SPACES[0]);

  /* zone config */
  const [zoneSensitivity, setZoneSensitivity] = useState("Medium");
  const [lcrEnabled, setLcrEnabled]   = useState(true);
  const [overlayEnabled, setOverlayEnabled] = useState(true);

  /* toggles */
  const [shadeDetection, setShadeDetection] = useState(true);
  const [smoothingEnabled, setSmoothingEnabled] = useState(true);
  const [realtimeMode, setRealtimeMode] = useState(true);

  /* alert */
  const [alertLevel, setAlertLevel]   = useState("warning");
  const [zones, setZones] = useState({ Left: true, Center: true, Right: true });
  const [zoneSensitivityMap, setZoneSensitivityMap] = useState({ Left: "Medium", Center: "High", Right: "Medium" });

  /* engine state */
  const [engineActive, setEngineActive] = useState(false);
  const [applyLog, setApplyLog]         = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return;
    }

    setDeltaE(Number(settings.deltaE ?? 3.0));
    setPixelDensity(Number(settings.pixelDensity ?? 0.05));
    setMinDefectArea(Number(settings.minDefectArea ?? 100));
    setColorSpace(settings.colorSpace || COLOR_SPACES[0]);
    setZoneSensitivity(settings.zoneSensitivity || "Medium");
    setLcrEnabled(Boolean(settings.lcrEnabled ?? true));
    setOverlayEnabled(Boolean(settings.overlayEnabled ?? true));
    setShadeDetection(Boolean(settings.shadeDetection ?? true));
    setSmoothingEnabled(Boolean(settings.smoothingEnabled ?? true));
    setRealtimeMode(Boolean(settings.realtimeMode ?? true));
    setAlertLevel(settings.alertLevel || "warning");
    setEngineActive(Boolean(settings.engineActive ?? false));
    setZones(settings.zones || { Left: true, Center: true, Right: true });
    setZoneSensitivityMap(settings.zoneSensitivityMap || { Left: "Medium", Center: "High", Right: "Medium" });
    setHydrated(true);
  }, [settings]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      save({
        deltaE,
        pixelDensity,
        minDefectArea,
        colorSpace,
        zoneSensitivity,
        lcrEnabled,
        overlayEnabled,
        shadeDetection,
        smoothingEnabled,
        realtimeMode,
        alertLevel,
        engineActive,
        zones,
        zoneSensitivityMap
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    deltaE,
    pixelDensity,
    minDefectArea,
    colorSpace,
    zoneSensitivity,
    lcrEnabled,
    overlayEnabled,
    shadeDetection,
    smoothingEnabled,
    realtimeMode,
    alertLevel,
    engineActive,
    zones,
    zoneSensitivityMap,
    save
  ]);

  const handleApply = async () => {
    const nextEngineActive = shadeDetection;
    setEngineActive(nextEngineActive);
    await save({
      deltaE,
      pixelDensity,
      minDefectArea,
      colorSpace,
      zoneSensitivity,
      lcrEnabled,
      overlayEnabled,
      shadeDetection,
      smoothingEnabled,
      realtimeMode,
      alertLevel,
      engineActive: nextEngineActive,
      zones,
      zoneSensitivityMap
    });

    const ts = new Date().toLocaleTimeString();
    setApplyLog(
      `[${ts}] Config applied — ΔE: ${deltaE.toFixed(2)} | Density: ${pixelDensity.toFixed(3)} | Sensitivity: ${zoneSensitivity} | Alert: ${alertLevel}`
    );
  };

  const handleReset = async () => {
    const defaults = await reset();

    setDeltaE(Number(defaults.deltaE ?? 3.0));
    setPixelDensity(Number(defaults.pixelDensity ?? 0.05));
    setMinDefectArea(Number(defaults.minDefectArea ?? 100));
    setColorSpace(defaults.colorSpace || COLOR_SPACES[0]);
    setZoneSensitivity(defaults.zoneSensitivity || "Medium");
    setLcrEnabled(Boolean(defaults.lcrEnabled ?? true));
    setOverlayEnabled(Boolean(defaults.overlayEnabled ?? true));
    setShadeDetection(Boolean(defaults.shadeDetection ?? true));
    setSmoothingEnabled(Boolean(defaults.smoothingEnabled ?? true));
    setRealtimeMode(Boolean(defaults.realtimeMode ?? true));
    setAlertLevel(defaults.alertLevel || "warning");
    setEngineActive(Boolean(defaults.engineActive ?? false));
    setZones(defaults.zones || { Left: true, Center: true, Right: true });
    setZoneSensitivityMap(defaults.zoneSensitivityMap || { Left: "Medium", Center: "High", Right: "Medium" });
    setApplyLog("Settings reset to backend defaults.");
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Core Thresholds ──────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Core Thresholds</SectionTitle>

        <Row>
          <Label sub="CIE 76 colour difference — lower = stricter">ΔE Threshold</Label>
          <PrecisionInput
            id="det-deltaE"
            value={deltaE}
            onChange={setDeltaE}
            min={0.1}
            max={20}
            step={0.1}
            unit="ΔE"
            width="w-24"
          />
          <input
            type="range"
            min={0.1}
            max={20}
            step={0.1}
            value={deltaE}
            onChange={(e) => setDeltaE(parseFloat(e.target.value))}
            className="h-2 w-36 cursor-pointer appearance-none self-center rounded-full bg-[#c0cfe0] accent-[#4f79ad]"
          />
          <span className="self-center text-xs text-[#7a97b3]">
            {deltaE < 1 ? "Ultra-strict" : deltaE < 3 ? "Strict" : deltaE < 6 ? "Standard" : "Relaxed"}
          </span>
        </Row>

        <SliderRow
          label="Pixel Density Threshold"
          sub="Defect pixel ratio per zone (0.01 – 1.0)"
          value={pixelDensity}
          onChange={setPixelDensity}
          min={0.01}
          max={1.0}
          step={0.005}
          decimals={3}
        />

        <Row>
          <Label sub="Minimum contour area to register as a defect">Min Defect Area</Label>
          <PrecisionInput
            id="det-area"
            value={minDefectArea}
            onChange={setMinDefectArea}
            min={1}
            max={5000}
            step={10}
            unit="px²"
            width="w-24"
          />
        </Row>

        <Row>
          <Label sub="Colour space used by the CV engine">Colour Space</Label>
          <Select
            id="det-cs"
            value={colorSpace}
            onChange={setColorSpace}
            options={COLOR_SPACES}
          />
        </Row>
      </div>

      {/* ── Zone Configuration ───────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Zone Configuration</SectionTitle>

        <Row>
          <Label sub="Global sensitivity applied to all zones">Zone Sensitivity</Label>
          <div className="flex gap-2">
            {ZONE_SENSITIVITY_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setZoneSensitivity(lvl)}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                  zoneSensitivity === lvl
                    ? "border-[#4f79ad] bg-[#4f79ad] text-white"
                    : "border-[#9ab0c9] bg-white text-[#24416a] hover:bg-[#eaf0f8]"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </Row>

        <Row>
          <Label sub="Analyse Left, Center, Right fabric zones independently">Enable LCR Detection</Label>
          <Toggle checked={lcrEnabled} onChange={setLcrEnabled} label="LCR Detection" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {lcrEnabled ? "Active — per-zone analysis ON" : "Disabled — single-zone mode"}
          </span>
        </Row>

        <LCRPanel
          enabled={lcrEnabled}
          zones={zones}
          sensMap={zoneSensitivityMap}
          onZonesChange={setZones}
          onSensitivityMapChange={setZoneSensitivityMap}
        />

        <Row>
          <Label sub="Draw zone boundary overlay on live feed">Enable Zone Overlay</Label>
          <Toggle checked={overlayEnabled} onChange={setOverlayEnabled} label="Zone Overlay" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {overlayEnabled ? "Overlay visible on feed" : "Hidden"}
          </span>
        </Row>
      </div>

      {/* ── Engine Options ────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Engine Options</SectionTitle>

        <Row>
          <Label sub="Master switch for shade variation detection">Enable Shade Detection</Label>
          <Toggle checked={shadeDetection} onChange={setShadeDetection} label="Shade Detection" />
          <span className="self-center text-sm font-semibold text-[#5b7a9b]">
            {shadeDetection ? "Detection ON" : "Detection OFF"}
          </span>
        </Row>

        <Row>
          <Label sub="Temporal smoothing to reduce false positives">Frame Smoothing</Label>
          <Toggle checked={smoothingEnabled} onChange={setSmoothingEnabled} label="Frame Smoothing" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {smoothingEnabled ? "Enabled (3-frame rolling avg)" : "Disabled — per-frame analysis"}
          </span>
        </Row>

        <Row>
          <Label sub="Process every frame; disable for slower triggers">Real-time Mode</Label>
          <Toggle checked={realtimeMode} onChange={setRealtimeMode} label="Real-time Mode" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {realtimeMode ? "Live processing active" : "Batch / manual trigger"}
          </span>
        </Row>
      </div>

      {/* ── Defect Alert Level ────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Defect Alert Level</SectionTitle>
        <p className="mb-3 text-xs text-[#6b89a5]">
          Sets the action taken when a shade defect is confirmed by the CV engine.
        </p>

        <div className="flex flex-wrap gap-3">
          {ALERT_LEVELS.map(({ id, label, desc, color, ring }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAlertLevel(id)}
              className={`flex flex-1 min-w-[140px] items-center gap-3 rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2 ${ring} ${
                alertLevel === id
                  ? "border-[#4f79ad] bg-[#eef4fc] shadow-md"
                  : "border-[#c0cfe0] bg-white hover:bg-[#f4f7fb]"
              }`}
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${color}`} />
              <div>
                <p className="text-sm font-bold text-[#1d2f49]">{label}</p>
                <p className="text-[11px] text-[#6b89a5]">{desc}</p>
              </div>
              {alertLevel === id && (
                <span className="ml-auto text-xs font-bold text-[#4f79ad]">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Apply / Reset ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Detection Engine Controls</SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <EngineBadge active={engineActive} />

          <button
            type="button"
            onClick={handleApply}
            className="rounded-md bg-[#4f79ad] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#3d6394] focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
          >
            ✓ Apply Configuration
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-[#9ab0c9] bg-[#edf2f8] px-5 py-2 text-sm font-semibold text-[#24416a] shadow transition hover:bg-[#dde7f3] focus:outline-none focus:ring-2 focus:ring-[#9ab0c9]"
          >
            ↺ Reset Defaults
          </button>
        </div>

        {applyLog && (
          <div className="mt-3 rounded-md border border-[#b3becc] bg-[#f4f7fb] px-4 py-2 font-mono text-xs text-[#2e4f6e]">
            {applyLog}
          </div>
        )}

        {(error || isSaving) && (
          <div className="mt-2 text-xs font-semibold text-[#4f79ad]">
            {error || "Syncing detection settings with backend..."}
          </div>
        )}
      </div>

    </div>
  );
}

export default DetectionSettings;
