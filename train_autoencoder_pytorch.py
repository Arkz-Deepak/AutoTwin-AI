"""
PyTorch Convolutional Autoencoder for Structural Joint Anomaly Detection
Cross-Platform Training Script (Windows RTX GPU / Ubuntu Linux CUDA)
"""
import os
import time
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

# ---------------------------------------------------------
# 1. Configuration & Paths
# ---------------------------------------------------------
ROOT = Path(r"/media/windows/Projects/DigitalTwin")
DATA_DIR = ROOT / "synthetic_dataset" / "autoencoder_baseline"
MODEL_SAVE_PATH = ROOT / "models" / "autoencoder_best.pth"
VIZ_SAVE_PATH = ROOT / "models" / "reconstruction_analysis.png"

MODEL_SAVE_PATH.parent.mkdir(parents=True, exist_ok=True)

IMAGE_SIZE = 256
BATCH_SIZE = 16
EPOCHS = 50
LEARNING_RATE = 1e-3
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ---------------------------------------------------------
# 2. Dataset Loader
# ---------------------------------------------------------
class ChassisDataset(Dataset):
    def __init__(self, root_dir: Path, img_size: int = 256):
        self.root_dir = root_dir
        self.image_paths = sorted(list(root_dir.glob("weld_normal_*.png")))
        self.transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),  # Scales pixels to [0.0, 1.0]
        ])

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        img = Image.open(img_path).convert("RGB")
        tensor_img = self.transform(img)
        return tensor_img, tensor_img

# ---------------------------------------------------------
# 3. Convolutional Autoencoder Architecture
# ---------------------------------------------------------
class ConvAutoencoder(nn.Module):
    def __init__(self):
        super(ConvAutoencoder, self).__init__()
        # Encoder: 256x256x3 -> 16x16x256
        self.encoder = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, stride=2, padding=1),   # 128x128
            nn.BatchNorm2d(32),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(32, 64, kernel_size=3, stride=2, padding=1),  # 64x64
            nn.BatchNorm2d(64),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(64, 128, kernel_size=3, stride=2, padding=1), # 32x32
            nn.BatchNorm2d(128),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(128, 256, kernel_size=3, stride=2, padding=1),# 16x16
            nn.BatchNorm2d(256),
            nn.LeakyReLU(0.2, inplace=True)
        )
        # Decoder: 16x16x256 -> 256x256x3
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(256, 128, kernel_size=3, stride=2, padding=1, output_padding=1), # 32x32
            nn.BatchNorm2d(128),
            nn.LeakyReLU(0.2, inplace=True),
            nn.ConvTranspose2d(128, 64, kernel_size=3, stride=2, padding=1, output_padding=1),  # 64x64
            nn.BatchNorm2d(64),
            nn.LeakyReLU(0.2, inplace=True),
            nn.ConvTranspose2d(64, 32, kernel_size=3, stride=2, padding=1, output_padding=1),   # 128x128
            nn.BatchNorm2d(32),
            nn.LeakyReLU(0.2, inplace=True),
            nn.ConvTranspose2d(32, 3, kernel_size=3, stride=2, padding=1, output_padding=1),    # 256x256
            nn.Sigmoid()  # Reconstructs pixels strictly in [0.0, 1.0]
        )

    def forward(self, x):
        latent = self.encoder(x)
        reconstruction = self.decoder(latent)
        return reconstruction

# ---------------------------------------------------------
# 4. Visualization & Error Heatmap Function
# ---------------------------------------------------------
def visualize_reconstruction(model: nn.Module, dataset: Dataset, device: torch.device, output_path: Path):
    """
    Evaluates a sample image, computes the reconstruction difference,
    and plots: Original | Reconstruction | Error Heatmap.
    """
    model.eval()
    sample_idx = min(len(dataset) - 1, 0)
    orig_tensor, _ = dataset[sample_idx]

    with torch.no_grad():
        input_batch = orig_tensor.unsqueeze(0).to(device)
        recon_tensor = model(input_batch).squeeze(0).cpu()

    # Convert tensors (C, H, W) to numpy images (H, W, C) in [0, 1]
    orig_img = orig_tensor.permute(1, 2, 0).numpy()
    recon_img = recon_tensor.permute(1, 2, 0).numpy()

    # Calculate absolute error heatmap averaged across color channels
    abs_diff = np.abs(orig_img - recon_img)
    error_heatmap = np.mean(abs_diff, axis=-1)
    mse_score = np.mean((orig_img - recon_img) ** 2)

    # Plot 1x3 comparison
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    fig.suptitle(f"Chassis Structural Joint - Autoencoder Inspection Analysis\nReconstruction MSE Loss: {mse_score:.6f}", fontsize=14, fontweight='bold')

    axes[0].imshow(orig_img)
    axes[0].set_title("1. Original Input Image", fontsize=12, fontweight='semibold')
    axes[0].axis("off")

    axes[1].imshow(recon_img)
    axes[1].set_title("2. Autoencoder Reconstruction", fontsize=12, fontweight='semibold')
    axes[1].axis("off")

    im_heat = axes[2].imshow(error_heatmap, cmap="inferno", vmin=0.0, vmax=max(0.15, float(error_heatmap.max())))
    axes[2].set_title("3. Error Heatmap (|Diff|)", fontsize=12, fontweight='semibold')
    axes[2].axis("off")
    fig.colorbar(im_heat, ax=axes[2], fraction=0.046, pad=0.04, label="Anomaly Intensity")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"\n[Visualization Saved] -> {output_path}")
    try:
        plt.show()
    except Exception:
        pass

# ---------------------------------------------------------
# 5. Training Loop
# ---------------------------------------------------------
def train():
    print(f"\n===========================================================")
    print(f"  PyTorch Autoencoder Training - Vehicle Chassis Digital Twin")
    print(f"  Dataset: {DATA_DIR}")
    print(f"  Device:  {DEVICE} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")
    print(f"  Epochs:  {EPOCHS} | Batch Size: {BATCH_SIZE} | Image Size: {IMAGE_SIZE}x{IMAGE_SIZE}")
    print(f"===========================================================\n")

    dataset = ChassisDataset(DATA_DIR, IMAGE_SIZE)
    if len(dataset) == 0:
        raise FileNotFoundError(f"No training images found in {DATA_DIR}. Please run data generation first.")

    print(f"Found {len(dataset):,} baseline synthetic images for training.")
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, pin_memory=(DEVICE.type == 'cuda'))

    model = ConvAutoencoder().to(DEVICE)
    criterion = nn.MSELoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_loss = float('inf')
    t_start = time.time()

    for epoch in range(1, EPOCHS + 1):
        model.train()
        running_loss = 0.0

        for inputs, targets in dataloader:
            inputs, targets = inputs.to(DEVICE), targets.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * inputs.size(0)

        scheduler.step()
        epoch_loss = running_loss / len(dataset)

        if epoch % 5 == 0 or epoch == 1 or epoch == EPOCHS:
            print(f"Epoch [{epoch:03d}/{EPOCHS:03d}] | Loss (MSE): {epoch_loss:.6f} | LR: {scheduler.get_last_lr()[0]:.6f}")

        if epoch_loss < best_loss:
            best_loss = epoch_loss
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'loss': best_loss,
            }, MODEL_SAVE_PATH)

    total_time = time.time() - t_start
    print(f"\nTraining completed in {total_time:.1f}s ({total_time / 60.0:.2f} min). Best Loss: {best_loss:.6f}")
    print(f"Model saved to: {MODEL_SAVE_PATH}")

    # Load best weights and trigger 3-panel visualization
    checkpoint = torch.load(MODEL_SAVE_PATH, map_location=DEVICE)
    model.load_state_dict(checkpoint['model_state_dict'])
    visualize_reconstruction(model, dataset, DEVICE, VIZ_SAVE_PATH)

if __name__ == '__main__':
    train()

