# processing/preprocessor.py

import cv2
from config import settings

class Preprocessor:

    @staticmethod
    def apply_blur(frame):
        return cv2.GaussianBlur(
            frame,
            (settings.BLUR_KERNEL, settings.BLUR_KERNEL),
            0
        )

    @staticmethod
    def convert_to_lab(frame):
        return cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)

    @staticmethod
    def extract_l_channel(lab_frame):
        l_channel, _, _ = cv2.split(lab_frame)
        return l_channel