# 영상 관문 판 — /굽기전검수 · /마감작업(Fable 5.2 울트라 관문)의 검수자들이 나눠 볼 판과 숫자를 한 번에 만든다(2026-11-12, Claude).
#
# 왜: 관문 워크플로(.claude/workflows/video-gate.js)는 검수자 여럿이 컷을 나눠 본다. 판을 검수자마다 그때그때 만들면 토큰이 들고 꼴이
#   매번 달라져서, 판과 숫자는 이 도구가 정한 꼴로 만들고 검수자는 읽기만 한다. 판은 Claude가 그림을 줄이는 크기(긴 변 1568 · 약 115만 화소)
#   안으로 만들어 보내도 더 줄지 않게 한다. 기계 숫자는 거르기용이다 — 판정은 검수자 눈이 한다.
#
#   시작 그림은 컷표 그 컷의 「시작그림」 칸(편 폴더 기준)을 먼저, 칸이 비면 <정지 폴더>/<컷>.png|jpg를 쓴다. 맨 위 「소품」 줄의 기준그림(탈것 · 되풀이 소품)도 기준으로 싣는다.
#   python -I -X utf8 tools/영상관문판.py <컷표.json> --관문 굽기전 [--그림 <정지 폴더>] [--그림지시문 <폴더>] [--꾸러미 <폴더>] [--출력 <폴더>] [--컷 C3,C7]
#   python -I -X utf8 tools/영상관문판.py <컷표.json> --관문 마감 --최종 <최종.mp4> [--원본 <원본.mp4>] [--그림 <정지 폴더>] [--출력 <폴더>] [--컷 C3,C7]
#
#   기본값(편 = 컷표가 있는 폴더): --그림 <편>/정지 · --그림지시문 <편>/이미지지시문 · --꾸러미 <편>/꾸러미 · --출력 <편>/검수/판_<관문>
#   --컷: 다시 검수 — 그 컷과 앞뒤 이웃 컷의 판만 만든다(이웃은 이어짐을 보려고).
#
# 만드는 것(<출력>/):
#   판목록.json  워크플로가 받는 목록 — 컷마다 열 그림 · 기준 그림 · 판 · 도구 끝 코드 · 못 만든 것
#   숫자.json    컷마다 밝기 · 붉푸 비 · 앞뒤보다 튐 · 첫 장 겹침(같은 시작 그림 의심) · 얼굴 수 · 엔진 흔적(굽기전) · 사람 움직임(마감) · 연속성 항목
#   굽기전  그림_<컷>.jpg(시작 그림) · 기준_<장면|인물>_<이름>.jpg · 전체_<n>.jpg · 장면_<장면>_<n>.jpg · 얼굴_<배역>_<n>.jpg · 얼굴_여럿_<n>.jpg
#   마감    띠_<컷>.jpg(컷 안 고른 간격 8장) · 움직임_<컷>.jpg(사람 컷 가운데 1초를 1/8초 8장) · 끝.jpg(끝 3초 0.25초 12장)
#           · 원본_<컷>.jpg(컷표 detail에 "원본": [시작초, 끝초]가 있고 --원본을 줬을 때 — 위 우리 25 · 50 · 75%, 아래 원본 같은 자리)
#           · 전체 · 장면(컷 가운데 장) · 얼굴 판은 굽기전과 같은 꼴. 정지 폴더가 있으면 시작 그림의 엔진 흔적도 숫자에 붙인다(제작 규칙 「검수」 엔진 표)
#   그리고 tools/컷연속성검사.py(굽기전 --그림 · --그림지시문 · --지시문, 마감 --영상) · 끝판검사.py · 사람움직임.py(사람 컷마다)를 돌려 숫자에 붙인다.
#
# 숫자 문턱(거르기용): 첫 장 dHash 거리 5 이하면 같은 시작 그림 의심(「이어찍기」 이웃은 뺌) · 같은 시간대 이웃 평균보다 밝기 30 · 붉푸 비 0.3 넘게
#   다르면 튐(같은 장면 이웃끼리) · 사람 컷인데 얼굴 0 · 사람 없는 컷인데 얼굴 · 한 사람 컷에 얼굴 여럿 · 사람 움직임(컷 가운데 2.5초) 0.12 아래는 「살펴볼움직임」 —
#   움직임은 검수자 눈에 맡기지 않고 검수 세션이 1/8초 띠를 직접 본다(11-07 Fable이 8장 띠를 받고도 멈춘 손을 두 번 놓쳤다).
# 끝 코드: 0 다 만듦 · 2 못 만든 것이 있음(판목록 「못함」) · 1 입력 오류.
# 시험: node --test tests/영상관문.test.js(워크플로 모의 실행 · 이음). 이 도구는 그림 라이브러리 · ffmpeg가 있어야 돌아 PC에서 실제 편으로 확인한다.
import argparse
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")  # 얼굴 검출 때마다 찍히는 OpenCV 알림을 끈다

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    print(f"그림 라이브러리가 없다({e.name}) — numpy · Pillow가 필요하다", file=sys.stderr)
    sys.exit(1)

뿌리 = Path(__file__).resolve().parent.parent
문서 = 뿌리.parent  # 기준그림이 「synk-vendor/…」처럼 Documents 기준으로 적힌 편이 있다
굽기폴더 = 뿌리 / "docs" / "마케팅" / "PULSE_포트폴리오_제작준비_20261012"
사람움직임도구 = 굽기폴더 / "시댄스무제한" / "사람움직임.py"
끝판도구 = 굽기폴더 / "video" / "끝판검사.py"
연속성도구 = 뿌리 / "tools" / "컷연속성검사.py"
YUNET = Path.home() / ".rembg" / "models" / "yunet" / "face_detection_yunet_2023mar.onnx"
글꼴후보 = [Path("C:/Windows/Fonts/malgunbd.ttf"), Path("C:/Windows/Fonts/malgun.ttf"), Path("/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf")]
긴변, 화소 = 1568, 1_150_000
그림확장자 = (".png", ".jpg", ".jpeg", ".webp")
판칸 = 8          # 전체 · 장면 판 한 장의 칸 수 — 이야기를 읽을 만한 크기(9:16이면 칸 약 284×505)
얼굴칸 = 30         # 얼굴판 한 장(6×5) — 칸 약 196px
움직임초 = 2.5      # 사람 움직임은 컷 가운데 이만큼만 잰다(긴 컷 302장에 60초 → 2.5초면 컷당 20초 안팎)
겹침문턱, 밝기문턱, 붉푸문턱, 굳음 = 5, 30.0, 0.3, 0.12
흔적표 = [("GPT", (b"OpenAI", b"ChatGPT", b"gpt-image", b"DALL")), ("Google", (b"Google", b"Gemini", b"Imagen")), ("C2PA", (b"c2pa", b"C2PA", b"jumb"))]


def 파일이름(이름):
    """컷 · 장면 · 배역 이름을 파일 이름에 쓸 수 있게(윈도에서 못 쓰는 글자 · 빈칸 → _)."""
    return re.sub(r'[\\/:*?"<>|\s]', "_", str(이름))


def 찾기(p, 편):
    if not p:
        return None
    q = Path(os.path.expanduser(str(p)))
    for c in ([q] if q.is_absolute() else [편 / q, 뿌리 / q, 문서 / q]):
        if c.exists():
            return c.resolve()
    return None


def 글꼴(크기):
    for p in 글꼴후보:
        if p.exists():
            try:
                return ImageFont.truetype(str(p), 크기)
            except OSError:
                pass
    return ImageFont.load_default()


def 줄이기(im):
    w, h = im.size
    s = min(1.0, 긴변 / max(w, h), (화소 / (w * h)) ** 0.5)
    return im if s >= 1.0 else im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def 저장(im, 경로):
    줄이기(im.convert("RGB")).save(경로, "JPEG", quality=90)
    return str(Path(경로).resolve())


def 꼬리표(im, 글, 크기):
    d = ImageDraw.Draw(im)
    f = 글꼴(크기)
    x0, y0, x1, y1 = d.textbbox((0, 0), 글, font=f)
    d.rectangle([0, 0, x1 - x0 + 12, y1 - y0 + 10], fill=(0, 0, 0))
    d.text((6 - x0, 5 - y0), 글, font=f, fill=(255, 255, 255))
    return im


def 맞춤(im, w, h):
    """비율을 지키며 w×h 칸 안에 넣고 남는 곳은 어둡게 채운다(원본 비율이 다른 판도 늘리지 않게)."""
    im = im.convert("RGB")
    s = min(w / im.size[0], h / im.size[1])
    t = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
    칸 = Image.new("RGB", (w, h), (24, 24, 24))
    칸.paste(t, ((w - t.size[0]) // 2, (h - t.size[1]) // 2))
    return 칸


def 판짜기(그림들, 꼬리들, 비=None, 열=None):
    """칸을 격자로 — 열을 안 주면 판이 정사각에 가깝게, 판 전체가 긴 변 1568 · 115만 화소 안에 들게 칸 크기를 정한다."""
    n = len(그림들)
    a = 비 or (그림들[0].size[0] / 그림들[0].size[1])
    if 열 is None:
        열 = min(range(1, n + 1), key=lambda c: abs(c * a / ((n + c - 1) // c) - 1))
    행 = (n + 열 - 1) // 열
    tw = min(긴변 / 열, 긴변 * a / 행, (화소 * a / (열 * 행)) ** 0.5)
    tw, th = max(8, int(tw)), max(8, int(tw / a))
    판 = Image.new("RGB", (열 * tw, 행 * th), (24, 24, 24))
    크기 = max(11, th // 12)
    for i, (g, 글) in enumerate(zip(그림들, 꼬리들)):
        칸 = 맞춤(g, tw, th) if g is not None else Image.new("RGB", (tw, th), (60, 0, 0))
        판.paste(꼬리표(칸, 글 or ("못 뽑음" if g is None else ""), 크기) if (글 or g is None) else 칸, ((i % 열) * tw, (i // 열) * th))
    return 판


def 나눠짜기(항목, 칸수, 이름앞, 출력, 비=None):
    """[(그림, 꼬리)] → 칸수씩 판 여러 장. 경로 목록을 돌려준다."""
    경로들 = []
    for k in range(0, len(항목), 칸수):
        조각 = 항목[k:k + 칸수]
        경로들.append(저장(판짜기([g for g, _ in 조각], [c for _, c in 조각], 비), 출력 / f"{이름앞}_{k // 칸수 + 1}.jpg"))
    return 경로들


def 영상정보(영상):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration",
                        "-of", "json", str(영상)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    j = json.loads(r.stdout or "{}")
    s = (j.get("streams") or [{}])[0]
    num, _, den = (s.get("r_frame_rate") or "24/1").partition("/")
    fps = float(num) / float(den) if den and float(den) else 24.0
    return int(s.get("width") or 0), int(s.get("height") or 0), fps or 24.0, float((j.get("format") or {}).get("duration") or 0)


def 한장(영상, t, w, h):
    r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{max(0.0, t):.3f}", "-i", str(영상), "-frames:v", "1",
                        "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    return Image.frombytes("RGB", (w, h), r.stdout[:w * h * 3]) if len(r.stdout) >= w * h * 3 else None


def 여러장(영상, 시각들, 크기, 일꾼):
    w, h = 크기
    return list(일꾼.map(lambda t: 한장(영상, t, w, h), 시각들))


def 뽑을크기(w, h, 긴=1920):
    s = min(1.0, 긴 / max(w, h))
    return max(2, int(w * s) // 2 * 2), max(2, int(h * s) // 2 * 2)


def 빛값(그림):
    a = np.asarray(그림.convert("RGB").resize((96, 96))).astype(np.float32)
    밝기 = float((0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]).mean())
    return round(밝기, 1), round(float(a[..., 0].mean() / max(1.0, a[..., 2].mean())), 3)


def 지문(그림):
    """dHash 64비트 — 거의 한 색인 장(검은 페이드 · 흰 화면)은 지문이 다 같아져 None(겹침에서 뺀다)."""
    a = np.asarray(그림.convert("L").resize((9, 8), Image.LANCZOS)).astype(np.int16)
    if float(a.std()) < 4.0:
        return None
    return int("".join("1" if b else "0" for b in (a[:, 1:] > a[:, :-1]).flatten()), 2)


def 엔진흔적(경로):
    try:
        b = Path(경로).read_bytes()
    except OSError:
        return "못 읽음"
    b = b[:4_000_000] + b[-200_000:]
    return "·".join(이름 for 이름, 표 in 흔적표 if any(m in b for m in 표)) or "흔적 없음"


class 얼굴찾개:
    def __init__(self):
        self.cv2, self.까닭 = None, None
        try:
            import cv2
            self.cv2 = cv2
        except ImportError:
            self.까닭 = "cv2가 없어 얼굴판을 못 만듦"
            return
        if not YUNET.exists():
            self.cv2, self.까닭 = None, f"얼굴 검출 모델이 없어 얼굴판을 못 만듦({YUNET})"

    def 찾기(self, 그림):
        if not self.cv2 or 그림 is None:
            return []
        cv2 = self.cv2
        a = np.asarray(그림.convert("RGB"))[:, :, ::-1].copy()
        h, w = a.shape[:2]
        s = min(1.0, 960 / max(w, h))
        작은 = cv2.resize(a, (max(1, int(w * s)), max(1, int(h * s)))) if s < 1 else a
        fd = cv2.FaceDetectorYN.create(str(YUNET), "", (작은.shape[1], 작은.shape[0]), 0.7, 0.3, 5000)
        _, faces = fd.detect(작은)
        out = [] if faces is None else [tuple(float(v) / s for v in f[:4]) for f in faces]
        return sorted(out, key=lambda r: -r[2] * r[3])

    @staticmethod
    def 자르기(그림, 상자):
        x, y, fw, fh = 상자
        cx, cy, half = x + fw / 2, y + fh / 2, max(fw, fh) * 0.8
        return 그림.crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half))).resize((256, 256), Image.LANCZOS)


def 돌리기(명령, 시간=1200):
    try:
        r = subprocess.run([str(x) for x in 명령], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=시간)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return None, "", f"{시간}초 넘게 걸려 멈춤"
    except OSError as e:
        return None, "", str(e)


def 컷시간(표):
    d, seq, 끝 = 표.get("detail") or [], 표.get("seq") or [], float(표.get("end") or 0)
    시작 = {str(r[0]): float(r[1]) for r in seq if isinstance(r, list) and len(r) > 1}
    out = []
    for i, x in enumerate(d):
        t = x.get("t", 시작.get(str(x.get("cut"))))
        dur = x.get("dur")
        if dur is None and t is not None:
            다음 = d[i + 1].get("t", 시작.get(str(d[i + 1].get("cut")))) if i + 1 < len(d) else (끝 or None)
            dur = (float(다음) - float(t)) if 다음 is not None else None
        out.append((None if t is None else float(t), None if dur is None else float(dur)))
    return out


def 고른컷(표, 컷인자):
    컷들 = [str(x.get("cut")) for x in 표.get("detail") or []]
    if not 컷인자:
        return 컷들, []
    원함 = [c.strip() for c in 컷인자.split(",") if c.strip()]
    없음 = [c for c in 원함 if c not in 컷들]
    고름 = set()
    for c in 원함:
        if c in 컷들:
            i = 컷들.index(c)
            고름.update(컷들[max(0, i - 1):i + 2])
    return [c for c in 컷들 if c in 고름], 없음


def 시작그림찾기(폴더, 컷, 줄=None, 편=None):
    """컷표 그 컷의 「시작그림」 칸(편 폴더 기준 · 목록이면 첫 장)을 먼저, 없으면 <정지 폴더>/<컷>.png|jpg …"""
    값 = (줄 or {}).get("시작그림")
    for v in ([값] if isinstance(값, str) else 값 if isinstance(값, list) else []):
        if isinstance(v, str) and v.strip():
            p = Path(os.path.expanduser(v.strip()))
            p = p if p.is_absolute() else (편 / p if 편 else p)
            if p.is_file():
                return p.resolve(), None
            return None, f"{컷}: 「시작그림」 칸의 파일이 없다 — {v}"
    if not 폴더 or not 폴더.is_dir():
        return None, None
    이름 = 파일이름(컷)
    for e in 그림확장자:
        for 후보 in (폴더 / f"{컷}{e}", 폴더 / f"{이름}{e}"):
            if 후보.exists():
                return 후보, None
    판들 = sorted([p for p in 폴더.iterdir() if p.suffix.lower() in 그림확장자 and re.match(rf"^{re.escape(이름)}[_\-].+", p.stem)],
                key=lambda p: p.stat().st_mtime)
    if 판들:
        return 판들[-1], f"{컷}: 정확한 이름(<컷>.png|jpg)이 없어 가장 새 판 {판들[-1].name}을 씀 — {len(판들)}판"
    return None, None


def main(argv):
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("컷표")
    ap.add_argument("--관문", required=True, choices=["굽기전", "마감"])
    ap.add_argument("--그림")
    ap.add_argument("--그림지시문")
    ap.add_argument("--꾸러미")
    ap.add_argument("--최종")
    ap.add_argument("--원본")
    ap.add_argument("--출력")
    ap.add_argument("--컷")
    o = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")
    시작시각 = time.monotonic()
    컷표 = Path(o.컷표).resolve()
    if not 컷표.exists():
        print(f"컷표가 없다: {컷표}", file=sys.stderr)
        return 1
    표 = json.loads(컷표.read_text(encoding="utf-8"))
    편 = 컷표.parent
    출력 = Path(o.출력).resolve() if o.출력 else 편 / "검수" / f"판_{o.관문}"
    출력.mkdir(parents=True, exist_ok=True)
    if o.관문 == "마감" and not o.최종:
        print("마감에는 --최종 <최종.mp4>가 필요하다", file=sys.stderr)
        return 1
    최종 = Path(o.최종).resolve() if o.최종 else None
    if 최종 is not None and not 최종.exists():
        print(f"최종 영상이 없다: {최종}", file=sys.stderr)
        return 1
    detail = 표.get("detail") or []
    if not detail:
        print("컷표에 detail이 없다 — 컷표 틀 2로 채운 뒤 돌린다", file=sys.stderr)
        return 1
    컷들, 없는컷 = 고른컷(표, o.컷)
    못함 = [f"{c}: 컷표에 없는 컷" for c in 없는컷]
    줄 = {str(x.get("cut")): x for x in detail}
    순서 = [str(x.get("cut")) for x in detail]
    장면표, 인물표 = 표.get("장면") or {}, 표.get("인물") or {}
    시간대 = {c: (장면표.get(줄[c].get("장면")) or {}).get("시간대") or 줄[c].get("장면") for c in 순서}
    얼굴 = 얼굴찾개()
    if 얼굴.까닭:
        못함.append(얼굴.까닭)
    숫자 = {c: {} for c in 컷들}
    컷목록, 기준목록, 판 = [], [], {"전체": [], "장면": [], "얼굴": [], "끝": ""}
    대표 = {}      # 컷 → 대표 그림(굽기전: 시작 그림, 마감: 컷 가운데 장)
    첫장 = {}      # 컷 → 겹침을 잴 그림(굽기전: 시작 그림, 마감: 컷 첫 장)
    얼굴재료 = {}  # 컷 → [(그림, 꼬리)]
    살펴볼 = []
    도구 = []
    비 = None

    # ── 기준 그림 ──
    소품표 = 표.get("소품") if isinstance(표.get("소품"), dict) else {}

    def 나온소품(c):
        v = 줄[c].get("소품")
        return [k for k, 상태 in v.items() if 상태 != "화면밖"] if isinstance(v, dict) else []

    for 종류, 표들 in (("장면", 장면표), ("인물", 인물표), ("소품", 소품표)):
        if 종류 == "소품":
            쓰는 = {n for c in 컷들 for n in 나온소품(c)} | ({k for k, v in 소품표.items() if isinstance(v, dict) and v.get("종류") == "탈것"})
        else:
            쓰는 = {n for c in 컷들 for n in ([줄[c].get("장면")] if 종류 == "장면" else (줄[c].get("인물") or [])) if n}
        for 이름, v in 표들.items():
            if 이름 not in 쓰는 or not isinstance(v, dict) or not v.get("기준그림"):
                continue
            p = 찾기(v["기준그림"], 편)
            if not p:
                못함.append(f"기준 그림 없음: {종류} {이름} — {v['기준그림']}")
                continue
            try:
                g = Image.open(p)
                g.load()
            except OSError as e:
                못함.append(f"기준 그림을 못 엶: {종류} {이름} — {e}")
                continue
            기준목록.append({"종류": 종류, "이름": 이름, "그림": 저장(g, 출력 / f"기준_{종류}_{파일이름(이름)}.jpg")})
            if 종류 == "인물":
                상자 = 얼굴.찾기(g)
                얼굴재료.setdefault(f"__기준__{이름}", [(얼굴.자르기(g, 상자[0]) if 상자 else g, "기준")])

    with ThreadPoolExecutor(max_workers=8) as 일꾼:
        if o.관문 == "굽기전":
            정지 = Path(o.그림).resolve() if o.그림 else 편 / "정지"
            if not 정지.is_dir():
                못함.append(f"시작 그림 폴더가 없다: {정지}")
            for c in 컷들:
                p, 알림 = 시작그림찾기(정지, c, 줄[c], 편)
                if 알림:
                    못함.append(알림)
                그림들 = []
                if p:
                    try:
                        g = Image.open(p)
                        g.load()
                        g = g.convert("RGB")
                        대표[c] = 첫장[c] = g
                        비 = 비 or g.size[0] / g.size[1]
                        그림들.append(저장(g, 출력 / f"그림_{파일이름(c)}.jpg"))
                        숫자[c]["엔진흔적"] = 엔진흔적(p)
                        숫자[c]["원본파일"] = str(p)
                        얼굴재료[c] = [(g, c)]
                    except OSError as e:
                        못함.append(f"{c}: 시작 그림을 못 엶 — {e}")
                else:
                    못함.append(f"{c}: 시작 그림 없음({정지})")
                컷목록.append({"cut": c, "장면": str(줄[c].get("장면") or ""), "인물": list(줄[c].get("인물") or []), "소품": 나온소품(c), "그림": 그림들, "움직임": ""})
        else:
            w, h, fps, 길이 = 영상정보(최종)
            if not (w and h and 길이):
                print(f"최종 영상을 못 읽음: {최종}", file=sys.stderr)
                return 1
            크기 = 뽑을크기(w, h)
            비 = 크기[0] / 크기[1]
            시간 = dict(zip(순서, 컷시간(표)))
            원본정보 = 영상정보(Path(o.원본)) if o.원본 and Path(o.원본).exists() else None
            if o.원본 and not 원본정보:
                못함.append(f"원본 영상을 못 읽음: {o.원본}")
            for c in 컷들:
                t, dur = 시간.get(c, (None, None))
                항목 = {"cut": c, "장면": str(줄[c].get("장면") or ""), "인물": list(줄[c].get("인물") or []), "소품": 나온소품(c), "그림": [], "움직임": ""}
                컷목록.append(항목)
                if t is None or not dur or dur <= 0 or t >= 길이:
                    못함.append(f"{c}: 컷표의 시각(t · dur)을 못 정함 — 띠를 못 만듦")
                    continue
                dur = min(dur, 길이 - t)
                띠시각 = [t + dur * (i + 0.5) / 8 for i in range(8)]
                띠 = 여러장(최종, 띠시각, 크기, 일꾼)
                항목["그림"].append(저장(판짜기(띠, [f"{c}  {s:.2f}s" for s in 띠시각], 비), 출력 / f"띠_{파일이름(c)}.jpg"))
                대표[c] = 띠[4] if 띠[4] is not None else next((x for x in 띠 if x is not None), None)
                첫장[c] = 한장(최종, t + min(dur / 3, max(0.2, dur * 0.1)), *크기)  # 컷 경계 바로 뒤는 컷표 시각이 조금 어긋나면 앞 컷이 잡힌다(11-12 실측 C2)
                얼굴재료[c] = [(띠[i], f"{c} {띠시각[i]:.1f}s") for i in (1, 4, 6) if 띠[i] is not None]
                if 줄[c].get("인물"):
                    가운데 = t + dur / 2
                    움시각 = [min(t + dur - 0.02, max(t + 0.02, 가운데 - 0.4375 + i * 0.125)) for i in range(8)]
                    항목["움직임"] = 저장(판짜기(여러장(최종, 움시각, 크기, 일꾼), [f"{c}  {s:.3f}s" for s in 움시각], 비), 출력 / f"움직임_{파일이름(c)}.jpg")
                구간 = 줄[c].get("원본")
                if 원본정보 and isinstance(구간, list) and len(구간) == 2:
                    ow, oh, _, _ = 원본정보
                    s0, s1 = float(구간[0]), float(구간[1])
                    우리 = 여러장(최종, [t + dur * f for f in (0.25, 0.5, 0.75)], 크기, 일꾼)
                    원 = 여러장(Path(o.원본), [s0 + (s1 - s0) * f for f in (0.25, 0.5, 0.75)], 뽑을크기(ow, oh), 일꾼)
                    항목["그림"].append(저장(판짜기(우리 + 원, [f"{c} 우리 {p}%" for p in (25, 50, 75)] + [f"원본 {p}%" for p in (25, 50, 75)], 비, 열=3),
                                            출력 / f"원본_{파일이름(c)}.jpg"))
            끝시각 = [max(0.0, 길이 - 3.0 + 0.125 + i * 0.25) for i in range(12)]
            판["끝"] = 저장(판짜기(여러장(최종, 끝시각, 크기, 일꾼), [f"끝 {s:.2f}s" for s in 끝시각], 비), 출력 / "끝.jpg")

    # ── 전체 · 장면 판 ──
    있는컷 = [c for c in 컷들 if 대표.get(c) is not None]
    if 있는컷:
        판["전체"] = 나눠짜기([(대표[c], c) for c in 있는컷], 판칸, "전체", 출력, 비)
        장면순 = []
        for c in 있는컷:
            s = str(줄[c].get("장면") or "장면없음")
            if s not in 장면순:
                장면순.append(s)
        for s in 장면순:
            판["장면"] += 나눠짜기([(대표[c], c) for c in 있는컷 if str(줄[c].get("장면") or "장면없음") == s], 판칸, f"장면_{파일이름(s)}", 출력, 비)

    # ── 얼굴판 · 얼굴 수 ──
    if 얼굴.cv2:
        배역칸 = {이름[len("__기준__"):]: list(v) for 이름, v in 얼굴재료.items() if 이름.startswith("__기준__")}
        여럿 = []
        for c in 컷들:
            사람 = list(줄[c].get("인물") or [])
            수 = []
            for g, 꼬리 in 얼굴재료.get(c, []):
                상자 = 얼굴.찾기(g)
                수.append(len(상자))
                if len(사람) == 1 and 상자:
                    배역칸.setdefault(사람[0], []).append((얼굴.자르기(g, 상자[0]), 꼬리))
                elif len(사람) >= 2:
                    여럿 += [(얼굴.자르기(g, b), 꼬리) for b in 상자[:4]]
            if 수:
                숫자[c]["얼굴수"] = max(수)
                if not 사람 and max(수) > 0:
                    숫자[c].setdefault("의심", []).append(f"사람 없는 컷인데 얼굴 {max(수)}")
                if len(사람) == 1 and max(수) > 1:
                    숫자[c].setdefault("의심", []).append(f"한 사람 컷인데 얼굴 {max(수)}(뒤 사람 · 비침?)")
                if 사람 and max(수) == 0:
                    숫자[c].setdefault("의심", []).append("사람 컷인데 얼굴을 못 찾음(뒷모습 · 가림 · 극접사면 그대로)")
        for 배역, 칸들 in 배역칸.items():
            if len(칸들) > 1:
                판["얼굴"] += 나눠짜기(칸들, 얼굴칸, f"얼굴_{파일이름(배역)}", 출력, 1.0)
        if 여럿:
            판["얼굴"] += 나눠짜기(여럿, 얼굴칸, "얼굴_여럿", 출력, 1.0)

    if o.관문 == "마감":
        정지 = Path(o.그림).resolve() if o.그림 else 편 / "정지"
        if 정지.is_dir() or any(줄[c].get("시작그림") for c in 컷들):
            for c in 컷들:
                p, _ = 시작그림찾기(정지, c, 줄[c], 편)
                if p:
                    숫자[c]["엔진흔적"] = 엔진흔적(p)

    # ── 빛 튐 · 겹침 ──
    빛 = {c: 빛값(대표[c]) for c in 있는컷}
    for c in 있는컷:
        숫자[c]["밝기"], 숫자[c]["붉푸"] = 빛[c]
    튐 = []
    for i, c in enumerate(있는컷):
        이웃 = []
        if i > 0 and not 줄[c].get("시간건너뜀"):
            이웃.append(있는컷[i - 1])
        if i + 1 < len(있는컷) and not 줄[있는컷[i + 1]].get("시간건너뜀"):
            이웃.append(있는컷[i + 1])
        이웃 = [n for n in 이웃 if 줄[n].get("장면") == 줄[c].get("장면") and 시간대.get(n) == 시간대.get(c)]
        if not 이웃:
            continue
        db = 빛[c][0] - sum(빛[n][0] for n in 이웃) / len(이웃)
        dr = 빛[c][1] - sum(빛[n][1] for n in 이웃) / len(이웃)
        if abs(db) > 밝기문턱 or abs(dr) > 붉푸문턱:
            튐.append({"컷": c, "밝기차": round(db, 1), "붉푸차": round(dr, 3), "이웃": 이웃})
            숫자[c].setdefault("의심", []).append(f"같은 시간대 이웃보다 밝기 {db:+.0f} · 붉푸 {dr:+.2f}")
    지문들 = {c: 지문(첫장[c]) for c in 컷들 if 첫장.get(c) is not None}
    지문들 = {c: v for c, v in 지문들.items() if v is not None}
    겹침 = []
    키 = list(지문들)
    for i in range(len(키)):
        for j in range(i + 1, len(키)):
            a, b = 키[i], 키[j]
            d = bin(지문들[a] ^ 지문들[b]).count("1")
            if d > 겹침문턱:
                continue
            if (순서.index(b) == 순서.index(a) + 1 and 줄[b].get("이어찍기")) or 줄[a].get("같은판") or 줄[b].get("같은판"):
                continue  # 이어 찍기 · 한 판을 일부러 이어 쓴 컷(같은판: "<까닭>")
            겹침.append({"컷": [a, b], "거리": d})
            for x, y in ((a, b), (b, a)):
                숫자[x].setdefault("의심", []).append(f"{y}와 첫 장이 거의 같음(거리 {d}) — 같은 시작 그림?")

    # ── 도구 ──
    연속성출력 = 출력 / "연속성"
    if o.관문 == "굽기전":
        명령 = [sys.executable, "-I", "-X", "utf8", 연속성도구, 컷표]
        정지 = Path(o.그림).resolve() if o.그림 else 편 / "정지"
        그림지시문 = Path(o.그림지시문).resolve() if o.그림지시문 else 편 / "이미지지시문"
        꾸러미 = Path(o.꾸러미).resolve() if o.꾸러미 else 편 / "꾸러미"
        if 정지.is_dir():
            명령 += ["--그림", 정지]
        if 그림지시문.is_dir():
            명령 += ["--그림지시문", 그림지시문]
        else:
            못함.append(f"그림 지시문 폴더가 없다: {그림지시문}")
        if 꾸러미.is_dir():
            명령 += ["--지시문", 꾸러미]
        else:
            못함.append(f"꾸러미(영상 지시문) 폴더가 없다: {꾸러미}")
    else:
        명령 = [sys.executable, "-I", "-X", "utf8", 연속성도구, 컷표, "--영상", 최종]
    결과파일 = 연속성출력 / "결과.json"
    if 결과파일.exists():
        결과파일.unlink()
    코드, 나옴, 오류 = 돌리기(명령 + ["--출력", 연속성출력, "--json"])
    항목들 = []
    try:
        항목들 = json.loads(결과파일.read_text(encoding="utf-8")).get("항목", []) if 결과파일.exists() else json.loads(나옴)
    except (json.JSONDecodeError, AttributeError):
        못함.append(f"컷연속성검사 결과를 못 읽음(끝 코드 {코드}): {(오류 or 나옴).strip()[:200]}")
    편항목 = []
    for x in 항목들 if isinstance(항목들, list) else []:
        if not isinstance(x, dict) or x.get("등급") not in ("걸림", "확인"):
            continue  # 주의 · 알림은 판 안의 점 후보처럼 컷마다 나와 잡음이 크다 — 결과 파일에는 남는다
        c, 글 = str(x.get("컷")), f"{x.get('등급')} · {x.get('항목')} · {str(x.get('글'))[:200]}"
        if c in 숫자:
            숫자[c].setdefault("연속성", []).append(글)
        else:
            편항목.append(f"{c} · {글}")
    걸림 = sum(1 for x in 항목들 if isinstance(x, dict) and x.get("등급") == "걸림")
    확인 = sum(1 for x in 항목들 if isinstance(x, dict) and x.get("등급") == "확인")
    도구.append({"이름": "컷연속성검사", "끝코드": 코드, "요약": f"걸림 {걸림} · 확인 {확인}" + (f" · 오류 {오류.strip()[:160]}" if 코드 not in (0, 1, 2) else ""),
               "결과": str((연속성출력 / "결과.json").resolve())})
    if o.관문 == "마감":
        코드, 나옴, 오류 = 돌리기([sys.executable, "-X", "utf8", 끝판도구, 최종], 600)
        도구.append({"이름": "끝판검사", "끝코드": 코드, "요약": ("⚠ 끝에 납작한 판 — 끝 판을 눈으로" if "⚠" in 나옴 else "끝에 납작한 판 없음") if 코드 is not None else f"못 돌림 {오류[:160]}"})
        _, _, fps, _ = 영상정보(최종)
        시간 = dict(zip(순서, 컷시간(표)))
        사람컷 = [c for c in 컷들 if 줄[c].get("인물") and 시간.get(c, (None, None))[0] is not None and (시간[c][1] or 0) > 0.3]

        def 움직임재기(c):
            t, dur = 시간[c]
            쓸 = min(dur - 0.1, 움직임초)
            a, k = int(round((t + (dur - 쓸) / 2) * fps)), max(8, int(쓸 * fps))
            코드, 나옴, 오류 = 돌리기([sys.executable, "-X", "utf8", 사람움직임도구, 최종, a, k, "--이름", 파일이름(c)], 600)
            m = re.search(r"\{.*\}", 나옴 or "")
            try:
                return c, json.loads(m.group(0)) if m else {"못 잼": (나옴 or 오류).strip()[:160]}
            except json.JSONDecodeError:
                return c, {"못 잼": 나옴.strip()[:160]}

        with ThreadPoolExecutor(max_workers=4) as 일꾼:
            for c, r in 일꾼.map(움직임재기, 사람컷):
                숫자[c]["사람움직임"] = r
                사람값 = r.get("사람") if isinstance(r, dict) else None
                if 사람값 is None or 사람값 < 굳음 or "굳음" in str(r.get("판정", "")) or "눈으로" in str(r.get("판정", "")) or "멈춘" in str(r.get("판정", "")):
                    살펴볼.append(c)
        도구.append({"이름": "사람움직임", "끝코드": 0, "요약": f"사람 컷 {len(사람컷)} · 살펴볼 {len(살펴볼)}(0.12 아래 · 굳음 · 극접사 · 못 잼)"})

    # ── 쓰기 ──
    (출력 / "숫자.json").write_text(json.dumps({"관문": o.관문, "컷표": str(컷표), "최종": str(최종) if 최종 else "", "문턱": {"겹침": 겹침문턱, "밝기": 밝기문턱, "붉푸": 붉푸문턱, "사람": 굳음},
                                               "튐": 튐, "겹침": 겹침, "연속성_편": 편항목, "컷": 숫자}, ensure_ascii=False, indent=1), encoding="utf-8")
    판목록 = {
        "끝코드": 2 if 못함 else 0,
        "관문": o.관문, "편": str(편), "컷표": str(컷표), "최종": str(최종) if 최종 else "",
        "비율": (표.get("편") or {}).get("비율") or "",
        "컷": 컷목록, "기준": 기준목록, "판": 판,
        "숫자": str((출력 / "숫자.json").resolve()),
        "살펴볼움직임": 살펴볼, "도구": 도구, "못함": 못함,
    }
    (출력 / "판목록.json").write_text(json.dumps(판목록, ensure_ascii=False, indent=1), encoding="utf-8")
    그림수 = sum(len(c["그림"]) for c in 컷목록) + len(기준목록) + len(판["전체"]) + len(판["장면"]) + len(판["얼굴"]) + (1 if 판["끝"] else 0)
    print(f"판목록 {출력 / '판목록.json'}")
    print(f"{time.monotonic() - 시작시각:.0f}초 · 컷 {len(컷목록)} · 판 {그림수}장 · 튐 {len(튐)} · 겹침 {len(겹침)} · 살펴볼 움직임 {len(살펴볼)} · " + " · ".join(f"{d['이름']} {d['요약']}" for d in 도구))
    for m in 못함:
        print(f"  못함: {m}")
    return 판목록["끝코드"]


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
