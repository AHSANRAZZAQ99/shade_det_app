import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSettingsSection } from "../../hooks/useSettingsSection";

/* ── option constants ─────────────────────────────────────────── */
const MODEL_TYPES = [
  "ShadeNet (Custom CNN)",
  "ResNet-50",
  "MobileNet-V3",
  "EfficientNet-B0",
  "YOLOv8 (Detection)",
  "Custom / External"
];

const MODEL_VERSIONS = {
  "ShadeNet (Custom CNN)": ["ShadeNet_v1", "ShadeNet_v2-beta", "ShadeNet_v2.1"],
  "ResNet-50":             ["ResNet50_shade_v1", "ResNet50_pretrained"],
  "MobileNet-V3":          ["MobileNetV3_shade_v1"],
  "EfficientNet-B0":       ["EfficientNet_shade_v1"],
  "YOLOv8 (Detection)":    ["yolov8n", "yolov8s", "yolov8m"],
  "Custom / External":     ["custom_model"]
};

const INFERENCE_MODES = [
  { id: "realtime",  label: "Real-time",   desc: "Every frame — lowest latency" },
  { id: "interval",  label: "Interval",    desc: "Every N-th frame — balanced" },
  { id: "triggered", label: "Triggered",   desc: "Manual or event-based only" }
];

const DEVICES = ["Auto (best available)", "GPU – CUDA", "GPU – OpenCL", "CPU", "TPU / Edge"];

const PRECISION_MODES = ["FP32 (full)", "FP16 (half)", "INT8 (quantised)"];

const BATCH_SIZES = ["1", "2", "4", "8", "16", "32"];

/* ── shared primitives ────────────────────────────────────────── */
function SectionTitle({ children }) {
  return (
    <h4 className="mb-3 mt-5 border-b border-[#b3becc] pb-1 text-[13px] font-bold uppercase tracking-widest text-[#4f79ad] first:mt-0">
      {children}
    </h4>
  );
}

function Row({ children }) {
  return <div className="flex flex-wrap items-start gap-3 py-1.5">{children}</div>;
}

function Label({ children, sub }) {
  return (
    <div className="w-52 shrink-0">
      <span className="text-sm font-semibold text-[#24416a]">{children}</span>
      {sub && <p className="mt-0.5 text-[11px] leading-tight text-[#6e90b0]">{sub}</p>}
    </div>
  );
}

function Select({ id, value, onChange, options, disabled }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 rounded-md border border-[#9ab0c9] bg-white px-2 text-sm text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
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
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/* ── model status badge ───────────────────────────────────────── */
const STATUS_STYLES = {
  unloaded: { dot: "bg-slate-400",   bar: "bg-slate-300",   text: "text-slate-500",   label: "Not Loaded"  },
  loading:  { dot: "bg-amber-400",   bar: "bg-amber-400",   text: "text-amber-600",   label: "Loading…"    },
  ready:    { dot: "bg-emerald-500", bar: "bg-emerald-500", text: "text-emerald-700", label: "Ready"        },
  error:    { dot: "bg-red-500",     bar: "bg-red-400",     text: "text-red-600",     label: "Load Error"  }
};

function ModelStatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.unloaded;
  return (
    <span className={`flex items-center gap-1.5 rounded-full border border-current/20 bg-white px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot} ${status === "loading" ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}

/* ── confidence slider with live quality label ────────────────── */
function ConfidenceSlider({ value, onChange }) {
  const label =
    value >= 0.9 ? "Ultra-strict"
    : value >= 0.75 ? "High confidence"
    : value >= 0.55 ? "Standard"
    : value >= 0.35 ? "Permissive"
    : "Experimental";

  const color =
    value >= 0.75 ? "accent-emerald-600"
    : value >= 0.5  ? "accent-[#4f79ad]"
    : "accent-amber-500";

  return (
    <Row>
      <Label sub="Minimum score for defect to be accepted by engine">Confidence Threshold</Label>
      <div className="flex flex-1 min-w-[220px] items-center gap-3">
        <input
          type="range"
          min={0.05}
          max={0.99}
          step={0.01}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={`h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#c0cfe0] ${color}`}
        />
        <input
          type="number"
          min={0.05}
          max={0.99}
          step={0.01}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= 0.05 && v <= 0.99) onChange(v);
          }}
          className="h-9 w-20 rounded-md border border-[#9ab0c9] bg-white px-2 text-center text-sm font-bold text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
        />
        <span className="w-28 text-xs text-[#6b89a5]">{label}</span>
      </div>
    </Row>
  );
}

/* ── inference mode cards ─────────────────────────────────────── */
function InferenceModeCards({ value, onChange, intervalN, onIntervalChange }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {INFERENCE_MODES.map(({ id, label, desc }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex flex-1 min-w-[150px] flex-col rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#4f79ad] ${
              value === id
                ? "border-[#4f79ad] bg-[#eef4fc] shadow-md"
                : "border-[#c0cfe0] bg-white hover:bg-[#f4f7fb]"
            }`}
          >
            <span className="text-sm font-bold text-[#1d2f49]">
              {label}
              {value === id && <span className="ml-2 text-xs text-[#4f79ad]">✓</span>}
            </span>
            <span className="mt-0.5 text-[11px] text-[#6b89a5]">{desc}</span>
          </button>
        ))}
      </div>

      {value === "interval" && (
        <div className="flex items-center gap-3 rounded-md border border-[#c4d4e4] bg-[#f0f5fb] px-4 py-2">
          <span className="text-sm text-[#24416a]">Process every</span>
          <input
            type="number"
            min={2}
            max={60}
            value={intervalN}
            onChange={(e) => onIntervalChange(Math.max(2, parseInt(e.target.value, 10) || 2))}
            className="h-8 w-16 rounded-md border border-[#9ab0c9] bg-white px-2 text-center text-sm font-bold text-[#1d2f49] focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
          />
          <span className="text-sm text-[#24416a]">frames</span>
        </div>
      )}
    </div>
  );
}

/* ── main component ───────────────────────────────────────────── */
function ModelSettings() {
  const { apiBaseUrl, settings, isSaving, error, save, reset } = useSettingsSection("model", { pollMs: 4000 });

  const [modelType, setModelType]         = useState(MODEL_TYPES[0]);
  const [modelVersion, setModelVersion]   = useState(MODEL_VERSIONS[MODEL_TYPES[0]][0]);
  const [customModelPath, setCustomModelPath] = useState("");
  const [inferenceMode, setInferenceMode] = useState("realtime");
  const [intervalN, setIntervalN]         = useState(5);
  const [device, setDevice]               = useState(DEVICES[0]);
  const [precision, setPrecision]         = useState(PRECISION_MODES[0]);
  const [batchSize, setBatchSize]         = useState("1");
  const [confidence, setConfidence]       = useState(0.75);
  const [warmupEnabled, setWarmupEnabled] = useState(true);
  const [fallbackToCPU, setFallbackToCPU] = useState(true);
  const [modelStatus, setModelStatus]     = useState("unloaded");
  const [loadLog, setLoadLog]             = useState("");
  const [applyLog, setApplyLog]           = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return;
    }

    const resolvedType = settings.modelType || MODEL_TYPES[0];
    const versions = MODEL_VERSIONS[resolvedType] || ["custom_model"];
    const resolvedVersion = settings.modelVersion && versions.includes(settings.modelVersion)
      ? settings.modelVersion
      : versions[0];

    setModelType(resolvedType);
    setModelVersion(resolvedVersion);
    setCustomModelPath(settings.customModelPath || "");
    setInferenceMode(settings.inferenceMode || "realtime");
    setIntervalN(Number(settings.intervalN ?? 5));
    setDevice(settings.device || DEVICES[0]);
    setPrecision(settings.precision || PRECISION_MODES[0]);
    setBatchSize(String(settings.batchSize || "1"));
    setConfidence(Number(settings.confidence ?? 0.75));
    setWarmupEnabled(Boolean(settings.warmupEnabled ?? true));
    setFallbackToCPU(Boolean(settings.fallbackToCPU ?? true));
    setModelStatus(settings.modelStatus || "unloaded");
    setHydrated(true);
  }, [settings]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      save({
        modelType,
        modelVersion,
        customModelPath,
        inferenceMode,
        intervalN,
        device,
        precision,
        batchSize,
        confidence,
        warmupEnabled,
        fallbackToCPU,
        modelStatus
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    modelType,
    modelVersion,
    customModelPath,
    inferenceMode,
    intervalN,
    device,
    precision,
    batchSize,
    confidence,
    warmupEnabled,
    fallbackToCPU,
    modelStatus,
    save
  ]);

  useEffect(() => {
    let mounted = true;

    const refreshModelStatus = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/model/status`, { timeout: 3500 });
        if (!mounted) {
          return;
        }

        const payload = response.data || {};
        setModelStatus(payload.status || "unloaded");
        if (payload.message) {
          setLoadLog(payload.message);
        }
      } catch {
        if (!mounted) {
          return;
        }
        setLoadLog((current) => current || "Unable to fetch model runtime status from backend.");
      }
    };

    refreshModelStatus();
    const interval = window.setInterval(refreshModelStatus, 3000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [apiBaseUrl]);

  const handleModelTypeChange = (t) => {
    setModelType(t);
    setModelVersion(MODEL_VERSIONS[t][0]);
    setModelStatus("unloaded");
    setLoadLog("");
  };

  const handleLoadModel = async () => {
    setModelStatus("loading");
    setLoadLog("Loading model into memory…");
    try {
      await save({
        modelType,
        modelVersion,
        customModelPath,
        inferenceMode,
        intervalN,
        device,
        precision,
        batchSize,
        confidence,
        warmupEnabled,
        fallbackToCPU,
        modelStatus: "loading"
      });

      const response = await axios.post(`${apiBaseUrl}/api/model/load`, {}, { timeout: 6000 });
      const message = response.data?.message || "Model loaded.";
      setModelStatus(response.data?.status || "ready");
      setLoadLog(message);
    } catch {
      setModelStatus("error");
      setLoadLog("Unable to load model from backend.");
    }
  };

  const handleReloadModel = async () => {
    setModelStatus("loading");
    setLoadLog("Reloading model…");
    try {
      await save({ modelStatus: "loading" });
      const response = await axios.post(`${apiBaseUrl}/api/model/reload`, {}, { timeout: 6000 });
      const message = response.data?.message || "Model reloaded.";
      setModelStatus(response.data?.status || "ready");
      setLoadLog(message);
    } catch {
      setModelStatus("error");
      setLoadLog("Unable to reload model from backend.");
    }
  };

  const handleUnload = async () => {
    try {
      const response = await axios.post(`${apiBaseUrl}/api/model/unload`, {}, { timeout: 5000 });
      setModelStatus(response.data?.status || "unloaded");
      setLoadLog(response.data?.message || "Model unloaded from memory.");
    } catch {
      setModelStatus("error");
      setLoadLog("Unable to unload model from backend.");
    }
  };

  const handleApply = async () => {
    await save({
      modelType,
      modelVersion,
      customModelPath,
      inferenceMode,
      intervalN,
      device,
      precision,
      batchSize,
      confidence,
      warmupEnabled,
      fallbackToCPU,
      modelStatus
    });

    const ts = new Date().toLocaleTimeString();
    setApplyLog(
      `[${ts}] Config saved — ${modelVersion} | ${device} | ${precision} | Confidence: ${confidence.toFixed(2)} | Mode: ${inferenceMode}`
    );
  };

  const handleReset = async () => {
    const defaults = await reset();

    const resolvedType = defaults.modelType || MODEL_TYPES[0];
    const versions = MODEL_VERSIONS[resolvedType] || ["custom_model"];
    setModelType(resolvedType);
    setModelVersion(defaults.modelVersion && versions.includes(defaults.modelVersion) ? defaults.modelVersion : versions[0]);
    setCustomModelPath(defaults.customModelPath || "");
    setInferenceMode(defaults.inferenceMode || "realtime");
    setIntervalN(Number(defaults.intervalN ?? 5));
    setDevice(defaults.device || DEVICES[0]);
    setPrecision(defaults.precision || PRECISION_MODES[0]);
    setBatchSize(String(defaults.batchSize || "1"));
    setConfidence(Number(defaults.confidence ?? 0.75));
    setWarmupEnabled(Boolean(defaults.warmupEnabled ?? true));
    setFallbackToCPU(Boolean(defaults.fallbackToCPU ?? true));
    setModelStatus(defaults.modelStatus || "unloaded");
    setLoadLog("");
    setApplyLog("Settings reset to backend defaults.");
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Model Selection ───────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Model Selection</SectionTitle>

        <Row>
          <Label sub="CNN architecture used for shade detection">Model Type</Label>
          <Select
            id="mod-type"
            value={modelType}
            onChange={handleModelTypeChange}
            options={MODEL_TYPES}
          />
        </Row>

        <Row>
          <Label sub="Specific trained checkpoint to load">Model Version</Label>
          {modelType !== "Custom / External" ? (
            <Select
              id="mod-version"
              value={modelVersion}
              onChange={setModelVersion}
              options={MODEL_VERSIONS[modelType]}
            />
          ) : (
            <div className="flex flex-1 min-w-[260px] flex-col gap-1">
              <input
                type="text"
                value={customModelPath}
                onChange={(e) => setCustomModelPath(e.target.value)}
                placeholder="C:/models/my_model.pt or /models/my_model.onnx"
                spellCheck={false}
                className="h-9 w-full rounded-md border border-[#9ab0c9] bg-white px-3 font-mono text-sm text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
              />
              <p className="text-[11px] text-[#6b89a5]">Supports .pt (PyTorch), .onnx, .tflite</p>
            </div>
          )}
          <ModelStatusBadge status={modelStatus} />
        </Row>
      </div>

      {/* ── Inference Configuration ───────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Inference Configuration</SectionTitle>

        <Row>
          <Label sub="When the model runs relative to the camera feed">Inference Mode</Label>
          <InferenceModeCards
            value={inferenceMode}
            onChange={setInferenceMode}
            intervalN={intervalN}
            onIntervalChange={setIntervalN}
          />
        </Row>

        <ConfidenceSlider value={confidence} onChange={setConfidence} />
      </div>

      {/* ── Hardware ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Hardware</SectionTitle>

        <Row>
          <Label sub="Processing device for inference">Compute Device</Label>
          <Select
            id="mod-device"
            value={device}
            onChange={setDevice}
            options={DEVICES}
          />
        </Row>

        <Row>
          <Label sub="Numeric precision for inference (affects speed vs. accuracy)">Precision Mode</Label>
          <div className="flex flex-wrap gap-2">
            {PRECISION_MODES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrecision(p)}
                className={`rounded-md border px-4 py-1.5 text-sm font-semibold transition ${
                  precision === p
                    ? "border-[#4f79ad] bg-[#4f79ad] text-white"
                    : "border-[#9ab0c9] bg-white text-[#24416a] hover:bg-[#eaf0f8]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Row>

        <Row>
          <Label sub="Frames processed in a single forward pass">Batch Size</Label>
          <div className="flex flex-wrap gap-2">
            {BATCH_SIZES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBatchSize(b)}
                className={`w-12 rounded-md border py-1.5 text-sm font-bold transition ${
                  batchSize === b
                    ? "border-[#4f79ad] bg-[#4f79ad] text-white"
                    : "border-[#9ab0c9] bg-white text-[#24416a] hover:bg-[#eaf0f8]"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          {parseInt(batchSize, 10) > 1 && (
            <span className="self-center text-xs text-[#8aa4be]">
              Higher batch = more VRAM required
            </span>
          )}
        </Row>

        <Row>
          <Label sub="Run warmup pass after loading to avoid first-frame latency spike">Model Warmup</Label>
          <Toggle checked={warmupEnabled} onChange={setWarmupEnabled} label="Model Warmup" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {warmupEnabled ? "Warmup pass enabled" : "Skip warmup (faster load)"}
          </span>
        </Row>

        <Row>
          <Label sub="Automatically fall back to CPU if GPU is unavailable">CPU Fallback</Label>
          <Toggle checked={fallbackToCPU} onChange={setFallbackToCPU} label="CPU Fallback" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {fallbackToCPU ? "Will use CPU if GPU fails" : "Hard GPU requirement"}
          </span>
        </Row>
      </div>

      {/* ── Model Controls ────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Model Controls</SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <ModelStatusBadge status={modelStatus} />

          <button
            type="button"
            onClick={handleLoadModel}
            disabled={modelStatus === "loading"}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ▶ Load Model
          </button>

          <button
            type="button"
            onClick={handleReloadModel}
            disabled={modelStatus === "unloaded" || modelStatus === "loading"}
            className="rounded-md border border-[#4f79ad] bg-[#4f79ad] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#3d6394] focus:outline-none focus:ring-2 focus:ring-[#4f79ad] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↻ Reload Model
          </button>

          <button
            type="button"
            onClick={handleUnload}
            disabled={modelStatus === "unloaded" || modelStatus === "loading"}
            className="rounded-md border border-[#9ab0c9] bg-[#edf2f8] px-5 py-2 text-sm font-semibold text-[#24416a] shadow transition hover:bg-[#dde7f3] focus:outline-none focus:ring-2 focus:ring-[#9ab0c9] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ■ Unload
          </button>
        </div>

        {loadLog && (
          <div className={`mt-3 rounded-md border px-4 py-2 font-mono text-xs ${
            modelStatus === "error"
              ? "border-red-300 bg-red-50 text-red-600"
              : "border-[#b3becc] bg-[#f4f7fb] text-[#2e4f6e]"
          }`}>
            {loadLog}
          </div>
        )}
      </div>

      {/* ── Apply / Reset ─────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Save Configuration</SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleApply}
            className="rounded-md bg-[#4f79ad] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#3d6394] focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
          >
            ✓ Apply Settings
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
            {error || "Syncing model settings with backend..."}
          </div>
        )}
      </div>

    </div>
  );
}

export default ModelSettings;
