import winsound
import threading


class AlertManager:


    @staticmethod
    def no_variation():

        threading.Thread(
            target=AlertManager._single_beep,
            daemon=True
        ).start()



    @staticmethod
    def variation_detected():

        threading.Thread(
            target=AlertManager._double_beep,
            daemon=True
        ).start()



    @staticmethod
    def _single_beep():

        winsound.Beep(
            1000,
            200
        )



    @staticmethod
    def _double_beep():

        winsound.Beep(
            1200,
            300
        )

        winsound.Beep(
            1200,
            300
        )

