import cv2
import os
import json
import sys
from datetime import datetime
import numpy as np

# LOGIC SYSTEM
from processing.pixel_analyzer import PixelAnalyzer
from processing.decision_engine import DecisionEngine
from processing.statistics_engine import StatisticsEngine

from processing.zone_segmenter import ZoneSegmenter
from processing.preprocessor import Preprocessor
from processing.roi_manager import ROIManager

roi_manager = ROIManager()

# MODEL KEPT FOR FUTURE AI TRAINING
#from processing.efficientnet_model import EfficientNetModel


import os

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "backend",
    "models",
    "current",
    "model_v1.pth"
)
# MODEL DISABLED TEMPORARILY
# model = EfficientNetModel(MODEL_PATH)

# -------------------- FOLDERS --------------------
TEST_FOLDER = "test_images"
SAVE_FOLDER = "database/defected"
METADATA_FOLDER = "database/metadata"

BATCH_OUTPUT = ""

# -------------------- THRESHOLD --------------------
VARIATION_THRESHOLD = 12


def ensure_directories():
    os.makedirs(SAVE_FOLDER, exist_ok=True)
    os.makedirs(METADATA_FOLDER, exist_ok=True)
    os.makedirs("defected_images", exist_ok=True)


# -------------------- DELTA E --------------------
def compute_delta_e(zone_mean, global_mean):
    return abs(zone_mean - global_mean)


# -------------------- OVERLAY --------------------
def overlay_zone(image, prediction):

    if prediction == "defect":

        h, w, _ = image.shape

        overlay = image.copy()

        cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 255), -1)

        alpha = 0.25

        image = cv2.addWeighted(
            overlay,
            alpha,
            image,
            1 - alpha,
            0
        )

        cv2.putText(
            image,
            "DEFECT DETECTED",
            (40, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (255, 255, 255),
            2
        )

    return image


# -------------------- METADATA --------------------
def save_metadata(filename, prediction, confidence):

    timestamp = datetime.now().strftime("%H%M%S")

    meta_filename = f"{filename}_{timestamp}.json"

    data = {
        "image": filename,
        "prediction": prediction,
        "confidence": float(confidence),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    with open(os.path.join(METADATA_FOLDER, meta_filename), "w") as f:
        json.dump(data, f, indent=4)


# -------------------- LOGIC DETECTION --------------------
def detect_variation(roi_frame):

    blurred = Preprocessor.apply_blur(roi_frame)

    lab = Preprocessor.convert_to_lab(blurred)

    l_channel = Preprocessor.extract_l_channel(lab)

    left, center, right = ZoneSegmenter.segment_lcr(l_channel)

    left_stats = StatisticsEngine.compute_statistics(left)
    center_stats = StatisticsEngine.compute_statistics(center)
    right_stats = StatisticsEngine.compute_statistics(right)

    global_mean = (
        left_stats["mean"] +
        center_stats["mean"] +
        right_stats["mean"]
    ) / 3

    delta_left = compute_delta_e(
        left_stats["mean"],
        global_mean
    )

    delta_center = compute_delta_e(
        center_stats["mean"],
        global_mean
    )

    delta_right = compute_delta_e(
        right_stats["mean"],
        global_mean
    )

    max_variation = max(
        delta_left,
        delta_center,
        delta_right
    )

    if max_variation > VARIATION_THRESHOLD:
        prediction = "defect"
    else:
        prediction = "no_defect"

    confidence = float(max_variation)

    return prediction, confidence


# -------------------- PROCESS IMAGE --------------------
def process_image(image_path):

    image = cv2.imread(image_path)

    filename = os.path.basename(image_path)

    if image is None:
        print(f"Unable to read image: {filename}")
        return

    # ---------------- ROI ----------------
    roi_frame = roi_manager.crop(image)

    # ---------------- LOGIC DETECTION ----------------
    prediction, confidence = detect_variation(roi_frame)

    print(f"{filename} → {prediction} ({confidence:.2f})")

    # ---------------- SAVE ONLY DEFECTS ----------------
    if prediction == "defect":

        print(f"Defect detected in {filename}")

        display_frame = image.copy()

        overlayed = overlay_zone(display_frame, prediction)

        timestamp = datetime.now().strftime("%H%M%S_%f")

        safe_filename = f"{timestamp}_{filename}"

        save_path = os.path.join(BATCH_OUTPUT, safe_filename)

        cv2.imwrite(save_path, overlayed)

        # Save metadata
        save_metadata(filename, prediction, confidence)


# -------------------- LIVE FRAME --------------------
def process_frame(frame):

    roi_frame = roi_manager.crop(frame)

    prediction, confidence = detect_variation(roi_frame)

    if prediction == "defect":

        overlayed = overlay_zone(
            frame.copy(),
            prediction
        )

        return overlayed, prediction, confidence

    return frame, prediction, confidence


# -------------------- MAIN --------------------
def run_batch_mode():

    ensure_directories()

    global BATCH_OUTPUT

    today_str = datetime.now().strftime("%Y_%m_%d")

    BATCH_OUTPUT = os.path.join(
        "defected_images",
        today_str
    )

    os.makedirs(BATCH_OUTPUT, exist_ok=True)

    files = os.listdir(TEST_FOLDER)

    if not files:
        print("No images found in test_images folder.")
        return

    for file in files:

        if file.lower().endswith((".jpg", ".png", ".jpeg")):

            process_image(
                os.path.join(TEST_FOLDER, file)
            )

    print("\nBatch testing completed.\n")


def run_api_mode():

    from backend.api_server import app

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )


def main():

    if "--batch" in sys.argv:
        run_batch_mode()
        return

    run_api_mode()


if __name__ == "__main__":
    main()