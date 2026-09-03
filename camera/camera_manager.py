import cv2
import numpy as np
import os
import time


class CameraManager:

    def __init__(self, camera_source=0):

        self.cap = None
        self.camera_source = camera_source


        # =====================================
        # RTSP CAMERA
        # =====================================

        if isinstance(camera_source, str):

            print("Opening RTSP camera...")

            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                "rtsp_transport;tcp|fflags;nobuffer|max_delay;0"
            )


            self.cap = cv2.VideoCapture(
                camera_source,
                cv2.CAP_FFMPEG
            )


        # =====================================
        # USB / LAPTOP CAMERA
        # =====================================

        else:

            print("Opening laptop/USB webcam...")


            # First try normal backend
            self.cap = cv2.VideoCapture(
                camera_source
            )


            # If failed use DirectShow
            if not self.cap.isOpened():

                print(
                    "Default backend failed, trying DirectShow..."
                )


                self.cap = cv2.VideoCapture(
                    camera_source,
                    cv2.CAP_DSHOW
                )



        # =====================================
        # CAMERA CHECK
        # =====================================

        if not self.cap.isOpened():

            raise Exception(
                "Camera not accessible"
            )


        # =====================================
        # CAMERA SETTINGS
        # =====================================

        self.cap.set(
            cv2.CAP_PROP_FRAME_WIDTH,
            1280
        )


        self.cap.set(
            cv2.CAP_PROP_FRAME_HEIGHT,
            720
        )


        # Reduce delay
        self.cap.set(
            cv2.CAP_PROP_BUFFERSIZE,
            1
        )



        # =====================================
        # CAMERA WARM UP
        # =====================================

        print("Warming up camera...")


        warmup_success = False


        for i in range(15):

            ret, frame = self.cap.read()


            if ret and frame is not None:

                warmup_success = True

                print(
                    "Camera warmed up successfully"
                )

                break


            time.sleep(0.1)



        if not warmup_success:

            self.cap.release()

            raise Exception(
                "Camera opened but cannot receive frames"
            )



        print(
            "Camera connected successfully"
        )




    # =====================================
    # GET FRAME
    # =====================================

    def get_frame(self):

        if self.cap is None:
            return None


        ret, frame = self.cap.read()


        if not ret or frame is None:

            print(
                "Failed to receive frame"
            )

            return None



        frame = cv2.resize(
            frame,
            (900,500)
        )


        return frame





    # =====================================
    # LCR OVERLAY
    # =====================================

    def apply_lcr_overlay(self, frame):

        h, w, _ = frame.shape


        left = frame[:, :w//3]

        center = frame[
            :,
            w//3:2*w//3
        ]

        right = frame[
            :,
            2*w//3:
        ]


        left_mean = np.mean(left)

        center_mean = np.mean(center)

        right_mean = np.mean(right)



        threshold = 10



        left_defect = (
            abs(left_mean-center_mean)
            >
            threshold
        )


        right_defect = (
            abs(right_mean-center_mean)
            >
            threshold
        )



        overlay = frame.copy()



        if left_defect:

            cv2.rectangle(
                overlay,
                (0,0),
                (w//3,h),
                (0,0,255),
                -1
            )



        if right_defect:

            cv2.rectangle(
                overlay,
                (2*w//3,0),
                (w,h),
                (0,0,255),
                -1
            )



        frame = cv2.addWeighted(
            overlay,
            0.3,
            frame,
            0.7,
            0
        )



        cv2.line(
            frame,
            (w//3,0),
            (w//3,h),
            (255,255,255),
            2
        )


        cv2.line(
            frame,
            (2*w//3,0),
            (2*w//3,h),
            (255,255,255),
            2
        )



        cv2.putText(
            frame,
            "LEFT",
            (50,40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (255,255,255),
            2
        )


        cv2.putText(
            frame,
            "CENTER",
            (w//3+50,40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (255,255,255),
            2
        )


        cv2.putText(
            frame,
            "RIGHT",
            (2*w//3+50,40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (255,255,255),
            2
        )


        return frame





    # =====================================
    # RELEASE CAMERA
    # =====================================

    def release(self):

        if self.cap is not None:

            self.cap.release()

            self.cap = None

            print(
                "Camera released successfully"
            )