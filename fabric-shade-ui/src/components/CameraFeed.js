import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSettingsSection } from "../hooks/useSettingsSection";
import { useROI } from "../contexts/ROIContext";
import UploadModal from "./UploadModal";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function CameraFeed({
  isConnected = false,
  isCameraRunning = false,
  isStartingCamera = false,
  isStoppingCamera = false,
  isCapturingVariation = false,
  liveFrameUrl = null,
  cameraStreamCandidates = [],
  latestSummary,
  errorMessage = "",
  onStartCamera,
  onStopCamera,
  onCaptureVariation
}) {
  const { settings: cameraSettings } = useSettingsSection("camera", { pollMs: 4000 });
  const deltaEValue = Number.isFinite(latestSummary?.deltaE) ? latestSummary.deltaE : 0;
  const densityValue = Number.isFinite(latestSummary?.density) ? latestSummary.density : 0;
  const statusLabel = latestSummary?.status || "Waiting";

  const [sourceIndex, setSourceIndex] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDefectLabelEnabled, setIsDefectLabelEnabled] = useState(true);

  const { roi, updateRoi } = useROI();
  const [isDragging, setIsDragging] = useState(false);
  const [draggedSide, setDraggedSide] = useState(null);
  const [hoveredSide, setHoveredSide] = useState(null);
  const [startPos, setStartPos] = useState(null);
  const liveCanvasRef = useRef(null);
  const liveImgRef = useRef(null);

  const [cooldownValue, setCooldownValue] = useState(2.0);
  const [consecutiveValue, setConsecutiveValue] = useState(3);
  const [isUpdatingParams, setIsUpdatingParams] = useState(false);

  const [isAutoCapturingEnabled, setIsAutoCapturingEnabled] = useState(false);
  const [isStartingDetection, setIsStartingDetection] = useState(false);
  const [isStoppingDetection, setIsStoppingDetection] = useState(false);

  const isBusy = isStartingCamera || isStoppingCamera;

  const feedCandidates = useMemo(() => {
    if (!isCameraRunning) {
      return [];
    }
    const merged = [...cameraStreamCandidates, liveFrameUrl].filter(Boolean);
    return Array.from(new Set(merged));
  }, [cameraStreamCandidates, isCameraRunning, liveFrameUrl]);

  useEffect(() => {
    setSourceIndex(0);
  }, [liveFrameUrl]);

  useEffect(() => {
    // Fetch detection parameters on mount
    fetch("http://localhost:5000/api/detection/cooldown")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setCooldownValue(data.cooldown);
          setConsecutiveValue(data.consecutiveRequired);
        }
      })
      .catch(() => {
        // silently fail; use defaults
      });

    // Fetch auto-capture status on mount
    fetch("http://localhost:5000/api/detection/auto-capture")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setIsAutoCapturingEnabled(data.enabled);
        }
      })
      .catch(() => {
        // silently fail; use defaults
      });
  }, []);

  useEffect(() => {
    if (isCameraRunning) {

        setSourceIndex(0);

        const timer = setTimeout(() => {
            setRetryNonce(prev => prev + 1);
        }, 800);

        return () => clearTimeout(timer);
    }

}, [isCameraRunning]);

  useEffect(() => {
    setSourceIndex((current) => (current < feedCandidates.length ? current : 0));
  }, [feedCandidates.length]);

  const activeFeedUrl = useMemo(() => {
    if (!isCameraRunning) {
        return null;
    }

    return `${API_BASE_URL}/api/camera/stream?r=${retryNonce}`;
}, [isCameraRunning, retryNonce]);

  const drawLiveRoi = useCallback(() => {
    const canvas = liveCanvasRef.current;
    const img = liveImgRef.current;
    if (!canvas || !img || !img.naturalWidth || !img.naturalHeight) return;

    const viewW = canvas.clientWidth;
    const viewH = canvas.clientHeight;
    if (!viewW || !viewH) return;
    canvas.width = viewW;
    canvas.height = viewH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = Math.min(viewW / img.naturalWidth, viewH / img.naturalHeight);
    const renderW = img.naturalWidth * scale;
    const renderH = img.naturalHeight * scale;
    const offsetX = (viewW - renderW) / 2;
    const offsetY = (viewH - renderH) / 2;

    const { x, y, w, h } = roi;
    const rx = offsetX + x * scale;
    const ry = offsetY + y * scale;
    const rw = w * scale;
    const rh = h * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = "rgba(0,255,0,0.12)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.font = "12px Arial";
    ctx.fillStyle = "#00FF00";
    ctx.fillText(`ROI (${w}x${h})`, rx + 5, Math.max(14, ry - 6));
    ctx.restore();
  }, [roi]);

  useEffect(() => {
    drawLiveRoi();
  }, [drawLiveRoi, activeFeedUrl]);

  const getLiveCanvasPoint = (e) => {
    const canvas = liveCanvasRef.current;
    const img = liveImgRef.current;
    if (!canvas || !img || !img.naturalWidth || !img.naturalHeight) return null;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const renderW = img.naturalWidth * scale;
    const renderH = img.naturalHeight * scale;
    const offsetX = (rect.width - renderW) / 2;
    const offsetY = (rect.height - renderH) / 2;

    // Ignore mouse events outside rendered image area
    if (cx < offsetX || cy < offsetY || cx > offsetX + renderW || cy > offsetY + renderH) {
      return null;
    }

    return {
      x: ((cx - offsetX) / renderW) * img.naturalWidth,
      y: ((cy - offsetY) / renderH) * img.naturalHeight
    };
  };

  const getLiveClickedSide = (x, y, currentRoi) => {
    const { x: rx, y: ry, w, h } = currentRoi;
    const threshold = 14;

    if (Math.abs(x - rx) <= threshold && Math.abs(y - ry) <= threshold) return "corner-tl";
    if (Math.abs(x - (rx + w)) <= threshold && Math.abs(y - ry) <= threshold) return "corner-tr";
    if (Math.abs(x - rx) <= threshold && Math.abs(y - (ry + h)) <= threshold) return "corner-bl";
    if (Math.abs(x - (rx + w)) <= threshold && Math.abs(y - (ry + h)) <= threshold) return "corner-br";

    if (x >= rx - threshold && x <= rx + w + threshold && y >= ry - threshold && y <= ry + threshold) return "top";
    if (x >= rx - threshold && x <= rx + w + threshold && y >= ry + h - threshold && y <= ry + h + threshold) return "bottom";
    if (x >= rx - threshold && x <= rx + threshold && y >= ry - threshold && y <= ry + h + threshold) return "left";
    if (x >= rx + w - threshold && x <= rx + w + threshold && y >= ry - threshold && y <= ry + h + threshold) return "right";
    if (x >= rx && x <= rx + w && y >= ry && y <= ry + h) return "move";
    return null;
  };

  const getCursorForSide = (side) => {
    if (!side) return "crosshair";
    if (side === "left" || side === "right") return "ew-resize";
    if (side === "top" || side === "bottom") return "ns-resize";
    if (side === "corner-tl" || side === "corner-br") return "nwse-resize";
    if (side === "corner-tr" || side === "corner-bl") return "nesw-resize";
    if (side === "move") return "move";
    return "crosshair";
  };

  const handleLiveCanvasMouseDown = (e) => {
    const point = getLiveCanvasPoint(e);
    if (!point) return;
    const { x, y } = point;
    const side = getLiveClickedSide(x, y, roi);
    if (!side) return;
    setIsDragging(true);
    setDraggedSide(side);
    setStartPos({ x, y, roi });
  };

  const handleLiveCanvasMouseMove = (e) => {
    const point = getLiveCanvasPoint(e);
    if (!point) return;
    const { x: currentX, y: currentY } = point;

    if (!isDragging || !draggedSide || !startPos) {
      setHoveredSide(getLiveClickedSide(currentX, currentY, roi));
      return;
    }

    const deltaX = currentX - startPos.x;
    const deltaY = currentY - startPos.y;
    const { x, y, w, h } = startPos.roi;
    let newRoi = { ...roi };

    if (draggedSide === "move") {
      newRoi = { x: x + deltaX, y: y + deltaY, w, h };
    } else if (draggedSide === "top") {
      newRoi = { x, y: y + deltaY, w, h: Math.max(50, h - deltaY) };
    } else if (draggedSide === "bottom") {
      newRoi = { x, y, w, h: Math.max(50, h + deltaY) };
    } else if (draggedSide === "left") {
      newRoi = { x: x + deltaX, y, w: Math.max(50, w - deltaX), h };
    } else if (draggedSide === "right") {
      newRoi = { x, y, w: Math.max(50, w + deltaX), h };
    } else if (draggedSide === "corner-tl") {
      newRoi = { x: x + deltaX, y: y + deltaY, w: Math.max(50, w - deltaX), h: Math.max(50, h - deltaY) };
    } else if (draggedSide === "corner-tr") {
      newRoi = { x, y: y + deltaY, w: Math.max(50, w + deltaX), h: Math.max(50, h - deltaY) };
    } else if (draggedSide === "corner-bl") {
      newRoi = { x: x + deltaX, y, w: Math.max(50, w - deltaX), h: Math.max(50, h + deltaY) };
    } else if (draggedSide === "corner-br") {
      newRoi = { x, y, w: Math.max(50, w + deltaX), h: Math.max(50, h + deltaY) };
    }

    const img = liveImgRef.current;
    const maxX = img?.naturalWidth || 0;
    const maxY = img?.naturalHeight || 0;
    if (!maxX || !maxY) return;

    newRoi.x = Math.round(Math.max(0, Math.min(newRoi.x, maxX - 50)));
    newRoi.y = Math.round(Math.max(0, Math.min(newRoi.y, maxY - 50)));
    newRoi.w = Math.round(Math.max(50, Math.min(newRoi.w, maxX - newRoi.x)));
    newRoi.h = Math.round(Math.max(50, Math.min(newRoi.h, maxY - newRoi.y)));
    updateRoi(newRoi);
  };

  const stopDragging = () => {
    setIsDragging(false);
    setDraggedSide(null);
    setStartPos(null);
  };

  const updateDetectionParameters = async () => {
    setIsUpdatingParams(true);
    try {
      const response = await fetch("http://localhost:5000/api/detection/cooldown", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cooldown: parseFloat(cooldownValue),
          consecutiveRequired: parseInt(consecutiveValue, 10)
        })
      });
      const data = await response.json();
      if (data.ok) {
        console.log("Detection parameters updated:", data);
      }
    } catch (err) {
      console.error("Failed to update detection parameters:", err);
    } finally {
      setIsUpdatingParams(false);
    }
  };

  const startDetection = async () => {
    if (!isCameraRunning) {
      console.error("Camera must be running to start detection");
      return;
    }
    
    setIsStartingDetection(true);
    try {
      const response = await fetch("http://localhost:5000/api/detection/auto-capture", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          roi: roi
        })
      });
      const data = await response.json();
      if (data.ok) {
        setIsAutoCapturingEnabled(true);
        console.log("Auto-capture detection started with ROI:", roi);
      } else {
        console.error("Failed to start detection:", data.error);
      }
    } catch (err) {
      console.error("Failed to start detection:", err);
    } finally {
      setIsStartingDetection(false);
    }
  };

  const stopDetection = async () => {
    setIsStoppingDetection(true);
    try {
      const response = await fetch("http://localhost:5000/api/detection/auto-capture", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: false
        })
      });
      const data = await response.json();
      if (data.ok) {
        setIsAutoCapturingEnabled(false);
        console.log("Auto-capture detection stopped");
      } else {
        console.error("Failed to stop detection:", data.error);
      }
    } catch (err) {
      console.error("Failed to stop detection:", err);
    } finally {
      setIsStoppingDetection(false);
    }
  };

  const handleCanvasMouseLeave = () => {
    setIsDragging(false);
    setDraggedSide(null);
    setStartPos(null);
    setHoveredSide(null);
  };

  const handleFeedError = () => {
    setSourceIndex((current) => {
      if (current >= feedCandidates.length - 1) {
        window.setTimeout(() => {
          setRetryNonce((nonce) => nonce + 1);
        }, 350);
        return current;
      }
      return current + 1;
    });
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-[var(--panel-border)] bg-[#d9dde3] p-2 shadow-sm">
      <div className="mb-2 flex items-center justify-between border-b border-[#b9c2ce] px-1.5 pb-1.5">
        <h3 className="text-[22px] font-bold text-steel-700">Camera Feed</h3>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${isConnected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {isConnected ? "Realtime Connected" : "Realtime Offline"}
          </span>
          <div className="flex gap-2 text-[#8694aa]">
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 rounded-md border border-[#8ba0b8] bg-[#21497b] p-2 shadow-inner xl:grid-cols-[220px_minmax(0,1fr)_170px]">
        <aside className="max-h-full overflow-y-auto rounded border border-[#5d7795] bg-[#1b3f6a] p-2 text-white">
          <p className="mb-2 border-b border-white/15 pb-1 text-xs font-bold uppercase tracking-wider text-white/80">Controls</p>

          <div className="space-y-2">
            <div className="rounded border border-white/15 bg-[#18375d] p-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">Camera Settings</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="rounded bg-[#133153] px-2 py-1 text-white/85">Device: {cameraSettings.device || "USB Camera 0"}</div>
                <div className="rounded bg-[#133153] px-2 py-1 text-white/85">Resolution: {cameraSettings.resolution || "1920 x 1080 (Full HD)"}</div>
                <div className="rounded bg-[#133153] px-2 py-1 text-white/85">Mode: {cameraSettings.captureMode || "Continuous"}</div>
              </div>
            </div>

            <div className="rounded border border-white/15 bg-[#18375d] p-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">Capture</p>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                <button
                  className="rounded bg-gradient-to-b from-emerald-600 to-emerald-700 px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={isCameraRunning ? onStopCamera : onStartCamera}
                  disabled={isBusy}
                >
                  {isStartingCamera ? "Starting..." : isStoppingCamera ? "Stopping..." : isCameraRunning ? "Stop Camera" : "Start Camera"}
                </button>
                <button
                  className="rounded bg-gradient-to-b from-blue-600 to-blue-700 px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={() => {
                    if (!isCameraRunning || isCapturingVariation || isBusy) return;
                    if (onCaptureVariation) onCaptureVariation(roi, isDefectLabelEnabled);
                  }}
                  disabled={!isCameraRunning || isCapturingVariation || isBusy}
                >
                  {isCapturingVariation ? "Capturing..." : "Capture Variation"}
                </button>
                <button
                  className="rounded bg-gradient-to-b from-purple-600 to-purple-700 px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                >
                  Upload Image
                </button>
                <button
                  className={`rounded px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDefectLabelEnabled
                      ? "bg-gradient-to-b from-red-600 to-red-700"
                      : "bg-gradient-to-b from-slate-500 to-slate-600"
                  }`}
                  type="button"
                  onClick={() => setIsDefectLabelEnabled((prev) => !prev)}
                  disabled={isCapturingVariation || isBusy}
                >
                  Defect: {isDefectLabelEnabled ? "ON" : "OFF"}
                </button>
                <div className="rounded border border-white/15 bg-[#18375d] p-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">Detection Parameters</p>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <label className="w-20 text-white/75">Cooldown (s):</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={cooldownValue}
                        onChange={(e) => setCooldownValue(parseFloat(e.target.value) || 0)}
                        className="flex-1 rounded bg-[#133153] px-1.5 py-0.5 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="w-20 text-white/75">Frames:</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="1"
                        value={consecutiveValue}
                        onChange={(e) => setConsecutiveValue(parseInt(e.target.value, 10) || 1)}
                        className="flex-1 rounded bg-[#133153] px-1.5 py-0.5 text-xs text-white"
                      />
                    </div>
                    <button
                      className="w-full rounded bg-gradient-to-b from-amber-600 to-amber-700 px-2 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={updateDetectionParameters}
                      disabled={isUpdatingParams}
                    >
                      {isUpdatingParams ? "Updating..." : "Update Params"}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </aside>

        <div className="min-h-0 rounded border border-[#5f7894] bg-gradient-to-b from-[#2a4e78] via-[#35597f] to-[#20456e] p-2">
          <div className="relative h-full min-h-[300px] overflow-hidden rounded border border-[#8ea7bf] bg-gradient-to-b from-[#e7edf5] to-[#bcc8d8]">
            {activeFeedUrl ? (
              <>
                <img
                  ref={liveImgRef}
                  src={isCameraRunning ? `${API_BASE_URL}/api/camera/stream` : ""}
                  alt="Live camera stream"
                  className="absolute inset-0 h-full w-full object-contain"
                  onError={handleFeedError}
                  onLoad={drawLiveRoi}
                  style={{ pointerEvents: "none" }}
                />
                <canvas
                  ref={liveCanvasRef}
                  className="absolute inset-0 h-full w-full"
                  style={{ cursor: getCursorForSide(isDragging ? draggedSide : hoveredSide) }}
                  onMouseDown={handleLiveCanvasMouseDown}
                  onMouseMove={handleLiveCanvasMouseMove}
                  onMouseUp={stopDragging}
                  onMouseLeave={handleCanvasMouseLeave}
                />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[16px] font-semibold text-[#5b6f86]">
                {isCameraRunning ? "CONNECTING CAMERA VIEW" : "CAMERA STOPPED"}
              </div>
            )}

            <div className="pointer-events-none absolute inset-4 rounded border-2 border-[#ef4444]" />
            <div className="pointer-events-none absolute bottom-4 left-4 rounded bg-[#ef4444] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              L - Left Zone
            </div>

            <div className="pointer-events-none absolute inset-y-6 left-1/3 w-0 border-l-2 border-dashed border-[#ef4444]" />
            <div className="pointer-events-none absolute inset-y-6 right-1/3 w-0 border-l-2 border-dashed border-[#ef4444]" />

            <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              LCR Overlay Active
            </div>
          </div>
        </div>

        <aside className="max-h-full overflow-y-auto rounded border border-[#5d7795] bg-[#1b3f6a] p-2 text-white">
          <p className="mb-2 border-b border-white/15 pb-1 text-xs font-bold uppercase tracking-wider text-white/80">Results</p>

          <div className="space-y-1.5 text-xs">
            <div className="rounded bg-[#133153] px-2 py-1.5">
              <p className="text-white/65">dE</p>
              <p className="text-sm font-bold text-white">{deltaEValue.toFixed(2)}</p>
            </div>
            <div className="rounded bg-[#133153] px-2 py-1.5">
              <p className="text-white/65">Density</p>
              <p className="text-sm font-bold text-white">{densityValue.toFixed(2)}</p>
            </div>
            <div className="rounded bg-[#133153] px-2 py-1.5">
              <p className="text-white/65">Status</p>
              <p className={`text-sm font-bold ${statusLabel.toLowerCase().includes("defect") ? "text-amber-300" : "text-emerald-300"}`}>{statusLabel}</p>
            </div>
            
            <div className="rounded border border-white/15 bg-[#18375d] p-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">Auto Capture</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="rounded bg-[#133153] px-2 py-1 text-white/75">
                  ROI: ({roi.x}, {roi.y}) {roi.w}×{roi.h}
                </div>
                <div className="rounded bg-[#133153] px-2 py-1 text-white/75">
                  Status: {isAutoCapturingEnabled ? "🟢 Capturing" : "🔴 Stopped"}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    className={`rounded px-2 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                      isAutoCapturingEnabled
                        ? "bg-gradient-to-b from-slate-500 to-slate-600"
                        : "bg-gradient-to-b from-lime-600 to-lime-700"
                    }`}
                    type="button"
                    onClick={startDetection}
                    disabled={!isCameraRunning || isAutoCapturingEnabled || isStartingDetection || isStoppingDetection || isBusy}
                  >
                    {isStartingDetection ? "Starting..." : "Start"}
                  </button>
                  <button
                    className={`rounded px-2 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                      isAutoCapturingEnabled
                        ? "bg-gradient-to-b from-red-600 to-red-700"
                        : "bg-gradient-to-b from-slate-500 to-slate-600"
                    }`}
                    type="button"
                    onClick={stopDetection}
                    disabled={!isAutoCapturingEnabled || isStoppingDetection || isStartingDetection || isBusy}
                  >
                    {isStoppingDetection ? "Stopping..." : "Stop"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {errorMessage && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 rounded border border-[#b6c1cf] bg-[#e3e8ef] p-1.5 text-[11px] font-semibold text-[#36506e] md:grid-cols-4">
        <div className="rounded border border-[#c3ceda] bg-[#f1f4f8] px-2 py-1">Frame Info: Backend Stream</div>
        <div className="rounded border border-[#c3ceda] bg-[#f1f4f8] px-2 py-1">Detection: {isConnected ? "Realtime" : "Polling"}</div>
        <div className="rounded border border-[#c3ceda] bg-[#f1f4f8] px-2 py-1">Camera: {isCameraRunning ? "Running" : "Stopped"}</div>
        <div className="rounded border border-[#c3ceda] bg-[#f1f4f8] px-2 py-1">Feed: {activeFeedUrl ? "Live image" : isCameraRunning ? "Connecting" : "No frame"}</div>
      </div>

      <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
    </section>
  );
}

export default CameraFeed;