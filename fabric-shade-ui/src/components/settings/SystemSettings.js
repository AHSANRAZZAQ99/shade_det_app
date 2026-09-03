import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSettingsSection } from "../../hooks/useSettingsSection";

/* ── option constants ─────────────────────────────────────────── */
const THEMES        = ["Light", "Dark", "System Default"];
const LANGUAGES     = ["English", "Turkish", "German", "French", "Spanish", "Arabic"];
const LOG_LEVELS    = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];
const LOG_OUTPUTS   = ["File", "Console", "Both"];
const MAX_LOG_SIZES = ["10 MB", "25 MB", "50 MB", "100 MB", "500 MB"];
const APP_PORTS     = ["5000", "8000", "8080", "8888", "Custom"];

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

function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-md border px-4 py-1.5 text-sm font-semibold transition ${
            value === o
              ? "border-[#4f79ad] bg-[#4f79ad] text-white"
              : "border-[#9ab0c9] bg-white text-[#24416a] hover:bg-[#eaf0f8]"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ── system health row ────────────────────────────────────────── */
function HealthRow({ label, value, status }) {
  const dot = {
    ok:   "bg-emerald-500",
    warn: "bg-amber-400",
    err:  "bg-red-500"
  }[status] ?? "bg-slate-400";

  return (
    <div className="flex items-center justify-between rounded-md border border-[#d5e0ec] bg-[#f4f7fb] px-4 py-2">
      <span className="text-sm text-[#24416a]">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="text-sm font-semibold text-[#1d3960]">{value}</span>
      </div>
    </div>
  );
}

/* ── main component ───────────────────────────────────────────── */
function SystemSettings() {
  const { apiBaseUrl, settings, isSaving, error, save, reset } = useSettingsSection("system", { pollMs: 5000 });

  /* appearance */
  const [theme, setTheme]           = useState("Light");
  const [language, setLanguage]     = useState("English");

  /* startup */
  const [autoStartCamera, setAutoStartCamera]     = useState(true);
  const [autoStartDetection, setAutoStartDetection] = useState(false);
  const [minimizeToTray, setMinimizeToTray]       = useState(false);
  const [startWithOS, setStartWithOS]             = useState(false);

  /* notifications */
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundAlerts, setSoundAlerts]             = useState(true);
  const [desktopPopups, setDesktopPopups]         = useState(true);

  /* logging */
  const [systemLogs, setSystemLogs]               = useState(true);
  const [logLevel, setLogLevel]                   = useState("INFO");
  const [logOutput, setLogOutput]                 = useState("Both");
  const [maxLogSize, setMaxLogSize]               = useState("50 MB");

  /* network */
  const [apiPort, setApiPort]                     = useState("5000");
  const [customPort, setCustomPort]               = useState("");
  const [portError, setPortError]                 = useState("");

  /* ui state */
  const [applyLog, setApplyLog]                   = useState("");
  const [health, setHealth] = useState({
    cpuUsage: null,
    ramUsageMb: null,
    gpu: "Unknown",
    cameraFeed: "—",
    backendApi: "—",
    diskFreeGb: null
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return;
    }

    setTheme(settings.theme || "Light");
    setLanguage(settings.language || "English");
    setAutoStartCamera(Boolean(settings.autoStartCamera ?? true));
    setAutoStartDetection(Boolean(settings.autoStartDetection ?? false));
    setMinimizeToTray(Boolean(settings.minimizeToTray ?? false));
    setStartWithOS(Boolean(settings.startWithOS ?? false));
    setNotificationsEnabled(Boolean(settings.notificationsEnabled ?? true));
    setSoundAlerts(Boolean(settings.soundAlerts ?? true));
    setDesktopPopups(Boolean(settings.desktopPopups ?? true));
    setSystemLogs(Boolean(settings.systemLogs ?? true));
    setLogLevel(settings.logLevel || "INFO");
    setLogOutput(settings.logOutput || "Both");
    setMaxLogSize(settings.maxLogSize || "50 MB");
    setApiPort(settings.apiPort || "5000");
    setCustomPort(settings.customPort || "");
    setHydrated(true);
  }, [settings]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      save({
        theme,
        language,
        autoStartCamera,
        autoStartDetection,
        minimizeToTray,
        startWithOS,
        notificationsEnabled,
        soundAlerts,
        desktopPopups,
        systemLogs,
        logLevel,
        logOutput,
        maxLogSize,
        apiPort,
        customPort
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    theme,
    language,
    autoStartCamera,
    autoStartDetection,
    minimizeToTray,
    startWithOS,
    notificationsEnabled,
    soundAlerts,
    desktopPopups,
    systemLogs,
    logLevel,
    logOutput,
    maxLogSize,
    apiPort,
    customPort,
    save
  ]);

  useEffect(() => {
    let active = true;

    const loadHealth = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/system/health`, { timeout: 3500 });
        const payload = response.data?.health || response.data || {};

        if (!active) {
          return;
        }

        setHealth({
          cpuUsage: payload.cpuUsage ?? payload.cpuPercent ?? null,
          ramUsageMb: payload.ramUsageMb ?? payload.ramUsedMb ?? null,
          gpu: payload.gpu || payload.gpuStatus || "Unknown",
          cameraFeed: payload.cameraFeed || "—",
          backendApi: payload.backendApi || "Online",
          diskFreeGb: payload.diskFreeGb ?? null
        });
      } catch {
        if (!active) {
          return;
        }

        setHealth((current) => ({ ...current, backendApi: "Offline" }));
      }
    };

    loadHealth();
    const id = window.setInterval(loadHealth, 3000);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [apiBaseUrl]);

  const resolvedPort = apiPort === "Custom" ? customPort : apiPort;

  const validateCustomPort = (val) => {
    const n = parseInt(val, 10);
    if (!val) return "Port is required.";
    if (isNaN(n) || n < 1024 || n > 65535) return "Enter a valid port (1024 – 65535).";
    return "";
  };

  const handlePortChange = (val) => {
    setCustomPort(val);
    setPortError(validateCustomPort(val));
  };

  const handleApply = async () => {
    if (apiPort === "Custom") {
      const err = validateCustomPort(customPort);
      if (err) { setPortError(err); return; }
    }

    await save({
      theme,
      language,
      autoStartCamera,
      autoStartDetection,
      minimizeToTray,
      startWithOS,
      notificationsEnabled,
      soundAlerts,
      desktopPopups,
      systemLogs,
      logLevel,
      logOutput,
      maxLogSize,
      apiPort,
      customPort
    });

    const ts = new Date().toLocaleTimeString();
    setApplyLog(
      `[${ts}] System settings saved — Theme: ${theme} | Lang: ${language} | Log: ${logLevel} → ${logOutput} | Port: ${resolvedPort}`
    );
  };

  const handleReset = async () => {
    const defaults = await reset();

    setTheme(defaults.theme || "Light");
    setLanguage(defaults.language || "English");
    setAutoStartCamera(Boolean(defaults.autoStartCamera ?? true));
    setAutoStartDetection(Boolean(defaults.autoStartDetection ?? false));
    setMinimizeToTray(Boolean(defaults.minimizeToTray ?? false));
    setStartWithOS(Boolean(defaults.startWithOS ?? false));
    setNotificationsEnabled(Boolean(defaults.notificationsEnabled ?? true));
    setSoundAlerts(Boolean(defaults.soundAlerts ?? true));
    setDesktopPopups(Boolean(defaults.desktopPopups ?? true));
    setSystemLogs(Boolean(defaults.systemLogs ?? true));
    setLogLevel(defaults.logLevel || "INFO");
    setLogOutput(defaults.logOutput || "Both");
    setMaxLogSize(defaults.maxLogSize || "50 MB");
    setApiPort(defaults.apiPort || "5000");
    setCustomPort(defaults.customPort || "");
    setPortError("");
    setApplyLog("Settings reset to backend defaults.");
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Appearance ──────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Appearance</SectionTitle>

        <Row>
          <Label sub="Application colour theme">Theme</Label>
          <PillGroup options={THEMES} value={theme} onChange={setTheme} />
        </Row>

        <Row>
          <Label sub="UI display language">Language</Label>
          <Select id="sys-lang" value={language} onChange={setLanguage} options={LANGUAGES} />
        </Row>
      </div>

      {/* ── Startup Behaviour ────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Startup Behaviour</SectionTitle>

        <Row>
          <Label sub="Connect to camera feed on application launch">Auto Start Camera</Label>
          <Toggle checked={autoStartCamera} onChange={setAutoStartCamera} label="Auto Start Camera" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {autoStartCamera ? "Camera connects on launch" : "Manual start required"}
          </span>
        </Row>

        <Row>
          <Label sub="Begin shade detection immediately after camera connects">Auto Start Detection</Label>
          <Toggle checked={autoStartDetection} onChange={setAutoStartDetection} label="Auto Start Detection" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {autoStartDetection ? "Detection starts automatically" : "Manual activation required"}
          </span>
        </Row>

        <Row>
          <Label sub="Keep app running in system tray when window is closed">Minimize to Tray</Label>
          <Toggle checked={minimizeToTray} onChange={setMinimizeToTray} label="Minimize to Tray" />
        </Row>

        <Row>
          <Label sub="Launch application when the OS boots">Start with OS</Label>
          <Toggle checked={startWithOS} onChange={setStartWithOS} label="Start with OS" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {startWithOS ? "Registered in startup" : "Not registered"}
          </span>
        </Row>
      </div>

      {/* ── Notifications ────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Notifications</SectionTitle>

        <Row>
          <Label sub="Master switch for all alert notifications">Enable Notifications</Label>
          <Toggle checked={notificationsEnabled} onChange={setNotificationsEnabled} label="Enable Notifications" />
          <span className="self-center text-sm font-semibold text-[#5b7a9b]">
            {notificationsEnabled ? "All alerts active" : "All alerts suppressed"}
          </span>
        </Row>

        <Row>
          <Label sub="Play audible alert on defect detection">Sound Alerts</Label>
          <Toggle
            checked={soundAlerts && notificationsEnabled}
            onChange={setSoundAlerts}
            label="Sound Alerts"
          />
          {!notificationsEnabled && (
            <span className="self-center text-xs text-[#8aa4be]">Notifications disabled</span>
          )}
        </Row>

        <Row>
          <Label sub="Show OS desktop pop-up on defect events">Desktop Popups</Label>
          <Toggle
            checked={desktopPopups && notificationsEnabled}
            onChange={setDesktopPopups}
            label="Desktop Popups"
          />
          {!notificationsEnabled && (
            <span className="self-center text-xs text-[#8aa4be]">Notifications disabled</span>
          )}
        </Row>
      </div>

      {/* ── System Logging ───────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>System Logging</SectionTitle>

        <Row>
          <Label sub="Write application events to log files">Enable System Logs</Label>
          <Toggle checked={systemLogs} onChange={setSystemLogs} label="Enable System Logs" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {systemLogs ? "Logging active" : "Logging disabled"}
          </span>
        </Row>

        <Row>
          <Label sub="Minimum severity level recorded">Log Level</Label>
          <div className="flex flex-wrap gap-2">
            {LOG_LEVELS.map((lvl) => {
              const accent = {
                DEBUG: "border-slate-400 bg-slate-400",
                INFO: "border-blue-400 bg-blue-400",
                WARNING: "border-amber-400 bg-amber-400",
                ERROR: "border-red-400 bg-red-400",
                CRITICAL: "border-red-700 bg-red-700"
              }[lvl];
              return (
                <button
                  key={lvl}
                  type="button"
                  disabled={!systemLogs}
                  onClick={() => setLogLevel(lvl)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    logLevel === lvl
                      ? `${accent} text-white`
                      : "border-[#9ab0c9] bg-white text-[#24416a] hover:bg-[#eaf0f8]"
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </Row>

        <Row>
          <Label sub="Where log output is written">Log Output</Label>
          <Select
            id="sys-logoutput"
            value={logOutput}
            onChange={setLogOutput}
            options={LOG_OUTPUTS}
            disabled={!systemLogs}
          />
        </Row>

        <Row>
          <Label sub="Maximum size before log is rotated">Max Log File Size</Label>
          <Select
            id="sys-logsize"
            value={maxLogSize}
            onChange={setMaxLogSize}
            options={MAX_LOG_SIZES}
            disabled={!systemLogs}
          />
        </Row>
      </div>

      {/* ── Network / API ─────────────────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Network / API</SectionTitle>

        <Row>
          <Label sub="Port the backend API server listens on">API Server Port</Label>
          <Select
            id="sys-port"
            value={apiPort}
            onChange={(v) => { setApiPort(v); setPortError(""); }}
            options={APP_PORTS}
          />
          {apiPort === "Custom" && (
            <div className="flex flex-col gap-1">
              <input
                type="number"
                min={1024}
                max={65535}
                value={customPort}
                onChange={(e) => handlePortChange(e.target.value)}
                placeholder="1024 – 65535"
                className={`h-9 w-32 rounded-md border px-2 text-sm text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad] ${
                  portError ? "border-red-400 bg-red-50" : "border-[#9ab0c9] bg-white"
                }`}
              />
              {portError && <p className="text-xs text-red-500">{portError}</p>}
            </div>
          )}
          {!portError && (
            <span className="self-center font-mono text-xs text-[#6b89a5]">
              http://localhost:{resolvedPort}
            </span>
          )}
        </Row>
      </div>

      {/* ── System Health (read-only) ─────────────────────── */}
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>System Health</SectionTitle>
        <p className="mb-3 text-xs text-[#6b89a5]">Live diagnostics from backend health endpoint.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <HealthRow label="CPU Usage"       value={health.cpuUsage == null ? "— %" : `${health.cpuUsage.toFixed(1)} %`}    status="ok" />
          <HealthRow label="RAM Usage"       value={health.ramUsageMb == null ? "— MB" : `${health.ramUsageMb.toFixed(1)} MB`}   status="ok" />
          <HealthRow label="GPU / OpenCL"    value={health.gpu || "—"}      status="ok" />
          <HealthRow label="Camera Feed"     value={health.cameraFeed || "—"}      status={String(health.cameraFeed).toLowerCase().includes("running") ? "ok" : "warn"} />
          <HealthRow label="Backend API"     value={health.backendApi || "—"}      status={String(health.backendApi).toLowerCase().includes("offline") ? "err" : "ok"} />
          <HealthRow label="Disk Free"       value={health.diskFreeGb == null ? "— GB" : `${health.diskFreeGb.toFixed(2)} GB`}   status="ok" />
        </div>
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
            {error || "Syncing system settings with backend..."}
          </div>
        )}
      </div>

    </div>
  );
}

export default SystemSettings;
