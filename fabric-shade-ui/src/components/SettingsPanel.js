import React, { useMemo, useState } from "react";
import CameraSettings from "./settings/CameraSettings";
import DetectionSettings from "./settings/DetectionSettings";
import ImageStorage from "./settings/ImageStorage";
import SystemSettings from "./settings/SystemSettings";
import ModelSettings from "./settings/ModelSettings";
import UserSecurity from "./settings/UserSecurity";

const tabs = [
  "Camera Settings",
  "Detection Settings",
  "Image Storage",
  "System Settings",
  "Model Settings",
  "User & Security"
];

function SettingsPanel({ operatorName = "John", onOperatorNameChange }) {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  const tabDescription = useMemo(
    () => ({
      "Camera Settings": "Camera streams, frame quality, and connection options.",
      "Detection Settings": "Sensitivity thresholds, zones, and alert behavior.",
      "Image Storage": "Retention period, archival rules, and folder targets.",
      "System Settings": "Application preferences, health checks, and maintenance.",
      "Model Settings": "Model version controls, inference options, and rollout mode.",
      "User & Security": "Users, roles, access control, and authentication settings."
    }),
    []
  );

  return (
    <section className="h-full rounded-xl border border-[#8da2bb] bg-[#e1e7ef] p-3 md:p-4">
      <header className="mb-3 border-b border-[#b3becc] pb-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-[#1c355a]">Settings</h2>
      </header>

      <div className="grid overflow-hidden h-[calc(100%-3.4rem)] min-h-[420px] grid-cols-1 gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
        <nav className="min-h-0 overflow-hidden rounded-lg border border-[#b3becc] bg-[#d6deea] p-2">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-[15px] font-semibold transition ${
                    activeTab === tab
                      ? "border-[#4f79ad] bg-[#4f79ad] text-white"
                      : "border-transparent bg-[#edf2f8] text-[#24416a] hover:border-[#92a8c2]"
                  }`}
                >
                  {tab}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-h-0 min-w-0 overflow-y-scroll rounded-lg border border-[#b3becc] bg-[#edf2f8] p-4 md:p-5" style={{ scrollbarGutter: "stable", overflowAnchor: "none" }}>
          {activeTab !== "Camera Settings" && activeTab !== "Detection Settings" && activeTab !== "Image Storage" && activeTab !== "System Settings" && activeTab !== "Model Settings" && activeTab !== "User & Security" && (
            <>
              <h3 className="text-xl font-bold text-[#193658]">{activeTab}</h3>
              <p className="mt-2 max-w-2xl text-sm text-[#365577]">{tabDescription[activeTab]}</p>
              <div className="mt-5 rounded-md border border-dashed border-[#98acc3] bg-white/70 p-4 text-sm text-[#3b5a7b]">
                Module UI for <strong>{activeTab}</strong> will be added in the next step.
              </div>
            </>
          )}

          {activeTab === "Camera Settings" && <CameraSettings />}
          {activeTab === "Detection Settings" && <DetectionSettings />}
          {activeTab === "Image Storage" && <ImageStorage />}
          {activeTab === "System Settings" && <SystemSettings />}
          {activeTab === "Model Settings" && <ModelSettings />}
          {activeTab === "User & Security" && (
            <UserSecurity
              operatorName={operatorName}
              onOperatorNameChange={onOperatorNameChange}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export default SettingsPanel;
