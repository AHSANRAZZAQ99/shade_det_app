import React, { useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import CameraFeed from "../components/CameraFeed";
import ZoneStats from "../components/ZoneStats";
import CameraConnection from "../components/CameraConnection";
import DefectHistory from "../components/DefectHistory";
import DailyDataset from "../components/DailyDataset";
import SettingsPanel from "../components/SettingsPanel";
import { useDetectionFeed } from "../hooks/useDetectionFeed";

function Dashboard() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [operatorName, setOperatorName] = useState(() => window.localStorage.getItem("operatorName") || "John");
  const {
    isConnected,
    isCameraRunning,
    isStartingCamera,
    isStoppingCamera,
    isCapturingVariation,
    liveFrameUrl,
    cameraStreamCandidates,
    latestSummary,
    zoneAnalysis,
    recentLogs,
    recentDefects,
    dailyDatasets,
    errorMessage,
    startCamera,
    stopCamera,
    captureVariation,
    deleteDailyImage,
    deleteDailyFolder,
    clearRecentDefects,
    refreshRecentDefects,
    refreshDailyDatasets
  } = useDetectionFeed();

  const renderMainContent = () => {
    if (activePage === "Settings") {
      return <SettingsPanel operatorName={operatorName} onOperatorNameChange={setOperatorName} />;
    }

    if (activePage === "Camera Feed") {
      return (
        <CameraFeed
          isConnected={isConnected}
          isCameraRunning={isCameraRunning}
          isStartingCamera={isStartingCamera}
          isStoppingCamera={isStoppingCamera}
          isCapturingVariation={isCapturingVariation}
          liveFrameUrl={liveFrameUrl}
          cameraStreamCandidates={cameraStreamCandidates}
          latestSummary={latestSummary}
          errorMessage={errorMessage}
          onStartCamera={startCamera}
          onStopCamera={stopCamera}
          onCaptureVariation={captureVariation}
        />
      );
    }

    if (activePage === "Defect History") {
      return <DefectHistory frames={recentDefects} onRefresh={clearRecentDefects} errorMessage={errorMessage} />;
    }

    if (activePage === "Daily Dataset") {
      return (
        <DailyDataset
          dailyDatasets={dailyDatasets}
          onRefresh={refreshDailyDatasets}
          onDeleteImage={deleteDailyImage}
          onDeleteFolder={deleteDailyFolder}
          errorMessage={errorMessage}
        />
      );
    }

    if (activePage === "Dashboard") {
      return (
        <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-h-0">
            <CameraFeed
              isConnected={isConnected}
              isCameraRunning={isCameraRunning}
              isStartingCamera={isStartingCamera}
              isStoppingCamera={isStoppingCamera}
              isCapturingVariation={isCapturingVariation}
              liveFrameUrl={liveFrameUrl}
              cameraStreamCandidates={cameraStreamCandidates}
              latestSummary={latestSummary}
              errorMessage={errorMessage}
              onStartCamera={startCamera}
              onStopCamera={stopCamera}
              onCaptureVariation={captureVariation}
            />
          </div>

          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
            <ZoneStats rows={zoneAnalysis} />
            <CameraConnection />
          </div>
        </div>
      );
    }

    return (
      <section className="h-full rounded-xl border border-[#8da2bb] bg-[#e1e7ef] p-4 md:p-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-[#1c355a]">{activePage}</h2>
        <p className="mt-2 text-sm text-[#365577]">
          This section is part of the navigation and can be built after the settings modules are finalized.
        </p>
      </section>
    );
  };

  return (
    <div className="h-screen overflow-hidden p-2 md:p-3">
      <div className="mx-auto flex h-full max-w-[1650px] flex-col overflow-hidden rounded-2xl border border-[#8da2bb] shadow-panel">
        <Header operatorName={operatorName} />

        <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)]">
          <Sidebar activeItem={activePage} onSelect={setActivePage} />

          <main className="min-h-0 overflow-hidden bg-[#d0d7e2] p-2 md:p-3">
            {renderMainContent()}
          </main>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;