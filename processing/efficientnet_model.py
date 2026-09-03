import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from processing.pipeline import process_frame
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
from training.train_model import train

class EfficientNetModel:

    def __init__(self, model_path):
        self.device = torch.device("cpu")

        # Load EfficientNet-B0
        self.model = efficientnet_b0(weights=EfficientNet_B0_Weights.DEFAULT)

        # Modify classifier for 4 classes
        self.model.classifier[1] = nn.Linear(
            self.model.classifier[1].in_features, 4
        )

        # Load trained weights
        self.model.load_state_dict(
            torch.load(model_path, map_location=self.device)
        )

        self.model.to(self.device)
        self.model.eval()

        # Class labels (IMPORTANT: must match training)
        self.classes = ["left", "center", "right", "no_defect"]

        # Image preprocessing
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor()
        ])

    # -------------------- PREDICTION --------------------
    def predict(self, image):

        # Transform image
        img = self.transform(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.model(img)

            # Convert logits → probabilities
            probs = F.softmax(outputs, dim=1)

            # Get highest probability
            confidence, pred = torch.max(probs, 1)

        label = self.classes[pred.item()]
        confidence = confidence.item()

        return label, confidence