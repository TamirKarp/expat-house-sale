#!/usr/bin/env python3
"""Light touch-up for item photos. Used by build.js.

    enhance.py INPUT FULL_OUT THUMB_OUT THUMB_SIZE

What it does: fixes rotation, stretches brightness so the picture uses the full range,
lifts dark photos a little, adds a touch of contrast and colour, and sharpens gently.
What it does not do: change colours between objects, smooth, retouch or remove anything,
so buyers see the item as it really is. It also drops camera data (model, time, location).
"""
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


def enhance(img):
    img = ImageOps.exif_transpose(img).convert("RGB")
    a = np.asarray(img, dtype=np.float32) / 255.0
    luma = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

    # Brightness stretch, the same for every colour channel so hues stay put.
    # Capped so a photo that is already fine is barely touched.
    lo, hi = np.percentile(luma, (0.5, 99.5))
    lo = min(float(lo), 0.10)
    hi = max(float(hi), 0.88)
    a = np.clip((a - lo) / (hi - lo), 0.0, 1.0)

    # Lift dark photos or tame bright ones towards a comfortable average.
    mean = float(np.clip(a.mean(), 0.05, 0.95))
    gamma = np.log(0.46) / np.log(mean)
    gamma = 1.0 + (float(np.clip(gamma, 0.75, 1.15)) - 1.0) * 0.7
    a = np.power(a, gamma)

    out = Image.fromarray((a * 255.0 + 0.5).astype(np.uint8))
    out = ImageEnhance.Contrast(out).enhance(1.04)
    out = ImageEnhance.Color(out).enhance(1.02)
    return out


def sharpen(img, amount=55):
    return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=amount, threshold=3))


def save(img, path):
    img.save(path, "JPEG", quality=85, optimize=True, progressive=True)


def main():
    src, full_out, thumb_out, thumb_size = sys.argv[1:5]
    with Image.open(src) as opened:
        opened.load()
        base = opened.copy()

    full = sharpen(enhance(base))
    save(full, full_out)

    thumb = full.copy()
    thumb.thumbnail((int(thumb_size), int(thumb_size)), Image.LANCZOS)
    save(sharpen(thumb, 30), thumb_out)


if __name__ == "__main__":
    main()
