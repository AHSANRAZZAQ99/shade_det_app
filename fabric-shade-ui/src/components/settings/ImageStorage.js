import React, { useEffect, useState } from "react";
import { useSettingsSection } from "../../hooks/useSettingsSection";

/* ── option constants ─────────────────────────────────────────── */
const RETENTION_OPTIONS = ["7 days", "14 days", "30 days", "60 days", "90 days", "180 days", "1 year", "Never"];
const IMAGE_FORMATS     = ["JPEG", "PNG", "BMP", "TIFF"];
const COMPRESSION_LEVELS = ["Low (best quality)", "Medium", "High (smallest size)"];
const DEFECT_SUBFOLDER_OPTIONS = ["By Date", "By Defect Type", "By Camera", "Flat (no subfolders)"];

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

/* ── today's folder preview (read-only, mimics backend logic) ─── */
function DailyFolderPreview({ basePath, enabled }) {
  const today = new Date();
  const yr  = today.getFullYear();
  const mo  = String(today.getMonth() + 1).padStart(2, "0");
  const dy  = String(today.getDate()).padStart(2, "0");
  const folderName = `${yr}-${mo}-${dy}`;
  const fullPath   = basePath.replace(/\\/g, "/").replace(/\/$/, "") + "/" + folderName + "/";

  if (!enabled) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-[#b0becc] bg-[#f4f7fb] px-4 py-2 text-sm text-[#7a97b3]">
        Daily folder creation is disabled — images will be saved directly to the base path.
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-[#c4d4e4] bg-[#f0f5fb] px-4 py-2">
      <span className="text-lg">📁</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4f79ad]">
          Today's folder (created by backend)
        </p>
        <p className="font-mono text-sm text-[#1d3960]">{fullPath}</p>
      </div>
    </div>
  );
}

/* ── storage usage mock bar ───────────────────────────────────── */
function StorageBar({ usedGB = 14.3, totalGB = 50 }) {
  const pct = Math.min(100, Math.round((usedGB / totalGB) * 100));
  const color = pct > 85 ? "bg-red-500" : pct > 65 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="mt-1">
      <div className="mb-1 flex justify-between text-xs text-[#5b7a9b]">
        <span>{usedGB} GB used</span>
        <span>{totalGB - usedGB} GB free / {totalGB} GB total</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#d0dcea]">
        <div
          style={{ width: `${pct}%` }}
          className={`h-full rounded-full transition-all ${color}`}
        />
      </div>
      <p className="mt-0.5 text-right text-[11px] text-[#7a97b3]">{pct}% used</p>
    </div>
  );
}

/* ── main component ───────────────────────────────────────────── */
function ImageStorage() {
  const { settings, isSaving, error, save, reset } = useSettingsSection("storage", { pollMs: 5000 });

  /* save toggles */
  const [saveDefect, setSaveDefect]     = useState(true);
  const [saveNormal, setSaveNormal]     = useState(false);
  const [dailyFolder, setDailyFolder]   = useState(true);

  /* paths */
  const [basePath, setBasePath]         = useState("C:/shade_det_app/database/");
  const [defectSubfolder, setDefectSubfolder] = useState("By Date");

  /* format */
  const [imageFormat, setImageFormat]   = useState("JPEG");
  const [compression, setCompression]   = useState("Medium");
  const [saveTimestamp, setSaveTimestamp] = useState(true);
  const [saveMetadata, setSaveMetadata]  = useState(true);

  /* cleanup */
  const [autoCleanup, setAutoCleanup]   = useState(true);
  const [retention, setRetention]       = useState("30 days");

  /* ui state */
  const [applyLog, setApplyLog]         = useState("");
  const [pathError, setPathError]       = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return;
    }

    setSaveDefect(Boolean(settings.saveDefect ?? true));
    setSaveNormal(Boolean(settings.saveNormal ?? false));
    setDailyFolder(Boolean(settings.dailyFolder ?? true));
    setBasePath(settings.basePath || "C:/shade_det_app/database/");
    setDefectSubfolder(settings.defectSubfolder || "By Date");
    setImageFormat(settings.imageFormat || "JPEG");
    setCompression(settings.compression || "Medium");
    setSaveTimestamp(Boolean(settings.saveTimestamp ?? true));
    setSaveMetadata(Boolean(settings.saveMetadata ?? true));
    setAutoCleanup(Boolean(settings.autoCleanup ?? true));
    setRetention(settings.retention || "30 days");
    setHydrated(true);
  }, [settings]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      save({
        saveDefect,
        saveNormal,
        dailyFolder,
        basePath,
        defectSubfolder,
        imageFormat,
        compression,
        saveTimestamp,
        saveMetadata,
        autoCleanup,
        retention
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    saveDefect,
    saveNormal,
    dailyFolder,
    basePath,
    defectSubfolder,
    imageFormat,
    compression,
    saveTimestamp,
    saveMetadata,
    autoCleanup,
    retention,
    save
  ]);

  const validatePath = (p) => {
    if (!p.trim()) return "Storage path cannot be empty.";
    if (!/^[A-Za-z]:[\\/]/.test(p) && !p.startsWith("/")) return "Enter a valid absolute path (e.g. C:/shade_det_app/database/).";
    return "";
  };

  const handlePathChange = (val) => {
    setBasePath(val);
    setPathError(validatePath(val));
  };

  const handleApply = async () => {
    const err = validatePath(basePath);
    if (err) { setPathError(err); return; }

    await save({
      saveDefect,
      saveNormal,
      dailyFolder,
      basePath,
      defectSubfolder,
      imageFormat,
      compression,
      saveTimestamp,
      saveMetadata,
      autoCleanup,
      retention
    });

    const ts = new Date().toLocaleTimeString();
    setApplyLog(
      `[${ts}] Saved — Path: ${basePath.trim()} | Format: ${imageFormat} | Retention: ${autoCleanup ? retention : "disabled"} | Daily folder: ${dailyFolder ? "ON" : "OFF"}`
    );
  };

  const handleReset = async () => {
    const defaults = await reset();

    setSaveDefect(Boolean(defaults.saveDefect ?? true));
    setSaveNormal(Boolean(defaults.saveNormal ?? false));
    setDailyFolder(Boolean(defaults.dailyFolder ?? true));
    setBasePath(defaults.basePath || "C:/shade_det_app/database/");
    setDefectSubfolder(defaults.defectSubfolder || "By Date");
    setImageFormat(defaults.imageFormat || "JPEG");
    setCompression(defaults.compression || "Medium");
    setSaveTimestamp(Boolean(defaults.saveTimestamp ?? true));
    setSaveMetadata(Boolean(defaults.saveMetadata ?? true));
    setAutoCleanup(Boolean(defaults.autoCleanup ?? true));
    setRetention(defaults.retention || "30 days");
    setPathError("");
    setApplyLog("Settings reset to backend defaults.");
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Save Rules ──────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Save Rules</SectionTitle>

        <Row>
          <Label sub="Write confirmed defect frames to disk">Save Defect Images</Label>
          <Toggle checked={saveDefect} onChange={setSaveDefect} label="Save Defect Images" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {saveDefect ? "Enabled" : "Disabled"}
          </span>
        </Row>

        <Row>
          <Label sub="Write clean / passing frames to disk">Save Normal Images</Label>
          <Toggle checked={saveNormal} onChange={setSaveNormal} label="Save Normal Images" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {saveNormal ? "Enabled — high disk usage expected" : "Disabled (recommended)"}
          </span>
        </Row>

        <Row>
          <Label sub="Backend creates a YYYY-MM-DD sub-folder each day">Daily Folder Creation</Label>
          <Toggle checked={dailyFolder} onChange={setDailyFolder} label="Daily Folder Creation" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {dailyFolder ? "Managed by backend" : "Disabled — flat save"}
          </span>
        </Row>
      </div>

      {/* ── Storage Path ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Storage Path</SectionTitle>

        <Row>
          <Label sub="Root folder where all images are written">Base Save Path</Label>
          <div className="flex flex-1 min-w-[260px] flex-col gap-1">
            <input
              type="text"
              value={basePath}
              onChange={(e) => handlePathChange(e.target.value)}
              spellCheck={false}
              placeholder="e.g. C:/shade_det_app/database/"
              className={`h-9 w-full rounded-md border px-3 font-mono text-sm text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad] ${
                pathError ? "border-red-400 bg-red-50" : "border-[#9ab0c9] bg-white"
              }`}
            />
            {pathError && <p className="text-xs text-red-500">{pathError}</p>}
          </div>
        </Row>

        <Row>
          <Label sub="Sub-folder structure inside the base path for defects">Defect Sub-folder</Label>
          <Select
            id="img-subfolder"
            value={defectSubfolder}
            onChange={setDefectSubfolder}
            options={DEFECT_SUBFOLDER_OPTIONS}
          />
        </Row>

        <DailyFolderPreview basePath={basePath} enabled={dailyFolder} />

        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#4f79ad]">Storage Usage</p>
          <StorageBar usedGB={14.3} totalGB={50} />
        </div>
      </div>

      {/* ── Image Format ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Image Format</SectionTitle>

        <Row>
          <Label sub="File format for saved captures">Format</Label>
          <div className="flex gap-2">
            {IMAGE_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setImageFormat(f)}
                className={`rounded-md border px-4 py-1.5 text-sm font-semibold transition ${
                  imageFormat === f
                    ? "border-[#4f79ad] bg-[#4f79ad] text-white"
                    : "border-[#9ab0c9] bg-white text-[#24416a] hover:bg-[#eaf0f8]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </Row>

        <Row>
          <Label sub="Compression applied during JPEG / TIFF encode">Compression</Label>
          <Select
            id="img-compression"
            value={compression}
            onChange={setCompression}
            options={COMPRESSION_LEVELS}
            disabled={imageFormat === "PNG" || imageFormat === "BMP"}
          />
          {(imageFormat === "PNG" || imageFormat === "BMP") && (
            <span className="self-center text-xs text-[#8aa4be]">
              Lossless format — compression N/A
            </span>
          )}
        </Row>

        <Row>
          <Label sub="Embed capture timestamp in image filename">Timestamp in Filename</Label>
          <Toggle checked={saveTimestamp} onChange={setSaveTimestamp} label="Timestamp in Filename" />
          <span className="self-center text-xs text-[#6b89a5] font-mono">
            {saveTimestamp ? "defect_2026-03-11_14-32-05.jpg" : "defect_0042.jpg"}
          </span>
        </Row>

        <Row>
          <Label sub="Save ΔE score, zone, and frame index alongside image">Save Detection Metadata</Label>
          <Toggle checked={saveMetadata} onChange={setSaveMetadata} label="Save Detection Metadata" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {saveMetadata ? "JSON sidecar file per image" : "Image only"}
          </span>
        </Row>
      </div>

      {/* ── Auto Cleanup ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Auto Cleanup</SectionTitle>

        <Row>
          <Label sub="Automatically purge images older than retention period">Enable Auto Cleanup</Label>
          <Toggle checked={autoCleanup} onChange={setAutoCleanup} label="Auto Cleanup" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {autoCleanup ? "Active — old images removed automatically" : "Disabled — manual cleanup only"}
          </span>
        </Row>

        <Row>
          <Label sub="Images older than this threshold are deleted">Retention Period</Label>
          <Select
            id="img-retention"
            value={retention}
            onChange={setRetention}
            options={RETENTION_OPTIONS}
            disabled={!autoCleanup}
          />
          {!autoCleanup && (
            <span className="self-center text-xs text-[#8aa4be]">Enable auto cleanup to set retention</span>
          )}
        </Row>
      </div>

      {/* ── Apply / Reset ─────────────────────────────────── */}
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
            {error || "Syncing image storage settings with backend..."}
          </div>
        )}
      </div>

    </div>
  );
}

export default ImageStorage;
