import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || API_BASE_URL.replace(/^http/i, "ws");
const CAMERA_STREAM_PATHS = [
  process.env.REACT_APP_CAMERA_STREAM_PATH,
  "/api/camera/stream"
].filter(Boolean);
const RECENT_HISTORY_LIMIT = 20;
const LATEST_POLL_MS = 1800;
const DATA_POLL_MS = 6000;
const FRAME_STALE_MS = 2500;

const DEFAULT_SUMMARY = {
  deltaE: null,
  density: null,
  status: "Waiting"
};

const ZONE_KEYS = ["LEFT", "CENTER", "RIGHT"];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildZoneAnalysis(source) {
  const deltaValues = source?.deltaValues || {};
  const pixelDensity = source?.pixelDensity || {};
  const defectType = String(source?.defectType || source?.status || "").toUpperCase();

  const resolveVariation = (zone) => {
    const explicitKey = `${zone.toLowerCase()}_variation`;
    const densityKey = `${zone.toLowerCase()}_density`;
    const nestedDensity = pixelDensity[zone] ?? pixelDensity[zone.toLowerCase()];
    const candidate = source?.[explicitKey] ?? source?.[densityKey] ?? nestedDensity ?? source?.density ?? 0;
    const numeric = toNumber(candidate);
    return numeric <= 1 ? numeric * 100 : numeric;
  };

  const rows = ZONE_KEYS.map((zone) => {
    const zoneDelta = toNumber(deltaValues[zone.toLowerCase()] ?? deltaValues[zone] ?? source?.deltaE ?? 0);
    const variation = resolveVariation(zone);
    const zoneDefect = defectType.includes(zone) ? defectType : "-";

    return {
      zone,
      deltaE: zoneDelta,
      variation,
      density: variation,
      defectType: zoneDefect
    };
  });

  const overallVariation = toNumber(
    source?.overall_variation ??
    source?.overallVariation ??
    (rows.reduce((sum, row) => sum + row.variation, 0) / rows.length || 0)
  );

  return [...rows, {
    zone: "OVERALL",
    deltaE: toNumber(source?.deltaE ?? source?.metrics?.deltaE ?? 0),
    variation: overallVariation,
    density: overallVariation,
    defectType: source?.defectType || source?.status || "-"
  }];
}

function buildLogEntries(source) {
  const time = source?.time || parseTime(source?.timestamp) || new Date().toLocaleTimeString();
  const isDefect = Boolean(source?.defectDetected || source?.defect);
  const defectType = source?.defectType || source?.zone || "Unknown";
  const deltaText = toNumber(source?.deltaE).toFixed(2);
  const densityText = toNumber(source?.density).toFixed(2);

  const rows = [
    `${time} Image processed`,
    `${time} ${isDefect ? `Defect Detected: ${defectType}` : "No Defect Found"}`,
    `${time} ΔE: ${deltaText} | Density: ${densityText}`
  ];

  return rows;
}

function toArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

function toAbsoluteUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();

  if (
    !/^https?:\/\//i.test(trimmed) &&
    !/^data:/i.test(trimmed) &&
    !trimmed.startsWith("/") &&
    /^[a-zA-Z0-9+/=\r\n]+$/.test(trimmed) &&
    trimmed.length > 300
  ) {
    const normalizedBase64 = trimmed.replace(/[\r\n]/g, "");
    return `data:image/jpeg;base64,${normalizedBase64}`;
  }

  if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed;
  }

  return `${API_BASE_URL}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function parseTime(value) {
  if (!value) {
    return new Date().toLocaleTimeString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleTimeString();
}

function normalizeDefectItem(raw, index = 0) {

  const timestamp =
    raw.timestamp ||
    raw.created_at ||
    raw.createdAt ||
    raw.detectedAt ||
    raw.time ||
    new Date().toISOString();


  const imagePath =
    raw.image_path ||
    raw.imagePath ||
    raw.image_name ||
    null;


  const imageBase64 =
    raw.imageBase64 ||
    raw.frameBase64 ||
    null;


  const folder =
  raw.defect_detected === 1 ||
  raw.defectDetected === true
    ? "defect"
    : "no_defect";


const imageUrl = raw.image_path
  ? toAbsoluteUrl(
      `/api/defects/image/${folder}/${raw.image_path}`
    )
  : toAbsoluteUrl(
      raw.imageUrl ||
      raw.image ||
      raw.frameUrl ||
      raw.fileUrl ||
      raw.path ||
      imageBase64
    );


  const thumbnailUrl = toAbsoluteUrl(
    raw.thumbnailUrl ||
    raw.thumb ||
    raw.previewUrl ||
    raw.thumbnailBase64 ||
    imageUrl
  );


  return {

    id: String(
      raw.id ||
      raw.image_name ||
      raw.name ||
      raw.fileName ||
      `defect-${Date.now()}-${index}`
    ),


    zone:
      raw.zone ||
      raw.region ||
      "Global",


    time: parseTime(timestamp),


    timestamp,


    deltaE: Number(
      raw.deltaE ??
      raw.de ??
      raw.metrics?.deltaE ??
      0
    ),


    density: Number(
      raw.density ??
      raw.metrics?.density ??
      raw.ratio ??
      raw.confidence ??
      0
    ),


    imageUrl,


    thumbnailUrl,


    status:
      raw.defect_detected === 1 ||
      raw.defectDetected === true
        ? "Defect Detected"
        : "No Defect",


    defectType:
      raw.defect_type ||
      raw.defectType ||
      "UNKNOWN"

  };
}

async function firstSuccessfulGet(paths, params) {
  let lastError = null;

  for (const path of paths) {
    try {
      const response = await axios.get(`${API_BASE_URL}${path}`, { params, timeout: 4000 });
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function firstSuccessfulPost(paths, body = {}) {
  let lastError = null;

  for (const path of paths) {
    try {
      const response = await axios.post(`${API_BASE_URL}${path}`, body, { timeout: 4000 });
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function useDetectionFeed() {
  const [isConnected, setIsConnected] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [liveFrameUrl, setLiveFrameUrl] = useState(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isStoppingCamera, setIsStoppingCamera] = useState(false);
  const [isCapturingVariation, setIsCapturingVariation] = useState(false);
  const [latestSummary, setLatestSummary] = useState(DEFAULT_SUMMARY);
  const [zoneAnalysis, setZoneAnalysis] = useState(() => buildZoneAnalysis({}));
  const [recentLogs, setRecentLogs] = useState([]);
  const [recentDefects, setRecentDefects] = useState([]);
  const [dailyDatasets, setDailyDatasets] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const wsRef = useRef(null);
  const lastFrameAtRef = useRef(0);

  const cameraStreamCandidates = useMemo(
    () => CAMERA_STREAM_PATHS.map((path) => `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`),
    []
  );

  const refreshRecentDefects = useCallback(async () => {
    try {

      const payload = await firstSuccessfulGet(
        ["/api/defects"],
        { limit: RECENT_HISTORY_LIMIT }
      );


      const rows = toArray(
        payload?.defects ||
        payload?.data ||
        payload
      );


      const normalized = rows
        .map(normalizeDefectItem)
        .slice(0, RECENT_HISTORY_LIMIT);


      setRecentDefects(normalized);

      setErrorMessage("");


    } catch {

      setErrorMessage(
        (current) =>
          current || "Unable to load recent defect history from backend."
      );

    }

}, []);

  const refreshDailyDatasets = useCallback(async () => {
    try {
      const payload = await firstSuccessfulGet(["/api/defects/daily", "/api/storage/daily-folders"]);

      const folders = toArray(payload?.items || payload?.data || payload?.folders || payload).map((row) => ({
        date: row.date || row.folder || row.name || "Unknown",
        count: Number(row.count ?? row.total ?? row.images ?? 0),
        path: row.path || row.folderPath || "",
        samples: toArray(row.samples || row.images || []).map((img, index) =>
          normalizeDefectItem(typeof img === "string" ? { imageUrl: img, id: `${row.date || "daily"}-${index}` } : img, index)
        )
      }));

      setDailyDatasets(folders);
      setErrorMessage("");
    } catch {
      setErrorMessage((current) => current || "Unable to load daily timestamp folders from backend.");
    }
  }, []);

  const refreshLogs = useCallback(async () => {

  try {

    const payload = await firstSuccessfulGet([
      "/api/logs"
    ]);

    const logs = payload?.logs || [];


    const formattedLogs = logs.map((log)=>(
      `${parseTime(log.created_at)} ${log.message}`
    ));


    setRecentLogs(formattedLogs);


  } catch {

    console.log("Unable to load system logs");

  }

  }, []);

  const deleteDailyImage = useCallback(async (folderDate, imageId) => {
    if (!folderDate || !imageId) {
      return false;
    }

    try {
      setErrorMessage("");
      await axios.delete(
        `${API_BASE_URL}/api/storage/daily-folders/${encodeURIComponent(folderDate)}/images/${encodeURIComponent(imageId)}`,
        { timeout: 5000 }
      );
      await refreshDailyDatasets();
      return true;
    } catch {
      setErrorMessage("Unable to delete image from daily dataset folder.");
      return false;
    }
  }, [refreshDailyDatasets]);

  const deleteDailyFolder = useCallback(async (folderDate) => {
    if (!folderDate) {
      return false;
    }

    try {
      setErrorMessage("");
      await axios.delete(`${API_BASE_URL}/api/storage/daily-folders/${encodeURIComponent(folderDate)}`, { timeout: 5000 });
      await refreshDailyDatasets();
      return true;
    } catch {
      setErrorMessage("Unable to delete daily dataset folder.");
      return false;
    }
  }, [refreshDailyDatasets]);

  const clearRecentDefects = useCallback(async () => {
    try {
      setErrorMessage("");
      await axios.delete(`${API_BASE_URL}/api/defects/clear`, { timeout: 5000 });
      setRecentDefects([]);
      return true;
    } catch {
      setErrorMessage("Unable to clear defect history.");
      return false;
    }
  }, []);

  const refreshLatest = useCallback(async (force = false) => {
    if (!isCameraRunning && !force) {
      return;
    }

    try {
      const payload = await firstSuccessfulGet(["/api/detection/latest"]);

      const source = payload?.result || payload?.item || payload?.data || payload;

      setLiveFrameUrl(toAbsoluteUrl(source?.frameUrl || source?.imageUrl || source?.frame || source?.image || source?.imageBase64));
      lastFrameAtRef.current = Date.now();
      setLatestSummary({
        deltaE: Number(source?.deltaE ?? source?.de ?? source?.metrics?.deltaE ?? 0),
        density: Number(source?.density ?? source?.metrics?.density ?? source?.ratio ?? 0),
        status: source?.status || (source?.defectDetected || source?.defect ? "Defect Detected" : "No Defect")
      });
      setZoneAnalysis(buildZoneAnalysis(source));
      setRecentLogs((current) => [...buildLogEntries(source), ...current].slice(0, 30));
      setIsConnected(true);
      setErrorMessage("");
    } catch {
      setIsConnected(false);
    }
  }, [isCameraRunning]);

  const startCamera = useCallback(async () => {
    setIsStartingCamera(true);
    setErrorMessage("");
    setIsConnected(false);
    setLiveFrameUrl(null);
    lastFrameAtRef.current = 0;

    try {
      await axios.post(
    `${API_BASE_URL}/api/camera/start`,
    {},
    { timeout: 5000 }
);
      setIsCameraRunning(true);

      // Pull the first frame immediately, then retry a few times while the backend warms up.
      // Give camera time to initialize
      setTimeout(() => {
          refreshLatest(true);
      }, 500);

      void refreshRecentDefects();
      void refreshDailyDatasets();
      refreshLogs();
    } catch {
      setIsConnected(false);
      setIsCameraRunning(false);
      setErrorMessage("Unable to start camera from backend.");
    } finally {
      setIsStartingCamera(false);
    }
  }, [refreshDailyDatasets, refreshLatest, refreshRecentDefects]);

  const stopCamera = useCallback(async () => {
    setIsStoppingCamera(true);
    setErrorMessage("");
    setIsCameraRunning(false);
    setIsConnected(false);
    setLiveFrameUrl(null);
    setLatestSummary({
      deltaE: null,
      density: null,
      status: "Stopped"
    });

    try {
      await firstSuccessfulPost(["/api/camera/stop", "/api/camera/stop-stream", "/api/camera/off"]);
    } catch {
      setIsCameraRunning(true);
      setIsConnected(false);
      setErrorMessage("Unable to stop camera from backend.");
    } finally {
      setIsStoppingCamera(false);
    }
  }, []);

  const captureVariation = useCallback(async (roi = null, isDefectLabelEnabled = true) => {
    setIsCapturingVariation(true);

    try {
      const payload = await firstSuccessfulPost([
        "/api/camera/capture",
        "/api/defects/capture",
        "/api/camera/capture-defect",
        "/api/capture/variation"
      ], {
        ...(roi ? { roi } : {}),
        isDefectLabelEnabled: Boolean(isDefectLabelEnabled)
      });

      const source = payload?.result || payload;

      setLiveFrameUrl(toAbsoluteUrl(source?.imageBase64 || source?.imageUrl || source?.frameUrl || source?.image));
      setLatestSummary({
        deltaE: Number(source?.deltaE ?? 0),
        density: Number(source?.density ?? 0),
        status: source?.defectDetected ? "Defect Detected" : "No Defect"
      });
      setIsConnected(true);
      setZoneAnalysis(buildZoneAnalysis(source));
      setRecentLogs((current) => [...buildLogEntries(source), ...current].slice(0, 30));

      const normalized = normalizeDefectItem(source);
      setRecentDefects((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)].slice(0, RECENT_HISTORY_LIMIT));

      setErrorMessage("");

      void refreshRecentDefects();
      void refreshDailyDatasets();
    } catch {
      setErrorMessage("Unable to capture variation image from backend.");
    } finally {
      setIsCapturingVariation(false);
    }
  }, [refreshDailyDatasets, refreshRecentDefects]);

  useEffect(() => {
    let dataPollingId;

    const stopPolling = () => {
      if (dataPollingId) {
        window.clearInterval(dataPollingId);
        dataPollingId = undefined;
      }
    };

    const startPolling = () => {
      if (!dataPollingId) {
        dataPollingId = window.setInterval(() => {
          refreshRecentDefects();
          refreshDailyDatasets();
        }, DATA_POLL_MS);
      }
    };

    try {
      const ws = new WebSocket(`${WS_BASE_URL.replace(/\/$/, "")}/ws/detections`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
        stopPolling();
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data || "{}");

          if (payload.frameUrl || payload.imageUrl || payload.frame || payload.image) {
            setLiveFrameUrl(toAbsoluteUrl(payload.frameUrl || payload.imageUrl || payload.frame || payload.image));
            lastFrameAtRef.current = Date.now();
          }

          if (payload.metrics || payload.deltaE || payload.de || payload.density || payload.status || payload.defect !== undefined) {
            setLatestSummary({
              deltaE: Number(payload.deltaE ?? payload.de ?? payload.metrics?.deltaE ?? 0),
              density: Number(payload.density ?? payload.metrics?.density ?? payload.ratio ?? 0),
              status: payload.status || (payload.defect ? "Defect Detected" : "No Defect")
            });
            setZoneAnalysis(buildZoneAnalysis(payload));
            setRecentLogs((current) => [...buildLogEntries(payload), ...current].slice(0, 30));
          }

          const defectItems = toArray(payload.defect || payload.defects || payload.item);
          if (defectItems.length > 0) {
            setRecentDefects((current) => {
              const normalized = defectItems.map((item, index) => normalizeDefectItem(item, index));
              const merged = [...normalized, ...current].slice(0, RECENT_HISTORY_LIMIT);
              return merged;
            });
            refreshDailyDatasets();
          }

          setErrorMessage("");
        } catch {
          setErrorMessage("Received invalid realtime detection payload.");
        }
      };

      ws.onerror = () => {
        setIsWsConnected(false);
        setIsConnected(false);
        startPolling();
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        setIsConnected(false);
        startPolling();
      };
    } catch {
      setIsWsConnected(false);
      startPolling();
    }

    if (isCameraRunning) {
      refreshLatest();
    }
    refreshRecentDefects();
    refreshDailyDatasets();

    return () => {
      stopPolling();

      if (wsRef.current && wsRef.current.readyState <= 1) {
        wsRef.current.close();
      }
    };
  }, [isCameraRunning, refreshDailyDatasets, refreshLatest, refreshRecentDefects, refreshLogs]);

  useEffect(() => {
    if (!isCameraRunning || isWsConnected) {
      return undefined;
    }

    const latestLoop = window.setInterval(() => {
      refreshLatest();
    }, LATEST_POLL_MS);

    return () => {
      window.clearInterval(latestLoop);
    };
  }, [isCameraRunning, isWsConnected, refreshLatest]);

  useEffect(() => {
    if (!isCameraRunning) {
      return undefined;
    }

    const watchdog = window.setInterval(() => {
      const lastFrameAt = lastFrameAtRef.current || 0;
      if (!lastFrameAt || Date.now() - lastFrameAt > FRAME_STALE_MS) {
        refreshLatest();
      }
    }, 1800);

    return () => {
      window.clearInterval(watchdog);
    };
  }, [isCameraRunning, refreshLatest]);

  return useMemo(
    () => ({
      apiBaseUrl: API_BASE_URL,
      isConnected,
      isCameraRunning,
      isStartingCamera,
      isStoppingCamera,
      isCapturingVariation,
      liveFrameUrl,
      latestSummary,
      zoneAnalysis,
      recentLogs,
      recentDefects,
      dailyDatasets,
      cameraStreamCandidates,
      errorMessage,
      startCamera,
      stopCamera,
      captureVariation,
      deleteDailyImage,
      deleteDailyFolder,
      clearRecentDefects,
      refreshRecentDefects,
      refreshDailyDatasets
    }),
    [
      isConnected,
      isCameraRunning,
      isStartingCamera,
      isStoppingCamera,
      isCapturingVariation,
      liveFrameUrl,
      latestSummary,
      zoneAnalysis,
      recentLogs,
      recentDefects,
      dailyDatasets,
      cameraStreamCandidates,
      errorMessage,
      startCamera,
      stopCamera,
      captureVariation,
      deleteDailyImage,
      deleteDailyFolder,
      clearRecentDefects,
      refreshRecentDefects,
      refreshDailyDatasets
    ]
  );
}
