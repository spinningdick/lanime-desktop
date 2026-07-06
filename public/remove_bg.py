"""去除视频背景，输出带透明通道的 WebM"""
import sys
from rembg import remove, new_session
from PIL import Image
import subprocess
import tempfile
import os

INPUT = sys.argv[1]
OUTPUT = sys.argv[2]

print("Loading rembg model...")
session = new_session("isnet-general-use")

# 提取帧
tmpdir = tempfile.mkdtemp()
print(f"Extracting frames to {tmpdir}...")

subprocess.run([
    "ffmpeg", "-i", INPUT,
    "-vf", "fps=30",
    f"{tmpdir}/frame_%04d.png"
], check=True, capture_output=True)

frames = sorted(os.listdir(tmpdir))
print(f"Processing {len(frames)} frames...")

for i, fname in enumerate(frames):
    fpath = os.path.join(tmpdir, fname)
    img = Image.open(fpath).convert("RGBA")
    out = remove(img, session=session)
    out.save(fpath)
    if (i + 1) % 10 == 0:
        print(f"  {i+1}/{len(frames)}")

# 合成为 WebM 透明视频
print("Encoding WebM with alpha...")
subprocess.run([
    "ffmpeg", "-framerate", "30",
    "-i", f"{tmpdir}/frame_%04d.png",
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuva420p",
    "-auto-alt-ref", "0",
    "-b:v", "2M",
    "-y",
    OUTPUT
], check=True, capture_output=True)

# 清理
import shutil
shutil.rmtree(tmpdir)
print(f"Done! Output: {OUTPUT}")
