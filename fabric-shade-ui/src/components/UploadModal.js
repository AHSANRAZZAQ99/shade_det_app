import React, { useState, useRef, useCallback, useEffect } from "react";

import axios from "axios";

// Use environment variable or fallback
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function UploadModal({ isOpen, onClose }) {
  const fileInputRef = useRef(null);
  const imageCanvasRef = useRef(null);

  // State
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, processing, roi-ready, labeling
  const [baseImage, setBaseImage] = useState(null);
  const [roi, setRoi] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [draggedSide, setDraggedSide] = useState(null);
  const [hoveredSide, setHoveredSide] = useState(null);
  const [startPos, setStartPos] = useState(null);
  
  // Label dialog
  const [labelChoice, setLabelChoice] = useState(null);
  const [selectedSide, setSelectedSide] = useState("center");
  const [isLabelSaving, setIsLabelSaving] = useState(false);
  const [labelMessage, setLabelMessage] = useState("");

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploadStatus("processing");

    const formData = new FormData();
    formData.append("image", file);

    axios
      .post(`${API_BASE_URL}/api/upload-image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10000
      })
      .then((res) => {
        const data = res.data;
        if (data.ok) {
          setSessionId(data.sessionId);
          setRoi(data.roi);
          setImageSize(data.imageSize);
          setPrediction(null); // Do NOT run detection yet

          const img = new Image();
          img.onload = () => {
            setBaseImage(img);
            setImageSize({ width: img.width, height: img.height });
            redrawCanvas(img, data.roi);
            setUploadStatus("roi-ready");
          };
          img.onerror = () => {
            setError(`Failed to load image from ${data.imagePath}`);
            setUploadStatus("idle");
          };
          img.src = data.imagePath;
        } else {
          // Show detailed error info from backend
          let errorMsg = data.error || "Upload failed";
          if (data.debugPath) {
            errorMsg += ` | Path: ${data.debugPath}`;
          }
          if (data.folderContents) {
            errorMsg += ` | Files: ${data.folderContents.length}`;
          }
          setError(errorMsg);
          setUploadStatus("idle");
        }
      })
      .catch((err) => {
        const errMsg = err.response?.data?.error || err.message || "Upload error";
        setError(`Upload failed: ${errMsg}`);
        setUploadStatus("idle");
      });
  };

  // Blinking state for overlay
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    if (!prediction || !roi) return;
    if (!prediction.defectDetected || prediction.variationZone === "NONE") return;
    const interval = setInterval(() => setBlink((b) => !b), 500);
    return () => clearInterval(interval);
  }, [prediction, roi]);

  const redrawCanvas = useCallback((image, currentRoi) => {
  if (!imageCanvasRef.current || !image) return;

  const canvas = imageCanvasRef.current;
  const ctx = canvas.getContext("2d");

  //  Always reset canvas properly
  canvas.width = image.width;
  canvas.height = image.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Prevent drawing invalid ROI
  if (
    !currentRoi ||
    currentRoi.w <= 0 ||
    currentRoi.h <= 0
  ) return;

  const { x, y, w, h } = currentRoi;

  // 🔍 Debug (you can remove later)
  console.log("Drawing ROI:", currentRoi);

  ctx.save(); // isolate drawing

  //  ROI transparent fill
  ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
  ctx.fillRect(x, y, w, h);

  //  Blinking defect overlay
  if (
    prediction &&
    prediction.defectDetected &&
    prediction.variationZone !== "NONE" &&
    blink
  ) {
    let zx = x, zw = w;

    if (prediction.variationZone === "LEFT") {
      zw = Math.floor(w / 3);
    } else if (prediction.variationZone === "CENTER") {
      zx = x + Math.floor(w / 3);
      zw = Math.floor(w / 3);
    } else if (prediction.variationZone === "RIGHT") {
      zx = x + Math.floor(2 * w / 3);
      zw = w - Math.floor(2 * w / 3);
    }

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#ff2222";
    ctx.fillRect(zx, y, zw, h);
    ctx.globalAlpha = 1;
  }

  //  ROI border
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Corner handles
  const r = 8;
  ctx.fillStyle = "#00FF00";

  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h]
  ];

  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Side handles
  const sideR = 6;
  const sides = [
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x, y + h / 2],
    [x + w, y + h / 2]
  ];

  sides.forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, sideR, 0, Math.PI * 2);
    ctx.fill();
  });

  //  Label
  ctx.fillStyle = "#00FF00";
  ctx.font = "12px Arial";
  ctx.fillText(`ROI (${w}x${h})`, x + 5, y - 5);

  ctx.restore(); //  restore state

}, [prediction, blink]);

  const getHitPadding = () => {
    const canvas = imageCanvasRef.current;
    if (!canvas) {
      return 20;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const scaleY = canvas.height / Math.max(rect.height, 1);
    const scale = Math.max(scaleX, scaleY);

    return Math.max(14, Math.round(12 * scale));
  };

  const getClickedSide = (x, y, roi) => {
    if (!roi) return null;

    const { x: rx, y: ry, w, h } = roi;
    const threshold = getHitPadding();
    const cornerThreshold = Math.round(threshold * 1.5);

    if (Math.abs(x - rx) <= cornerThreshold && Math.abs(y - ry) <= cornerThreshold) return "corner-tl";
    if (Math.abs(x - (rx + w)) <= cornerThreshold && Math.abs(y - ry) <= cornerThreshold) return "corner-tr";
    if (Math.abs(x - rx) <= cornerThreshold && Math.abs(y - (ry + h)) <= cornerThreshold) return "corner-bl";
    if (Math.abs(x - (rx + w)) <= cornerThreshold && Math.abs(y - (ry + h)) <= cornerThreshold) return "corner-br";

    const halfW = w / 2;
    const halfH = h / 2;
    const sideHandleRange = Math.max(threshold, 16);
    if (
      Math.abs(x - (rx + halfW)) <= sideHandleRange &&
      Math.abs(y - ry) <= sideHandleRange
    ) {
      return "top";
    }
    if (
      Math.abs(x - (rx + halfW)) <= sideHandleRange &&
      Math.abs(y - (ry + h)) <= sideHandleRange
    ) {
      return "bottom";
    }
    if (
      Math.abs(x - rx) <= sideHandleRange &&
      Math.abs(y - (ry + halfH)) <= sideHandleRange
    ) {
      return "left";
    }
    if (
      Math.abs(x - (rx + w)) <= sideHandleRange &&
      Math.abs(y - (ry + halfH)) <= sideHandleRange
    ) {
      return "right";
    }

    if (
      y >= ry - threshold &&
      y <= ry + threshold &&
      x >= rx - threshold &&
      x <= rx + w + threshold
    ) {
      return "top";
    }

    if (
      y >= ry + h - threshold &&
      y <= ry + h + threshold &&
      x >= rx - threshold &&
      x <= rx + w + threshold
    ) {
      return "bottom";
    }

    if (
      x >= rx - threshold &&
      x <= rx + threshold &&
      y >= ry - threshold &&
      y <= ry + h + threshold
    ) {
      return "left";
    }

    if (
      x >= rx + w - threshold &&
      x <= rx + w + threshold &&
      y >= ry - threshold &&
      y <= ry + h + threshold
    ) {
      return "right";
    }

    if (x >= rx && x <= rx + w && y >= ry && y <= ry + h) return "move";

    return null;
  };

  const getCanvasPoint = (e) => {
    const canvas = imageCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasMouseDown = (e) => {
    if (!roi || !baseImage) return;

    const { x, y } = getCanvasPoint(e);

    const side = getClickedSide(x, y, roi);
    if (side) {
      setIsDragging(true);
      setDraggedSide(side);
      setStartPos({ x, y, roi });
    }
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

  const handleCanvasMouseMove = (e) => {
    if (!roi) return;

    const { x: currentX, y: currentY } = getCanvasPoint(e);

    if (!isDragging || !draggedSide || !startPos) {
      const side = getClickedSide(currentX, currentY, roi);
      setHoveredSide(side);
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
      newRoi = {
        x: x + deltaX,
        y: y + deltaY,
        w: Math.max(50, w - deltaX),
        h: Math.max(50, h - deltaY)
      };
    } else if (draggedSide === "corner-tr") {
      newRoi = {
        x: x,
        y: y + deltaY,
        w: Math.max(50, w + deltaX),
        h: Math.max(50, h - deltaY)
      };
    } else if (draggedSide === "corner-bl") {
      newRoi = {
        x: x + deltaX,
        y: y,
        w: Math.max(50, w - deltaX),
        h: Math.max(50, h + deltaY)
      };
    } else if (draggedSide === "corner-br") {
      newRoi = {
        x: x,
        y: y,
        w: Math.max(50, w + deltaX),
        h: Math.max(50, h + deltaY)
      };
    }

    const maxX = baseImage?.width || imageSize?.width || 0;
    const maxY = baseImage?.height || imageSize?.height || 0;

    if (!maxX || !maxY) {
      return;
    }

    newRoi.x = Math.round(Math.max(0, Math.min(newRoi.x, maxX - 50)));
    newRoi.y = Math.round(Math.max(0, Math.min(newRoi.y, maxY - 50)));
    newRoi.w = Math.round(Math.max(50, Math.min(newRoi.w, maxX - newRoi.x)));
    newRoi.h = Math.round(Math.max(50, Math.min(newRoi.h, maxY - newRoi.y)));

    setRoi(newRoi);
    redrawCanvas(baseImage, newRoi);
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setDraggedSide(null);
    setStartPos(null);
  };

  const handleCanvasMouseLeave = () => {
    setIsDragging(false);
    setDraggedSide(null);
    setStartPos(null);
    setHoveredSide(null);
  };

  const handleSaveRoi = async () => {
  if (!roi || !sessionId) return;

  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/upload/update-roi`,
      {
        x: roi.x,
        y: roi.y,
        w: roi.w,
        h: roi.h
      },
      {
        timeout: 5000
      }
    );

    if (res.data.ok) {
      setPrediction({
        defectDetected: res.data.defectDetected,
        defectType: res.data.prediction,
        deltaE: res.data.deltaE || 0,
        density: res.data.density || 0,
        variationZone: res.data.variationZone || "NONE"
      });

      setUploadStatus("labeling");
    } else {
      setError(res.data.error || "Failed to save ROI");
    }

  } catch (err) {
    setError(err?.message || "ROI save error");
    console.error("ROI API ERROR:", err);
  }
};

  const handleConfirmLabel = async () => {
    if (!labelChoice) {
      setLabelMessage("Please select Yes or No");
      return;
    }

    setIsLabelSaving(true);
    setLabelMessage("");

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/upload/confirm-label`,
        {
          label: labelChoice,
          side: selectedSide
        },
        { timeout: 5000 }
      );

      if (res.data.ok) {
        setLabelMessage(
          labelChoice === "yes"
            ? `✓ Saved to ${selectedSide} dataset`
            : "✓ Image discarded"
        );
        setTimeout(() => {
          resetForm();
          onClose();
        }, 1500);
      } else {
        setLabelMessage(res.data.error || "Label save failed");
      }
    } catch (err) {
      setLabelMessage(err.message || "Label error");
    } finally {
      setIsLabelSaving(false);
    }
  };

  const resetForm = () => {
    setUploadStatus("idle");
    setBaseImage(null);
    setRoi(null);
    setImageSize(null);
    setSessionId(null);
    setPrediction(null);
    setError("");
    setLabelChoice(null);
    setSelectedSide("center");
    setLabelMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!baseImage) return;
    redrawCanvas(baseImage, roi);
  }, [baseImage, roi, redrawCanvas]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="h-[80vh] w-[90vw] max-w-4xl rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-800">Upload & Label Image</h2>
          <button
            onClick={handleClose}
            className="text-2xl text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(100%-100px)] flex-col gap-3 overflow-auto p-4">
          {error && (
            <div className="rounded bg-red-100 p-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {uploadStatus === "idle" && (
            <div className="flex flex-1 items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50">
              <div className="text-center">
                <p className="mb-3 text-sm font-semibold text-gray-600">
                  Select a fabric image to upload
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Choose File
                </button>
              </div>
            </div>
          )}

          {uploadStatus !== "idle" && baseImage && (
            <>
              {/* Canvas */}
              <div className="h-[300px] rounded border border-gray-300 bg-black p-2">
                <canvas
                  ref={imageCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
                  className="h-full w-full rounded"
                  style={{ cursor: getCursorForSide(isDragging ? draggedSide : hoveredSide) }}
                />
              </div>

              {/* Info */}
              {prediction && (
                <div className="grid grid-cols-5 gap-2 rounded bg-gray-100 p-2 text-xs">
                  <div>
                    <span className="font-bold">Type: </span>{prediction.defectType}
                  </div>
                  <div>
                    <span className="font-bold">Defect: </span>
                    <span className={prediction.defectDetected ? "text-red-600" : "text-green-600"}>
                      {prediction.defectDetected ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">ΔE: </span>{prediction.deltaE?.toFixed(2)}
                  </div>
                  <div>
                    <span className="font-bold">Density: </span>{prediction.density?.toFixed(3)}
                  </div>
                  <div>
                    <span className="font-bold">Zone: </span>{prediction.variationZone || "NONE"}
                  </div>
                </div>
              )}

              {/* ROI Button */}
              {uploadStatus === "roi-ready" && (
                <button
                  onClick={handleSaveRoi}
                  className="w-full rounded bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"
                >
                  Confirm ROI & Continue
                </button>
              )}

              {/* Label Dialog */}
              {uploadStatus === "labeling" && (
                <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-gray-700">Is the detection correct?</p>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLabelChoice("yes")}
                      className={`flex-1 rounded px-3 py-1.5 text-xs font-bold ${
                        labelChoice === "yes"
                          ? "bg-green-600 text-white"
                          : "border border-green-600 text-green-600 hover:bg-green-50"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setLabelChoice("no")}
                      className={`flex-1 rounded px-3 py-1.5 text-xs font-bold ${
                        labelChoice === "no"
                          ? "bg-red-600 text-white"
                          : "border border-red-600 text-red-600 hover:bg-red-50"
                      }`}
                    >
                      No
                    </button>
                  </div>

                  {labelChoice === "yes" && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-700">Select fabric side:</p>
                      <div className="flex gap-2">
                        {["defect", "no_defect"].map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedSide(s)}
                            className={`flex-1 rounded px-2 py-1 text-xs font-bold ${
                              selectedSide === s
                                ? "bg-blue-600 text-white"
                                : "border border-blue-600 text-blue-600 hover:bg-blue-50"
                            }`}
                          >
                            {s === "no_defect" ? "No Defect" : s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {labelMessage && (
                    <div className={`rounded p-2 text-xs text-center font-semibold ${
                      labelMessage.includes("✓")
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {labelMessage}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleClose}
                      disabled={isLabelSaving}
                      className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmLabel}
                      disabled={isLabelSaving || !labelChoice}
                      className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isLabelSaving ? "Saving..." : "Confirm"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadModal;
