# alerts/alert_manager.py

class AlertManager:

    @staticmethod
    def trigger_alert(defect_type):
        print("\n" + "="*50)
        print("🚨 SHADE DEFECT DETECTED!")
        print(f"DEFECT TYPE: {defect_type}")
        print("="*50 + "\n")

    @staticmethod
    def reset_alert():
        pass