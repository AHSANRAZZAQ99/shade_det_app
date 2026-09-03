from flask import request, jsonify, send_file
import os
import cv2
from datetime import datetime
import shutil
import sys

sys.stdout.reconfigure(encoding='utf-8')

from utils.dataset_utils import count_dataset_images
import threading
import subprocess

# 🔹 Import your pipeline (CNN is inside this)
from processing.pipeline import process_frame
from processing.roi_manager import ROIManager
from training.train_model import DATASET_PATH, train
from utils.training_state import get_last_trained_count, update_last_trained_count

# 🔹 Setup paths
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
UPLOAD_FOLDER = os.path.join(ROOT_DIR, "temp_uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 🔹 Global ROI
roi_manager = ROIManager()

# 🔹 Upload session
current_upload_session = {}
is_training = False
training_lock = threading.Lock()


def infer_variation_zone(defect_type):
    label = str(defect_type or "").upper()
    if "LEFT" in label:
        return "LEFT"
    if "CENTER" in label:
        return "CENTER"
    if "RIGHT" in label:
        return "RIGHT"
    if "GLOBAL" in label:
        return "GLOBAL"
    return "NONE"


def summarize_result(result):
    result = result or {}
    defect_type = result.get("defect_type", "NORMAL")
    return {
        "prediction": defect_type,
        "defectDetected": bool(result.get("defect_detected", False)),
        "confidence": float(result.get("confidence", 0.0)),
        "variationZone": infer_variation_zone(defect_type),
    }


def register_upload_routes(app):

    #  FIXED: MUST BE POST (NOT GET)
    @app.route('/api/upload-image', methods=['POST'])
    def upload_image():
        global current_upload_session

        # ---------------- CHECK FILE ----------------
        if 'image' not in request.files:
            return jsonify({"ok": False, "error": "No file provided"}), 400

        file = request.files['image']
        if file.filename == "":
            return jsonify({"ok": False, "error": "Empty filename"}), 400

        # ---------------- SAVE ----------------
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"{timestamp}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        file.save(filepath)

        # ---------------- READ IMAGE ----------------
        image = cv2.imread(filepath)
        if image is None:
            return jsonify({"ok": False, "error": "Invalid image"}), 400

        h, w = image.shape[:2]

        # ---------------- PROCESS ----------------
        active_roi = roi_manager.get_roi() or {"x": 0, "y": 0, "w": w, "h": h}

        try:
            result, _ = process_frame(image, roi=active_roi)
        except Exception as e:
            return jsonify({
                "ok": False,
                "error": f"Image processing failed: {str(e)}"
            }), 500

        summary = summarize_result(result)

        # ---------------- DRAW ROI ----------------
        result_filename = f"result_{filename}"
        result_path = os.path.join(UPLOAD_FOLDER, result_filename)

        cv2.imwrite(result_path, image)
        # ---------------- STORE SESSION ----------------
        current_upload_session = {
            "filepath": filepath,
            "result_path": result_path,
            "filename": result_filename,
            "original_filename": filename,
            "image_shape": {"height": h, "width": w},
            "roi": active_roi,
            "result": result,
            "timestamp": timestamp
        }

        # ---------------- RESPONSE ----------------
        response = {
            "ok": True,
            "status": "success",
            "sessionId": timestamp,
            "imagePath": f"http://localhost:5000/api/upload/preview/{result_filename}",
            "originalPath": f"http://localhost:5000/api/upload/preview/{filename}",
            "imageSize": {"height": h, "width": w},
            "roi": active_roi,
        }

        response.update(summary)
        return jsonify(response)

    # ---------------- UPDATE ROI ----------------
    @app.route('/api/upload/update-roi', methods=['POST'])
    def update_roi():
        global current_upload_session

        if not current_upload_session:
            return jsonify({"ok": False, "error": "No active upload session"}), 400

        body = request.get_json(silent=True) or {}

        x = int(body.get("x", 0))
        y = int(body.get("y", 0))
        w = int(body.get("w", 100))
        h = int(body.get("h", 100))

        roi_manager.set_roi(x, y, w, h)

        filepath = current_upload_session["filepath"]
        image = cv2.imread(filepath)

        if image is None:
            return jsonify({"ok": False, "error": "Image reload failed"}), 500

        result, overlayed = process_frame(image, roi=roi_manager.get_roi())
        updated_summary = summarize_result(result)

        image_with_roi = overlayed.copy()
        cv2.imwrite(current_upload_session["result_path"], image_with_roi)

        current_upload_session["roi"] = roi_manager.get_roi()
        current_upload_session["result"] = result

        response = {
            "ok": True,
            "status": "roi_updated",
            "roi": roi_manager.get_roi()
        }
        response.update(updated_summary)

        return jsonify(response)

    # ---------------- CONFIRM LABEL ----------------
    @app.route('/api/upload/confirm-label', methods=['POST'])
    def confirm_label():
        MIN_IMAGES_PER_CLASS = 5
        TRAIN_THRESHOLD = 500  # Train only on fixed milestones: 500, 1000, 1500...

        def trigger_training(total_images):
            global is_training

            with training_lock:
                if is_training:
                    print(" Training already in progress.")
                    return False
                is_training = True

            def training_worker():
                global is_training

                print("Starting Auto Training...")

                try:
                    train()
                    update_last_trained_count(total_images)
                    print(f" Training finished. Last trained count updated to {total_images}.")
                except Exception as e:
                    print(" Training Failed:", e)
                finally:
                    is_training = False

            threading.Thread(target=training_worker, daemon=True).start()
            return True

        global current_upload_session

        if not current_upload_session:
            return jsonify({"ok": False, "error": "No active session"}), 400

        body = request.get_json(silent=True) or {}
        label = body.get("label", "no").lower()  # yes / no

    #  FINAL DATASET PATH
        BASE_PATH = r"C:\shade_det_app\database\labeled_dataset"

        try:
        # ---------------- GET DATA ----------------
            image_path = current_upload_session["filepath"]
            roi = current_upload_session["roi"]
            filename = current_upload_session["original_filename"]

            image = cv2.imread(image_path)

            if image is None:
                return jsonify({"ok": False, "error": "Image not found"}), 500

        # ---------------- SELECT FOLDER (BINARY) ----------------
            if label == "yes":
                target_folder = "defect"
            else:
                target_folder = "no_defect"

            save_dir = os.path.join(BASE_PATH, target_folder)
            os.makedirs(save_dir, exist_ok=True)

            save_path = os.path.join(save_dir, filename)

        # ----------------  CROP ROI ONLY ----------------
            if roi:
                x = roi["x"]
                y = roi["y"]
                w = roi["w"]
                h = roi["h"]

                cropped = image[y:y+h, x:x+w]
            else:
                return jsonify({"ok": False, "error": "ROI not found"}), 400

        # ---------------- SAVE ----------------
            success = cv2.imwrite(save_path, cropped)

            if not success:
                return jsonify({"ok": False, "error": "Failed to save image"}), 500

            print(" ROI IMAGE SAVED:", save_path)

        # ---------------- TRAINING CHECK ----------------
            total_images = count_dataset_images()
            print(f" Total dataset images: {total_images}")

            last_trained = int(get_last_trained_count() or 0)
            # Normalize previous state so training stays aligned to fixed 500-image steps.
            last_trained_aligned = (last_trained // TRAIN_THRESHOLD) * TRAIN_THRESHOLD
            completed_milestone = (total_images // TRAIN_THRESHOLD) * TRAIN_THRESHOLD

            # Trigger only when we crossed the NEXT 500 milestone.
            if completed_milestone >= last_trained_aligned + TRAIN_THRESHOLD:
                valid_classes = get_valid_classes(DATASET_PATH, MIN_IMAGES_PER_CLASS)

                if len(valid_classes) >= 2:  # BINARY CHECK
                    print(f" Training triggered at milestone {completed_milestone}")
                    trigger_training(completed_milestone)
                else:
                    print(" Waiting for enough class data...")

        # ---------------- CLEAN TEMP ----------------
            try:
                os.remove(current_upload_session["filepath"])
                os.remove(current_upload_session["result_path"])
            except:
                pass

            current_upload_session = {}

            return jsonify({
            "ok": True,
            "status": "saved",
            "savedPath": save_path
        })

        except Exception as e:
            return jsonify({
            "ok": False,
            "error": str(e)
        }), 500
    #  PREVIEW ROUTE (IMPORTANT - FIXED IMAGE LOADING)
    @app.route('/api/upload/preview/<filename>', methods=['GET'])
    def preview_image(filename):
        try:
            filename = os.path.basename(filename)

            filepath = os.path.join(UPLOAD_FOLDER, filename)

            
            if not os.path.isfile(filepath):
                return jsonify({
                "ok": False,
                "error": "File not found",
                "path": filepath
            }), 404

            return send_file(filepath)

        except Exception as e:
            return jsonify({
            "ok": False,
            "error": str(e)
        }), 500