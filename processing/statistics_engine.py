# processing/statistics_engine.py

import numpy as np

class StatisticsEngine:

    @staticmethod
    def compute_statistics(zone):

        mean = np.mean(zone)
        std = np.std(zone)

        if mean == 0:
            cv = 0
        else:
            cv = std / mean

        return {
            "mean": float(mean),
            "std": float(std),
            "cv": float(cv)
        }