import torch
import torch.nn as nn
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
import os
import shutil
from datetime import datetime



# ================= PATHS =================


BASE_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        ".."
    )
)


VALIDATION_PATH = os.path.join(
    BASE_DIR,
    "database",
    "validation_dataset"
)



CURRENT_MODEL = os.path.join(
    BASE_DIR,
    "backend",
    "models",
    "current",
    "model_v1.pth"
)


CANDIDATE_MODEL = os.path.join(
    BASE_DIR,
    "backend",
    "models",
    "candidate",
    "model_v2.pth"
)



ARCHIVE_DIR = os.path.join(
    BASE_DIR,
    "backend",
    "models",
    "archive"
)



os.makedirs(
    ARCHIVE_DIR,
    exist_ok=True
)



# ================= CONFIG =================


BATCH_SIZE = 16


CLASS_COUNT = 2



# ================= MODEL =================


def create_model():


    model = models.efficientnet_b0(
        weights=None
    )


    model.classifier[1] = nn.Linear(
        model.classifier[1].in_features,
        CLASS_COUNT
    )


    return model




# ================= TEST =================


def evaluate(model_path):


    device = torch.device(
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )


    model = create_model()



    model.load_state_dict(
        torch.load(
            model_path,
            map_location=device
        )
    )


    model.to(device)


    model.eval()



    transform = transforms.Compose([

        transforms.Resize(
            (224,224)
        ),

        transforms.ToTensor()

    ])



    dataset = datasets.ImageFolder(
        VALIDATION_PATH,
        transform
    )



    loader = DataLoader(
        dataset,
        batch_size=BATCH_SIZE
    )



    correct = 0

    total = 0



    with torch.no_grad():


        for images, labels in loader:


            images = images.to(device)

            labels = labels.to(device)



            outputs = model(images)


            _, predicted = torch.max(
                outputs,
                1
            )



            total += labels.size(0)

            correct += (
                predicted == labels
            ).sum().item()



    accuracy = (
        correct / total
    ) * 100



    return accuracy




# ================= DEPLOY =================


def promote_candidate():



    timestamp = datetime.now().strftime(
        "%Y_%m_%d_%H_%M_%S"
    )


    archive_model = os.path.join(
        ARCHIVE_DIR,
        f"model_{timestamp}.pth"
    )



    # archive old model

    shutil.copy(
        CURRENT_MODEL,
        archive_model
    )



    # replace current

    shutil.copy(
        CANDIDATE_MODEL,
        CURRENT_MODEL
    )


    print(
        "Candidate deployed successfully"
    )




# ================= MAIN =================


def main():


    print(
        "Testing current model..."
    )


    current_acc = evaluate(
        CURRENT_MODEL
    )


    print(
        f"Current accuracy: {current_acc:.2f}%"
    )



    print(
        "Testing candidate model..."
    )


    candidate_acc = evaluate(
        CANDIDATE_MODEL
    )


    print(
        f"Candidate accuracy: {candidate_acc:.2f}%"
    )



    if candidate_acc > current_acc:


        print(
            "Candidate is better. Deploying..."
        )


        promote_candidate()



    else:


        print(
            "Candidate rejected. Keeping current model."
        )




if __name__ == "__main__":

    main()