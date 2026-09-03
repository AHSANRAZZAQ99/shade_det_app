import torch
import torch.nn as nn
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
import os
import json


# ================= CONFIG =================


BASE_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        ".."
    )
)


# Dataset

DATASET_PATH = os.path.join(
    BASE_DIR,
    "database",
    "labeled_dataset"
)


# Current deployed model

CURRENT_MODEL_PATH = os.path.join(
    BASE_DIR,
    "backend",
    "models",
    "current",
    "model_v1.pth"
)


# Candidate model

CANDIDATE_MODEL_PATH = os.path.join(
    BASE_DIR,
    "backend",
    "models",
    "candidate",
    "model_v2.pth"
)


os.makedirs(
    os.path.dirname(CANDIDATE_MODEL_PATH),
    exist_ok=True
)



BATCH_SIZE = 16
EPOCHS = 10


# Binary classes

CLASS_NAMES = [
    "defect",
    "no_defect"
]



# ================= DATASET =================


def create_dataset(base_path, transform):


    dataset = datasets.ImageFolder(
        base_path,
        transform=transform
    )


    print(
        "Original classes:",
        dataset.classes
    )


    # Check binary classes

    if sorted(dataset.classes) != sorted(CLASS_NAMES):

        raise Exception(
            f"Dataset classes must be {CLASS_NAMES}. "
            f"Found {dataset.classes}"
        )


    print(
        "Training classes:",
        dataset.classes
    )


    return dataset




# ================= SMART MODEL LOADING =================


def load_previous_model(model, device):


    if not os.path.exists(CURRENT_MODEL_PATH):

        print(
            "No previous model found. Training from scratch."
        )

        return model



    print(
        "Loading previous model for fine-tuning..."
    )


    checkpoint = torch.load(
        CURRENT_MODEL_PATH,
        map_location=device
    )


    model_dict = model.state_dict()



    # Only load matching layers

    filtered_checkpoint = {

        k:v

        for k,v in checkpoint.items()

        if k in model_dict
        and model_dict[k].shape == v.shape

    }



    model_dict.update(
        filtered_checkpoint
    )


    model.load_state_dict(
        model_dict
    )


    print(
        f"Loaded {len(filtered_checkpoint)} layers"
    )


    print(
        "Old classifier skipped (new binary classifier created)"
    )


    return model




# ================= TRAIN =================


def train():


    device = torch.device(
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )


    print(
        "Using device:",
        device
    )



    transform = transforms.Compose([

        transforms.Resize(
            (224,224)
        ),

        transforms.ToTensor()

    ])




    # Dataset

    dataset = create_dataset(
        DATASET_PATH,
        transform
    )



    # Save class mapping

    CLASS_FILE = os.path.join(
        BASE_DIR,
        "class_names.json"
    )


    with open(
        CLASS_FILE,
        "w"
    ) as f:

        json.dump(
            dataset.classes,
            f
        )


    print(
        "Class mapping saved:",
        dataset.classes
    )



    loader = DataLoader(
        dataset,
        batch_size=BATCH_SIZE,
        shuffle=True
    )



    # ================= MODEL =================


    model = models.efficientnet_b0(
        weights="DEFAULT"
    )



    # NEW BINARY CLASSIFIER

    model.classifier[1] = nn.Linear(

        model.classifier[1].in_features,

        2

    )



    # Load old knowledge

    model = load_previous_model(
        model,
        device
    )



    model.to(device)



    # ================= TRAINING =================


    criterion = nn.CrossEntropyLoss()


    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=0.001
    )



    for epoch in range(EPOCHS):


        total_loss = 0



        for images, labels in loader:


            images = images.to(device)

            labels = labels.to(device)



            outputs = model(images)



            loss = criterion(
                outputs,
                labels
            )



            optimizer.zero_grad()

            loss.backward()

            optimizer.step()



            total_loss += loss.item()



        print(
            f"Epoch {epoch+1}/{EPOCHS} Loss: {total_loss:.4f}"
        )



    # ================= SAVE =================


    torch.save(

        model.state_dict(),

        CANDIDATE_MODEL_PATH

    )


    print(
        "\nCandidate model saved:"
    )

    print(
        CANDIDATE_MODEL_PATH
    )




if __name__ == "__main__":

    train()