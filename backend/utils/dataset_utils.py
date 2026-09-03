# utils/dataset_utils.py
import torch
import torchvision
import os

DATASET_PATH = "C:\\shade_det_app\\database\\labeled_dataset"

def count_dataset_images():
    total = 0

    for root, dirs, files in os.walk(DATASET_PATH):
        for file in files:
            if file.lower().endswith((".jpg", ".png", ".jpeg")):
                total += 1

    return total