# 지유 스킨케어 광고 · 본편과 훅 판 편집(영상판). 컷 길이·엔드카드·소리는 이미지콘티_가편집.py와 같고, 정지 그림 자리에 영상을 넣는다.
#   python 본편_편집.py [본편 훅B 훅C] [--비율 9:16,4:5,1:1] [--판 v1] [--색감 필름아침] [--부분보정 [0.2]] [--남기기 폴더] [--마스크만] [--컷7b]
#                       [--세트2 [--손]]   (--손: 손에 든 새 병 마지막 장면 + 로고 층 엔드카드 + 새 병 컷 2 · 6, 10-20)
#   --컷7b: 컷 7 자리에 사람을 작게 · 왼쪽에 둔 새 컷 7(영상_H3.py 7b)을 넣고 엔드카드를 9:16 글자 자리(y 269~1248 · x 65~920) 안에 둔다(10-19)
#   --색감: PULSE 공용 색감(../색감/색감.py LOOKS). 컷을 자른 뒤 입히고 병 접사는 색조만, 엔드카드 팩샷·글자는 그 위에 그대로(10-19)
#   --부분보정: 얼굴이 나오는 사람 컷(1·4·5·7·훅 C)은 색감 뒤에 「피부손」 마스크(얼굴·목 + 볼에 댄 손·팔) 안만 노출을 올린다
#     (기본 +0.2스톱, 10-19 v3c · Fable 「넣는다」). 마스크는 ../색감/부분보정.py 마스크_준비가 사람 손 없이 만든다(업스케일 프레임,
#     synk-vendor/…/색감/마스크/<컷>_피부손). 여러 판을 나란히 돌릴 땐 먼저 --마스크만으로 한 번 만들어 둔다(같은 폴더에 동시에 쓰지 않게)
#   --남기기: 인코딩 전 프레임 몇 장(KEEP_IDX)을 그 폴더에 PNG로 남긴다(풀어 본 색과 견주는 확인용)
#   인코딩(10-19 v3c): 1단계부터 bt709 행렬로 넣고 표시를 붙인다. 표시 없이 넣고 2단계에서 표시를 주면 ffmpeg가 601→709로 바꾸며
#     화면이 고르게 2~6단계 어두워졌다(v3b, 현장 노트 bt709 항목)
#   → Documents/synk-vendor/jiyu-skincare-20261018/편집/<판이름>_<비율>_<판>.mp4
# 납품(브리프 6절): 본편 9:16·4:5·1:1, 훅 B·C는 9:16만. 비율 판은 같은 원본에서 자르고 병·글자는 비율마다 다시 놓는다.
# 그림 고르는 순서(컷마다 있는 것 가운데 앞의 것):
#   사람·솜 컷: 영상_H3/업/<컷>/*.png(영상_다듬기.py, 1080×1920) → 영상_H3/구간/<컷>.mp4(756×1344을 키움) → 키프레임 정지 그림
#   병 컷: 블렌더/최종/<컷>_*.png → 블렌더/중간/<컷>_*.png
# 엔드카드: 블렌더 팩샷 + 글자(14.0초 타격, 가편집과 같은 겹). 훅 B·C는 첫 2초에 얹는 글자를 넣는다(브리프 3절 훅 표).
# 소리: 음악(음악_15초.py) + 내레이션 세 줄 + 효과음(효과음_목록.json). 끝에 -14 LUFS로 맞추고 봉우리를 누른다.
# 색 맞춤·입자는 후반 한 번(브리프 1절 질감): 아주 옅은 시간 입자만 넣는다.
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "색감"))
import 이미지콘티_가편집 as 가편집  # noqa: E402  엔드카드 겹(end_layer·with_end)과 경로를 같이 쓴다
import 색감  # noqa: E402  PULSE 공용 색감(--색감 이름). 컷을 자른 뒤·엔드카드와 글자를 얹기 전에 입힌다
import 부분보정  # noqa: E402  마스크 안만 손보기(--부분보정)

V = 가편집.V
K = 가편집.K
N = 가편집.N
H3 = os.path.join(V, "영상_H3")
BLF = os.path.join(V, "블렌더", "최종")
BLM = os.path.join(V, "블렌더", "중간")
PACK_DIR = BLF  # 엔드카드 팩샷(투명 바탕)은 세트와 상관없이 이 폴더
OUT = os.path.join(V, "편집")
MUSIC = os.path.join(V, "음악", "지유_음악_15초_A1.wav")
SFX = os.path.join(HERE, "효과음_목록.json")  # 배치표는 저장소, 소리 파일은 synk-vendor/…/효과음/
W, H, FPS = 1080, 1920, 24
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
SUIT_M = os.path.join(ROOT, "docs", "브랜드_폰트", "SUIT", "SUIT-Medium.otf")
INK = (52, 52, 50)
MASKS = os.path.join(V, "색감", "마스크")  # 부분 보정 마스크 보관(컷마다 <컷>_피부손)
FACE_CUTS = ("컷1", "컷4", "컷5", "컷7", "컷7b", "훅C")  # 얼굴이 나오는 사람 컷(컷 3 솜은 사람 없음)
KEEP_IDX = (24, 72, 168, 216, 312, 350)  # --남기기로 남길 프레임 번호(Fable 검수와 같은 자리 + 72)
TO_709 = "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"  # rgb → bt709 YUV(1단계)
BT709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
         "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709"]

# 사람·솜 컷의 정지 그림(영상이 아직 없을 때 대신 쓴다)
STILL = {"컷1": "컷1_v3.jpg", "컷3": "컷3_시작_창.jpg", "컷4": "컷4_v4_틀.jpg", "컷5": "컷5_v3b_틀.jpg",
         "컷7": "컷7_v6b_틀.jpg", "컷7b": "컷7_v7_틀.jpg", "훅C": "훅C_틀.jpg"}
# (시작초, 끝초, 종류:이름) — 사람: 영상_H3 컷, 병: 블렌더 컷
BODY = [(4.0, 6.0, "사람:컷3"), (6.0, 8.0, "사람:컷4"), (8.0, 10.0, "사람:컷5"), (10.0, 12.0, "병:컷6"), (12.0, 15.0, "사람:컷7")]
EDITS = {
    "본편": {"head": [(0.0, 2.0, "사람:컷1"), (2.0, 4.0, "병:컷2")], "line1": 0.3, "text": None},
    # 훅 B: 병 0–2(물방울은 2.0 직전에 흘러내림) → 지유 2–4, 내레이션 첫 줄은 지유 컷으로.
    # 글자: 병 접사는 위쪽을 뚜껑이, 아래쪽을 라벨이 차지해 창 쪽(왼쪽) 위 흐린 벽에 두 줄로
    "훅B": {"head": [(0.0, 2.0, "병:컷2"), (2.0, 4.0, "사람:컷1")], "line1": 2.3,
            "text": (["약산성", "무향 토너"], "la", (72, 210))},
    # 훅 C: 수건 컷은 머리가 위 끝에 붙어 위쪽 글자 자리가 없다 → 머리카락 끝(1650쯤) 아래 흰 티 위
    "훅C": {"head": [(0.0, 2.0, "사람:훅C"), (2.0, 4.0, "병:컷2")], "line1": 0.3,
            "text": (["세안 후 3초, 토너부터"], "mm", (540, 1740))},
}
# 비율: 9:16 원본에서 잘라 낸다. 사람 컷은 가운데 자르기면 머리가 잘린다 → 헤어밴드 윗선(1080×1920 기준 컷 1 약 170,
# 컷 4 약 130, 컷 5 약 160, 컷 7 약 310, 정지 그림에서 잼) 위로 70px쯤 남기고 자른다. 병 컷 2는 라벨까지 들어오게 아래로.
RATIOS = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080)}
CROP_Y = {
    "9:16": {},
    # 4:5 컷 2: 470은 뚜껑 위와 「MALGEUM」 아래가 반씩 잘렸다(10-19 Fable) → 560(뚜껑은 밖, 라벨 두 줄 온전)
    # 컷7b(헤어밴드 윗선 약 390): 4:5 · 1:1 모두 310에서 자르면 머리 위 여백 80px, 병 · 글자는 9:16과 같은 벽 자리에 온다
    "4:5": {"사람": 200, "컷1": 100, "컷4": 60, "컷5": 90, "컷7": 200, "컷7b": 310, "컷2": 560, "컷3": 285, "컷6": 285},
    "1:1": {"사람": 230, "컷1": 100, "컷4": 60, "컷5": 90, "컷7": 230, "컷7b": 310, "컷2": 700, "컷3": 420, "컷6": 420},
}
# 엔드카드 자리(자른 화면 좌표): 9:16은 가편집과 같다. 1:1은 병을 줄이고 올려 글자까지 들어오게
END_LAYOUTS = {
    "9:16": 가편집.END_LAYOUT,
    # 4:5: -200은 글줄 아래 여백이 19px라 잘린 것처럼 보였다(10-19 Fable) → -300
    "4:5": {**가편집.END_LAYOUT, "bottle_bottom": 가편집.END_LAYOUT["bottle_bottom"] - 300},
    "1:1": {**가편집.END_LAYOUT, "bottle_h": 340, "bottle_bottom": 760, "text_w": 260},
}
# 컷7b 엔드카드(--컷7b): 사람 팔 바깥선 x≈565 오른쪽 그늘 벽 가슴 높이에 병, 그 아래 글자. 9:16 겹 범위 x 642~897 · y 670~1238
# (정지 그림 시안, 글자 자리 y 269~1248 · x 65~920 안). 4:5 · 1:1은 같은 벽 자리를 자른 화면 좌표로(310 위로 올림).
# 병 330px: 사람이 0.95배 → 0.58배로 작아졌는데 병을 400px로 두면 병/머리가 v3c 0.72 → 1.14로 뒤집혀 붙인 그래픽으로 읽혔다
# (10-19 Fable P2) → 머리의 0.94배. 400px 판은 편집/v3d_시안/병크기_비교.jpg
_L7B = {"cx": 770, "bottle_h": 330, "bottle_bottom": 1000, "text_gap": 36, "text_w": 280, "appear": 14.0}
END_LAYOUTS_7B = {"9:16": _L7B, "4:5": {**_L7B, "bottle_bottom": 1000 - 310}, "1:1": {**_L7B, "bottle_bottom": 1000 - 310}}

# 세트 2(--세트2, 10-19 유호님 「배경이 너무 휑하다 … 제대로 좋은 화장실처럼」 → A안 「호텔 욕실」로 전체 다시):
# 사람 · 솜 컷은 키프레임_세트2로 뽑은 H3(<컷>_세트2), 병 컷 2 · 6은 블렌더 --set 2(최종_세트2, 없으면 미리보기_세트2),
# 엔드카드 팩샷은 그대로. 글자는 그레이지 벽에서 대비가 떨어져(Fable: 6.1 → 4.2:1) 따뜻한 차콜(라벨.py --세트2).
# 엔드카드는 세면대 끝선(9:16 y≈1280) 위 · 글자 자리(y 269~1248 · x 65~920) 안, 사람은 왼쪽 55% 안(x≤594).
# 훅 B · C 글자도 글자 자리 안으로(v3c는 y 210 · 1740이라 플랫폼 머리글 · 캡션에 걸렸다): 훅 C는 머리 위 회벽에.
S2 = {"컷1": "컷1_세트2", "컷3": "컷3_세트2", "컷4": "컷4_세트2", "컷5": "컷5_세트2", "컷7": "컷7_세트2", "훅C": "훅C_세트2"}
K2 = os.path.join(V, "키프레임_세트2")
BLF2, BLM2 = os.path.join(V, "블렌더", "최종_세트2"), os.path.join(V, "블렌더", "미리보기_세트2")
STILL2 = {"컷1_세트2": os.path.join(K2, "컷1_틀.jpg"), "컷3_세트2": os.path.join(K2, "컷3_시작_창.jpg"),
          "컷4_세트2": os.path.join(K2, "컷4_틀.jpg"), "컷5_세트2": os.path.join(K2, "컷5_틀.jpg"),
          "컷7_세트2": os.path.join(K2, "컷7_틀.jpg"), "훅C_세트2": os.path.join(K2, "훅C_틀.jpg")}
# 비율 판 자르기(정지 그림에서 헤어밴드 윗선 − 70px 안팎, 컷 3은 솜이 아래 가운데에): 영상이 나오면 남긴 프레임으로 다시 본다
# 10-20 Fable 2차(v4 프레임으로 잼): 컷 1 정수리 위 여백이 32px뿐이라 130 → 95, 1:1 컷 2는 「MALGEUM」(y 1820~1879)이
# 밖이라 810(병 컷 이름은 세트 1과 같아 use_set2에서 바꾼다)
CROP_Y["4:5"].update({"컷1_세트2": 95, "컷3_세트2": 430, "컷4_세트2": 80, "컷5_세트2": 160, "컷7_세트2": 430})
CROP_Y["1:1"].update({"컷1_세트2": 95, "컷3_세트2": 590, "컷4_세트2": 80, "컷5_세트2": 160, "컷7_세트2": 440})
# 엔드카드 그림자: 세트 2 회벽에선 0.14가 −12단계라 살짝 떠 보임(Fable 2차) → 0.19(노린 15~20단계)
_LS2 = {"cx": 770, "bottle_h": 330, "bottle_bottom": 930, "text_gap": 36, "text_w": 280, "appear": 14.0, "shadow": 0.19}
END_LAYOUTS_S2 = {"9:16": _LS2, "4:5": {**_LS2, "bottle_bottom": 930 - 430}, "1:1": {**_LS2, "bottle_bottom": 930 - 440}}
HOOK_TEXT_S2 = {"훅B": (["약산성", "무향 토너"], "la", (72, 300)), "훅C": (["세안 후 3초, 토너부터"], "mm", (540, 380))}


def use_set2():
    """--세트2: 사람 · 솜 컷 이름을 세트 2로, 병 컷 폴더 · 엔드카드 자리 · 글자색 · 훅 글자 자리를 세트 2로(한 번만 부른다)."""
    global FACE_CUTS, BLF, BLM

    def s2(src):
        kind, name = src.split(":")
        return f"{kind}:{S2.get(name, name)}" if kind == "사람" else src
    for e in EDITS.values():
        e["head"] = [(a, b, s2(s)) for a, b, s in e["head"]]
    BODY[:] = [(a, b, s2(s)) for a, b, s in BODY]
    for e, spec in HOOK_TEXT_S2.items():
        EDITS[e]["text"] = spec
    STILL.update(STILL2)
    FACE_CUTS = FACE_CUTS + tuple(S2[c] for c in ("컷1", "컷4", "컷5", "컷7", "훅C"))
    END_LAYOUTS.update(END_LAYOUTS_S2)
    CROP_Y["1:1"]["컷2"] = 810  # 병 컷 이름은 세트 1과 같아 여기서만(세트 1 판은 그대로 700)
    BLF, BLM = BLF2, BLM2
    가편집.ECTEXT = os.path.join(V, "블렌더", "엔드카드글자_malgeum_세트2.png")


# 손에 든 병(--손, --세트2 뒤에, 10-20 유호님 「맑음 병 CG가 너무 촌스러운데 트렌디하게」 → 「손에 든 병」 · 「병도 새로」):
# 컷 7을 지유가 새 병을 볼 옆에 든 장면(컷7손_세트2)으로 바꾸고, 엔드카드는 벽에 띄운 병 그림 없이 위쪽 벽 왼쪽 로고 · 문구 층만
# (엔드카드_손.py, 하린 MORU C안 자리). 병 컷 2 · 6은 새 병(블렌더 --bottle 2) 폴더
BLF3 = os.path.join(V, "블렌더", "최종_세트2_병2")
HAND = "컷7손_세트2"
HAND_LAYER = {}
HAND_APPEAR, HAND_DUR, HAND_RISE = 14.0, 0.4, 12  # 후반 가이드 3절: 0.4초 동안 12px 올라오며(easeOutQuint)


def use_hand():
    global FACE_CUTS, BLF
    import 엔드카드_손 as hand
    BODY[-1] = (12.0, 15.0, f"사람:{HAND}")
    FACE_CUTS = FACE_CUTS + (HAND,)
    # 자르기(10-20 Fable 시뮬): 4:5는 위 230~460, 1:1은 280~460이어야 머리 · 병이 같이 든다(0이면 병 바닥 y≈1300이 잘림)
    CROP_Y["4:5"][HAND], CROP_Y["1:1"][HAND] = 230, 340
    STILL[HAND] = os.path.join(K2, "컷7손_틀.jpg")
    BLF = BLF3
    for ratio in RATIOS:
        HAND_LAYER[ratio] = hand.lockup_for(ratio)


def hand_end(im, ratio, t):
    """로고 층을 14.0초부터 0.4초 동안 12px 올라오며(빠르게 나와 천천히 멈춤) 얹는다."""
    p = (t - HAND_APPEAR) / HAND_DUR
    if p <= 0:
        return im
    e = 1 - (1 - min(1.0, p)) ** 5
    lay = HAND_LAYER[ratio].copy()
    lay.putalpha(lay.getchannel("A").point(lambda v: int(v * e)))
    base = im.convert("RGBA")
    base.alpha_composite(lay, (0, round((1 - e) * HAND_RISE)))
    return base.convert("RGB")


def numbered(folder, prefix=""):
    """<prefix><숫자>.png만 번호 순으로(블렌더 제품 교체판 「컷2_soom_0001.png」 같은 이름은 뺀다)."""
    pat = re.compile(re.escape(prefix) + r"(\d+)\.png$")
    files = [(int(m.group(1)), f) for f in glob.glob(os.path.join(folder, "*.png"))
             if (m := pat.fullmatch(os.path.basename(f)))]
    return [f for _, f in sorted(files)]


def fit(im):
    s = W / im.width
    im = im.resize((W, round(im.height * s)), Image.LANCZOS)
    top = (im.height - H) // 2
    return im.crop((0, top, W, top + H))


def read_video(path, n):
    """mp4를 1080×1920 프레임으로(폭을 1080에 맞춰 키우고 가운데 9:16)."""
    p = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vf",
                          f"scale={W}:-2:flags=lanczos,crop={W}:{H}", "-frames:v", str(n), "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stdin=subprocess.DEVNULL)
    size = W * H * 3
    for _ in range(n):
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield Image.frombytes("RGB", (W, H), buf)
    p.stdout.close()
    p.wait()


def source(kind, name, n):
    """길이 n의 1080×1920 프레임을 차례로 낸다. 모자라면 마지막 프레임을 늘인다."""
    if kind == "사람":
        # SeedVR2 CLI는 <출력>/<입력 이름>/<입력 이름>_000000.png로 쓴다(영상_다듬기.py의 입력 이름 = 컷 이름)
        up = numbered(os.path.join(H3, "업", name, name), f"{name}_")
        clip = os.path.join(H3, "구간", f"{name}.mp4")
        if up:
            gen, what = (fit(Image.open(f).convert("RGB")) for f in up[:n]), f"업스케일 {len(up)}장"
        elif os.path.exists(clip):
            gen, what = read_video(clip, n), "구간 영상(키우기 전)"
        else:
            gen, what = iter([fit(Image.open(os.path.join(K, STILL[name])).convert("RGB"))]), "정지 그림"
    else:
        fin = numbered(BLF, f"{name}_")
        files = fin or numbered(BLM, f"{name}_")
        gen, what = (fit(Image.open(f).convert("RGB")) for f in files[:n]), ("블렌더 최종" if fin else "블렌더 중간")
    print(f"  {name}: {what}", flush=True)
    last, made = None, 0
    for im in gen:
        if made >= n:
            break
        last, made = im, made + 1
        yield im
    for _ in range(n - made):
        yield last


def text_layer(spec, size):
    """훅 글자 겹: 짙은 글자(창 쪽 흰 글자 금지), SUIT Medium 62px, 줄 간격 1.3."""
    lines, anchor, (x, y) = spec
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(SUIT_M, 62)
    for i, line in enumerate(lines):
        d.text((x, y + i * 80), line, font=font, fill=INK + (255,), anchor=anchor)
    return layer


def crop_y(kind, name, ratio, h):
    table = CROP_Y[ratio]
    y = table.get(name, table.get(kind, (H - h) // 2))
    return max(0, min(H - h, y))


def face_masks(edit, lift):
    """부분 보정 마스크 폴더 {컷: 폴더}. 얼굴이 나오는 사람 컷 가운데 업스케일 프레임이 있는 컷만(마스크와 같은 프레임이어야 함).
    「피부손」 = 얼굴 · 목 + 볼에 댄 손 · 팔(10-19 지유 시험, Fable 「컷4·훅C는 손까지」). 있던 마스크가 같은 주문 · 같은 원본이면 그대로 쓴다."""
    out = {}
    if not lift:
        return out
    for start, end, src in EDITS[edit]["head"] + BODY:
        kind, name = src.split(":")
        up = os.path.join(H3, "업", name, name)
        if kind == "사람" and name in FACE_CUTS and numbered(up, f"{name}_"):
            n = round((end - start) * FPS)
            out[name] = 부분보정.마스크_준비(up, 0, n, "피부손", os.path.join(MASKS, f"{name}_피부손"))
    return out


def frames(edit, ratio, look=None, lift=0.0):
    w, h = RATIOS[ratio]
    plan = EDITS[edit]["head"] + BODY
    masks = face_masks(edit, lift)
    pack = numbered(PACK_DIR, "컷7팩샷_")
    pack_path = pack[0] if pack else None
    if look and pack_path:  # 엔드카드 병도 컷 6 병과 같은 색조로(안 하면 2초 사이 병 색이 달랐다, 10-19 Fable P2). 글자는 그대로
        rgba = Image.open(pack_path).convert("RGBA")
        graded = 색감.grade(rgba.convert("RGB"), look, product=True).convert("RGBA")
        graded.putalpha(rgba.getchannel("A"))
        # 판마다 따로(여러 판을 나란히 돌리면 같은 임시 파일을 겹쳐 쓰다 덜 쓴 파일을 읽을 수 있다)
        pack_path = os.path.join(tempfile.gettempdir(), f"_jiyu_pack_{look}_{os.getpid()}.png")
        graded.save(pack_path)
    layer = 가편집.end_layer(END_LAYOUTS[ratio], (w, h), pack_path)
    spec = EDITS[edit]["text"]
    text = text_layer(spec, (w, h)) if spec and ratio == "9:16" else None
    for start, end, src in plan:
        kind, name = src.split(":")
        n = round((end - start) * FPS)
        y0 = crop_y(kind, name, ratio, h)
        for i, im in enumerate(source(kind, name, n)):
            t = start + i / FPS
            im = im.crop((0, y0, w, y0 + h))
            if look:  # 병 접사는 색조만(라벨이 지워지지 않게), 엔드카드 팩샷·글자는 아래에서 그대로 얹는다
                im = 색감.grade(im, look, product=(kind == "병"))
            if name in masks:  # 부분 보정: 마스크 안만 노출(선형 빛). 비율 판은 마스크도 그림과 같은 자리로 자른다
                im = 부분보정.밝히기(im, 부분보정.마스크(masks[name], i)[y0:y0 + h], lift)
            if name in ("컷7", "컷7b", "컷7_세트2"):
                im = 가편집.with_end(im, layer, min(1.0, max(0.0, (t - END_LAYOUTS[ratio]["appear"]) / 0.15)))
            elif name == HAND:
                im = hand_end(im, ratio, t)
            if text is not None and t < 2.0:
                a = min(1.0, t / 0.15, max(0.0, (2.0 - t) / 0.15))  # 0.15초에 들어와 1.85초부터 빠진다
                lay = text.copy()
                lay.putalpha(lay.getchannel("A").point(lambda v: int(v * a)))
                base = im.convert("RGBA")
                base.alpha_composite(lay)
                im = base.convert("RGB")
            yield im


def audio_args(edit):
    """소리 입력과 섞기 필터(내레이션 + 음악 + 효과음, 15초로 못 박음)."""
    lines = [("1_세안하고.wav", EDITS[edit]["line1"]), ("2_피부가먼저.wav", 6.0), ("3a_말금.wav", 12.6)]
    args, filt, labels = [], [], []
    k = 0
    for f, t in lines:
        args += ["-i", os.path.join(N, f)]
        ms = int(t * 1000)
        filt.append(f"[{k}:a]aresample=48000,adelay={ms}|{ms}[n{k}]")
        labels.append(f"[n{k}]")
        k += 1
    args += ["-i", MUSIC]
    filt.append(f"[{k}:a]aresample=48000,volume=0.35[m]")
    labels.append("[m]")
    k += 1
    if os.path.exists(SFX):
        for s in json.load(open(SFX, encoding="utf-8")):
            if edit not in s.get("edits", [edit]):
                continue
            t = s["at"] + s.get("shift", {}).get(edit, 0)
            args += ["-i", os.path.join(V, "효과음", s["file"])]
            ms = int(t * 1000)
            filt.append(f"[{k}:a]aresample=48000,volume={s.get('gain', 1.0)},adelay={ms}|{ms}[s{k}]")
            labels.append(f"[s{k}]")
            k += 1
    # 무음 채우기는 길이를 못 박는다(apad=whole_dur) — 끝없는 apad는 ffmpeg가 멈췄다(현장 노트, 10-18)
    filt.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur=15,atrim=0:15[mix]")
    return args, filt


def loudness(path):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, stdin=subprocess.DEVNULL)
    err = r.stderr.decode("utf-8", "ignore")
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", err)
    return (float(i[-1]) if i else None), (float(p[-1]) if p else None)


def mix_audio(edit, tmp):
    """섞고 -14 LUFS로 맞춘 뒤 봉우리를 누른다(누른 뒤 다시 재서 한 번 더 맞춤)."""
    raw = os.path.join(tmp, "a_raw.wav")
    a_args, a_filt = audio_args(edit)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *a_args, "-filter_complex", ";".join(a_filt),
                    "-map", "[mix]", "-ar", "48000", "-ac", "2", raw], check=True, stdin=subprocess.DEVNULL)
    gain = 0.0
    out = os.path.join(tmp, "a.wav")
    for _ in range(2):
        lufs, _ = loudness(raw if gain == 0.0 else out)
        gain += -14.0 - lufs if lufs is not None else 0.0
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-af",
                        f"volume={gain:.2f}dB,alimiter=limit=0.79:level=false", "-ar", "48000", out],
                       check=True, stdin=subprocess.DEVNULL)
    return out


def render(edit, ratios, tag, look=None, lift=0.0, keep=None):
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    audio = mix_audio(edit, tmp)
    outs = []
    for ratio in ratios:
        if edit != "본편" and ratio != "9:16":
            print(f"{edit} {ratio}: 납품 목록에 없음(훅 판은 9:16만) — 건너뜀", flush=True)
            continue
        w, h = RATIOS[ratio]
        print(f"{edit} {ratio}: 그림", flush=True)
        video = os.path.join(tmp, f"v_{ratio.replace(':', 'x')}.mp4")
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                                "-r", str(FPS), "-i", "-", "-vf", TO_709, "-c:v", "libx264", "-crf", "14", "-preset", "slow",
                                *BT709, video], stdin=subprocess.PIPE)
        count = 0
        for im in frames(edit, ratio, look, lift):
            if keep and count in KEEP_IDX:
                os.makedirs(keep, exist_ok=True)
                im.save(os.path.join(keep, f"{edit}_{ratio.replace(':', 'x')}_{tag}_f{count:03d}.png"))
            enc.stdin.write(im.tobytes())
            count += 1
        enc.stdin.close()
        if enc.wait() != 0:
            raise SystemExit("영상 인코딩 실패")
        out = os.path.join(OUT, f"{edit}_{ratio.replace(':', 'x')}_{tag}.mp4")
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", video, "-i", audio,
                        "-vf", "noise=c0s=3:c0f=t", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "18",
                        "-preset", "slow", "-pix_fmt", "yuv420p",
                        # 색 공간 태그(10-19 Fable P3): 없으면 플레이어마다 색을 다르게 읽을 수 있다.
                        # -color_primaries·-color_trc만으로는 noise 필터 뒤 원색·감마가 unknown으로 남아 x264 VUI로 박는다.
                        # 1단계가 이미 bt709라 여기서는 색 변환 없이 입자만 얹는다(v3c)
                        *BT709,
                        "-c:a", "aac", "-b:a", "192k", "-t", "15",
                        "-movflags", "+faststart", out], check=True, stdin=subprocess.DEVNULL)
        i, p = loudness(out)
        print(f"  프레임 {count}장 → {out} ({i} LUFS, 봉우리 {p} dBFS)", flush=True)
        outs.append(out)
    return outs


if __name__ == "__main__":
    args = sys.argv[1:]
    ratios = ["9:16"]
    tag = "v1"
    if "--비율" in args:
        ratios = args[args.index("--비율") + 1].split(",")
    if "--판" in args:
        tag = args[args.index("--판") + 1]
    look = args[args.index("--색감") + 1] if "--색감" in args else None  # 색감.LOOKS 이름(없으면 v2처럼 그대로)
    lift = 0.0
    if "--부분보정" in args:  # 값을 안 주면 +0.2스톱(README: 0.25 이하)
        nxt = args[args.index("--부분보정") + 1] if args.index("--부분보정") + 1 < len(args) else ""
        lift = float(nxt) if re.fullmatch(r"\d+(\.\d+)?", nxt) else 0.2
    keep = args[args.index("--남기기") + 1] if "--남기기" in args else None
    if "--컷7b" in args:  # 새 컷 7(사람 작게 · 왼쪽)과 그 엔드카드 자리
        BODY[-1] = (12.0, 15.0, "사람:컷7b")
        END_LAYOUTS.update(END_LAYOUTS_7B)
    if "--세트2" in args:  # 새 욕실(세트 2)로 사람 · 솜 · 병 컷을 모두 바꾼다
        use_set2()
    if "--손" in args:  # 손에 든 새 병 마지막 장면 + 로고 층 엔드카드 + 새 병 컷(세트 2 위에)
        use_hand()
    edits = [a for a in args if a in EDITS] or ["본편"]
    if "--마스크만" in args:  # 여러 판을 나란히 돌리기 전에 마스크만 한 번(같은 폴더에 동시에 쓰지 않게)
        for e in edits:
            print(e, face_masks(e, lift or 0.2), flush=True)
        raise SystemExit
    for e in edits:
        render(e, ratios, tag, look, lift, keep)
