# ui/display_manager.py

import cv2

class DisplayManager:

    @staticmethod
    def show_frame(frame):
        cv2.imshow("LCR Shade Detection", frame)

    @staticmethod
    def check_exit():
        return cv2.waitKey(1) & 0xFF == ord('q')

    @staticmethod
    def close():
        cv2.destroyAllWindows()