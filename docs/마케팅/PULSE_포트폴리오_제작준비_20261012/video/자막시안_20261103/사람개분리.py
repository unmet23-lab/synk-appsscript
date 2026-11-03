# 자막 시안 — 큰 글자를 피사체 뒤로 보낼 컷만 SAM 3로 개 · 사람을 따서 Remotion이 읽을 프레임 · 마스크를 만든다(만족 사례 S42와 같은 길).
#   sam venv:  C:/SYNK-LoRA/tools/sam/venv/Scripts/python.exe -X utf8 사람개분리.py [p11|p12]
#   [컷…] [--cpu]  컷을 주면 그 컷만, --cpu는 GPU 없이(줄 밖 작업이 GPU를 쥐었을 때)
#   GPU는 줄을 선다:  python synk-vendor/_공용차례/차례.py gpu 돌리기 <이름> <할 일> --상한 30 -- <위 명령>
#   출력(git 밖 public): <편>/cut/<컷>/f/00001.jpg(화면 그대로) · m/00001.png(흰 RGBA, 알파 = 피사체) · report.json
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter
from scipy import ndimage
from transformers import Sam3VideoModel, Sam3VideoProcessor

PUB = Path("C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public")
W = Path("C:/SYNK-LoRA/tools/sam/sam3")
FPS = 24
# 편 → (컷 이름, 시작 초, 끝 초, 글 지시들) — 시각은 그 편 화면.mp4 기준
JOBS = {
    "p11": [("c01", 0.00, 2.17, ["dog"]), ("c04", 6.50, 11.23, ["person", "dog"]), ("c09", 16.27, 19.33, ["dog"]), ("c10", 19.33, 22.06, ["person", "dog"])],
    "p12": [("c01", 0.00, 1.87, ["person"]), ("c09", 22.87, 27.07, ["person"]), ("c13", 29.17, 29.87, ["person"]), ("c16", 31.27, 35.14, ["person"])],
}
SMALL = (540, 960)   # 분리는 반 크기로, 마스크는 다시 키운다


def frames(src, a, b, tmp):
    n = round((b - a) * FPS)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.4f}", "-i", str(src), "-frames:v", str(n), "-vf", f"fps={FPS}", "-q:v", "2", str(Path(tmp) / "%05d.jpg")], check=True)
    return sorted(Path(tmp).glob("*.jpg"))


def main():
    film = sys.argv[1] if len(sys.argv) > 1 else "p11"
    only = [a for a in sys.argv[2:] if not a.startswith("--")]
    cpu = "--cpu" in sys.argv   # GPU를 줄 밖 작업(학습 등)이 쥐고 있을 때 — 느리지만 GPU를 건드리지 않는다
    dev, dt = ("cpu", torch.float32) if cpu else ("cuda", torch.bfloat16)
    src = PUB / film / "picture.mp4"
    t0 = time.monotonic()
    model = Sam3VideoModel.from_pretrained(str(W)).to(dev, dtype=dt)
    proc = Sam3VideoProcessor.from_pretrained(str(W))
    for cut, a, b, prompts in JOBS[film]:
        if only and cut not in only:
            continue
        out = PUB / film / "cut" / cut
        (out / "f").mkdir(parents=True, exist_ok=True)
        (out / "m").mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            files = frames(src, a, b, tmp)
            big = [Image.open(p).convert("RGB") for p in files]
            for i, im in enumerate(big):
                im.save(out / "f" / f"{i + 1:05}.jpg", quality=92)
            small = [np.array(im.resize(SMALL, Image.LANCZOS)) for im in big]
            union = [np.zeros((SMALL[1], SMALL[0]), bool) for _ in small]
            for word in prompts:
                sess = proc.init_video_session(video=small, inference_device=dev, processing_device="cpu", video_storage_device="cpu", dtype=dt)
                proc.add_text_prompt(sess, word)
                for k, o in enumerate(model.propagate_in_video_iterator(inference_session=sess)):
                    r = proc.postprocess_outputs(sess, o)
                    i = o.frame_idx if getattr(o, "frame_idx", None) is not None else k
                    ms = r["masks"]
                    if ms.shape[0]:
                        union[i] |= ms.any(dim=0).cpu().numpy().astype(bool)
                del sess
                if not cpu:
                    torch.cuda.empty_cache()
            stats, prev = [], None
            for i, mk in enumerate(union):
                mk = ndimage.binary_fill_holes(mk)
                iou = float(np.logical_and(mk, prev).sum() / max(1, np.logical_or(mk, prev).sum())) if prev is not None else 1.0
                prev = mk
                alpha = Image.fromarray((mk * 255).astype("uint8")).resize(big[0].size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
                rgba = Image.new("RGBA", alpha.size, "white")
                rgba.putalpha(alpha)
                rgba.save(out / "m" / f"{i + 1:05}.png")
                stats.append({"frame": i + 1, "area": round(float(mk.mean()), 4), "iou": round(iou, 4)})
        rep = {"cut": cut, "from": a, "to": b, "prompts": prompts, "frames": len(stats), "minIou": min(s["iou"] for s in stats), "minArea": min(s["area"] for s in stats), "maxArea": max(s["area"] for s in stats), "stats": stats}
        (out / "report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
        print("MASKED", film, cut, len(stats), "minIoU", rep["minIou"], "area", rep["minArea"], rep["maxArea"], round(time.monotonic() - t0), "s", flush=True)
    print("ALL_DONE", flush=True)


if __name__ == "__main__":
    main()
