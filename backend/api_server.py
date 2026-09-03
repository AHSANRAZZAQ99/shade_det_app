import base64
import json
import os
import shutil
import sys
import threading
import time
from datetime import datetime
from alerts.alerts_manager import AlertManager
from database.db_queries import (
    save_camera,
    save_detection,
    save_log,
    get_system_logs,
    get_detection_records,
)

import cv2
from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
import sys
from flask import send_from_directory

camera_lock = threading.Lock()
sys.stdout.reconfigure(encoding='utf-8')

app = Flask(__name__)
CORS(app)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from camera.camera_manager import CameraManager
from processing.decision_engine import DecisionEngine
from processing.pixel_analyzer import PixelAnalyzer
from processing.preprocessor import Preprocessor
from processing.statistics_engine import StatisticsEngine
from processing.zone_segmenter import ZoneSegmenter
from processing.roi_manager import ROIManager
from backend.upload_api import register_upload_routes
from backend.database.db_queries import clear_detection_records

try:
    import psutil
except Exception:
    psutil = None

app = Flask(__name__)
CORS(app)

CAMERA_CONFIG_FILE = "database/camera_config.json"
camera_manager = None
camera_initialized = False
camera_stream_enabled = False
last_result = None
analysis_lock = threading.Lock()
analysis_worker_lock = threading.Lock()
analysis_worker_thread = None

RECENT_FRAMES = []
MAX_RECENT_FRAMES = 20
DAILY_DATASET_SAMPLE_LIMIT = 8

DEFECTED_DIR = os.path.join(ROOT_DIR, "defected_images")
os.makedirs(DEFECTED_DIR, exist_ok=True)
LABELED_DATASET_DIR = os.path.join(ROOT_DIR, "database", "labeled_dataset")
os.makedirs(os.path.join(LABELED_DATASET_DIR, "defect"), exist_ok=True)
os.makedirs(os.path.join(LABELED_DATASET_DIR, "no_defect"), exist_ok=True)

# ---------------- DETECTION STATE (consecutive-frame confirmation + cooldown)
CONSECUTIVE_REQUIRED = 3
COOLDOWN_SECONDS = 2.0
DETECTION_STATE = {
    "prev_state": "no_defect",   # last committed saved state
    "consecutive": 0,             # current consecutive defect frames
    "last_save_ts": 0.0,          # last saved timestamp
}

# Auto-capture configuration
    # Endpoint to get defect records
AUTO_CAPTURE_ENABLED = False
CURRENT_ROI = None

SETTINGS_PATH = os.path.join(os.path.dirname(__file__), "runtime_settings.json")
settings_lock = threading.Lock()

DEFAULT_SETTINGS = {
    "camera": {
        "device": "USB Camera 0",
        "resolution": "1920 × 1080 (Full HD)",
        "fps": 30,
        "exposure": 50,
        "brightness": 50,
        "contrast": 50,
        "saturation": 50,
        "sharpness": 50,
        "whiteBalance": "Auto",
        "autoFocus": True,
        "captureMode": "Continuous",
    },
    "detection": {
        "deltaE": 3.0,
        "pixelDensity": 0.05,
        "minDefectArea": 100,
        "colorSpace": "CIE Lab (ΔE)",
        "zoneSensitivity": "Medium",
        "lcrEnabled": True,
        "overlayEnabled": True,
        "shadeDetection": True,
        "smoothingEnabled": True,
        "realtimeMode": True,
        "alertLevel": "warning",
        "engineActive": False,
    },
    "storage": {
        "saveDefect": True,
        "saveNormal": False,
        "dailyFolder": True,
        "basePath": "C:/shade_det_app/database/",
        "defectSubfolder": "By Date",
        "imageFormat": "JPEG",
        "compression": "Medium",
        "saveTimestamp": True,
        "saveMetadata": True,
        "autoCleanup": True,
        "retention": "30 days",
    },
    "system": {
        "theme": "Light",
        "language": "English",
        "autoStartCamera": True,
        "autoStartDetection": False,
        "minimizeToTray": False,
        "startWithOS": False,
        "notificationsEnabled": True,
        "soundAlerts": True,
        "desktopPopups": True,
        "systemLogs": True,
        "logLevel": "INFO",
        "logOutput": "Both",
        "maxLogSize": "50 MB",
        "apiPort": "5000",
        "customPort": "",
    },
    "model": {
        "modelType": "ShadeNet (Custom CNN)",
        "modelVersion": "ShadeNet_v1",
        "customModelPath": "",
        "inferenceMode": "realtime",
        "intervalN": 5,
        "device": "Auto (best available)",
        "precision": "FP32 (full)",
        "batchSize": "1",
        "confidence": 0.75,
        "warmupEnabled": True,
        "fallbackToCPU": True,
        "modelStatus": "disabled",
    },
    "security": {
        "operatorName": "John",
        "role": "Operator",
        "adminRequired": True,
        "sessionTimeout": "15 min",
        "twoStepConfirm": True,
        "allowLogout": True,
        "systemLocked": False,
        "lockOnIdle": True,
        "permissions": {
            "Camera Controls": True,
            "Detection Settings": False,
            "Storage Settings": False,
            "Model Settings": False,
            "System Settings": False,
            "Export Reports": True,
            "User Management": False,
            "Shutdown / Restart": False,
        },
    },
}

MODEL_RUNTIME = {
    "status": "disabled",
    "lastMessage": "Logic detection is active; CNN inference is disabled until retraining is re-enabled.",
    "updatedAt": datetime.now().isoformat(),
}

DETECTION_ENGINE = "logic"



def save_camera_config(config):

    os.makedirs("database", exist_ok=True)

    with open(CAMERA_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)



def load_camera_config():

    if not os.path.exists(CAMERA_CONFIG_FILE):
        return None

    with open(CAMERA_CONFIG_FILE, "r") as f:
        return json.load(f)


def clone_defaults():
    return json.loads(json.dumps(DEFAULT_SETTINGS))


def deep_merge(base, incoming):
    if not isinstance(base, dict) or not isinstance(incoming, dict):
        return incoming

    for key, value in incoming.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        else:
            base[key] = value

    return base


def load_settings_store():
    if not os.path.isfile(SETTINGS_PATH):
        defaults = clone_defaults()
        save_settings_store(defaults)
        return defaults

    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as handle:
            stored = json.load(handle)
    except Exception:
        stored = {}

    merged = clone_defaults()
    if isinstance(stored, dict):
        deep_merge(merged, stored)
    return merged


def save_settings_store(settings):
    with open(SETTINGS_PATH, "w", encoding="utf-8") as handle:
        json.dump(settings, handle, indent=2)


def get_settings():
    with settings_lock:
        return load_settings_store()


def update_settings(updates):
    with settings_lock:
        current = load_settings_store()
        deep_merge(current, updates)
        save_settings_store(current)
        return current


def reset_settings(section=None):
    with settings_lock:
        current = load_settings_store()
        defaults = clone_defaults()
        if section:
            if section in current:
                current[section] = defaults.get(section, {})
        else:
            current = defaults
        save_settings_store(current)
        return current


def get_system_health():
    camera_state = "running" if camera_initialized else "stopped"
    backend_state = "online"

    cpu_usage = 0.0
    ram_used_mb = 0.0
    ram_percent = 0.0
    gpu_label = "Unknown"

    if psutil is not None:
        try:
            cpu_usage = float(psutil.cpu_percent(interval=0.0))
            memory = psutil.virtual_memory()
            ram_used_mb = round(memory.used / (1024 * 1024), 2)
            ram_percent = float(memory.percent)
        except Exception:
            pass

    try:
        usage = shutil.disk_usage(ROOT_DIR)
        disk_free_gb = round(usage.free / (1024 * 1024 * 1024), 2)
    except Exception:
        disk_free_gb = 0.0

    return {
        "ok": True,
        "cpuUsage": cpu_usage,
        "ramUsageMb": ram_used_mb,
        "ramUsagePercent": ram_percent,
        "gpu": gpu_label,
        "cameraFeed": camera_state,
        "backendApi": backend_state,
        "diskFreeGb": disk_free_gb,
        "timestamp": datetime.now().isoformat(),
    }


def compute_delta_e(zone_mean, global_mean):
    return abs(zone_mean - global_mean)


def infer_zone_from_defect_type(defect_type):
    if "LEFT" in defect_type:
        return "Left Zone"
    if "CENTER" in defect_type:
        return "Center Zone"
    if "RIGHT" in defect_type:
        return "Right Zone"
    return "Unknown Zone"


def overlay_zone(image, result):
    h, w, _ = image.shape
    overlay = image.copy()
    defect_type = result.get("defect_type", "NORMAL")

    if "LEFT" in defect_type:
        cv2.rectangle(overlay, (0, 0), (w // 3, h), (0, 0, 255), -1)
    elif "CENTER" in defect_type:
        cv2.rectangle(overlay, (w // 3, 0), (2 * w // 3, h), (0, 0, 255), -1)
    elif "RIGHT" in defect_type:
        cv2.rectangle(overlay, (2 * w // 3, 0), (w, h), (0, 0, 255), -1)
    else:
        cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 255), -1)

    return cv2.addWeighted(overlay, 0.3, image, 0.7, 0)


def encode_image_to_base64(image, quality=82):
    ok, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return None
    return base64.b64encode(buffer).decode("utf-8")


def append_recent_frame(frame):
    RECENT_FRAMES.insert(0, frame)
    del RECENT_FRAMES[MAX_RECENT_FRAMES:]


def encode_file_to_base64(path, quality=70):
    image = cv2.imread(path)

    if image is None:
        return None

    ok, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return None

    return base64.b64encode(buffer).decode("utf-8")


def list_daily_dataset_folders(sample_limit=DAILY_DATASET_SAMPLE_LIMIT):
    folders = []

    if not os.path.isdir(DEFECTED_DIR):
        return folders

    for folder_name in sorted(os.listdir(DEFECTED_DIR), reverse=True):
        folder_path = os.path.join(DEFECTED_DIR, folder_name)
        if not os.path.isdir(folder_path):
            continue

        image_names = [
            name
            for name in sorted(os.listdir(folder_path), reverse=True)
            if name.lower().endswith((".jpg", ".jpeg", ".png", ".bmp"))
        ]

        samples = []
        for image_name in image_names:
            full_path = os.path.join(folder_path, image_name)
            if not os.path.isfile(full_path):
                continue

            samples.append(
                {
                    "id": image_name,
                    "time": image_name.split("_")[0] if "_" in image_name else "--:--:--",
                    "imageUrl": f"/api/defect-images/{folder_name}/{image_name}",
                    "thumbnailUrl": f"/api/defect-images/{folder_name}/{image_name}",
                }
            )

        folders.append(
            {
                "date": folder_name,
                "folder": folder_name,
                "path": folder_path,
                "count": len(image_names),
                "samples": samples,
            }
        )

    return folders


def resolve_daily_folder_path(folder_name):
    normalized_name = os.path.basename(os.path.normpath(str(folder_name or "").strip()))
    if not normalized_name or normalized_name in {".", ".."}:
        return None

    base_dir = os.path.abspath(DEFECTED_DIR)
    folder_path = os.path.abspath(os.path.join(base_dir, normalized_name))
    if folder_path != base_dir and not folder_path.startswith(base_dir + os.sep):
        return None

    return folder_path


def resolve_daily_image_path(folder_name, image_name):
    folder_path = resolve_daily_folder_path(folder_name)
    if not folder_path:
        return None

    normalized_image = os.path.basename(os.path.normpath(str(image_name or "").strip()))
    if not normalized_image or normalized_image in {".", ".."}:
        return None

    image_path = os.path.abspath(os.path.join(folder_path, normalized_image))
    if image_path != folder_path and not image_path.startswith(folder_path + os.sep):
        return None

    return image_path


def ensure_camera_started():
    global camera_initialized, camera_manager

    if camera_initialized and camera_manager is not None:
        return

    camera_manager = CameraManager()
    camera_initialized = True


def analyze_frame(frame, roi=None, store_capture=False, cropped_output=False, is_defect_label_enabled=True, auto_capture_enabled=False, current_roi=None):
    global last_result

    with analysis_lock:
        image_name = None
        image_path = None
        started_at = time.perf_counter()
        # Use the shared logic-based pipeline
        from processing.pipeline import process_frame
        result, overlayed = process_frame(frame, roi=roi)

        timestamp_dt = datetime.now()
        timestamp_iso = timestamp_dt.isoformat()
        timestamp_label = timestamp_dt.strftime("%H:%M:%S")

        output_image = frame.copy()

        if cropped_output:
            h, w = frame.shape[:2]
            if isinstance(roi, dict):
                rx = int(roi.get("x", 0))
                ry = int(roi.get("y", 0))
                rw = int(roi.get("w", w))
                rh = int(roi.get("h", h))
            else:
                rx, ry, rw, rh = 0, 0, w, h

            rx = max(0, min(rx, w - 1))
            ry = max(0, min(ry, h - 1))
            rw = max(1, min(rw, w - rx))
            rh = max(1, min(rh, h - ry))

            cropped = frame[ry:ry + rh, rx:rx + rw]
            if cropped is not None and cropped.size > 0:
                output_image = cropped

        image_base64 = encode_image_to_base64(output_image, quality=86)
        thumbnail_base64 = encode_image_to_base64(output_image, quality=65)

        defect_type = result.get("defect_type", "NORMAL")
        zone_name = infer_zone_from_defect_type(defect_type)
        pixel_density = result.get("pixel_density", {}) if isinstance(result.get("pixel_density", {}), dict) else {}
        left_variation = float(pixel_density.get("LEFT", 0.0) or 0.0) * 100.0
        center_variation = float(pixel_density.get("CENTER", 0.0) or 0.0) * 100.0
        right_variation = float(pixel_density.get("RIGHT", 0.0) or 0.0) * 100.0
        overall_variation = (left_variation + center_variation + right_variation) / 3.0

        payload = {
            "id": f"{int(timestamp_dt.timestamp() * 1000)}",
            "timestamp": timestamp_iso,
            "time": timestamp_label,
            "engine": DETECTION_ENGINE,
            "defectDetected": bool(result.get("defect_detected")),
            "defectType": defect_type,
            "zone": zone_name,
            "confidence": float(result.get("confidence", 0.0)),
            "left_variation": round(left_variation, 2),
            "center_variation": round(center_variation, 2),
            "right_variation": round(right_variation, 2),
            "overall_variation": round(overall_variation, 2),
            "processingTimeMs": round((time.perf_counter() - started_at) * 1000, 2),
            "image_name": image_name,
            "image_path": image_path,
            "imageBase64": image_base64,
            "thumbnailBase64": thumbnail_base64,
        }

        # Determine whether to save based on consecutive-frame confirmation,
        # state change (NoDefect -> Defect) and cooldown. Manual capture (store_capture)
        # always saves immediately.
        should_save = False
        is_auto_capture = False
        now_ts = time.time()
        cur_state = "defect" if payload.get("defectDetected") else "no_defect"

        if cur_state == "no_defect":
            # reset consecutive counter and update prev_state if we returned to no_defect
            DETECTION_STATE["consecutive"] = 0
            if DETECTION_STATE["prev_state"] == "defect":
                DETECTION_STATE["prev_state"] = "no_defect"

        else:  # cur_state == 'defect'
            DETECTION_STATE["consecutive"] += 1

            if DETECTION_STATE["consecutive"] >= CONSECUTIVE_REQUIRED:
                # only save when transitioning from no_defect -> defect
                if DETECTION_STATE["prev_state"] != "defect":
                    # enforce cooldown
                    if now_ts - DETECTION_STATE["last_save_ts"] >= COOLDOWN_SECONDS:
                        # Check if auto-capture is enabled
                        if auto_capture_enabled and current_roi is not None:
                            # For auto-capture: verify defect is within ROI bounds
                            # The entire frame analysis respects ROI, so if defect_detected is True,
                            # it's detected within the ROI context
                            should_save = True
                            is_auto_capture = True
                        else:
                            # Regular (non-auto) defect save
                            should_save = True
                        
                        DETECTION_STATE["last_save_ts"] = now_ts
                        DETECTION_STATE["prev_state"] = "defect"

        # Manual capture bypasses confirmation
        if store_capture:
            should_save = True
            is_auto_capture = False

        if image_base64 and should_save:
            save_name = f"{timestamp_dt.strftime('%H%M%S_%f')}.jpg"

            payload["image_name"] = save_name.replace(".jpg", "")
            payload["image_path"] = save_name
            image_url = None
            thumb_url = None

            # For manual captures: save to both DEFECTED_DIR and labeled_dataset
            if store_capture:
                day_folder = timestamp_dt.strftime("%Y_%m_%d")
                save_dir = os.path.join(DEFECTED_DIR, day_folder)
                os.makedirs(save_dir, exist_ok=True)
                cv2.imwrite(os.path.join(save_dir, save_name), output_image)

                labeled_target = "defect" if bool(is_defect_label_enabled) else "no_defect"
                labeled_dir = os.path.join(LABELED_DATASET_DIR, labeled_target)
                os.makedirs(labeled_dir, exist_ok=True)
                cv2.imwrite(os.path.join(labeled_dir, save_name), output_image)

                image_url = f"/api/defect-images/{day_folder}/{save_name}"
                thumb_url = f"/api/defect-images/{day_folder}/{save_name}"

            # For auto-captures: save directly to labeled_dataset/defect
            elif is_auto_capture:
                labeled_dir = os.path.join(LABELED_DATASET_DIR, "defect")
                os.makedirs(labeled_dir, exist_ok=True)
                cv2.imwrite(os.path.join(labeled_dir, save_name), output_image)

                # Auto-captured files are not in defect-images route; use inlined payload image.
                image_url = f"data:image/jpeg;base64,{payload['imageBase64']}"
                thumb_url = f"data:image/jpeg;base64,{payload['thumbnailBase64']}"

            append_recent_frame(
    {
        "id": payload["id"],
        "timestamp": payload["timestamp"],
        "time": payload["time"],
        "zone": payload["zone"],
        "confidence": payload["confidence"],

        # ADD THESE
        "image_name": payload.get("image_name"),
        "image_path": payload.get("image_path"),

        "imageUrl": image_url,
        "thumbnailUrl": thumb_url,
        "imageBase64": payload["imageBase64"],
        "thumbnailBase64": payload["thumbnailBase64"],
    }
)

        last_result = payload
        return payload


def maybe_schedule_analysis(frame):
    global analysis_worker_thread

    if frame is None:
        return False

    with analysis_worker_lock:
        if analysis_worker_thread is not None and analysis_worker_thread.is_alive():
            return False

        frame_for_analysis = frame.copy()

        def run_analysis_worker():
            try:
                analyze_frame(
                    frame_for_analysis,
                    roi=CURRENT_ROI if AUTO_CAPTURE_ENABLED else None,
                    auto_capture_enabled=AUTO_CAPTURE_ENABLED,
                    current_roi=CURRENT_ROI
                )
            except Exception:
                pass

        analysis_worker_thread = threading.Thread(
            target=run_analysis_worker,
            daemon=True,
            name="detection-analysis-worker",
        )
        analysis_worker_thread.start()
        return True


def stream_with_overlay():
    target_fps = 20
    detection_hz = 6
    min_emit_interval = 1.0 / max(target_fps, 1)
    min_detection_interval = 1.0 / max(detection_hz, 1)

    last_emit_at = 0.0
    last_detection_at = 0.0

    while True:
        try:
            if not camera_stream_enabled:
                time.sleep(0.02)
                continue

            frame = camera_manager.get_frame()
            if frame is None:
                time.sleep(0.03)
                continue

            now = time.perf_counter()

            # No auto-detection here; just stream frames
            ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
            if not ok:
                continue
            current_jpg_bytes = buffer.tobytes()

            elapsed_since_emit = now - last_emit_at
            if elapsed_since_emit < min_emit_interval:
                time.sleep(min_emit_interval - elapsed_since_emit)

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + current_jpg_bytes + b"\r\n"
            )
            last_emit_at = time.perf_counter()
        except Exception:
            break


@app.get("/api/status")
def api_status():
    settings = get_settings()
    return jsonify(
        {
            "ok": True,
            "service": "fabric-shade-backend",
            "cameraInitialized": camera_initialized,
            "timestamp": datetime.now().isoformat(),
            "recentDefects": len(RECENT_FRAMES),
            "operatorName": settings.get("security", {}).get("operatorName", "John"),
            "modelStatus": MODEL_RUNTIME.get("status", "unloaded"),
            "detectionEngine": DETECTION_ENGINE,
        }
    )


@app.get("/api/system/health")
def api_system_health():
    return jsonify(get_system_health())


@app.get("/api/settings")
def api_settings_all():
    return jsonify({"ok": True, "settings": get_settings()})


@app.put("/api/settings")
def api_settings_update_all():
    body = request.get_json(silent=True) or {}
    settings_payload = body.get("settings") if isinstance(body, dict) else {}

    if not isinstance(settings_payload, dict):
        return jsonify({"ok": False, "error": "settings must be an object."}), 400

    updated = update_settings(settings_payload)
    return jsonify({"ok": True, "settings": updated})


@app.post("/api/settings/reset")
def api_settings_reset_all():
    reset = reset_settings()
    return jsonify({"ok": True, "settings": reset})


@app.get("/api/settings/<section>")
def api_settings_section(section):
    settings = get_settings()
    if section not in settings:
        return jsonify({"ok": False, "error": f"Unknown settings section: {section}"}), 404
    return jsonify({"ok": True, "section": section, "settings": settings[section]})


@app.put("/api/settings/<section>")
def api_settings_update_section(section):
    settings = get_settings()
    if section not in settings:
        return jsonify({"ok": False, "error": f"Unknown settings section: {section}"}), 404

    body = request.get_json(silent=True) or {}
    section_payload = body.get("settings") if isinstance(body, dict) else {}

    if not isinstance(section_payload, dict):
        return jsonify({"ok": False, "error": "settings must be an object."}), 400

    updated = update_settings({section: section_payload})
    return jsonify({"ok": True, "section": section, "settings": updated[section]})


@app.post("/api/settings/<section>/reset")
def api_settings_reset_section(section):
    settings = get_settings()
    if section not in settings:
        return jsonify({"ok": False, "error": f"Unknown settings section: {section}"}), 404

    reset = reset_settings(section=section)
    return jsonify({"ok": True, "section": section, "settings": reset[section]})


@app.get("/api/model/status")
def api_model_status():
    settings = get_settings()
    model_settings = settings.get("model", {})
    return jsonify(
        {
            "ok": True,
            "status": MODEL_RUNTIME.get("status", "disabled"),
            "message": MODEL_RUNTIME.get("lastMessage", ""),
            "updatedAt": MODEL_RUNTIME.get("updatedAt"),
            "model": model_settings,
        }
    )


@app.get("/api/defects/image/<folder>/<filename>")
def serve_defect_image(folder, filename):

    try:

        base_folder = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "database",
        "labeled_dataset"
    )
)


        if folder not in [
            "defect",
            "no_defect"
        ]:
            return jsonify({
                "ok": False,
                "error": "Invalid image folder"
            }), 400



        image_folder = os.path.join(
            base_folder,
            folder
        )


        return send_from_directory(
            image_folder,
            filename
        )


    except Exception as exc:

        return jsonify({
            "ok": False,
            "error": str(exc)
        }), 500

@app.post("/api/model/load")
def api_model_load():
    MODEL_RUNTIME["status"] = "disabled"
    MODEL_RUNTIME["updatedAt"] = datetime.now().isoformat()
    MODEL_RUNTIME["lastMessage"] = "Model loading is disabled. Logic detection remains active."

    updated = update_settings({"model": {"modelStatus": "disabled"}})
    return jsonify({"ok": True, "status": MODEL_RUNTIME["status"], "message": MODEL_RUNTIME["lastMessage"], "settings": updated["model"]})


@app.post("/api/model/reload")
def api_model_reload():
    MODEL_RUNTIME["status"] = "disabled"
    MODEL_RUNTIME["updatedAt"] = datetime.now().isoformat()
    MODEL_RUNTIME["lastMessage"] = "Model reload is disabled. Logic detection remains active."

    updated = update_settings({"model": {"modelStatus": "disabled"}})
    return jsonify({"ok": True, "status": MODEL_RUNTIME["status"], "message": MODEL_RUNTIME["lastMessage"], "settings": updated["model"]})


@app.post("/api/model/unload")
def api_model_unload():
    MODEL_RUNTIME["status"] = "disabled"
    MODEL_RUNTIME["updatedAt"] = datetime.now().isoformat()
    MODEL_RUNTIME["lastMessage"] = "Model is already disabled. Logic detection remains active."

    updated = update_settings({"model": {"modelStatus": "disabled"}})
    return jsonify({"ok": True, "status": MODEL_RUNTIME["status"], "message": MODEL_RUNTIME["lastMessage"], "settings": updated["model"]})


@app.get("/api/detection/cooldown")
def api_detection_cooldown_get():
    return jsonify({
        "ok": True,
        "cooldown": COOLDOWN_SECONDS,
        "consecutiveRequired": CONSECUTIVE_REQUIRED
    })


@app.put("/api/detection/cooldown")
def api_detection_cooldown_set():
    global COOLDOWN_SECONDS, CONSECUTIVE_REQUIRED

    body = request.get_json(silent=True) or {}
    new_cooldown = body.get("cooldown")
    new_consecutive = body.get("consecutiveRequired")

    if new_cooldown is not None:
        try:
            COOLDOWN_SECONDS = float(new_cooldown)
            if COOLDOWN_SECONDS < 0:
                COOLDOWN_SECONDS = 0
        except (ValueError, TypeError):
            return jsonify({"ok": False, "error": "cooldown must be a number"}), 400

    if new_consecutive is not None:
        try:
            CONSECUTIVE_REQUIRED = int(new_consecutive)
            if CONSECUTIVE_REQUIRED < 1:
                CONSECUTIVE_REQUIRED = 1
        except (ValueError, TypeError):
            return jsonify({"ok": False, "error": "consecutiveRequired must be an integer"}), 400

    return jsonify({
        "ok": True,
        "cooldown": COOLDOWN_SECONDS,
        "consecutiveRequired": CONSECUTIVE_REQUIRED,
        "message": "Detection parameters updated"
    })


@app.get("/api/detection/auto-capture")
def api_auto_capture_get():
    """Get current auto-capture status and ROI"""
    return jsonify({
        "ok": True,
        "enabled": AUTO_CAPTURE_ENABLED,
        "roi": CURRENT_ROI
    })


@app.put("/api/detection/auto-capture")
def api_auto_capture_set():
    """Enable/disable auto-capture and set ROI"""
    global AUTO_CAPTURE_ENABLED, CURRENT_ROI

    body = request.get_json(silent=True) or {}
    enabled = body.get("enabled")
    roi = body.get("roi")

    if enabled is not None:
        AUTO_CAPTURE_ENABLED = bool(enabled)

    if roi is not None and isinstance(roi, dict):
        try:
            CURRENT_ROI = {
                "x": int(roi.get("x", 0)),
                "y": int(roi.get("y", 0)),
                "w": int(roi.get("w", 0)),
                "h": int(roi.get("h", 0)),
            }
        except (ValueError, TypeError):
            return jsonify({"ok": False, "error": "ROI values must be integers"}), 400

    return jsonify({
        "ok": True,
        "enabled": AUTO_CAPTURE_ENABLED,
        "roi": CURRENT_ROI,
        "message": "Auto-capture settings updated"
    })


@app.post("/api/security/change-password-request")
def api_security_change_password_request():
    settings = get_settings()
    operator_name = settings.get("security", {}).get("operatorName", "Operator")
    timestamp = datetime.now().isoformat()
    return jsonify({"ok": True, "message": f"Password change request recorded for {operator_name}.", "timestamp": timestamp})


@app.post("/api/security/logout")
def api_security_logout():
    settings = get_settings()
    operator_name = settings.get("security", {}).get("operatorName", "Operator")
    timestamp = datetime.now().isoformat()
    return jsonify({"ok": True, "message": f"{operator_name} logout requested.", "timestamp": timestamp})


@app.post("/api/security/lock")
def api_security_lock_toggle():
    body = request.get_json(silent=True) or {}
    desired_locked = bool(body.get("locked", True))
    updated = update_settings({"security": {"systemLocked": desired_locked}})
    return jsonify(
        {
            "ok": True,
            "locked": desired_locked,
            "message": f"System {'locked' if desired_locked else 'unlocked'}.",
            "settings": updated.get("security", {}),
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.post("/api/camera/start")
def api_camera_start():

    global camera_initialized, camera_manager, camera_stream_enabled


    with camera_lock:


        if camera_initialized and camera_manager is not None:

            camera_stream_enabled = True

            save_log(
                "CAMERA",
                "Camera already running"
            )

            return jsonify({
                "ok": True,
                "message": "Camera already started."
            })



        try:

            ensure_camera_started()

            camera_stream_enabled = True


            # Save log to MySQL
            save_log(
                "CAMERA",
                "Camera started successfully"
            )


            return jsonify({
                "ok": True,
                "message": "Camera started."
            })



        except Exception as exc:


            camera_initialized = False
            camera_manager = None


            # Save error log to MySQL
            save_log(
                "ERROR",
                f"Camera start failed: {str(exc)}"
            )


            return jsonify({
                "ok": False,
                "error": str(exc)
            }), 500


@app.post("/api/camera/stop")
def api_camera_stop():

    global camera_initialized, camera_manager, camera_stream_enabled


    try:

        if camera_manager is not None:

            camera_manager.release()


        camera_manager = None
        camera_initialized = False
        camera_stream_enabled = False


        # Save log to MySQL
        save_log(
            "CAMERA",
            "Camera stopped successfully"
        )


        return jsonify({
            "ok": True,
            "message": "Camera stopped."
        })


    except Exception as exc:


        # Save error log to MySQL
        save_log(
            "ERROR",
            f"Camera stop failed: {str(exc)}"
        )


        return jsonify({
            "ok": False,
            "error": str(exc)
        }), 500


@app.post("/api/camera/capture")
def api_camera_capture():

    try:

        payload = request.get_json(silent=True) or {}

        roi = payload.get("roi") if isinstance(payload, dict) else None

        is_defect_label_enabled = bool(
            payload.get("isDefectLabelEnabled", True)
        ) if isinstance(payload, dict) else True



        if isinstance(roi, dict):

            try:

                roi = {
                    "x": int(roi.get("x", 0)),
                    "y": int(roi.get("y", 0)),
                    "w": int(roi.get("w", 0)),
                    "h": int(roi.get("h", 0)),
                }

            except Exception:

                roi = None



        # Save capture start log
        save_log(
            "CAPTURE",
            "Variation capture started"
        )


        ensure_camera_started()


        frame = camera_manager.get_frame()


        if frame is None:

            save_log(
                "ERROR",
                "Capture failed: Unable to read frame from camera"
            )

            return jsonify({
                "ok": False,
                "error": "Unable to read frame from camera."
            }), 500



        result = analyze_frame(
            frame,
            roi=roi,
            store_capture=True,
            cropped_output=True,
            is_defect_label_enabled=is_defect_label_enabled,
        )



        print(result)

        save_detection(

    result.get(
        "image_name"
    ),

    result.get(
        "image_path"
    ),

    result.get(
        "defectDetected",
        False
    ),

    result.get(
        "defectType",
        "NO_DEFECT"
    ),

    result.get(
        "deltaE",
        0
    ),

    result.get(
        "confidence",
        0
    )

)


        if result["defectDetected"]:

            print("Defect")

            AlertManager.variation_detected()


            # Save defect capture log
            save_log(
                "DEFECT",
                "Defect detected during variation capture"
            )


        else:

            print("no defect")

            AlertManager.no_variation()


            # Save no defect log
            save_log(
                "CAPTURE",
                "Variation capture completed: No defect found"
            )



        return jsonify({
            "ok": True,
            "result": result
        })



    except Exception as exc:


        # Save capture error log
        save_log(
            "ERROR",
            f"Capture failed: {str(exc)}"
        )


        return jsonify({
            "ok": False,
            "error": str(exc)
        }), 500


@app.get("/api/camera/stream")
def api_camera_stream():
    try:
        if not camera_initialized or camera_manager is None or not camera_stream_enabled:
            return jsonify({"ok": False, "error": "Camera is not started."}), 409

        return Response(
            stream_with_overlay(),
            mimetype="multipart/x-mixed-replace; boundary=frame",
        )
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.get("/api/detection/latest")
def api_detection_latest():
    if last_result is not None:
        return jsonify({"ok": True, "result": last_result})

    try:
        ensure_camera_started()
        frame = camera_manager.get_frame()
        if frame is None:
            return jsonify({"ok": False, "error": "Unable to read frame from camera."}), 500
        result = analyze_frame(frame)
        return jsonify({"ok": True, "result": result})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.get("/api/defect-history")
def api_defect_history():
    limit = request.args.get("limit", default=MAX_RECENT_FRAMES, type=int)
    limit = max(1, min(limit, MAX_RECENT_FRAMES))
    return jsonify({"ok": True, "frames": RECENT_FRAMES[:limit]})


@app.get("/api/defects/recent")
def api_defects_recent():
    limit = request.args.get("limit", default=MAX_RECENT_FRAMES, type=int)
    limit = max(1, min(limit, MAX_RECENT_FRAMES))
    return jsonify({"ok": True, "items": RECENT_FRAMES[:limit]})


@app.get("/api/storage/daily-folders")
def api_storage_daily_folders():
    limit = request.args.get("limit", default=30, type=int)
    limit = max(1, min(limit, 365))
    folders = list_daily_dataset_folders()
    return jsonify({"ok": True, "folders": folders[:limit]})


@app.get("/api/defects/daily")
def api_defects_daily():
    limit = request.args.get("limit", default=30, type=int)
    limit = max(1, min(limit, 365))
    folders = list_daily_dataset_folders()
    return jsonify({"ok": True, "items": folders[:limit]})


@app.delete("/api/defects/clear")
def api_clear_defects():
    try:
        cleared = clear_detection_records()
        if not cleared:
            return jsonify({"ok": False, "error": "Unable to clear defect history."}), 500

        RECENT_FRAMES.clear()
        global last_result
        last_result = None

        return jsonify({"ok": True, "message": "Defect history cleared."})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.delete("/api/storage/daily-folders/<path:folder_name>")
def api_storage_delete_daily_folder(folder_name):
    folder_path = resolve_daily_folder_path(folder_name)
    if not folder_path:
        return jsonify({"ok": False, "error": "Invalid folder name."}), 400

    if not os.path.isdir(folder_path):
        return jsonify({"ok": False, "error": "Folder not found."}), 404

    try:
        shutil.rmtree(folder_path)
        return jsonify({"ok": True, "message": "Folder deleted.", "folder": os.path.basename(folder_path)})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.get("/api/logs")
def api_get_logs():

    try:

        logs = get_system_logs()

        return jsonify({
            "ok": True,
            "logs": logs
        })


    except Exception as exc:

        return jsonify({
            "ok": False,
            "error": str(exc)
        }), 500


@app.delete("/api/storage/daily-folders/<path:folder_name>/images/<path:image_name>")
def api_storage_delete_daily_image(folder_name, image_name):
    image_path = resolve_daily_image_path(folder_name, image_name)
    if not image_path:
        return jsonify({"ok": False, "error": "Invalid image path."}), 400

    if not os.path.isfile(image_path):
        return jsonify({"ok": False, "error": "Image not found."}), 404

    try:
        os.remove(image_path)
        return jsonify({"ok": True, "message": "Image deleted.", "image": os.path.basename(image_path)})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.get("/api/defect-images/<path:image_path>")
def api_serve_defect_image(image_path):
    folder_name = os.path.dirname(image_path)
    image_name = os.path.basename(image_path)
    
    resolved_path = resolve_daily_image_path(folder_name, image_name)
    if not resolved_path or not os.path.isfile(resolved_path):
        return jsonify({"ok": False, "error": "Image not found."}), 404

    try:
        with open(resolved_path, "rb") as f:
            image_data = f.read()
        return Response(image_data, mimetype="image/jpeg")
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500
    
@app.post("/api/camera/configure")
def api_camera_configure():

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "ok": False,
                "error": "No JSON data received"
            }), 400


        camera_type = data.get("type")


        # =========================
        # USB CAMERA
        # =========================

        if camera_type == "usb":

            camera_name = data.get(
                "camera_name",
                "USB Camera"
            )

            camera_index = data.get(
                "index",
                0
            )


            config = {

                "type": "usb",
                "source": camera_index

            }


            # Save USB camera
            
            save_camera(
                camera_name,
                "localhost",
                None,
                None,
                None,
                None,
                None,
                str(camera_index)
            )


            # Save log
            save_log(
                "CONFIG",
                f"USB camera configured: {camera_name}"
            )



        # =========================
        # RTSP CAMERA
        # =========================

        elif camera_type == "rtsp":


            camera_name = data.get(
                "camera_name",
                "RTSP Camera"
            )

            ip = data.get("ip")

            username = data.get(
                "username"
            )

            password = data.get(
                "password"
            )

            port = data.get(
                "port",
                554
            )

            channel = data.get(
                "channel",
                1
            )

            subtype = data.get(
                "subtype",
                0
            )



            if not ip:

                return jsonify({

                    "ok": False,

                    "error": "Camera IP required"

                }),400




            # =========================
            # BUILD RTSP URL
            # =========================


            if username and password:


                rtsp_url = (

                    f"rtsp://{username}:{password}"
                    f"@{ip}:{port}"
                    f"/cam/realmonitor?"
                    f"channel={channel}"
                    f"&subtype={subtype}"

                )


            else:


                rtsp_url = (

                    f"rtsp://{ip}:{port}"
                    f"/cam/realmonitor?"
                    f"channel={channel}"
                    f"&subtype={subtype}"

                )




            config = {

                "type": "rtsp",

                "source": rtsp_url

            }



            # =========================
            # SAVE CAMERA TO MYSQL
            # =========================
            print("Calling save_camera from configure API")

            save_camera(

                camera_name,

                ip,

                username,

                password,

                port,

                channel,

                subtype,

                rtsp_url

            )


            # Save log
            save_log(
                "CONFIG",
                f"RTSP camera configured: {camera_name} ({ip})"
            )



        else:


            return jsonify({

                "ok": False,

                "error": "Invalid camera type"

            }),400




        return jsonify({

            "ok": True,

            "message": "Camera configuration saved successfully",

            "config": config

        })




    except Exception as e:


        print(
            f"Camera configuration error: {e}"
        )


        # Save error log
        save_log(
            "ERROR",
            f"Camera configuration failed: {str(e)}"
        )


        return jsonify({

            "ok": False,

            "error": str(e)

        }),500


@app.get("/api/defects")
def api_get_defects():

    try:

        records = get_detection_records()


        return jsonify({
            "ok": True,
            "defects": records
        })


    except Exception as exc:

        return jsonify({
            "ok": False,
            "error": str(exc)
        }),500


if __name__ == "__main__":
    # Initialize ROI Manager
    roi_manager = ROIManager()
    
    # Register upload routes
    register_upload_routes(app)
    
    app.run(host="0.0.0.0", port=5000, debug=True)
