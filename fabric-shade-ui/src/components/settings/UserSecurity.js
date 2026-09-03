import React, { useEffect, useState } from "react";
import { useSettingsSection } from "../../hooks/useSettingsSection";

const ROLES = ["Operator", "Supervisor", "Admin", "Maintenance"];
const ACCESS_AREAS = [
  "Camera Controls",
  "Detection Settings",
  "Storage Settings",
  "Model Settings",
  "System Settings",
  "Export Reports",
  "User Management",
  "Shutdown / Restart"
];
const SESSION_TIMEOUTS = ["5 min", "10 min", "15 min", "30 min", "1 hour", "Never"];

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
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function AccessCard({ area, allowed, onToggle }) {
  return (
    <div className={`rounded-lg border p-3 transition ${allowed ? "border-[#4f79ad] bg-[#eef4fc]" : "border-[#c0cfe0] bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1d2f49]">{area}</p>
          <p className="text-[11px] text-[#6b89a5]">Permission for current role</p>
        </div>
        <Toggle checked={allowed} onChange={onToggle} label={area} />
      </div>
    </div>
  );
}

function StatusBadge({ locked }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${locked ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
      {locked ? "System Locked" : "System Unlocked"}
    </span>
  );
}

function UserSecurity({ operatorName = "John", onOperatorNameChange }) {
  const { settings, isSaving, error, save, reset, postAction } = useSettingsSection("security", { pollMs: 4000 });

  const [draftOperatorName, setDraftOperatorName] = useState(operatorName);
  const [role, setRole] = useState("Operator");
  const [adminRequired, setAdminRequired] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("15 min");
  const [twoStepConfirm, setTwoStepConfirm] = useState(true);
  const [allowLogout, setAllowLogout] = useState(true);
  const [systemLocked, setSystemLocked] = useState(false);
  const [lockOnIdle, setLockOnIdle] = useState(true);
  const [changePasswordLog, setChangePasswordLog] = useState("");
  const [sessionLog, setSessionLog] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [permissions, setPermissions] = useState({
    "Camera Controls": true,
    "Detection Settings": false,
    "Storage Settings": false,
    "Model Settings": false,
    "System Settings": false,
    "Export Reports": true,
    "User Management": false,
    "Shutdown / Restart": false
  });

  useEffect(() => {
    if (!settings || Object.keys(settings).length === 0) {
      return;
    }

    const resolvedName = settings.operatorName || operatorName || "John";
    setDraftOperatorName(resolvedName);
    setRole(settings.role || "Operator");
    setAdminRequired(Boolean(settings.adminRequired ?? true));
    setSessionTimeout(settings.sessionTimeout || "15 min");
    setTwoStepConfirm(Boolean(settings.twoStepConfirm ?? true));
    setAllowLogout(Boolean(settings.allowLogout ?? true));
    setSystemLocked(Boolean(settings.systemLocked ?? false));
    setLockOnIdle(Boolean(settings.lockOnIdle ?? true));
    setPermissions(settings.permissions || permissions);
    onOperatorNameChange?.(resolvedName);
    setHydrated(true);
  }, [settings, operatorName, onOperatorNameChange]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      save({
        operatorName: draftOperatorName.trim() || "John",
        role,
        adminRequired,
        sessionTimeout,
        twoStepConfirm,
        allowLogout,
        systemLocked,
        lockOnIdle,
        permissions
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    draftOperatorName,
    role,
    adminRequired,
    sessionTimeout,
    twoStepConfirm,
    allowLogout,
    systemLocked,
    lockOnIdle,
    permissions,
    save
  ]);

  const togglePermission = (area) => {
    setPermissions((prev) => ({ ...prev, [area]: !prev[area] }));
  };

  const handleSaveOperator = async () => {
    const cleanName = draftOperatorName.trim() || "John";
    onOperatorNameChange?.(cleanName);
    await save({ operatorName: cleanName });
    const ts = new Date().toLocaleTimeString();
    setSessionLog(`[${ts}] Operator updated to ${cleanName}.`);
  };

  const handleChangePassword = async () => {
    try {
      const payload = await postAction("/api/security/change-password-request", {
        operatorName: draftOperatorName.trim() || operatorName || "John"
      });
      const ts = new Date().toLocaleTimeString();
      setChangePasswordLog(`[${ts}] ${payload.message || `Password change dialog requested for ${operatorName}.`}`);
    } catch {
      setChangePasswordLog("Unable to notify backend about password change request.");
    }
  };

  const handleLogout = async () => {
    try {
      const payload = await postAction("/api/security/logout");
      const ts = new Date().toLocaleTimeString();
      setSessionLog(`[${ts}] ${payload.message || `${operatorName} logout requested.`}`);
    } catch {
      setSessionLog("Unable to notify backend about logout request.");
    }
  };

  const handleLockToggle = async () => {
    const next = !systemLocked;
    try {
      await postAction("/api/security/lock", { locked: next });
      setSystemLocked(next);
      const ts = new Date().toLocaleTimeString();
      setSessionLog(`[${ts}] System ${next ? "locked" : "unlocked"}.`);
    } catch {
      setSessionLog("Unable to update system lock state on backend.");
    }
  };

  const handleApply = async () => {
    await save({
      operatorName: draftOperatorName.trim() || "John",
      role,
      adminRequired,
      sessionTimeout,
      twoStepConfirm,
      allowLogout,
      systemLocked,
      lockOnIdle,
      permissions
    });

    const ts = new Date().toLocaleTimeString();
    setSessionLog(`[${ts}] Security policy saved — Role: ${role} | Admin check: ${adminRequired ? "ON" : "OFF"} | Timeout: ${sessionTimeout}`);
  };

  const handleReset = async () => {
    const defaults = await reset();

    const cleanName = defaults.operatorName || "John";
    setRole(defaults.role || "Operator");
    setAdminRequired(Boolean(defaults.adminRequired ?? true));
    setSessionTimeout(defaults.sessionTimeout || "15 min");
    setTwoStepConfirm(Boolean(defaults.twoStepConfirm ?? true));
    setAllowLogout(Boolean(defaults.allowLogout ?? true));
    setSystemLocked(Boolean(defaults.systemLocked ?? false));
    setLockOnIdle(Boolean(defaults.lockOnIdle ?? true));
    setPermissions(defaults.permissions || permissions);
    setDraftOperatorName(cleanName);
    onOperatorNameChange?.(cleanName);
    setChangePasswordLog("");
    setSessionLog("Settings reset to backend defaults.");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Current Operator</SectionTitle>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cbd8e6] bg-[#f4f7fb] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4f79ad]">Logged In User</p>
            <p className="mt-1 text-2xl font-bold text-[#193658]">{operatorName}</p>
            <p className="mt-1 text-sm text-[#5b7a9b]">Factory floor operator session</p>
          </div>
          <div className="min-w-[180px] rounded-lg border border-[#d5e0ec] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-[#7a97b3]">Role</p>
            <p className="mt-1 text-lg font-bold text-[#24416a]">{role}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={draftOperatorName}
            onChange={(e) => setDraftOperatorName(e.target.value)}
            placeholder="Enter operator name"
            className="h-10 min-w-[220px] rounded-md border border-[#9ab0c9] bg-white px-3 text-sm font-semibold text-[#1d2f49] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
          />
          <button
            type="button"
            onClick={handleSaveOperator}
            className="rounded-md bg-[#1f6fb2] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#175a92] focus:outline-none focus:ring-2 focus:ring-[#1f6fb2]"
          >
            Save Operator
          </button>
          <button
            type="button"
            onClick={handleChangePassword}
            className="rounded-md bg-[#4f79ad] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#3d6394] focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
          >
            Change Password
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={!allowLogout}
            className="rounded-md border border-[#9ab0c9] bg-[#edf2f8] px-5 py-2 text-sm font-semibold text-[#24416a] shadow transition hover:bg-[#dde7f3] focus:outline-none focus:ring-2 focus:ring-[#9ab0c9] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Logout
          </button>
        </div>

        {changePasswordLog && (
          <div className="mt-3 rounded-md border border-[#b3becc] bg-[#f4f7fb] px-4 py-2 font-mono text-xs text-[#2e4f6e]">
            {changePasswordLog}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Access Control</SectionTitle>

        <Row>
          <Label sub="Role applied to the current logged in operator">Assigned Role</Label>
          <Select id="usr-role" value={role} onChange={setRole} options={ROLES} />
        </Row>

        <Row>
          <Label sub="Require admin confirmation before opening critical settings">Admin Approval Required</Label>
          <Toggle checked={adminRequired} onChange={setAdminRequired} label="Admin Approval Required" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {adminRequired ? "Restricted pages need admin login" : "Operator can enter directly"}
          </span>
        </Row>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ACCESS_AREAS.map((area) => (
            <AccessCard
              key={area}
              area={area}
              allowed={permissions[area]}
              onToggle={() => togglePermission(area)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Session Security</SectionTitle>

        <Row>
          <Label sub="Automatically lock console when no activity is detected">Lock On Idle</Label>
          <Toggle checked={lockOnIdle} onChange={setLockOnIdle} label="Lock On Idle" />
          <span className="self-center text-sm text-[#5b7a9b]">
            {lockOnIdle ? "Idle protection enabled" : "No automatic lock"}
          </span>
        </Row>

        <Row>
          <Label sub="Time before system auto-locks due to inactivity">Session Timeout</Label>
          <Select id="usr-timeout" value={sessionTimeout} onChange={setSessionTimeout} options={SESSION_TIMEOUTS} disabled={!lockOnIdle} />
          {!lockOnIdle && <span className="self-center text-xs text-[#8aa4be]">Enable idle lock to use timeout</span>}
        </Row>

        <Row>
          <Label sub="Confirm dangerous actions like reset, stop, delete">Two-Step Confirmation</Label>
          <Toggle checked={twoStepConfirm} onChange={setTwoStepConfirm} label="Two-Step Confirmation" />
        </Row>

        <Row>
          <Label sub="Allow operator to close their active session">Allow Logout</Label>
          <Toggle checked={allowLogout} onChange={setAllowLogout} label="Allow Logout" />
        </Row>
      </div>

      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>System Lock</SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge locked={systemLocked} />
          <button
            type="button"
            onClick={handleLockToggle}
            className={`rounded-md px-5 py-2 text-sm font-bold text-white shadow transition focus:outline-none focus:ring-2 ${
              systemLocked
                ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400"
                : "bg-red-500 hover:bg-red-600 focus:ring-red-400"
            }`}
          >
            {systemLocked ? "Unlock System" : "Lock System"}
          </button>
        </div>

        <p className="mt-3 text-sm text-[#5b7a9b]">
          Use lock mode on the factory floor to prevent unauthorized access while leaving the application running.
        </p>
      </div>

      <div className="rounded-lg border border-[#b3becc] bg-white p-4 shadow-sm">
        <SectionTitle>Save Configuration</SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleApply}
            className="rounded-md bg-[#4f79ad] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#3d6394] focus:outline-none focus:ring-2 focus:ring-[#4f79ad]"
          >
            Apply Settings
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-[#9ab0c9] bg-[#edf2f8] px-5 py-2 text-sm font-semibold text-[#24416a] shadow transition hover:bg-[#dde7f3] focus:outline-none focus:ring-2 focus:ring-[#9ab0c9]"
          >
            Reset Defaults
          </button>
        </div>

        {sessionLog && (
          <div className="mt-3 rounded-md border border-[#b3becc] bg-[#f4f7fb] px-4 py-2 font-mono text-xs text-[#2e4f6e]">
            {sessionLog}
          </div>
        )}

        {(error || isSaving) && (
          <div className="mt-2 text-xs font-semibold text-[#4f79ad]">
            {error || "Syncing user and security settings with backend..."}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserSecurity;
