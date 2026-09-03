# config/settings.py

# ---------------- CAMERA SETTINGS ----------------
CAMERA_ID = 0
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# ---------------- PREPROCESSING ----------------
BLUR_KERNEL = 5   # Must be odd number (3,5,7...)

# ---------------- DETECTION THRESHOLDS ----------------
DELTA_L_THRESHOLD = 5.0     # Shade difference threshold
CV_THRESHOLD = 0.02          # Uniformity threshold

# ---------------- SYSTEM SETTINGS ----------------
FRAME_AVERAGE_COUNT = 5
SAVE_DEFECT_IMAGES = True
LOG_FILE_PATH = "logs/shade_log.csv"

# Pixel-level thresholds
DEFECT_DENSITY_THRESHOLD = 0.08 # Threshold for defect density (percentage of defective pixels)
PIXEL_DELTA_THRESHOLD = 15     # Per pixel deviation

# ---------------- MORPHOLOGICAL SETTINGS ----------------
MORPH_KERNEL_SIZE = 5          # Must be odd
MIN_DEFECT_AREA = 1500          # Minimum connected pixels to count as defect