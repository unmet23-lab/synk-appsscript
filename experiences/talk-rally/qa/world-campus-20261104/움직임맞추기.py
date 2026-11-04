"""
말 랠리 캠퍼스 판(2026-11-04) — 받은 움직임 영상(Flow Omni 720×1280 · 24fps)을 게임 영상으로 낸다. 유호님 「탁구치는 사람이 실제로 움직여서 치는 거였으면」.

사진과 맞추기: Flow는 세로 시작 그림을 가로 폭에 맞추고 위아래를 똑같이 자른다(현장노트 브라우저 「Flow는 세로 시작 그림을…」) — 영상 좌표 = 사진 좌표 × 0.46875 − (0, 5).
그래서 영상의 위쪽(네트 윗 띠까지)만 잘라 사진의 같은 자리에 겹치면 아래 탁구대는 사진 그대로이고 3D 공 · 칸이 어긋나지 않는다. 영상이 조금 흔들리면 벽 · 천장의 특징으로 장마다 되돌린다.

    python -I -X utf8 움직임맞추기.py 보기                 # 장면 모음 + 흔들림 표(공용 작업본 .tmp/.../움직임/보기_<이름>.jpg)
    python -I -X utf8 움직임맞추기.py 굽기                 # TRIM 표대로 잘라 빠르기를 맞춰 assets/world/cast/taeo/clips/<이름>.mp4
    python -I -X utf8 움직임맞추기.py 재기 hitL2 [시작초 끝초] # 라켓(빨간 덩이) 자리를 장마다 → 사진 좌표 · 3D 자리(태오가 치는 평면) — SCENE.contact 값
"""
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

여기 = Path(__file__).resolve().parent
게임 = 여기.parents[1]
공용 = Path(r"C:\Users\q1212\Documents\SYNK-appsscript") / ".tmp" / "talk-rally-world-20261104"
받기 = Path.home() / "ego" / "talk-rally-world-20261104" / "flow" / "받기"
판 = 공용 / "nb" / "out" / "rally-ready-nb_g1.png"
밖 = 공용 / "움직임"
낼 = 게임 / "assets" / "world" / "cast" / "taeo" / "clips"
밖.mkdir(parents=True, exist_ok=True)
FPS = 24
# 영상에서 쓸 자리: 네트 윗 띠(사진 y 1767 → 영상 823)에서 자른다 — 경계가 흰 띠에 숨는다
BOX_H = 820   # 영상 픽셀(720 폭 기준)
# 이름 → src(받은 파일) · segs(구간 · 빠르기, from > to면 거꾸로) · contact(라켓이 공에 닿는 원본 시각) · 공(지울 흰 공 {장: [x, y]}). 보기 · 재기로 보고 적는다.
TRIM = json.loads((여기.parent / "world-motion-table.json").read_text(encoding="utf-8")) if (여기.parent / "world-motion-table.json").exists() else {}


def 찾기(이름):
    # 움직임표의 src(다시 낸 판)가 있으면 그 파일, 없으면 그 이름 그대로의 첫 판
    p = 받기 / f"{TRIM.get(이름, {}).get('src', 이름 + '_a')}.mp4"
    if not p.exists():
        raise SystemExit(f"영상 없음: {p}")
    return p


def 장들(p):
    cap = cv2.VideoCapture(str(p))
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    return out


def 흔들림(frames, ref):
    """벽 · 천장(사람이 없는 위쪽 띠와 왼쪽)을 기준 그림과 위상 상관으로 견준다 → 장마다 (dx, dy)."""
    h, w = ref.shape[:2]
    win = cv2.createHanningWindow((w, 300), cv2.CV_32F)
    g0 = np.float32(cv2.cvtColor(ref[:300, :], cv2.COLOR_BGR2GRAY))
    res = []
    for f in frames:
        g = np.float32(cv2.cvtColor(f[:300, :], cv2.COLOR_BGR2GRAY))
        (dx, dy), _ = cv2.phaseCorrelate(g0, g, win)
        res.append((round(float(dx), 2), round(float(dy), 2)))
    return res


def 기준():
    im = cv2.imdecode(np.fromfile(판, np.uint8), cv2.IMREAD_COLOR)
    im = cv2.resize(im, (720, round(im.shape[0] * 0.46875)), interpolation=cv2.INTER_AREA)
    return im[5:5 + 1280]


def 보기(이름):
    p = 찾기(이름)
    frames = 장들(p)
    ref = 기준()
    shake = 흔들림(frames, ref)
    print(p.name, len(frames), "장", frames[0].shape, "· 위쪽 어긋남 첫 장", shake[0], "최대", max(abs(a) for a, _ in shake), max(abs(b) for _, b in shake))
    picks = list(range(0, len(frames), 4))
    w = 200
    h = round(w * BOX_H / 720)
    sheet = Image.new("RGB", (w * 8, (h + 2) * ((len(picks) + 7) // 8)), "black")
    for i, k in enumerate(picks):
        im = Image.fromarray(cv2.cvtColor(frames[k][:BOX_H], cv2.COLOR_BGR2RGB)).resize((w, h))
        ImageDraw.Draw(im).text((3, 3), f"{k / FPS:.2f}s", fill=(255, 255, 0))
        sheet.paste(im, ((i % 8) * w, (i // 8) * (h + 2)))
    sheet.save(밖 / f"보기_{이름}.jpg", quality=86)


def 공지우기(frames, k, 공):
    """모델이 지시와 달리 그린 흰 공을 지운다 — 게임의 공은 3D 하나다. 적어 둔 자리(겹쳐 찍힌 장은 둘)를, 공이 없고 둘레가 가장 닮은 가까운 장의 같은 자리로 덮고 가장자리를 섞는다."""
    f = frames[k].copy()
    h, w = f.shape[:2]
    for x, y in 공[k]:
        r = 26
        x0, y0, x1, y1 = max(0, x - r), max(0, y - r), min(w, x + r), min(h, y + r)
        hsv = cv2.cvtColor(f[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
        n, _, st, c = cv2.connectedComponentsWithStats(cv2.inRange(hsv, (0, 0, 190), (180, 75, 255)))
        cx, cy, 반 = x, y, 18
        후보 = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 12 and math.hypot(c[i][0] + x0 - x, c[i][1] + y0 - y) <= 16]
        if 후보:
            i = max(후보, key=lambda q: st[q, cv2.CC_STAT_AREA])
            cx, cy = round(c[i][0]) + x0, round(c[i][1]) + y0
            반 = min(30, round(max(st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]) / 2) + 9)
        if cy >= 735:   # 탁구대 띠는 움직이지 않고 번진 꼬리가 넓다
            반 = max(반, 26)
        안 = np.zeros((h, w), np.uint8)
        cv2.circle(안, (cx, cy), 반, 255, -1)
        둘레 = np.zeros((h, w), np.uint8)
        cv2.circle(둘레, (cx, cy), 반 + 9, 255, -1)
        둘레[안 > 0] = 0
        좋은 = None
        for d in (2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10, 12, -12):
            j = k + d
            if not 0 <= j < len(frames):
                continue
            if any(math.hypot(px - cx, py - cy) < 반 + 20 for px, py in 공.get(j, [])):
                continue
            차이 = float(cv2.absdiff(frames[j], frames[k]).mean(axis=2)[둘레 > 0].mean())
            if 좋은 is None or 차이 < 좋은[0]:
                좋은 = (차이, j)
        if 좋은 is None or 좋은[0] > 22:
            f = cv2.inpaint(f, 안, 7, cv2.INPAINT_TELEA)
            continue
        섞기 = cv2.GaussianBlur(안, (0, 0), 3).astype(np.float32)[..., None] / 255
        f = (f * (1 - 섞기) + frames[좋은[1]] * 섞기).astype(np.uint8)
    return f


def 장표(segs, 전체):
    """구간표 → 내보낼 장 번호(30fps). from > to면 거꾸로 튼다. 구간마다 끝난 시각도 돌려준다."""
    out, 끝 = [], []
    t = 0.0
    for s in segs:
        a, b, speed = s["from"], s["to"], s.get("speed", 1)
        길이 = abs(b - a) / speed
        n = round(길이 * 30)
        for i in range(n):
            src = a + (b - a) * i / n
            out.append(min(전체 - 1, max(0, round(src * FPS))))
        t += 길이
        끝.append(round(t, 3))
    return out, 끝


def 시각(segs, src):
    """원본 시각 src가 처음 나오는 내보낸 시각(마지막 구간까지 찾는다 — 닿는 때는 거꾸로 구간의 끝이어도 맞다)."""
    t = 0.0
    for s in segs:
        a, b, speed = s["from"], s["to"], s.get("speed", 1)
        lo, hi = min(a, b), max(a, b)
        if lo <= src <= hi:
            return t + abs(src - a) / speed
        t += abs(b - a) / speed
    raise SystemExit(f"구간표에 닿는 때가 없음: {src}")


def 굽기(이름):
    t = TRIM[이름]
    frames = 장들(찾기(이름))
    ref = 기준()
    segs = t.get("segs") or [{"from": t["from"], "to": t["to"], "speed": t.get("speed", 1)}]
    표, 끝 = 장표(segs, len(frames))
    공 = {int(k): v for k, v in t.get("공", {}).items()}
    흔 = dict(zip(sorted(set(표)), 흔들림([frames[k] for k in sorted(set(표))], ref)))
    tmp = 밖 / f"{이름}_장"
    tmp.mkdir(exist_ok=True)
    for old in tmp.glob("*.png"):
        old.unlink()
    for i, k in enumerate(표):
        f = 공지우기(frames, k, 공) if k in 공 else frames[k]
        dx, dy = 흔[k]
        # 장마다 위쪽 벽 · 천장이 기준 그림과 같은 자리에 오게 되돌린다(0.5px 아래면 그대로)
        if abs(dx) > 0.5 or abs(dy) > 0.5:
            f = cv2.warpAffine(f, np.float32([[1, 0, -dx], [0, 1, -dy]]), (f.shape[1], f.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        cv2.imencode(".png", f[:BOX_H])[1].tofile(tmp / f"{i:04d}.png")
    낼.mkdir(parents=True, exist_ok=True)
    out = 낼 / f"{이름}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(tmp / "%04d.png"), "-vf", "format=yuv420p",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-g", "10", "-an", "-movflags", "+faststart", str(out)], check=True)
    닿음 = 시각(segs, t["contact"])
    마지막 = cv2.absdiff(frames[표[-1]][:BOX_H], ref[:BOX_H]).mean()
    목록파일 = 여기.parent / "world-clips.json"
    목록 = json.loads(목록파일.read_text(encoding="utf-8"))
    목록["clips"][out.name] = {"bytes": out.stat().st_size, "sha256": hashlib.sha256(out.read_bytes()).hexdigest()}
    목록파일.write_text(json.dumps(목록, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{이름}: {len(표) / 30:.2f}초 · 닿는 때 {닿음:.2f}초 · {out.stat().st_size // 1024}KB · 끝 장과 ready 판 차이 {마지막:.1f} · 구간 끝 {끝}")


def 카메라():
    """world-scene.mjs의 3D 카메라 값 · 태오가 치는 평면 z를 읽는다."""
    글 = (게임 / "world-scene.mjs").read_text(encoding="utf-8")
    fov = float(re.search(r"fov: ([\d.]+)", 글).group(1))
    pos = [float(x) for x in re.search(r"position: \[([^\]]+)\]", 글).group(1).split(",")]
    q = [float(x) for x in re.search(r"quaternion: \[([^\]]+)\]", 글).group(1).split(",")]
    z = float(re.search(r"opp: \{[^}]*z: (-?[\d.]+)", 글).group(1))
    return fov, np.array(pos), q, z


def 자리(u, v, 사진=(1536, 2752)):
    """사진 좌표 → 태오가 치는 평면(z = opp.z)의 3D 자리."""
    fov, pos, (x, y, z, w), 평면 = 카메라()
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    tan = math.tan(math.radians(fov) / 2)
    ndc = np.array([(u / 사진[0]) * 2 - 1, 1 - (v / 사진[1]) * 2])
    d = R @ np.array([ndc[0] * tan * 사진[0] / 사진[1], ndc[1] * tan, -1.0])
    t = (평면 - pos[2]) / d[2]
    p = pos + d * t
    return round(float(p[0]), 3), round(float(p[1]), 3)


def 재기(이름, a=0.0, b=2.0):
    """라켓 면(채도 높은 빨강의 가장 큰 덩이)의 가운데를 장마다 찍는다. 시작 그림과 같은 자리면 움직임이 아니다."""
    frames = 장들(찾기(이름))
    for k in range(round(a * FPS), min(len(frames), round(b * FPS)), 2):
        hsv = cv2.cvtColor(frames[k][:BOX_H], cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, (0, 120, 70), (8, 255, 255)) | cv2.inRange(hsv, (172, 120, 70), (180, 255, 255))
        n, _, st, c = cv2.connectedComponentsWithStats(mask)
        if n < 2:
            print(f"{k / FPS:.2f}s 없음")
            continue
        i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        vx, vy = c[i]
        u, v = vx / 0.46875, (vy + 5) / 0.46875
        print(f"{k / FPS:.2f}s 영상 ({vx:.0f},{vy:.0f}) 넓이 {st[i, cv2.CC_STAT_AREA]} · 사진 ({u:.0f},{v:.0f}) · 3D {자리(u, v)}")


if __name__ == "__main__":
    일 = sys.argv[1] if len(sys.argv) > 1 else "보기"
    if 일 == "재기":
        재기(sys.argv[2], *[float(x) for x in sys.argv[3:5]])
        raise SystemExit
    이름들 = sys.argv[2:] or ["hitL", "hitC", "hitR", "serve"]
    for n in 이름들:
        (보기 if 일 == "보기" else 굽기)(n)
