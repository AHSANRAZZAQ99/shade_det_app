# logger/data_logger.py

import csv
import os
from datetime import datetime
from config import settings

class DataLogger:

    @staticmethod
    def log(result):

        # Ensure directory exists
        log_dir = os.path.dirname(settings.LOG_FILE_PATH)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)

        file_exists = os.path.isfile(settings.LOG_FILE_PATH)

        with open(settings.LOG_FILE_PATH, mode="a", newline="") as file:
            writer = csv.writer(file)

            if not file_exists:
                writer.writerow([
                    "Timestamp",
                    "Defect",
                    "Defect_Type",
                    "Global_Mean",
                    "Dev_Left",
                    "Dev_Center",
                    "Dev_Right"
                ])

            writer.writerow([
                datetime.now(),
                result["defect_detected"],
                result["defect_type"],
                result["global_mean"],
                result["deviations"]["LEFT"],
                result["deviations"]["CENTER"],
                result["deviations"]["RIGHT"]
            ])