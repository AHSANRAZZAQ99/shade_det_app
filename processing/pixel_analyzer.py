# processing/pixel_analyzer.py

import numpy as np
import cv2
from config import settings

class PixelAnalyzer:

    @staticmethod
    def analyze_zone(zone, reference_mean):

        # 1️⃣ Absolute deviation map
        deviation_map = np.abs(zone.astype(np.float32) - reference_mean)

        # 2️⃣ Threshold mask
        raw_mask = deviation_map > settings.PIXEL_DELTA_THRESHOLD
        raw_mask = raw_mask.astype(np.uint8) * 255

        # 3️⃣ Morphological filtering
        kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, 
            (settings.MORPH_KERNEL_SIZE, settings.MORPH_KERNEL_SIZE)
        )
        opened = cv2.morphologyEx(raw_mask, cv2.MORPH_OPEN, kernel)
        cleaned_mask = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)

        # 4️⃣ Connected component filtering (minimum area)
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(cleaned_mask)
        filtered_mask = np.zeros_like(cleaned_mask)
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area >= settings.MIN_DEFECT_AREA:
                filtered_mask[labels == i] = 255

        # 5️⃣ Defect density
        total_pixels = zone.size
        defect_pixels = np.sum(filtered_mask == 255)
        defect_ratio = defect_pixels / total_pixels

        return {
            "defect_ratio": defect_ratio,
            "defect_mask": filtered_mask
        }