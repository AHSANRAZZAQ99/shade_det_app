import cv2

class ROIManager:
    """
    Handles Region of Interest (ROI) operations:
    - Store ROI
    - Apply cropping safely
    """

    def __init__(self):
        # Default ROI (can be updated later from frontend)
        self.roi = {
            "x": 100,
            "y": 100,
            "w": 700,
            "h": 300
        }

    # -------------------- SET ROI --------------------
    def set_roi(self, x, y, w, h):
        self.roi = {
            "x": int(x),
            "y": int(y),
            "w": int(w),
            "h": int(h)
        }

    # -------------------- GET ROI --------------------
    def get_roi(self):
        return self.roi

    # -------------------- APPLY ROI --------------------
    def crop(self, frame):
        """
        Safely crop ROI from frame
        Handles boundary conditions
        """
        if frame is None:
            return frame

        h_frame, w_frame = frame.shape[:2]

        x = max(0, self.roi["x"])
        y = max(0, self.roi["y"])
        w = max(1, self.roi["w"])
        h = max(1, self.roi["h"])

        # Ensure ROI does not exceed frame
        x_end = min(x + w, w_frame)
        y_end = min(y + h, h_frame)

        roi_frame = frame[y:y_end, x:x_end]

        # Safety fallback
        if roi_frame.size == 0:
            return frame

        return roi_frame