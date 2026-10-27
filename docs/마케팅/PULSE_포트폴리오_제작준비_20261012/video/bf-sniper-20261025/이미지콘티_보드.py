# 블프 스나이퍼 이미지 콘티 보드 · 애니매틱(2026-10-26) — 고른 정지컷(정지컷/_고른판.json)에 화면 글을 합성해
#   ① 보드 넉 장: 줄마다 「원본 대표 프레임 | 우리 판 | 초 · 화면 · 말 · 소리」(원본 프레임이 들어가 git 밖에만 둔다)
#   ② 한눈 판: 우리 판 20컷
#   ③ 애니매틱 7판: 원본 20컷 초대로 이은 32.15초(낯선이 시험용) · 말_7.txt
#   python -X utf8 이미지콘티_보드.py
# 글 합성은 이야기스케치/애니매틱_6.py의 글판 · 꼬리표 · 전단 · 알림 · 끝 카드와 같은 꼴(02_콘티 1절의 화면 글).
import json
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

V = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/"
FONT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf"
FONT_B = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf"
W, H = 1920, 1080
BRAND = "느지막"
AMBER = (214, 120, 40)
picked = json.load(open(V + "정지컷/_고른판.json", encoding="utf-8")) if os.path.exists(V + "정지컷/_고른판.json") else {}

# (#, 시작, 끝, 우리 판 id, 화면 글, 원본 대표 프레임, 보드 글)
SHOTS = [
    (1, 0.00, 1.00, None, ("title",), None, "검은 화면 + 「작전명: 블프」 · 속삭임 「작전명… 블프.」"),
    (2, 1.00, 2.68, "S02", ("cal", "D-7", "27일 00:00 블프 · 75인치 TV 반값"), "K02", "달력 「2026년 11월」 — 20일에 X · 음악 시작 · 펜"),
    (3, 2.68, 5.27, "S03", ("drill", "체력", "tv"), "K03", "TV 자리 벽 앞 바닥 윗몸일으키기 · 입 다문 숨"),
    (4, 5.27, 7.61, "S04", ("drill", "엄지 근력", None), "K04", "링 라이트 원 너머 휴대폰 아령 → 로봇 청소기에 목례"),
    (5, 7.61, 8.61, "S05", ("cal", "D-3", None), "K05", "달력 24일 X(원본 간격 D-3) · 펜"),
    (6, 8.61, 10.45, "S06", ("drill", "장비 점검", None), "K06", "작전 책상 — 앞에 알람 셋 트로피, 뒤에서 화면 셋 줄 맞춤"),
    (7, 10.45, 13.80, "S07", None, "K07", "현관 전단(가슴 높이) · 돋보기를 벗음 · 속마음 「반값…」"),
    (8, 13.80, 15.09, "S08", ("drill", "보급", None), "K08", "선반 휙 팬 · 헤드셋 준호"),
    (9, 15.09, 16.72, "S09", ("drill", "위장", None), "K09", "욕실 거울 위장 줄 · 속마음 「이번엔… 이긴다.」"),
    (10, 16.72, 17.23, "S10", ("drill", "반응 속도", None), "K10", "초시계 엄지 · 삑"),
    (11, 17.23, 17.90, "S11", ("drill", "반응 속도", None), "K11", "화면빛 얼굴 — 집중"),
    (12, 17.90, 18.94, "S12", ("drill", "광클", None), "K12", "광클 번짐 · 딸깍딸깍"),
    (13, 18.94, 19.40, "S13", ("cal", "D-2", None), "K13", "달력 25일 · 펜"),
    (14, 19.40, 20.70, "S14", ("drill", "저격 자세", None), "K14", "담요 위장 저격 자세"),
    (15, 20.70, 21.37, "S15", ("cal", "D-1", None), "K15", "달력 26일 X · 펜"),
    (16, 21.37, 23.04, "S16", ("drill", "호흡", None), "K16", "탁상시계 탁 · 「들이쉬고…」"),
    (17, 23.04, 25.30, "S17", ("drill", "호흡", None), "K17", "링 라이트 원 팔 벌림 · 「반 내쉬고…」"),
    (18, 25.30, 26.17, "S18", ("cal", "D-DAY", None), "K18", "달력 27일 동그라미 · 「멈추고…」"),
    (19, 26.17, 31.11, "S19b", ("noti",), "K19", "00:00 밤 거실을 옆으로 따라가 27.0 잠든 준호 · 알림 27.1 · 음악 · 알람 뚝 27.6 · 드르렁 · 가게 목소리 28.3 · 끝 카드 29.1"),
    (20, 31.11, 32.15, None, None, None, "검은 화면 · 코골이"),
]
# 애니매틱 칸(시작, 끝, 우리 판 id, 글, 자막) — 19번은 셋으로 나눈다
SEGS = [
    (0.00, 1.00, None, ("title",), "(속삭임) 작전명… 블프."),
    (1.00, 2.68, "S02", ("cal", "D-7", "27일 00:00 블프 · 75인치 TV 반값"), None),
    (2.68, 5.27, "S03", ("drill", "체력", "tv"), None),
    (5.27, 7.61, "S04", ("drill", "엄지 근력", None), None),
    (7.61, 8.61, "S05", ("cal", "D-3", None), None),
    (8.61, 10.45, "S06", ("drill", "장비 점검", None), None),
    (10.45, 13.80, "S07", None, "(속마음) 반값…"),   # 10-27 전단은 그림 안에 느지막 전단 그대로(전단판.py) — 옆 카드 뺌
    (13.80, 15.09, "S08", ("drill", "보급", None), None),
    (15.09, 16.72, "S09", ("drill", "위장", None), "(속삭임) 이번엔… 이긴다."),
    (16.72, 17.23, "S10", ("drill", "반응 속도", None), None),
    (17.23, 17.90, "S11", ("drill", "반응 속도", None), None),
    (17.90, 18.94, "S12", ("drill", "광클", None), None),
    (18.94, 19.40, "S13", ("cal", "D-2", None), None),
    (19.40, 20.70, "S14", ("drill", "저격 자세", None), None),
    (20.70, 21.37, "S15", ("cal", "D-1", None), None),
    (21.37, 23.04, "S16", ("drill", "호흡", None), "(속삭임) 들이쉬고…"),
    (23.04, 25.30, "S17", ("drill", "호흡", None), "(속삭임) 반 내쉬고…"),
    (25.30, 26.17, "S18", ("cal", "D-DAY", None), "(속삭임) 멈추고…"),
    (26.17, 27.00, "S19a", ("open",), None),
    (27.00, 27.60, "S19b", ("noti",), None),
    (27.60, 28.30, "S19b", ("noti",), "(드르렁…)"),
    (28.30, 29.10, "S19b", ("noti",), "(가게 목소리) 주무세요."),
    (29.10, 31.11, "S19b", ("end",), "(가게 목소리) 블프는 선착순 없이 일주일 내내. 느지막."),
    (31.11, 32.15, None, None, "(드르렁…)"),
]
SOUND = [
    (0.0, "[째깍째깍]"),
    (0.2, "남자(속삭임): 작전명… 블프. (검은 화면에 「작전명: 블프」 글판)"),
    (1.0, "[작전물 같은 몽타주 음악 시작 — 끝까지 쉬지 않고 깔림, 달력 컷마다 빨간 펜 긋는 소리]"),
    (3.2, "[입 다문 숨 「흡」 — 윗몸일으키기]"),
    (5.3, "[로봇 청소기 지나가는 소리]"),
    (10.6, "남자(속삭임, 입은 다문 채 속마음): 반값…"),
    (13.8, "[휙]"),
    (15.3, "남자(속삭임, 입은 다문 채 속마음): 이번엔… 이긴다."),
    (16.8, "[초시계 삑]"),
    (17.9, "[마우스 딸깍딸깍 빠르게]"),
    (21.4, "[탁상시계를 탁 내려놓는 소리]"),
    (21.6, "남자(속삭임): 들이쉬고…"),
    (23.2, "남자(속삭임): 반 내쉬고…"),
    (25.4, "남자(속삭임): 멈추고…"),
    (26.2, "[자정 — 휴대폰 둘 · 탁상시계 알람이 한꺼번에 울림, 화면 셋이 번쩍]"),
    (27.0, "[카메라가 담요 속 잠든 준호에 닿음 — 알람은 계속 울림]"),
    (27.1, "[작은 알림음 「띵」 — 귀 옆 휴대폰에 알림]"),
    (27.6, "[음악 · 알람 뚝 — 정적 속에 「멈추고…」 다음의 날숨이 코골이로 「드르렁…」 두 번]"),
    (28.3, "가게 목소리(부드러운 여자 목소리, 화면 밖): 주무세요. 블프는 선착순 없이 일주일 내내. 느지막."),
    (31.2, "[코골이 한 번]"),
]


def fit(im, w=W, h=H):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def still(sid):
    if sid and sid in picked:
        return fit(Image.open(V + "받음/" + picked[sid]).convert("RGB"))
    im = Image.new("RGB", (W, H), (0, 0, 0) if sid is None else (90, 90, 90))
    if sid:
        ImageDraw.Draw(im).text((W / 2, H / 2), f"{sid} (아직)", font=ImageFont.truetype(FONT_B, 90), fill=(230, 230, 230), anchor="mm")
    return im


def tag(d, xy, text, size, fg=(255, 255, 255), bg=(0, 0, 0, 170), anchor="mm", pad=24, font=FONT_B):
    f = ImageFont.truetype(font, size)
    l, t, r, b = d.textbbox(xy, text, font=f, anchor=anchor)
    d.rounded_rectangle((l - pad, t - pad // 2, r + pad, b + pad // 2), radius=16, fill=bg)
    d.text(xy, text, font=f, fill=fg, anchor=anchor)


def overlay(img, ov):
    if not ov:
        return img
    img = img.convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    kind = ov[0]
    if kind == "cal":
        tag(d, (W / 2, H * 0.14), ov[1], 110, bg=(200, 40, 50, 230))
        if ov[2]:   # 10-27 낯선이 7차 셋 다 「27일 칸 글씨가 작다」 — 크게
            # 맨 아래 빈 줄(30일 오른쪽) — 10-27 Opus 확인: 27일 줄 위(H*0.68)에 두니 손을 작게 고친 뒤 20일 획 · 펜 끝을 가렸다
            tag(d, (W * 0.535, H * 0.945), ov[2], 72, fg=(40, 30, 30), bg=(255, 250, 240, 240))
    elif kind == "title":
        d.text((W / 2, H * 0.42), "작전명:", font=ImageFont.truetype(FONT_B, 90), fill=(200, 200, 200), anchor="mm")
        d.text((W / 2, H * 0.58), "블프", font=ImageFont.truetype(FONT_B, 200), fill=(255, 255, 255), anchor="mm")
    elif kind == "drill":
        tag(d, (W - 60, H * 0.09), f"훈련 · {ov[1]}", 54, fg=(230, 240, 200), bg=(40, 50, 30, 220), anchor="rm", pad=18)
        if ov[2] == "tv":
            tag(d, (W * 0.30, H * 0.20), "75인치 TV 자리", 54, fg=(60, 50, 30), bg=(250, 230, 160, 230))
    elif kind == "flyer":
        box = (W * 0.03, H * 0.22, W * 0.40, H * 0.66)   # 전단은 가슴 높이라 글 미리보기는 왼쪽 빈자리에
        d.rounded_rectangle(box, radius=20, fill=(255, 252, 245, 240))
        d.text((box[0] + 30, box[1] + 22), BRAND, font=ImageFont.truetype(FONT_B, 46), fill=AMBER)
        d.text((box[0] + 30, box[1] + 100), "75인치 TV", font=ImageFont.truetype(FONT_B, 56), fill=(30, 30, 30))
        f = ImageFont.truetype(FONT_B, 52)
        x0 = box[0] + 30
        d.text((x0, box[1] + 175), "198만 원", font=f, fill=(120, 120, 120))
        tw = d.textlength("198만 원", font=f)
        d.line((x0, box[1] + 205, x0 + tw, box[1] + 205), fill=(200, 40, 50), width=6)
        d.text((x0 + tw + 30, box[1] + 175), "99만 원", font=f, fill=(200, 40, 50))
        d.text((x0, box[1] + 240), "블프 반값", font=ImageFont.truetype(FONT_B, 80), fill=(200, 40, 50))
        # 10-27 낯선이 7차 셋 다 「선착순 없음을 못 읽음」 — 따로 한 줄로 크게
        tag(d, (x0 + 16, box[1] + 375), "선착순 없음", 54, fg=(255, 255, 255), bg=(200, 40, 50, 240), anchor="lm", pad=16)
        d.text((x0 + 350, box[1] + 375), "11/27부터 일주일 내내", font=ImageFont.truetype(FONT_B, 36), fill=(60, 60, 60), anchor="lm")
    elif kind == "open":
        tag(d, (W / 2, H * 0.22), "11/27 00:00", 130)
        tag(d, (W / 2, H * 0.42), "블프 OPEN", 80, bg=(200, 40, 50, 230))
    elif kind == "noti":
        box = (W * 0.08, H * 0.06, W * 0.92, H * 0.40)
        d.rounded_rectangle(box, radius=34, fill=(245, 245, 248, 240))
        d.rounded_rectangle((box[0] + 40, box[1] + 34, box[0] + 110, box[1] + 104), radius=16, fill=AMBER)
        d.text((box[0] + 75, box[1] + 69), "느", font=ImageFont.truetype(FONT_B, 46), fill=(255, 255, 255), anchor="mm")
        d.text((box[0] + 130, box[1] + 40), f"{BRAND} 앱 알림", font=ImageFont.truetype(FONT_B, 58), fill=AMBER)
        d.text((box[0] + 50, box[1] + 140), "주무세요. 선착순 없어요.", font=ImageFont.truetype(FONT_B, 84), fill=(30, 30, 30))
        d.text((box[0] + 50, box[1] + 245), "블프 반값은 일주일 내내예요.", font=ImageFont.truetype(FONT_B, 58), fill=(60, 60, 60))
    elif kind == "end":
        d.rectangle((W * 0.50, 0, W, H), fill=(250, 246, 238, 255))
        cx = W * 0.75
        d.text((cx, H * 0.17), "블프,", font=ImageFont.truetype(FONT_B, 110), fill=(40, 36, 30), anchor="mm")
        d.text((cx, H * 0.30), "자고 일어나서.", font=ImageFont.truetype(FONT_B, 110), fill=(40, 36, 30), anchor="mm")
        d.text((cx, H * 0.47), BRAND, font=ImageFont.truetype(FONT_B, 150), fill=AMBER, anchor="mm")
        d.text((cx, H * 0.60), "가전 · 생활 온라인몰", font=ImageFont.truetype(FONT_B, 58), fill=(70, 60, 50), anchor="mm")
        d.text((cx, H * 0.69), "선착순 없음 · 블프 반값 일주일 내내", font=ImageFont.truetype(FONT_B, 50), fill=(200, 40, 50), anchor="mm")
        d.text((cx, H * 0.77), "앱에서 「느지막」 검색", font=ImageFont.truetype(FONT_B, 46), fill=(90, 80, 70), anchor="mm")   # 10-27 낯선이 7차 「어디서 사는지 모름」 · 8차 「자막에 가림」 → 끝 카드 글을 위로
    return img.convert("RGB")


def sub(img, text):
    d = ImageDraw.Draw(img, "RGBA")
    f = ImageFont.truetype(FONT, 50)
    tw = d.textlength(text, font=f)
    x, y = (W - tw) / 2, H - 140
    d.rounded_rectangle((x - 28, y - 14, x + tw + 28, y + 70), radius=14, fill=(0, 0, 0, 170))
    d.text((x, y), text, font=f, fill=(255, 255, 255))


def boards():
    os.makedirs(V + "보드", exist_ok=True)
    TW, TH = 640, 360
    COLW = 760
    rowsets = [SHOTS[0:5], SHOTS[5:10], SHOTS[10:15], SHOTS[15:20]]
    fb, fr = ImageFont.truetype(FONT_B, 34), ImageFont.truetype(FONT, 26)
    for k, rows in enumerate(rowsets, 1):
        page = Image.new("RGB", (TW * 2 + COLW + 60, 90 + len(rows) * (TH + 20)), (250, 248, 244))
        d = ImageDraw.Draw(page)
        d.text((20, 26), f"블프 스나이퍼 이미지 콘티 {k}/4 — 원본(Target 2011, 사람은 우리가 바꿈) | 우리 판(글은 합성)", font=fb, fill=(30, 30, 30))
        for i, (n, a, b, sid, ov, key, text) in enumerate(rows):
            y = 90 + i * (TH + 20)
            org = Image.open(V + f"원본첫프레임/{key}.png").convert("RGB").resize((TW, TH)) if key else Image.new("RGB", (TW, TH))
            ours = overlay(still(sid), ov).resize((TW, TH)) if sid or ov else Image.new("RGB", (TW, TH))
            if sid == "S19b":   # 19번은 시작 그림(S19a)과 끝 그림(S19b)을 나란히 — 「왼쪽으로 따라가다 27.0에 닿음」(Fable 1차)
                a19 = overlay(still("S19a"), ("open",)).resize((TW // 2, TH // 2))
                b19 = ours.resize((TW // 2, TH // 2))
                ours = Image.new("RGB", (TW, TH), (20, 20, 20))
                ours.paste(a19, (0, TH // 4))
                ours.paste(b19, (TW // 2, TH // 4))
                ImageDraw.Draw(ours).text((8, TH // 4 - 34), "시작 26.17", font=ImageFont.truetype(FONT_B, 26), fill="white")
                ImageDraw.Draw(ours).text((TW // 2 + 8, TH // 4 - 34), "27.0 도착 · 알림", font=ImageFont.truetype(FONT_B, 26), fill="white")
            page.paste(org, (20, y))
            page.paste(ours, (20 + TW + 10, y))
            x = 20 + TW * 2 + 30
            d.text((x, y + 4), f"{n}   {a:.2f}–{b:.2f}초 ({b - a:.2f})", font=fb, fill=(30, 30, 30))
            words, line, yy = text.replace("—", "·").split(" "), "", y + 56   # SUIT에 긴 줄표 글자가 없다
            for w in words:   # 줄 바꿈
                if d.textlength(line + " " + w, font=fr) > COLW - 20:
                    d.text((x, yy), line.strip(), font=fr, fill=(60, 60, 60)); yy += 36; line = ""
                line += " " + w
            d.text((x, yy), line.strip(), font=fr, fill=(60, 60, 60))
        page.save(V + f"보드/블프스나이퍼_이미지콘티_{k}.jpg", quality=88)
    # 한눈
    tw, th = 480, 270
    g = Image.new("RGB", (tw * 5, th * 4), "white")
    gd = ImageDraw.Draw(g)
    for i, (n, a, b, sid, ov, key, text) in enumerate(SHOTS):
        im = overlay(still(sid), ov).resize((tw, th))
        g.paste(im, ((i % 5) * tw, (i // 5) * th))
        gd.rectangle(((i % 5) * tw, (i // 5) * th, (i % 5) * tw + 56, (i // 5) * th + 34), fill="black")
        gd.text(((i % 5) * tw + 8, (i // 5) * th + 4), str(n), font=ImageFont.truetype(FONT_B, 26), fill="white")
    g.save(V + "보드/블프스나이퍼_이미지콘티_한눈.jpg", quality=88)


def animatic(ver="7"):
    out = V + f"이야기스케치/칸{ver}/"
    os.makedirs(out, exist_ok=True)
    segs = []
    for k, (a, b, sid, ov, s) in enumerate(SEGS):
        img = overlay(still(sid), ov)
        if s:
            sub(img, s)
        p = out + f"{k:02d}.png"
        img.save(p)
        segs.append((p, b - a))
    lst = out + "목록.txt"
    with open(lst, "w", encoding="utf-8") as f:
        for p, dur in segs:
            f.write(f"file '{p}'\nduration {dur:.3f}\n")
        f.write(f"file '{segs[-1][0]}'\n")
    mp4 = V + f"이야기스케치/애니매틱_{ver}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-vf", "fps=25,format=yuv420p",
                    "-t", f"{SEGS[-1][1]:.3f}", "-c:v", "libx264", "-crf", "20", mp4], check=True)
    with open(V + f"이야기스케치/말_{ver}.txt", "w", encoding="utf-8") as f:
        for t, s in SOUND:
            f.write(f"{t:.1f}s  {s}\n")
    print(mp4)


if __name__ == "__main__":
    boards()
    animatic()
    print("고른 판", len(picked), "/", len({s[2] for s in SEGS if s[2]}))
