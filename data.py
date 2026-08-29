import os
from PIL import Image

dataset_dir = "/media/windows/Projects/DigitalTwin/synthetic_dataset/autoencoder_baseline"
removed_count = 0

print("Scanning dataset for truncated images...")
for filename in os.listdir(dataset_dir):
    if filename.endswith(".png"):
        filepath = os.path.join(dataset_dir, filename)
        try:
            with Image.open(filepath) as img:
                # verify() is not enough; we must force PIL to read the pixel data
                img.load() 
        except Exception as e:
            print(f"Deleting truncated file: {filename} | Error: {e}")
            os.remove(filepath)
            removed_count += 1

print(f"Deep scan complete. Removed {removed_count} broken images.")
