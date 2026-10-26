# 4번 이미지 콘티 배치도(2026-10-26) — Gemini에 원본 프레임 대신 넣는 그림. 원본 모델의 얼굴 · 몸 · 옷이 옮겨 오지 않게
# 사람은 검은 실루엣으로 바꾸고 바탕은 크게 흐려 빛 · 구도만 남긴다(만족 사례 장부 S31 「매진 임박」 v4 · 6번 · 8번 배치도와 같은 방식).
#   python -X utf8 이미지콘티_배치도.py      → 콘티/p4/원본첫프레임/C02.jpg … · 콘티/p4/배치/C02.png …(1456×816) · 배치/_한눈.jpg
# 원본 프레임이 들어가므로 산출은 git 밖에만 둔다. 사람 분할은 rembg u2net_human_seg.
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

SRC = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/레퍼런스/p4/원본영상/hq_-3diA4kU9PM/hq_-3diA4kU9PM.mp4"
P4 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p4")
FR, OUT = P4 / "원본첫프레임", P4 / "배치"
FONT = r"C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf"
W, H = 1456, 816
INK = 18

# 컷 번호 → (프레임을 뽑을 원본 초, 사람 실루엣을 잡을지). 시각은 01_샷표_원본 2절(컷 시작 + 0.1초 안팎, 8은 가장 밝은 3.88초).
CUTS = {
    "C02": (0.60, False), "C03": (2.17, False), "C04": (2.29, False), "C05": (2.38, False), "C06": (2.52, False),
    "C07": (2.80, False), "C08": (3.88, True), "C09": (4.70, False), "C11": (5.40, True), "C12": (6.60, True),
    "C13": (6.75, True), "C14": (6.95, True), "C15": (7.20, True), "C16": (8.10, False), "C17": (8.90, True),
    "C18": (9.85, False), "C19": (10.50, False), "C20": (11.40, True), "C21": (12.25, True), "C21e": (13.25, True),
    "C22": (13.60, True), "C23": (15.20, True), "C24": (15.70, True), "C25": (16.30, True), "C26": (17.40, True),
    "C27": (19.10, False), "C28": (20.30, True), "C29": (21.80, False), "C30": (22.80, True), "C32": (24.50, True),
    "C33": (25.05, True), "C34": (25.60, True), "CEND": (66.00, False),
}


def frame(cap, fps, t):
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
    ok, f = cap.read()
    if not ok:
        raise RuntimeError(f"프레임 못 읽음 {t}")
    return Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))


def main():
    FR.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    from rembg import new_session, remove
    sess = new_session("u2net_human_seg")
    cap = cv2.VideoCapture(SRC)
    fps = cap.get(cv2.CAP_PROP_FPS)
    thumbs = []
    meta = {}
    for cid, (t, person) in CUTS.items():
        im = frame(cap, fps, t)
        im.save(FR / f"{cid}.jpg", quality=92)
        small = im.resize((W, H), Image.LANCZOS)
        # 바탕: 크게 흐려 빛 · 색 덩어리만(원본 장소 · 물건의 생김새가 옮겨 오지 않게)
        bg = small.filter(ImageFilter.GaussianBlur(28))
        if person:
            m = remove(small, session=sess, only_mask=True)
            m = np.array(m.convert("L")) > 110
            share = float(m.mean())
            arr = np.array(bg)
            arr[m] = INK
            out = Image.fromarray(arr)
        else:
            share = 0.0
            out = bg
        out.save(OUT / f"{cid}.png")
        meta[cid] = {"t": t, "person": person, "person_share": round(share, 3)}
        thumbs.append((cid, out))
    cap.release()
    (OUT / "_배치.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    # 한눈 판
    tw, th = 364, 204
    cols = 6
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * th), (30, 30, 30))
    d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype(FONT, 20)
    for k, (cid, im) in enumerate(thumbs):
        x, y = (k % cols) * tw, (k // cols) * th
        sheet.paste(im.resize((tw, th)), (x, y))
        d.text((x + 6, y + 4), f"{cid} 사람 {meta[cid]['person_share']:.0%}", fill=(255, 220, 0), font=f)
    sheet.save(OUT / "_한눈.jpg", quality=85)
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
