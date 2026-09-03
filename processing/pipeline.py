def process_frame(image, roi=None):

    import cv2
    from processing.decision_engine import DecisionEngine
    from processing.pixel_analyzer import PixelAnalyzer
    from processing.preprocessor import Preprocessor
    from processing.roi_manager import ROIManager
    from processing.statistics_engine import StatisticsEngine
    from processing.zone_segmenter import ZoneSegmenter

    # ---------------- ROI HANDLING ----------------
    roi_manager = ROIManager()

    if isinstance(roi, dict):
        try:
            roi_manager.set_roi(
                int(roi.get("x", 0)),
                int(roi.get("y", 0)),
                int(roi.get("w", image.shape[1])),
                int(roi.get("h", image.shape[0])),
            )
        except Exception:
            pass

    roi_frame = roi_manager.crop(image)

    if roi_frame is None or roi_frame.size == 0:
        result = {
            "defect_detected": False,
            "defect_type": "NORMAL",
            "confidence": 0.0,
            "global_mean": 0.0,
            "deviations": {"LEFT": 0.0, "CENTER": 0.0, "RIGHT": 0.0},
            "pixel_density": {"LEFT": 0.0, "CENTER": 0.0, "RIGHT": 0.0},
            "roi": {
                "x": int(roi.get("x", 0)) if isinstance(roi, dict) else 0,
                "y": int(roi.get("y", 0)) if isinstance(roi, dict) else 0,
                "w": int(roi.get("w", image.shape[1])) if isinstance(roi, dict) else image.shape[1],
                "h": int(roi.get("h", image.shape[0])) if isinstance(roi, dict) else image.shape[0],
            },
        }
        return result, image.copy()

    # ---------------- LOGIC DETECTION ----------------
    blurred = Preprocessor.apply_blur(roi_frame)
    lab = Preprocessor.convert_to_lab(blurred)
    l_channel = Preprocessor.extract_l_channel(lab)
    left, center, right = ZoneSegmenter.segment_lcr(l_channel)

    left_stats = StatisticsEngine.compute_statistics(left)
    center_stats = StatisticsEngine.compute_statistics(center)
    right_stats = StatisticsEngine.compute_statistics(right)

    global_mean = (left_stats["mean"] + center_stats["mean"] + right_stats["mean"]) / 3

    left_pixels = PixelAnalyzer.analyze_zone(left, global_mean)
    center_pixels = PixelAnalyzer.analyze_zone(center, global_mean)
    right_pixels = PixelAnalyzer.analyze_zone(right, global_mean)

    result = DecisionEngine.analyze(
        left_stats,
        center_stats,
        right_stats,
        left_pixels,
        center_pixels,
        right_pixels,
    )

    confidence = max(
        abs(result["deviations"]["LEFT"]),
        abs(result["deviations"]["CENTER"]),
        abs(result["deviations"]["RIGHT"]),
    )

    result.update(
        {
            "confidence": float(confidence),
            "roi": {
                "x": int(roi.get("x", 0)) if isinstance(roi, dict) else 0,
                "y": int(roi.get("y", 0)) if isinstance(roi, dict) else 0,
                "w": int(roi.get("w", image.shape[1])) if isinstance(roi, dict) else image.shape[1],
                "h": int(roi.get("h", image.shape[0])) if isinstance(roi, dict) else image.shape[0],
            },
        }
    )

    # ---------------- OVERLAY ----------------
    overlayed = image.copy()

    if result["defect_detected"]:
        x = result["roi"]["x"]
        y = result["roi"]["y"]
        w = result["roi"]["w"]
        h = result["roi"]["h"]

        cv2.rectangle(overlayed, (x, y), (x + w, y + h), (0, 0, 255), 3)

        text = f"{result['defect_type']} ({confidence:.2f})"
        cv2.putText(
            overlayed,
            text,
            (x, y - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2,
        )

    return result, overlayed