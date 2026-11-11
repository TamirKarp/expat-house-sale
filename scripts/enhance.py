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


def luma_of(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def strong_fix(a):
    """Stronger lighting repair for awkward photos (colour cast, glare, dark patches).

    1. Colour cast: the brightest areas of most of these photos are a white wall or ceiling,
       so scale each colour so they come out neutral. Gentle limits stop it overdoing it.
    2. Uneven light: measure how bright each region is, then pull bright patches (sun, glare)
       down and lift dark ones up, keeping the fine detail on top untouched.
    """
    top = np.percentile(a.reshape(-1, 3), 98.5, axis=0)
    gains = np.clip(top.mean() / np.maximum(top, 1e-3), 0.85, 1.20)
    a = np.clip(a * gains, 0.0, 1.0)

    y = luma_of(a)
    h, w = y.shape
    radius = max(h, w) * 0.035
    blur = Image.fromarray((y * 255.0 + 0.5).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    base = np.clip(np.asarray(blur, dtype=np.float32) / 255.0, 0.03, 1.0)
    target = 0.55 + (base - 0.55) * 0.55
    gain = np.clip(target / base, 0.65, 1.6) ** 0.9
    return np.clip(a * gain[..., None], 0.0, 1.0)


def enhance(img, strong=False):
    img = ImageOps.exif_transpose(img).convert("RGB")
    a = np.asarray(img, dtype=np.float32) / 255.0
    if strong:
        a = strong_fix(a)
    luma = luma_of(a)

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
    strong = len(sys.argv) > 5 and sys.argv[5] == "strong"
    with Image.open(src) as opened:
        opened.load()
        base = opened.copy()

    full = sharpen(enhance(base, strong))
    save(full, full_out)

    thumb = full.copy()
    thumb.thumbnail((int(thumb_size), int(thumb_size)), Image.LANCZOS)
    save(sharpen(thumb, 30), thumb_out)


if __name__ == "__main__":
    main()
