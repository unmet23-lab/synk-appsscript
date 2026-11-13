# 최종본 검사 — 다 만든 영상 한 편에서 컷 전수 검수가 되풀이해 잡던 것을 기계로 잰다(2026-11-13, 유호님 「실수한것들이나 검수에서 지적받은부분들 다음에 참고해서
# 더 효율적으로 제작할수있게 어느정도 반영되고있어 ?」 → 「응, 고쳐」).
#
# 왜 있나: 「사람이 굳음」(점검표 26) · 「같은 판을 배율만 바꿔 이어 붙임 · 같은 장면 두 번」(50) · 「끝 3초가 약함」(2) · 「낮은 화소를 크게」(48)가 B38 v10 →
#   B39 v10 → B39 v16 → 메일비서 v12까지 편마다 마지막 컷 전수 검수에서야 잡혔다. 그 검사들(사람움직임.py · 컷연속성검사의 「같은판」)은 받은 판이나 컷표(틀 2)를
#   보는데, SNS 두 브랜드 편은 옛 컷표이거나 컷표가 없고 편집에서 판을 잘라 키운 것은 컷표에 안 나온다. 그래서 최종 영상 하나만 보고 잰다 —
#   올리기 전 검사 ⑳이 부르고(재연 · 진행자 편), 혼자 불러도 된다.
#
#   python -I -X utf8 tools/최종본검사.py <최종.mp4> [--json] [--항목 굳음,같은판,되풀이,끝,화소]
#
# 잰 것(결과 「걸림」의 항목 이름 — 올리기 전 검사가 이 이름으로 등급을 매긴다):
#   굳음      컷마다 사람움직임.py(카메라를 걷어 낸 사람 자리 움직임, 480×270 장당 px)의 「사람」 값 — 0.12 아래(점검표 26 문턱)이고 사람 자리를
#             얼굴 · 실루엣으로 잡은 컷. 0.8초 아래 컷은 재지 않는다. 얼굴 극접사(「가까움」)는 값이 미덥지 않아 알림으로만
#   구간굳음  3초 넘는 컷 안에서 1.5초 창(0.5초씩)이 잇달아 0.12 아래인 자리 — 컷 전체 값은 넘어도 뒤 절반이 멎은 꼴(B39 v10 54.4~57.0)
#   같은판    이웃한 두 컷의 경계 장이 한 그림의 배율 · 자리만 바꾼 것(닮음 변환이 화면 넓게 맞음 · 배율 6% 넘게 다르거나 25px 넘게 옮김) — 같은 판을 잘라 붙임
#   같은구도  이웃한 두 컷이 배율 · 자리까지 같은 그림(점프 컷)
#   되풀이    이웃하지 않은 두 컷의 가운데 장이 같은 그림(배율이 달라도) — 「똑같은 장면이 반복」(11-12 서울로) · 같은 판 두 번(B39 21.4초 = 54.4초)
#   끝소리    끝에서 2초 넘게 0.25초 칸마다 몸통 소리 가운데보다 10dB 넘게 작다 — 끝에 소리 한 방 없이 방 소리만 남는다(점검표 2 · B39 v10 −43dB)
#   끝화소    끝 3초에 걸린 컷의 가는 결 비(가는 결 / 중간 결 에너지)가 0.125 아래 — 720p 판을 화면에서 또 잘라 키운 흐린 끝(점검표 48 · 2,
#             B39 v10 57~58.5초 0.107). 끝 밖의 컷은 값만 「알림」에 적는다(어두운 판 · 얕은 심도와 아직 가르지 못한다)
# 글자 판 · 표시가 컷을 넘어 그대로 남는 자리는 맞춤에서 뺀다 — 맞은 점이 화면 위아래로 네 줄(80px 칸) 넘게 퍼져야 그림으로 본다(자막 두 줄은 한두 줄).
#
# 끝 코드: 0 걸림 없음 / 1 걸림 있음 / 2 잴 수 없음(파일 · ffmpeg). 판정(고칠 것 · 확인할 것)은 올리기 전 검사가 한다 — 이 도구는 잰 값과 자리만 낸다.
# 맞춘 자료(11-13): B39 「없는 판결」 v10(컷 전수 검수 표 — 같은판 4.4→5.5→7.4 · 9.7→11.0 · 54.4→57.0→58.5, 되풀이 21.4=54.4,
#   굳음 4.4~5.5 · 21.4~23.4 · 54.4~57.0, 끝 3초 방 소리 −44dB, 끝 근접 2.55배). 시험: node --test tests/최종본검사.test.js
import argparse
import importlib.util
import json
import math
import os
import subprocess
import sys

import cv2

cv2.setNumThreads(4)   # 올리기 전 검사가 여러 편을 함께 돌려도 PC를 다 잡지 않게
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION_PY = os.environ.get("SYNK_MOTION_PY") or os.path.join(HERE, "..", "docs", "마케팅", "PULSE_포트폴리오_제작준비_20261012", "시댄스무제한", "사람움직임.py")
FPS = 24.0             # 모든 장을 24fps로 풀어 잰다 — 사람움직임 0.12 문턱을 맞춘 판이 24fps이고(30fps 편은 같은 움직임이 0.8배로 나온다),
                       # 가변 프레임 편도 장 번호 = 초 × 24가 된다(11-13 Fable 검수 3 · 4)
CHUNK = 240            # 사람 움직임은 컷을 10초(240장)씩 끊어 잰다 — 한 판 긴 편도 메모리가 컷 길이에 비례해 불지 않게(Fable 검수 8)
FROZEN = 0.12          # 사람움직임.py와 같은 문턱(점검표 26)
MIN_CUT = 0.8          # 이보다 짧은 컷은 굳음을 재지 않는다
WIN, WIN_STEP, WIN_LONG = 1.5, 0.5, 3.0
SCALE_STEP = 0.06      # 같은판: 배율이 이만큼 넘게 다르면 「배율 바꿈」
SHIFT_PX = 25          # 같은판: 긴 변 640 기준 이만큼 넘게 옮기면 「자리 옮김」
MIN_INLIERS = 25
CUT_AREA = 0.3         # 컷으로 볼 바뀐 화면 몫(회색 25 넘게 바뀐 화소)
MIN_ROWS = 4           # 맞은 점이 80px 칸 줄 몇 줄에 퍼져야 그림으로 보나(글자 판은 한두 줄)
REPEAT_INLIERS = 40
END_SEC = 3.0
END_QUIET_DB = 10.0
END_QUIET_SEC = 2.0     # 끝에서 이만큼 넘게 조용하면 「끝 소리 한 방 없음」
DETAIL_FLAG = 0.125    # 이 아래면 잘라 키운 판으로 본다(끝 3초만 걸림 — 그 밖은 알림)
DETAIL_MIN = 5.0


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-show_entries", "format=duration", "-of", "json", path], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or "ffprobe 실패")
    j = json.loads(r.stdout)
    s = j["streams"][0]
    n, d = (int(x) for x in s["r_frame_rate"].split("/"))
    return int(s["width"]), int(s["height"]), n / d, float(j["format"]["duration"])


def fit_size(w, h, long_side):
    k = long_side / max(w, h)
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


def decode(path, size, gray=True):
    w, h = size
    pix = "gray" if gray else "bgr24"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},scale={w}:{h}",
                          "-f", "rawvideo", "-pix_fmt", pix, "-"], capture_output=True).stdout
    c = 1 if gray else 3
    n = len(raw) // (w * h * c)
    a = np.frombuffer(raw[: n * w * h * c], np.uint8)
    return a.reshape(n, h, w) if gray else a.reshape(n, h, w, 3)


def pick(path, size, idxs):
    """필요한 장만 골라 푼다 — {장 번호: 회색 그림}"""
    idxs = sorted(set(int(i) for i in idxs))
    if not idxs:
        return {}
    w, h = size
    sel = "+".join(f"eq(n\\,{i})" for i in idxs)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},select='{sel}',scale={w}:{h}", "-fps_mode", "passthrough",
                          "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
    n = len(raw) // (w * h)
    arr = np.frombuffer(raw[: n * w * h], np.uint8).reshape(n, h, w)
    return dict(zip(idxs, arr))


# ── 컷 ──
def find_cuts(small, fps):
    """이웃 장 차이가 앞뒤 반 초의 가운데 값보다 크게 튀고 화면의 CUT_AREA 넘게 바뀐 장 — 새 컷의 첫 장 번호. 3장 안에 붙은 둘은 큰 쪽 하나"""
    f = small.astype(np.float32)
    dd = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    half = max(6, int(round(fps / 2)))
    hits = []
    for i in range(len(dd)):
        nb = np.concatenate([dd[max(0, i - half):i], dd[i + 1:i + 1 + half]])
        med = float(np.median(nb)) if len(nb) else 0.0
        if dd[i] > 6 and dd[i] > 4 * max(med, 0.8):
            area = float((np.abs(f[i + 1] - f[i]) > 25).mean())
            if area >= CUT_AREA:                # 화면 캡처의 글자 · 스크롤처럼 한 자리만 바뀐 것은 컷이 아니다(y한도 0.05~0.28 · 실제 컷 0.32~0.84)
                hits.append((i + 1, float(dd[i])))
    cuts = []
    for k, v in hits:
        if k < 2 or k > len(f) - 2:
            continue
        if cuts and k - cuts[-1][0] <= 3:
            if v > cuts[-1][1]:
                cuts[-1] = (k, v)
            continue
        cuts.append((k, v))
    return [k for k, _ in cuts]


# ── 같은 그림 맞춤 ──
_ORB = None


def orb():
    global _ORB
    if _ORB is None:
        _ORB = cv2.ORB_create(3000, edgeThreshold=15, patchSize=15)
    return _ORB


def features(img):
    return orb().detectAndCompute(img, None)


def relation(fa, fb, shape, min_inliers=MIN_INLIERS, strict=False):
    """두 장을 잇는 닮음 변환 가운데 「그림」으로 볼 만한 것.
    글자 판 · 표시는 컷을 넘어 같은 자리에 남아 「배율 1 · 안 옮김」 맞춤을 한두 줄(80px 칸)에 모은다 — 그런 맞춤은 걷어 내고 남은 점으로 다시 맞춘다.
    배율 · 자리가 바뀐 맞춤은 글자 판이 만들 수 없으니 두 줄에 퍼지면 그림이다(사람 자리는 화면 가운데 두세 줄에 모인다 — B39 5.5초 · 57초).
    배율 · 자리가 그대로인 맞춤은 네 줄 넘게 퍼져야 그림이다. strict(되풀이 — 멀리 떨어진 두 컷)면 늘 네 줄을 요구한다."""
    (ka, da), (kb, db) = fa, fb
    if da is None or db is None or len(ka) < 20 or len(kb) < 20:
        return None
    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    m = [x for x in bf.knnMatch(da, db, k=2) if len(x) == 2 and x[0].distance < 0.75 * x[1].distance]
    if len(m) < min_inliers:
        return None
    pa = np.float32([ka[x[0].queryIdx].pt for x in m])
    pb = np.float32([kb[x[0].trainIdx].pt for x in m])
    h, w = shape
    unit = max(h, w) / 640                      # 길이 기준(긴 변 640)
    cell_h = 80 * unit
    centre = np.float32([[w / 2, h / 2]])
    keep = np.ones(len(m), bool)
    for _ in range(4):
        if keep.sum() < min_inliers:
            return None
        M, inl = cv2.estimateAffinePartial2D(pa[keep], pb[keep], method=cv2.RANSAC, ransacReprojThreshold=3.0 * unit, maxIters=4000, confidence=0.995)
        if M is None:
            return None
        inl = inl.ravel().astype(bool)
        idx = np.where(keep)[0][inl]
        if len(idx) < min_inliers:
            return None
        rows = {}
        for _x, y in pa[idx]:
            rows[int(y // cell_h)] = rows.get(int(y // cell_h), 0) + 1
        spread = sum(1 for v in rows.values() if v >= 3)
        s = float(math.hypot(M[0, 0], M[1, 0]))
        if not 0.4 <= s <= 2.5:                 # 찌그러진 맞춤(배율 0 · 수십 배) — 그림이 아니다
            keep[idx] = False
            continue
        moved = float(np.linalg.norm(cv2.transform(centre[None], M)[0, 0] - centre[0])) / unit   # 화면 가운데가 옮겨 간 거리(긴 변 640 기준 px)
        changed = abs(s - 1) > SCALE_STEP or moved > SHIFT_PX
        if (changed and spread >= 2 and not strict) or spread >= MIN_ROWS:
            return {"맞은점": int(len(idx)), "맞춤비": round(len(idx) / len(m), 2), "배율": round(s, 3), "옮김": round(moved, 1), "줄": spread}
        keep[idx] = False                       # 글자 판 맞춤 — 걷어 내고 남은 점으로 다시
    return None


def kind_of(rel):
    if not rel:
        return None
    if abs(rel["배율"] - 1) > SCALE_STEP or rel["옮김"] > SHIFT_PX:
        return "같은판"
    return "같은구도"


# ── 화소(잘라 키운 판) ──
def detail_ratio(gray):
    """가는 결(σ1 아래) 에너지 / 중간 결(σ1~3) 에너지 — 제 화소 판은 0.25~0.31(B39 · 메일비서 실측), 720p 판을 화면에서 또 잘라 키운 컷은 0.11 안팎.
    결이 거의 없는 어두운 판은 둘 다 작아 미덥지 않으니 중간 결이 DETAIL_MIN 아래면 None. 위 20%(글자 판)는 뺀다"""
    g = gray.astype(np.float32)
    g = g[int(g.shape[0] * 0.2):]
    b1 = cv2.GaussianBlur(g, (0, 0), 1.0)
    b3 = cv2.GaussianBlur(g, (0, 0), 3.0)
    mid = float(np.mean((b1 - b3) ** 2))
    if mid < DETAIL_MIN:
        return None
    return round(float(np.mean((g - b1) ** 2)) / mid, 3)


# ── 사람 움직임(사람움직임.py를 빌려 컷마다) ──
_MOTION = None


def motion_mod():
    global _MOTION
    if _MOTION is None:
        spec = importlib.util.spec_from_file_location("사람움직임", MOTION_PY)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _MOTION = mod
    return _MOTION


def _summarise(mod, a, b, fps, ps):
    s = mod.summary(ps)
    if not s:
        return None
    row = {"시작": round(a / fps, 2), "끝": round(b / fps, 2), "사람": s["사람"], "카메라": s["카메라"], "판정": s["판정"],
           "사람장": s["얼굴 장"] + s["실루엣 장"], "장": s["장"]}
    wins = []
    if (b - a) / fps >= WIN_LONG:
        n = int(round(WIN * fps))
        st = int(round(WIN_STEP * fps))
        for w0 in range(0, max(1, len(ps) - n + 1), st):
            part = ps[w0:w0 + n]
            ws = mod.summary(part)
            ppl = sum(1 for x in part if x[2] in ("얼굴", "실루엣"))
            if ws and ws["사람"] < FROZEN and ppl > len(part) / 2:
                wins.append(round((a + 2 + w0) / fps, 2))
    row["멎은창"] = wins
    return row


def measure_motion(path, fps, segs):
    """사람움직임.py와 같은 480×270 bgr 장을 한 번만 풀어(24fps) 컷마다 이웃 장 흐름을 잰다 — 컷 앞뒤 2장은 빼고, 긴 컷은 CHUNK장씩
    (끊는 자리의 장은 다음 덩이의 첫 장으로 다시 써서 이웃 쌍을 잃지 않는다)"""
    mod = motion_mod()
    W, H = mod.W, mod.H
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},scale={W}:{H}",
                             "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    size = W * H * 3
    out, i = [], 0

    def pairs_of(buf):
        fr = np.array(buf)
        mod.frames = lambda *_args, _fr=fr: _fr          # pairs()가 이 덩이의 장만 보게
        return mod.pairs(None)

    try:
        for a, b in segs:
            ps, buf = [], []
            while i < b:
                raw = proc.stdout.read(size)
                if len(raw) < size:
                    break
                if a + 2 <= i < b - 2:
                    buf.append(np.frombuffer(raw, np.uint8).reshape(H, W, 3))
                    if len(buf) >= CHUNK:
                        ps += pairs_of(buf)
                        buf = [buf[-1]]
                i += 1
            if len(buf) >= 2:
                ps += pairs_of(buf)
            if (b - a) / fps < MIN_CUT or len(ps) < 5:
                continue
            row = _summarise(mod, a, b, fps, ps)
            if row:
                out.append(row)
    finally:
        proc.stdout.close()
        proc.wait()
    return out


# ── 소리 ──
def audio_rms(path, dur=None, rate=16000):
    """0.25초 칸마다 dBFS. 소리 줄기가 영상보다 짧으면 모자란 칸을 무음(−90dB)으로 채운다 — 소리가 먼저 끝난 끝도 「조용한 끝」이다(Fable 검수 5)"""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    if not len(x):
        return None
    hop = rate // 4
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    want = int(dur * 4) if dur else 0
    if want > len(db):
        db = np.concatenate([db, np.full(want - len(db), -90.0)])
    return db


def main(argv=None):
    ap = argparse.ArgumentParser(description="최종본 검사 — 굳음 · 같은 판 · 되풀이 · 끝 · 화소")
    ap.add_argument("mp4")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--항목", default="굳음,같은판,되풀이,끝,화소")
    o = ap.parse_args(argv)
    want = set(o.항목.split(","))
    try:
        w, h, src_fps, dur = probe(o.mp4)
    except Exception as e:  # noqa: BLE001 — 끝 코드 2로 알린다
        print(json.dumps({"파일": o.mp4, "오류": str(e)}, ensure_ascii=False) if o.json else f"잴 수 없음: {e}")
        return 2
    small = decode(o.mp4, fit_size(w, h, 192))
    if len(small) < 4:
        print(json.dumps({"파일": o.mp4, "오류": "장이 모자람"}, ensure_ascii=False) if o.json else "잴 수 없음: 장이 모자람")
        return 2
    n = len(small)
    fps = FPS
    cuts = find_cuts(small, fps)
    bounds = [0] + cuts + [n]
    segs = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
    t = lambda k: round(k / fps, 2)  # noqa: E731
    hits, notes, failed = [], [], []

    def guard(name, fn):
        """항목 하나가 죽어도 앞서 잰 것은 낸다 — 못 잰 항목은 「못잼」에(Fable 검수 2)"""
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            failed.append({"항목": name, "오류": f"{type(e).__name__}: {e}"[:300]})

    need = set()
    if "같은판" in want:
        for c in cuts:
            need.update((c - 1, c))
    if "되풀이" in want:
        need.update((a + b) // 2 for a, b in segs)
    size = fit_size(w, h, 640)
    shape = (size[1], size[0])
    mid = None
    try:
        mid = pick(o.mp4, size, need) if need else None
    except Exception as e:  # noqa: BLE001
        failed.append({"항목": "같은판 · 되풀이", "오류": f"{type(e).__name__}: {e}"[:300]})

    def _same():
        if "같은판" in want and mid is not None:
            for c in cuts:
                rel = relation(features(mid[c - 1]), features(mid[c]), shape)
                k = kind_of(rel)
                if k:
                    hits.append({"항목": k, "초": t(c), "값": rel,
                                 "글": (f"{t(c)}초 컷 경계가 앞 컷과 같은 그림이다 — 배율 {rel['배율']} · {rel['옮김']}px 옮김(같은 판을 잘라 키워 이어 붙임, 점검표 50)"
                                        if k == "같은판" else f"{t(c)}초 컷 경계의 앞뒤가 배율 · 자리까지 같은 그림이다(점프 컷, 점검표 50)")})

    guard("같은판", _same)

    def _repeat():
        if "되풀이" in want and mid is not None:
            reps = [(a, b, features(mid[(a + b) // 2])) for a, b in segs if (b - a) / fps >= 0.5]
            group_of = {}                              # 컷 번호 → 무리(가장 이른 컷) — 이은 이은 것으로 번지지 않게 각 컷은 가장 이른 짝의 무리에만 든다
            for j in range(len(reps)):
                for i in range(j):
                    if reps[j][0] <= reps[i][1]:       # 이웃 컷은 같은판이 본다
                        continue
                    if relation(reps[i][2], reps[j][2], shape, REPEAT_INLIERS, strict=True):
                        group_of[j] = group_of.get(i, i)
                        group_of.setdefault(i, i)
                        break
            groups = {}
            for j, g in sorted(group_of.items()):
                groups.setdefault(g, []).append(j)
            for g in groups.values():                  # 같은 그림 무리마다 한 줄(B39 v10 법정 전경 0 · 2.9 · 18.4 · 34초가 네 줄로 흩어지지 않게)
                if len(g) < 2:
                    continue
                times = [t(reps[i][0]) for i in g]
                hits.append({"항목": "되풀이", "초": times[1], "앞초": times[0], "값": {"컷": times},
                             "글": f"같은 그림의 컷이 {len(times)}번 나온다 — {' · '.join(f'{x}초' for x in times)}(같은 장면 반복, 점검표 50)"})

    guard("되풀이", _repeat)

    def _detail():
        if "화소" in want:
            full = pick(o.mp4, (w, h), [(a + b) // 2 for a, b in segs if (b - a) / fps >= 0.5])
            end_from = n - int(round(END_SEC * fps))
            for a, b in segs:
                k = (a + b) // 2
                if k not in full:
                    continue
                r = detail_ratio(full[k])
                if r is None:
                    continue
                if r < DETAIL_FLAG and b > end_from:
                    hits.append({"항목": "끝화소", "초": t(a), "끝초": t(b), "값": {"가는결비": r},
                                 "글": f"끝 3초의 {t(a)}~{t(b)}초 컷이 잘라 키운 흐린 그림이다 — 가는 결 비 {r}(제 화소 판 0.25 안팎, 점검표 48 · 2)"})
                else:
                    notes.append({"항목": "화소", "초": t(a), "가는결비": r})

    guard("화소", _detail)

    def _end():
        if "끝" in want:
            db = audio_rms(o.mp4, dur)
            if db is not None and len(db) > 4 * (END_SEC + 2):
                end_n = int(END_SEC * 4)
                body_mid = float(np.median(db[4: len(db) - end_n]))
                quiet = 0                               # 끝에서부터(마지막 0.25초 칸은 빼고) 몸통 가운데보다 10dB 넘게 작은 칸이 잇달아 몇 개인가
                for v in db[-2::-1]:
                    if v < body_mid - END_QUIET_DB:
                        quiet += 1
                    else:
                        break
                row = {"끝조용초": round((quiet + 1) / 4, 2), "몸통가운데dB": round(body_mid, 1), "끝최대dB": round(float(np.max(db[-end_n:-1])), 1)}
                if quiet >= END_QUIET_SEC * 4:
                    hits.append({"항목": "끝소리", "초": round(dur - row["끝조용초"], 2), "값": row,
                                 "글": f"끝 {row['끝조용초']}초가 몸통 소리 가운데({row['몸통가운데dB']}dB)보다 {END_QUIET_DB:.0f}dB 넘게 작은 방 소리뿐이다 — 끝 소리 한 방이 없다(점검표 2)"})
                else:
                    notes.append({"항목": "끝소리", **row})

    guard("끝", _end)

    def _motion():
        if want & {"굳음"}:
            for r in measure_motion(o.mp4, fps, segs):
                if r["판정"] == "가까움 · 눈으로 판정":
                    notes.append({"항목": "가까움", "초": r["시작"], "끝초": r["끝"], "사람": r["사람"]})
                    continue
                mostly_people = r["사람장"] > (r["장"] - 1) / 2
                if mostly_people and r["사람"] < FROZEN:
                    hits.append({"항목": "굳음", "초": r["시작"], "끝초": r["끝"], "값": {"사람": r["사람"], "카메라": r["카메라"]},
                                 "글": f"{r['시작']}~{r['끝']}초 컷의 사람이 굳어 있다 — 사람 {r['사람']}(0.12 아래, 점검표 26)"})
                elif mostly_people and r["멎은창"]:
                    hits.append({"항목": "구간굳음", "초": r["멎은창"][0], "끝초": r["끝"], "값": {"사람": r["사람"], "창": r["멎은창"]},
                                 "글": f"{r['시작']}~{r['끝']}초 컷 안 {r['멎은창'][0]}초부터 1.5초 넘게 사람이 멎는다(점검표 26)"})
                notes.append({"항목": "사람", "초": r["시작"], "끝초": r["끝"], "사람": r["사람"], "판정": r["판정"], "사람장": r["사람장"], "장": r["장"]})

    guard("굳음", _motion)

    out = {"파일": o.mp4, "길이": round(dur, 2), "fps": fps, "원본fps": round(src_fps, 3), "컷": [t(c) for c in cuts], "걸림": hits, "알림": notes,
           **({"못잼": failed} if failed else {})}
    if o.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(f"{os.path.basename(o.mp4)} · {out['길이']}초 · 컷 {len(cuts) + 1}개")
        for x in hits:
            print(f"  [{x['항목']}] {x['글']}")
        for x in failed:
            print(f"  [못 잼 · {x['항목']}] {x['오류']}")
        if not hits and not failed:
            print("  걸림 없음")
    return 1 if hits else (2 if failed else 0)


if __name__ == "__main__":
    sys.exit(main())
