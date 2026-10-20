# 지유 세트 2 · 컷 4: H3가 지어낸 오른쪽 올리브 가지 · 꽃병 지우기(10-20).
# 시작 그림(키프레임)엔 없는데 시드 42 · 7 모두 0.75~2.25초에 화면 오른쪽 가장자리(수건 바 앞)에 가지와 흰 꽃병이 자라났다
# (「Nothing new appears」 지시문도 못 막음, Fable 1차 P2 「얼굴 옆 전경에서 시선을 나눈다」).
# 카메라가 고정(밀림 0.5px 이하)이라 가지가 생기기 전 H3 프레임(0번)의 벽 · 수건 · 바를 그 자리에만 덮는다.
#   ① 자리: H3 768 공간에서 고른 구간 프레임들과 0번 프레임의 차가 큰 곳(사람이 없는 x ≥ X_MIN만) → 넓히고 부드럽게
#   ② 덮을 판: 0번 프레임을 영상_다듬기.py와 같이 가운데 756으로 잘라 1080×1920으로 키움
#   ③ 프레임마다 덮는 자리 둘레 띠의 평균 색에 판을 맞춰(밝기 흔들림) 섞는다
#   python 컷4_가지지우기.py [--확인만]   → 업/컷4_세트2/컷4_세트2/ 를 고친 프레임으로 바꾸고 원본은 업/컷4_세트2/원본_가지있음/ 에 둔다
#   --확인만: 바꾸지 않고 처음 · 가운데 · 끝 프레임의 전후와 덮는 자리만 그림으로(…/컷4_가지지우기_확인.jpg)
import glob
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018")
H3 = os.path.join(V, "영상_H3")
SRC = os.path.join(H3, "컷4_세트2_s42.mp4")
START = 48           # 영상_다듬기.py WINDOWS["4s2"]의 시작 프레임
N = 48
UPD = os.path.join(H3, "업", "컷4_세트2", "컷4_세트2")
KEEP = os.path.join(H3, "업", "컷4_세트2", "원본_가지있음")
W0, H0, CROP_X = 768, 1344, 6   # H3 크기, 영상_다듬기.py의 가운데 756 자르기
W, H = 1080, 1920
X_MIN = 545          # 이보다 왼쪽은 사람(머리카락 · 티셔츠 끝 x≈530)이라 건드리지 않는다
Y_MAX = 985          # 꽃병 밑(768 공간 y≈966)까지만 — 그 아래 수전 · 세면대 대리석은 H3가 무늬를 조금씩 바꿔 차가 커도 덮지 않는다
THRESH, GROW, SOFT = 10.0, 14, 9


def h3_frames(idx):
    p = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", "-i", SRC, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE, stdin=subprocess.DEVNULL)
    out, i = {}, 0
    while True:
        buf = p.stdout.read(W0 * H0 * 3)
        if len(buf) < W0 * H0 * 3:
            break
        if i in idx:
            out[i] = np.frombuffer(buf, np.uint8).reshape(H0, W0, 3).astype(np.float32)
        i += 1
    p.wait()
    return out


def to_up(a):
    """H3 768×1344 → 영상_다듬기.py처럼 가운데 756 → 1080×1920."""
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8)) if isinstance(a, np.ndarray) else a
    return im.crop((CROP_X, 0, CROP_X + 756, H0)).resize((W, H), Image.LANCZOS)


def build():
    idx = [0] + list(range(START, START + N, 4)) + [START + N - 1]
    fr = h3_frames(set(idx))
    base = fr[0]
    diff = np.zeros((H0, W0), np.float32)
    for i in idx[1:]:
        diff = np.maximum(diff, np.abs(fr[i] - base).mean(axis=2))
    m = (diff > THRESH).astype(np.uint8) * 255
    m[:, :X_MIN] = 0
    m[Y_MAX:, :] = 0
    mi = Image.fromarray(m).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))  # 잔점 없애기
    mi = mi.filter(ImageFilter.MaxFilter(2 * GROW + 1)).filter(ImageFilter.GaussianBlur(SOFT))
    mask768 = np.asarray(mi, np.float32) / 255
    mask768[:, :X_MIN - 10] = 0
    mask768[Y_MAX + 20:, :] = 0
    mask = np.asarray(to_up(Image.fromarray((mask768 * 255).astype(np.uint8)).convert("RGB")).convert("L"), np.float32) / 255
    plate = np.asarray(to_up(base), np.float32)
    ring = (mask > 0.02) & (mask < 0.25)  # 덮는 자리 바로 바깥 띠(색 맞춤용)
    hard = mask > 0.5
    print(f"덮는 자리: 1080 공간 {int(hard.sum())}화소 · x {np.where(hard.any(0))[0][[0, -1]]} · y {np.where(hard.any(1))[0][[0, -1]]}")
    return mask, plate, ring


def patch(up, mask, plate, ring):
    a = np.asarray(up, np.float32)
    gain = (a[ring].mean(0) + 1) / (plate[ring].mean(0) + 1)
    out = a * (1 - mask[..., None]) + (plate * gain) * mask[..., None]
    return Image.fromarray(out.clip(0, 255).round().astype(np.uint8)), gain


def main():
    only_check = "--확인만" in sys.argv
    files = sorted(glob.glob(os.path.join(UPD, "컷4_세트2_*.png")))
    if os.path.isdir(KEEP) and len(glob.glob(os.path.join(KEEP, "*.png"))) == N:
        files = sorted(glob.glob(os.path.join(KEEP, "컷4_세트2_*.png")))  # 다시 돌릴 땐 원본에서
    assert len(files) == N, f"업스케일 프레임 {len(files)}장(48장이어야 함)"
    mask, plate, ring = build()
    if only_check:
        tiles = []
        for k in (0, N // 2, N - 1):
            up = Image.open(files[k]).convert("RGB")
            fixed, gain = patch(up, mask, plate, ring)
            print(f"  #{k} 색 맞춤 {np.round(gain, 3)}")
            for im in (up, fixed):
                tiles.append(im.resize((360, 640), Image.LANCZOS))
        mview = Image.fromarray((mask * 255).astype(np.uint8)).convert("RGB").resize((360, 640))
        S = Image.new("RGB", (7 * 364, 640), (24, 24, 24))
        for i, t in enumerate(tiles + [mview]):
            S.paste(t, (i * 364, 0))
        d = ImageDraw.Draw(S)
        for i, t in enumerate(["#0 전", "#0 후", "#24 전", "#24 후", "#47 전", "#47 후", "덮는 자리"]):
            d.text((i * 364 + 6, 6), t, fill=(255, 255, 0))
        out = os.path.join(H3, "컷4_가지지우기_확인.jpg")
        S.save(out, quality=90)
        print(out)
        return
    if not (os.path.isdir(KEEP) and len(glob.glob(os.path.join(KEEP, "*.png"))) == N):
        os.makedirs(KEEP, exist_ok=True)
        for f in files:
            shutil.copy2(f, os.path.join(KEEP, os.path.basename(f)))
        files = sorted(glob.glob(os.path.join(KEEP, "컷4_세트2_*.png")))
    gains = []
    for f in files:
        fixed, gain = patch(Image.open(f).convert("RGB"), mask, plate, ring)
        fixed.save(os.path.join(UPD, os.path.basename(f)))
        gains.append(gain)
    g = np.array(gains)
    print(f"{len(files)}장 고침 → {UPD} (원본 {KEEP}) · 색 맞춤 범위 {np.round(g.min(0), 3)} ~ {np.round(g.max(0), 3)}")


if __name__ == "__main__":
    main()
