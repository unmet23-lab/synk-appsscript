"""Read mascot sources; write only canonical-measurements.json beside this script.

Run from any directory: python -X utf8 <path>/measure-canon.py
Requires Pillow, numpy and scipy. No source image is changed.
"""
from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image
from scipy import ndimage


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CONNECTED_8 = np.ones((3, 3), dtype=np.uint8)


def bounds(mask):
    y, x = np.nonzero(mask)
    return [int(x.min()), int(y.min()), int(x.max()), int(y.max())]


def largest_component(mask):
    labels, _ = ndimage.label(mask, structure=CONNECTED_8)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    return labels == counts.argmax()


def box_record(box, canvas):
    x0, y0, x1, y1 = box
    width, height = x1 - x0 + 1, y1 - y0 + 1
    cw, ch = canvas
    return {
        "xywh": [x0, y0, width, height],
        "widthOverHeight": round(width / height, 6),
        "normalized": {
            "h": round(height / ch, 9), "w": round(width / cw, 9),
            "b": round((ch - y1 - 1) / ch, 9), "l": round(x0 / cw, 9),
        },
    }


def eye_features(a, body, char, body_box):
    r, g, b = (a[..., i].astype(np.int16) for i in range(3))
    if char == "마린":
        key = (r > 150) & (g > 120) & (r - b > 70)
    else:
        lum = .2126 * r + .7152 * g + .0722 * b
        key = (g > r) & (g > b) & (lum > 30)
    key &= body
    x0, y0, x1, y1 = body_box
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    key[y0 + int(bh * .7):] = False
    labels, _ = ndimage.label(key, structure=CONNECTED_8)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    selected = np.argsort(counts)[-2:]
    components = []
    for label in selected:
        mask = labels == label
        box = bounds(mask)
        yy, xx = np.nonzero(mask)
        components.append({
            "xywh": [box[0], box[1], box[2] - box[0] + 1, box[3] - box[1] + 1],
            "centroid": [round(float(xx.mean()), 3), round(float(yy.mean()), 3)],
            "pixels": int(counts[label]),
        })
    left, right = sorted(components, key=lambda c: c["centroid"][0])
    ew = (left["xywh"][2] + right["xywh"][2]) / 2
    eh = (left["xywh"][3] + right["xywh"][3]) / 2
    span = right["centroid"][0] - left["centroid"][0]
    result = {
        "feature": "yellow felt lenses" if char == "마린" else "green iris rings",
        "left": left, "right": right,
        "meanWidthOverBodyWidth": round(ew / bw, 6),
        "meanHeightOverWidth": round(eh / ew, 6),
        "centroidSpacingOverEyeWidth": round(span / ew, 6),
        "centroidYFromBodyTop": round(((left["centroid"][1] + right["centroid"][1]) / 2 - y0) / bh, 6),
    }
    if char == "마린":
        navy = body & (b - r > 25) & (b > 45) & (b < 190)
        nb = bounds(navy)
        result["helmet"] = {
            "xywh": [nb[0], nb[1], nb[2] - nb[0] + 1, nb[3] - nb[1] + 1],
            "heightOverBodyHeight": round((nb[3] - nb[1] + 1) / bh, 6),
            "bottomFromBodyTop": round((nb[3] - y0) / bh, 6),
        }
    return result


def measure(path, char):
    a = np.asarray(Image.open(path).convert("RGBA"))
    alpha = a[..., 3] > 128
    body = largest_component(alpha)
    bb = bounds(body)
    canvas = [a.shape[1], a.shape[0]]
    below = alpha.copy()
    below[:bb[3] + 1] = False
    result = {
        "path": path.relative_to(ROOT).as_posix(),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "canvas": canvas,
        "allAlpha128": box_record(bounds(alpha), canvas),
        "body": box_record(bb, canvas),
        "excludedAlpha128Pixels": int((alpha & ~body).sum()),
        "alpha128PixelsBelowBody": int(below.sum()),
        "eyes": eye_features(a, body, char, bb),
    }
    return result, a, body


def main():
    records, comparisons = [], []
    for char, ident in [("마린", "marin"), ("까몽", "kkamong")]:
        for cut, angle in [("본체", "front"), ("좌34", "angle")]:
            pair = []
            for folder, ext in [("정본_4K", "png"), ("화면_1024", "webp")]:
                path = ROOT / "docs" / "캐릭터" / folder / f"{char}_{cut}.{ext}"
                record, rgba, body = measure(path, char)
                records.append(record)
                pair.append((path, rgba, body))
            high, low = pair
            reduced = np.asarray(Image.fromarray(high[1]).resize((1024, 1024), Image.Resampling.LANCZOS))
            reduced_body = largest_component(reduced[..., 3] > 128)
            common = reduced_body & low[2]
            union = reduced_body | low[2]
            qa_copy = HERE / f"{ident}-{angle}.webp"
            comparisons.append({
                "character": ident, "view": angle,
                "sourceBodyMaskIoUAfterLanczos1024": round(float(common.sum() / union.sum()), 6),
                "rgbMeanAbsoluteDifferenceOnCommonBody": round(float(np.abs(reduced[..., :3].astype(float) - low[1][..., :3])[common].mean()), 6),
                "qaCopyByteIdenticalTo1024": qa_copy.exists() and qa_copy.read_bytes() == low[0].read_bytes(),
            })
    report = {
        "schemaVersion": 1,
        "date": "2026-10-12",
        "reproduce": "python -X utf8 experiences/brand-opening/qa/companion-canon-20261012/measure-canon.py",
        "method": {
            "body": "alpha > 128, largest 8-connected component; inclusive pixel bounds",
            "eyes": "original color thresholds, largest two 8-connected color blobs above 70% body height, full resolution",
            "helmet": "body-connected pixels where B-R > 25 and 45 < B < 190",
            "comparison": "4K RGBA resized with Pillow Lanczos to 1024, compared with existing lossy WebP; high overlap does not prove byte identity",
        },
        "limits": [
            "These are measurements of specific rendered reference images, not a complete 3D specification.",
            "Largest component is appropriate for these contiguous bodies; detached props must be inspected separately.",
            "Eye thresholds match the older tool but full-resolution 8-connectivity replaces its stride-4 / 4-connectivity; small width differences are measurement differences.",
            "For eyes and anatomy, approved reference images and later scoped character corrections take precedence over older ratio tables.",
        ],
        "records": records,
        "derivativeComparisons": comparisons,
    }
    output = HERE / "canonical-measurements.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output.relative_to(ROOT).as_posix()} ({len(records)} images)")
    for record in records:
        print(record["path"], record["body"]["xywh"], record["body"]["normalized"])


if __name__ == "__main__":
    main()
