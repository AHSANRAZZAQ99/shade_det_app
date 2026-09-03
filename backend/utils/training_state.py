import os
import json

STATE_FILE = "C:\\shade_det_app\\train_state.json"

def get_last_trained_count():
    if not os.path.exists(STATE_FILE):
        return 0

    try:
        with open(STATE_FILE, "r") as f:
            data = json.load(f)
            return data.get("last_count", 0)
    except Exception as e:
        print(" train_state.json corrupted or empty, resetting...")
        return 0


def update_last_trained_count(count):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({"last_count": count}, f)
    except Exception as e:
        print(" Failed to write train_state.json:", str(e))