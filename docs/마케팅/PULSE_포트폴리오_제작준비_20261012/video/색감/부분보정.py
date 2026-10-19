# PULSE 공용 색감의 부분 보정(10-19): SAM 마스크 안만 따로 손본다.
#   사람 손 없이 Claude가 끝까지 하는 후반(유호님 10-19 「나나 사람은 손이 거의 안들어갈거야. 전부 클로드로 할거라서」)에서
#   다빈치의 손작업(영역 그리기 · 따라가기)을 대신한다. 색감.py 본체는 그대로 두고 옆에서 부른다.
#   마스크는 GPU 쪽 C:/SYNK-LoRA/tools/sam/마스크_만들기.py가 프레임마다 PNG(대상일 확률 0~255)로 만든다.
#
#   편집 스크립트에서:
#     import 부분보정
#     m = 부분보정.마스크(마스크_폴더, i)                 # 0~1, 경계 흐림 + 움직임을 맞춘 이웃 프레임 1:2:1 평균
#     im = 부분보정.색감_잔잠금(im, "맑은아침", m_잔)      # 바깥은 색감 전체, 마스크 안(제품)은 색조만(색감.grade product=True)
#     im = 부분보정.밝히기(im, m_얼굴, ev=0.25)           # 마스크 안만 노출(선형 빛)
#     폴더 = 부분보정.마스크_준비(원본.mp4 | 프레임 폴더, 시작초, 장수, "잔" | "피부" | "피부손" | "병", 보관_폴더)   # 없으면 사람 손 없이 만든다(아래)
#   시험: python 부분보정.py 시험 <프레임 폴더> <출력 폴더> --색감 맑은아침 [--잔 <마스크 폴더>] [--얼굴 <마스크 폴더> --ev 0.25]
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import 색감  # noqa: E402

FEATHER = 18  # 경계 흐림(px, 1080 폭 기준). 18이면 턱선 · 앞머리에 빛무리가 없었다(10-19 하린 5b)
SAM_PY = r"C:\SYNK-LoRA\tools\sam\venv\Scripts\python.exe"
SAM_TOOL = r"C:\SYNK-LoRA\tools\sam\마스크_만들기.py"


def _지문(src):
    """원본이 바뀌었는지 볼 지문(마스크_만들기.py가 잰값.json에 적는 「원본_지문」과 같은 꼴, 10-19):
    영상은 [크기, 시각], 프레임 폴더는 [PNG 크기 합, 가장 늦은 PNG 시각, PNG 장수]."""
    src = Path(src)
    if src.is_file():
        return [src.stat().st_size, int(src.stat().st_mtime)]
    pngs = sorted(src.glob("*.png"))
    return [sum(p.stat().st_size for p in pngs), max((int(p.stat().st_mtime) for p in pngs), default=0), len(pngs)]


def 마스크_준비(src, start, frames, target, keep):
    """대상(「잔」 · 「피부」 · 「피부손」 · 「병」) 마스크 폴더를 돌려준다. 같은 주문(원본 · 시작 · 장수 · 대상)으로 만든 것이 있으면
    그대로 쓰고, 없거나 원본(영상 파일 또는 프레임 폴더)이 그 뒤 바뀌었으면 사람 손 없이 새로 만든다:
    SAM 3가 첫 프레임에서 대상과 빼야 할 것(손 · 머리카락 · 옷)을 글로 찾고, 자동으로 고른 점으로 SAM 2.1이 컷 끝까지 따라간다.
    보관 폴더에 다른 주문의 마스크나 기록(잰값.json) 없는 마스크가 있으면 덮지 않고 멈춘다(다른 컷 마스크를 잘못 입히지 않게).
    편집 스크립트와 같은 틀(1080x1920 · 24fps, 원본 start초부터 frames장)로 뽑으므로 프레임 i ↔ 마스크 i가 맞는다.
    프레임 폴더(업스케일 PNG)를 주면 시작 · 장수는 기록만 하고 폴더의 PNG를 모두 쓴다 — 컷이 처음부터 끝까지 든 폴더만 넣는다.
    10-19 하린 다섯 컷에서 손으로 점을 찍은 마스크와 겹침 0.979~0.997, 지유 다섯 컷(업스케일 폴더) 이웃 겹침 0.992~0.997."""
    keep, src = Path(keep), Path(src)
    folder, rec = keep / "마스크", keep / "잰값.json"
    pngs = list(folder.glob("*.png"))
    if rec.exists():
        s = json.loads(rec.read_text(encoding="utf-8"))
        if not (Path(s.get("원본", "")).resolve() == src.resolve() and s.get("시작") == float(start)
                and s.get("장수") == frames and s.get("자동", {}).get("설정", {}).get("이름") == target):
            raise RuntimeError(f"{keep}에 다른 원본 · 구간 · 대상의 마스크가 있음 — 다른 보관 폴더를 주거나 비우고 다시")
        if "원본_지문" in s:  # 10-19부터: 영상 · 프레임 폴더 모두 지문으로 견준다
            same_src = s["원본_지문"] == _지문(src)
        elif src.is_file():  # 지문 없는 예전 기록(영상)은 크기 · 시각으로
            same_src = (s.get("원본_크기"), s.get("원본_시각")) == (src.stat().st_size, int(src.stat().st_mtime))
        else:  # 지문 없는 예전 기록(폴더)은 바뀌었는지 알 수 없어 한 번 다시 만든다(컷당 30~60초)
            same_src = False
        if same_src and len(pngs) == s.get("프레임"):
            return folder
    elif pngs:
        raise RuntimeError(f"{keep}에 기록(잰값.json) 없는 마스크가 있음 — 다른 보관 폴더를 주거나 비우고 다시")
    for f in pngs:  # 같은 주문의 낡은 마스크(원본을 다시 뽑았거나 쓰다 끊김)는 지우고 새로
        f.unlink()
    subprocess.run([SAM_PY, "-X", "utf8", SAM_TOOL, str(src), str(keep), "--자동", target,
                    "--시작", str(start), "--장수", str(frames)], check=True)
    _raw.cache_clear()  # 같은 경로의 예전 마스크를 읽어 둔 것이 있으면 버린다(한 프로세스에서 다시 만들었을 때)
    return folder


@lru_cache(maxsize=64)
def _raw(path):
    return np.asarray(Image.open(path).convert("L"), np.float32) / 255.0


def _centroid(a):
    w = a > 0.5
    if not w.any():
        return None
    ys, xs = np.nonzero(w)
    return xs.mean(), ys.mean()


def _aligned(nb, cur):
    """이웃 프레임 마스크를 무게중심이 현재와 맞게 옮긴다(빨리 움직이는 잔에서 평균이 잔상을 만들지 않게)."""
    a, b = _centroid(nb), _centroid(cur)
    if a is None or b is None:
        return cur
    dx, dy = int(round(b[0] - a[0])), int(round(b[1] - a[1]))
    return np.roll(np.roll(nb, dy, axis=0), dx, axis=1)


def 마스크(folder, i, feather=FEATHER):
    """i번째(0부터) 프레임의 부드러운 마스크 0~1. 이웃 프레임은 움직임을 맞춰 1:2:1로 평균해 경계 깜빡임을 막는다."""
    files = sorted(Path(folder).glob("*.png"))
    cur = _raw(str(files[i]))
    prev = _aligned(_raw(str(files[max(0, i - 1)])), cur)
    nxt = _aligned(_raw(str(files[min(len(files) - 1, i + 1)])), cur)
    m = (prev + 2 * cur + nxt) / 4.0
    if feather:
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather)), np.float32) / 255.0
    return m


def _lin(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def _srgb(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - 0.055)


def _soft_clip(x, knee=0.85):
    y = x.copy()
    o = x > knee
    y[o] = knee + (1 - knee) * np.tanh((x[o] - knee) / (1 - knee))
    return y


def _blend(a, b, m):
    a = np.asarray(a, np.float32)
    b = np.asarray(b, np.float32)
    return Image.fromarray(np.clip(a * (1 - m[..., None]) + b * m[..., None] + 0.5, 0, 255).astype(np.uint8))


def 밝히기(img, m, ev=0.25):
    """마스크 안만 노출을 ev스톱 올린다(선형 빛). 밝은 곳은 부드럽게 눌러 날아가지 않게."""
    x = np.asarray(img, np.float32) / 255.0
    lifted = _soft_clip(_srgb(_lin(x) * 2.0 ** ev)) * 255.0
    return _blend(img, lifted, m)


def 색감_잔잠금(img, look, m):
    """바깥은 색감 전체, 마스크 안(제품 · 음료)은 색조만 — 한 화면에 사람과 제품이 같이 있을 때의 「제품 색 잠금」."""
    return _blend(색감.grade(img, look), 색감.grade(img, look, product=True), m)


def _시험(frames, out, look, cup, face, ev):
    out = Path(out)
    for d in ("색감만", "부분보정"):
        (out / d).mkdir(parents=True, exist_ok=True)
    files = sorted(Path(frames).glob("*.png"))
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB")
        색감.grade(im, look).save(out / "색감만" / f.name)
        res = 색감_잔잠금(im, look, 마스크(cup, i)) if cup else 색감.grade(im, look)
        if face:
            res = 밝히기(res, 마스크(face, i), ev)
        res.save(out / "부분보정" / f.name)
    print(out)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d  # noqa: E731
    if a and a[0] == "시험":
        _시험(a[1], a[2], opt("--색감", "맑은아침"), opt("--잔"), opt("--얼굴"), float(opt("--ev", 0.25)))
