# processing/decision_engine.py

from config import settings

class DecisionEngine:

    @staticmethod
    def analyze(left_stats, center_stats, right_stats,
                left_pixel, center_pixel, right_pixel):

        # Basic stats
        mean_L, mean_C, mean_R = left_stats["mean"], center_stats["mean"], right_stats["mean"]
        cv_L, cv_C, cv_R = left_stats["cv"], center_stats["cv"], right_stats["cv"]

        # Global mean
        global_mean = (mean_L + mean_C + mean_R) / 3
        dev_L, dev_C, dev_R = mean_L - global_mean, mean_C - global_mean, mean_R - global_mean

        abs_devs = {"LEFT": abs(dev_L), "CENTER": abs(dev_C), "RIGHT": abs(dev_R)}
        max_zone = max(abs_devs, key=abs_devs.get)
        max_deviation = abs_devs[max_zone]

        # Pixel density
        density_L = left_pixel["defect_ratio"]
        density_C = center_pixel["defect_ratio"]
        density_R = right_pixel["defect_ratio"]

        defect_detected = False
        defect_type = "NORMAL"

        # 1️⃣ Pixel density check (highest priority)
        if density_L > settings.DEFECT_DENSITY_THRESHOLD:
            defect_detected = True
            defect_type = "LEFT_PIXEL_VARIATION"
        elif density_C > settings.DEFECT_DENSITY_THRESHOLD:
            defect_detected = True
            defect_type = "CENTER_PIXEL_VARIATION"
        elif density_R > settings.DEFECT_DENSITY_THRESHOLD:
            defect_detected = True
            defect_type = "RIGHT_PIXEL_VARIATION"

        # 2️⃣ Mean deviation check
        elif max_deviation > settings.DELTA_L_THRESHOLD:
            defect_detected = True
            if max_zone == "LEFT":
                defect_type = "LEFT_DARKER" if dev_L < 0 else "LEFT_LIGHTER"
            elif max_zone == "CENTER":
                defect_type = "CENTER_DARKER" if dev_C < 0 else "CENTER_LIGHTER"
            elif max_zone == "RIGHT":
                defect_type = "RIGHT_DARKER" if dev_R < 0 else "RIGHT_LIGHTER"

        # 3️⃣ Uniformity check (CV)
        elif (cv_L > settings.CV_THRESHOLD or
              cv_C > settings.CV_THRESHOLD or
              cv_R > settings.CV_THRESHOLD):
            defect_detected = True
            defect_type = "LOCAL_UNIFORMITY_ISSUE"

        # 4️⃣ Global variation check
        total_spread = max(mean_L, mean_C, mean_R) - min(mean_L, mean_C, mean_R)
        if total_spread > (settings.DELTA_L_THRESHOLD * 2):
            defect_detected = True
            defect_type = "GLOBAL_VARIATION"

        return {
            "defect_detected": defect_detected,
            "defect_type": defect_type,
            "global_mean": global_mean,
            "deviations": {"LEFT": dev_L, "CENTER": dev_C, "RIGHT": dev_R},
            "pixel_density": {"LEFT": density_L, "CENTER": density_C, "RIGHT": density_R}
        }