# -*- coding: utf-8 -*-
"""새 컨셉 시안 — 끝 그림에 글 얹기 · 안마다 보드 (2026-10-29, 크레딧 0).

화면 위 글자는 그림 모델이 쓰지 않는다(제작 규칙 원칙). 끝 줄 · 이름은 Noto Serif KR, 보드 설명은 Noto Sans KR로 얹는다.
    python -I -X utf8 시안글.py   → <밖>/시안/a3 · a4 · b1_끝글_세로.jpg · 보드_안1~3.jpg · 웹/*.jpg
보드 설명의 줄은 「|」로 나눈다.
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset",
                 "새컨셉", "시안")
SERIF = "C:/Windows/Fonts/NotoSerifKR-VF.ttf"
SANS = "C:/Windows/Fonts/NotoSansKR-VF.ttf"
IVORY = (246, 238, 222)
CHAMP = (226, 200, 150)


def font(path, size, weight="Regular"):
    f = ImageFont.truetype(path, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def spaced(draw, xy_center, text, f, track=0.0):
    """자간을 벌린 한 줄을 가운데 맞춘 글자 자리."""
    widths = [draw.textlength(ch, font=f) for ch in text]
    total = sum(widths) + track * f.size * (len(text) - 1)
    x = xy_center[0] - total / 2
    out = []
    for ch, w in zip(text, widths):
        out.append((x, ch))
        x += w + track * f.size
    return out


def write_line(img, center, text, f, fill, track=0.0, light=False):
    """한 줄 쓰기 — 그늘은 옅게 번진 어두운 글자(light면 밝은 바탕용 옅은 흰 그늘)."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ds = ImageDraw.Draw(sh)
    for x, ch in spaced(d, center, text, f, track):
        ds.text((x, center[1] + 2), ch, font=f, fill=(255, 252, 245, 150) if light else (5, 8, 20, 170), anchor="lm")
        d.text((x, center[1]), ch, font=f, fill=(*fill, 255), anchor="lm")
    sh = sh.filter(ImageFilter.GaussianBlur(f.size * 0.18))
    return Image.alpha_composite(Image.alpha_composite(img.convert("RGBA"), sh), layer)


def end_card(src, dst, line=("서리꽃은", "따뜻한 창에만 핀다"), line_y=(0.135, 0.185), brand_y=(0.275, 0.312), veil_to=0.42,
             ink=None):
    """ink=(줄 색, 이름 색) — 밝은 아침 서리 위(c3)는 짙은 남색 · 짙은 금. 주면 위쪽 누르기(veil)는 하지 않는다."""
    im = Image.open(src).convert("RGBA")
    W, H = im.size
    c_line, c_brand = ink or (IVORY, CHAMP)
    if ink is None:  # 글 자리 위쪽만 아주 옅게 눌러 서리 위에서 읽히게
        veil = Image.new("RGBA", im.size, (0, 0, 0, 0))
        vd = ImageDraw.Draw(veil)
        for i in range(int(H * veil_to)):
            a = int(110 * (1 - i / (H * veil_to)) ** 1.4)
            vd.line([(0, i), (W, i)], fill=(4, 8, 22, a))
        im = Image.alpha_composite(im, veil)
    k = W / 1080
    if line:  # None이면 끝 줄 없이 이름만
        # 시청자 시험(10-29): 폰에서 끝 글이 작다 — 줄 64 · 이름 62 · 에디션 34(1080 폭 기준)
        im = write_line(im, (W / 2, H * line_y[0]), line[0], font(SERIF, int(64 * k), "Light"), c_line, 0.08, light=ink is not None)
        im = write_line(im, (W / 2, H * line_y[1]), line[1], font(SERIF, int(64 * k), "Light"), c_line, 0.08, light=ink is not None)
    im = write_line(im, (W / 2, H * brand_y[0]), "유리결", font(SERIF, int(62 * k), "Medium"), c_brand, 0.40, light=ink is not None)
    im = write_line(im, (W / 2, H * brand_y[1]), "서리꽃 홀리데이 에디션", font(SERIF, int(34 * k), "Regular"), c_brand, 0.22,
                    light=ink is not None)
    im.convert("RGB").save(dst, quality=93)


def board(title, sub, frames, dst, cell_w=420):
    """안 하나의 보드 — 박자 순서대로 시안 컷과 그 박자 설명(줄은 「|」)."""
    cells = []
    for path, beat, text in frames:
        im = Image.open(path).convert("RGB")
        h = int(cell_w * im.height / im.width)
        cells.append((im.resize((cell_w, h), Image.LANCZOS), beat, text))
    pad, head, foot = 28, 150, 210
    W = pad + len(cells) * (cell_w + pad)
    H = head + max(c[0].height for c in cells) + foot
    out = Image.new("RGB", (W, H), (14, 16, 24))
    d = ImageDraw.Draw(out)
    d.text((pad, 34), title, font=font(SANS, 44, "Bold"), fill=(240, 236, 228))
    d.text((pad, 96), sub, font=font(SANS, 24, "Regular"), fill=(190, 184, 172))
    for i, (im, beat, text) in enumerate(cells):
        x = pad + i * (cell_w + pad)
        out.paste(im, (x, head))
        y = head + im.height + 16
        d.text((x, y), beat, font=font(SANS, 26, "Bold"), fill=(232, 204, 150))
        yy = y + 40
        for line in text.split("|"):
            d.text((x, yy), line, font=font(SANS, 21, "Regular"), fill=(222, 218, 210))
            yy += 30
    out.save(dst, quality=90)


def web(src, dst, w=720):
    im = Image.open(src).convert("RGB")
    im.resize((w, int(w * im.height / im.width)), Image.LANCZOS).save(dst, quality=86)


if __name__ == "__main__":
    p = lambda n: os.path.join(밖, n)
    # 안 1 끝: 녹은 동그라미 구도(영상에서 가장 화려한 그림)에 끝 줄 · 이름 — 이름은 아래 창틀 띠에
    # 안 1 끝 줄은 그림(온기가 서리를 녹여 맑아짐)과 같은 쪽으로 — 「따뜻한 창에만 핀다」는 녹는 그림과 반대로 읽혔다(시청자 시험)
    end_card(p("a3_세로.png"), p("a3_끝글_세로.jpg"), line=("온기가 닿은 자리부터", "맑아진다"), line_y=(0.105, 0.157),
             brand_y=(0.872, 0.915), veil_to=0.30)
    # 안 3 끝(2판, Fable 10-29): 「고마워」 · 열린 선물(c3)은 글 없이 두고, 끝은 단지 뚜껑 결정 접사(c4) 위 어둠에 이름만.
    # 끝 줄 「서리꽃은 따뜻한 창에만 핀다」는 15초에선 빼고(4초에 못 읽고 「서리는 추워야 끼는데?」 위험) 30초 · 가로판에만
    # 3판(10-29 밤): 끝은 아침 창 앞(밝은 서리 위)이라 글은 짙은 남색 · 짙은 금(밝은 서리 위 상아색은 묻혔다)
    # 이름은 위의 「고마워」와 아래 단지 사이 빈 서리 자리에 — 읽는 순서 고마워 → 이름 → 제품(위에 두면 「고마워」와 엉켰다, 볼 이유 심사 3회차)
    end_card(p("c4_세로.png"), p("c4_끝글_세로.jpg"), line=None, brand_y=(0.425, 0.462), ink=((24, 32, 60), (22, 30, 64)))
    end_card(p("c4_세로.png"), p("c4_끝줄_세로.jpg"), line_y=(0.365, 0.407), brand_y=(0.495, 0.531),
             ink=((24, 32, 60), (22, 30, 64)))
    # 안 2 끝: 끝 줄 없이 이름만(스펙터클 편)
    end_card(p("b1_세로.png"), p("b1_끝글_세로.jpg"), line=None, brand_y=(0.110, 0.152), veil_to=0.25)
    board("안 1 「온기가 닿은 자리」",
          "무엇으로 이기나: 비싼 장치(물리로 자라는 서리 결정 접사 · 녹아 맑아지는 유리) + 끝 한 줄의 여운",
          [(p("a1_세로.png"), "기 0–2.5초", "깜깜한 유리에 결정 하나 —|여섯 가지와 곁가지가 자란다|(접사 한 컷, 뒤는 금빛 방)"),
           (p("a2_세로.png"), "승 2.5–6초", "창 가장자리부터 고사리처럼|뻗은 서리꽃이 창을 덮어 가고|그 사이로 따뜻한 방"),
           (p("a3_세로.png"), "전 6–10초", "안에서 온기가 닿은 자리부터|녹아 열린 맑은 동그라미,|그 너머 창턱의 선물"),
           (p("a4_세로.png"), "결 10–13초", "동그라미를 지나 방 안으로 —|서리꽃 새김 앰플 · 남색 단지,|금빛 세럼 한 방울"),
           (p("a3_끝글_세로.jpg"), "끝 13–15초", "다시 창 밖에서 — 녹은 자리의|선물과 「온기가 닿은 자리부터|맑아진다」 · 이름")],
          p("보드_안1.jpg"))
    board("안 2 「얼어붙은 1초」", "무엇으로 이기나: 순수 스펙터클(얼음 · 굴절 · 깨지는 순간이 멈춤)",
          [(p("b1_세로.png"), "기–승 0–6초", "얼음 덩어리 속에 잠든 두 제품,|금빛 세럼 한 방울이 떨어져|얼음에 금이 번진다"),
           (p("b2_세로.png"), "전 6–11초", "깨지는 순간 시간이 멎는다 —|조각 · 금빛 방울 · 제품이 공중에,|카메라가 그 사이를 지난다"),
           (p("b1_끝글_세로.jpg"), "결 11–15초", "다시 흐르며 조각은 흩어지고|제품이 내려앉음 + 이름|(끝 줄 없음)")],
          p("보드_안2.jpg"))
    board("안 3 「창에 쓴 말」", "무엇으로 이기나: 이야기(엇갈려 사는 둘이 서리 낀 창에 남기는 말 → 선물로 닫힘) — 15초 줄임판",
          [(p("c0_세로.png"), "기 0–2초", "그 창의 아래 모서리, 가장 찬 틀|가장자리에서 서리 결정이 돋는다|(겨울밤, 창 밖 불빛)"),
           (p("c1_세로.png"), "승 2–7초", "밤. 새벽 사람이 손끝으로 쓰고 간|「다녀올게」 위로 서리가 다시 끼고,|밤 사람이 「꼭 바르고 나가」"),
           (p("c2_세로.png"), "전 7–11초", "이브 새벽. 밤 사람이 밤새 남긴|「이거 바르고 나가 ↓」 —|창턱에 선물 상자"),
           (p("c3_세로.png"), "결 11–13.5초", "아침. 새벽 사람이 쓰고 간 「고마워」에|해가 들고, 열린 선물과 두 제품"),
           (p("c4_끝글_세로.jpg"), "끝 13.5–15초", "아침 창 앞, 단지 뚜껑의 서리꽃 결정 —|첫 장면의 그 결정, 뒤로 「고마워」 · 이름|(끝 줄은 30초 · 가로판에만)")],
          p("보드_안3.jpg"))
    os.makedirs(p("웹"), exist_ok=True)
    for n in ("c0_세로.png", "a1_세로.png", "a2_세로.png", "a3_세로.png", "a4_세로.png", "a3_끝글_세로.jpg", "b1_세로.png", "b2_세로.png",
              "b1_끝글_세로.jpg", "c1_세로.png", "c2_세로.png", "c3_세로.png", "c4_세로.png", "c4_끝글_세로.jpg", "c4_끝줄_세로.jpg",
              "p0_세로.png"):
        web(p(n), p(os.path.join("웹", n.rsplit(".", 1)[0] + ".jpg")))
    print("끝 —", 밖)
