# 블프 스나이퍼 7번 느지막 전단 원고 다시(2026-11-10, Claude) — 슬롭 점검표 55번 · 폰트 정본 §10.
# 11-07 판(../bf-sniper-20261025/전단판.py)은 회사 화면 글꼴 SUIT ExtraBold 한 굵기로 주황 띠 · 빨간 띠를 꽉 채운 템플릿(55번 짜임 그대로)이었다.
# 이번 원고는 장면 속 인쇄물로 처음부터 디자인한다 — 그 브랜드(느지막: 서두르지 않는 가전 · 생활 온라인몰)의 글꼴 · 크기 · 굵기 위계,
# 작은 머리줄 · 영문 · 값 · 작은 주석, 실제 제품 사진 자리. 웃음은 전단이 이미 「서두르지 마세요 · 선착순 없음」이라고 말하는데 준호가 못 읽는 데서.
#   A 「느긋한 DM」 — 크림 종이, 명조 제목 「서두르지 마세요.」, 가격 위계(정가 → 혜택가 → 반값 도장), 아래 주석 · 앱 줄.
#   B 「반값 가위선」 — 그림이 말한다: TV 사진 한가운데 가위 점선(반으로 자름 = 반값), 글은 이름 · 값 · 날짜만.
#     (11-10 첫 장면 굽기 F07B1에서 오른쪽 값이 준호 오른손 엄지에 가려 값을 왼쪽 아래로, 자른 틈을 더 벌렸다)
# 글꼴: 고운바탕(제목) · IBM Plex Sans KR(작은 글) · Fraunces(숫자 · 영문) — SUIT · Inter Tight는 쓰지 않는다(작품 안 회사 글꼴 금지).
#   python -X utf8 전단.py   → git 밖 글자다시_1110/전단/전단_A.png · 전단_B.png(1500×2000) · 360px 낱장
import base64
import io
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/글자다시_1110/전단"
LOGO = json.load(open(os.path.join(HERE, "..", "자막시안_20261103", "remotion", "src", "bf", "로고2.json"), encoding="utf-8"))
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"


def tv_png(w=1200, h=760, split=False, photo=False):
    """제품 사진 자리 — 얇은 검은 테 · 받침의 75인치 TV, 화면은 늦은 아침 해가 뜬 언덕(가전 매장 시연 화면 같은 그림)."""
    rng = np.random.default_rng(3)
    W, H = w, h
    img = np.zeros((H, W, 4), dtype=np.float32)
    # 몸통(테) — 아주 얇은 검정 + 아래 턱
    bx0, by0, bx1, by1 = 20, 10, W - 20, H - 90
    img[by0:by1, bx0:bx1, :3] = 0.06
    img[by0:by1, bx0:bx1, 3] = 1
    # 화면
    sx0, sy0, sx1, sy1 = bx0 + 10, by0 + 10, bx1 - 10, by1 - 18
    sw, sh = sx1 - sx0, sy1 - sy0
    yy, xx = np.mgrid[0:sh, 0:sw].astype(np.float32)
    u, v = xx / sw, yy / sh
    sky = np.stack([0.98 - 0.25 * v, 0.80 - 0.18 * v + 0.06 * u, 0.62 + 0.18 * v - 0.1 * u], -1)
    sun_c = (0.68, 0.46)
    d = np.sqrt(((u - sun_c[0]) * sw / sh) ** 2 + (v - sun_c[1]) ** 2)
    sky += (np.exp(-(d / 0.09) ** 2) * 0.55)[..., None] * np.array([1.0, 0.85, 0.55])
    sky += (np.exp(-(d / 0.35) ** 2) * 0.22)[..., None] * np.array([1.0, 0.7, 0.4])
    pic = sky
    for k, (base, amp, freq, phase, col) in enumerate([
        (0.62, 0.05, 2.2, 0.3, (0.58, 0.45, 0.52)),
        (0.70, 0.06, 3.1, 1.7, (0.42, 0.33, 0.44)),
        (0.80, 0.05, 2.6, 4.1, (0.28, 0.24, 0.34)),
        (0.90, 0.04, 3.8, 2.4, (0.17, 0.16, 0.24)),
    ]):
        ridge = base + amp * np.sin(u * math.pi * freq + phase) + 0.015 * np.sin(u * 23 + k)
        mask = (v > ridge).astype(np.float32)
        haze = np.clip((v - ridge) * 3, 0, 1)
        layer = np.array(col)[None, None, :] * (0.9 + 0.1 * haze[..., None])
        pic = pic * (1 - mask[..., None]) + layer * mask[..., None]
    if photo:
        # 11-11 맹검(전단재) 「TV 화면이 보라 물결 언덕 · 노란 해의 기본 벡터 그림」 → 사진 결: 능선을 흐리고(대기 원근),
        # 해 둘레 번짐을 키우고, 화면 전체에 낟알 · 가장자리 어둠을 준다. 굽기에서는 같은 엔진이 실제 사진처럼 다시 그린다.
        from PIL import Image as _I, ImageFilter as _F
        im = _I.fromarray((np.clip(pic, 0, 1) * 255).astype(np.uint8)).filter(_F.GaussianBlur(5))
        pic = np.asarray(im).astype(np.float32) / 255
        pic += (np.exp(-(d / 0.2) ** 2) * 0.25)[..., None] * np.array([1.0, 0.8, 0.5])
        pic *= (1 - 0.25 * (((u - 0.5) / 0.5) ** 2 + ((v - 0.5) / 0.5) ** 2))[..., None]
        pic += rng.normal(0, 0.03, pic.shape)
    pic += rng.normal(0, 0.012, pic.shape)
    pic = np.clip(pic, 0, 1)
    # 화면 반사 — 옅은 사선
    refl = np.clip(1 - np.abs((u * 0.8 + v * 0.6) - 0.55) / 0.12, 0, 1) * 0.06
    pic = np.clip(pic + refl[..., None], 0, 1)
    img[sy0:sy1, sx0:sx1, :3] = pic
    # 받침 — 낮은 중앙 받침
    cx = W // 2
    img[by1 - 2: by1 + 46, cx - 18: cx + 18, :3] = 0.1
    img[by1 - 2: by1 + 46, cx - 18: cx + 18, 3] = 1
    img[by1 + 46: by1 + 56, cx - 170: cx + 170, :3] = 0.12
    img[by1 + 46: by1 + 56, cx - 170: cx + 170, 3] = 1
    out = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), "RGBA")
    # 바닥 그림자
    sh_ = Image.new("RGBA", out.size, (0, 0, 0, 0))
    a = np.zeros((H, W), dtype=np.uint8)
    a[by1 + 50: by1 + 70, cx - 260: cx + 260] = 60
    sh_.putalpha(Image.fromarray(a).filter(ImageFilter.GaussianBlur(12)))
    sh_ = Image.alpha_composite(sh_, out)
    buf = io.BytesIO()
    sh_.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def svg(name, width, color):
    L = LOGO[name]
    h = width * L["h"] / L["w"]
    return f'<svg width="{width:.1f}" height="{h:.1f}" viewBox="0 0 {L["w"]} {L["h"]}"><path d="{L["d"]}" fill="{color}" fill-rule="evenodd"/></svg>'


def qr(size=150, seed=11):
    """앱 받기 칸 — QR처럼 보이는 무늬(읽히는 코드는 아님 — 가상 브랜드)."""
    rng = np.random.default_rng(seed)
    n = 25
    cells = rng.random((n, n)) < 0.48
    for (r0, c0) in ((0, 0), (0, n - 7), (n - 7, 0)):
        cells[r0:r0 + 7, c0:c0 + 7] = False
        for r in range(7):
            for c in range(7):
                ring = max(abs(r - 3), abs(c - 3))
                cells[r0 + r, c0 + c] = ring in (0, 1, 3)
    s = size / n
    rects = "".join(f'<rect x="{c * s:.2f}" y="{r * s:.2f}" width="{s + 0.3:.2f}" height="{s + 0.3:.2f}"/>' for r in range(n) for c in range(n) if cells[r, c])
    return f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" fill="#1d1a17">{rects}</svg>'


FONTS = ('<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=IBM+Plex+Sans+KR:wght@400;500;600;700'
         '&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=block" rel="stylesheet">')
PAPER = """
body{margin:0;width:1500px;height:2000px;overflow:hidden}
.paper{position:relative;width:1500px;height:2000px;background:#F5EFE4;color:#1d1a17;font-family:'IBM Plex Sans KR',sans-serif}
.grain{position:absolute;inset:0;opacity:.35;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .55 0 0 0 0 .5 0 0 0 0 .44 0 0 0 .28 0'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>")}
.num{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144}
"""


def flyer_a(tv):
    amber = "#C9732E"
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{PAPER}
.top{{position:absolute;left:110px;right:110px;top:96px;display:flex;align-items:center;justify-content:space-between}}
.mark{{display:flex;align-items:center;gap:22px}}
.meta{{text-align:right;font-size:26px;letter-spacing:.28em;color:#6d6359;font-weight:500}}
.meta b{{display:block;font-family:'Fraunces',serif;font-weight:600;letter-spacing:.06em;font-size:30px;color:#1d1a17;margin-top:8px}}
.rule{{position:absolute;left:110px;right:110px;height:2px;background:#1d1a17}}
.head{{position:absolute;left:110px;top:300px;font-family:'Gowun Batang',serif;font-weight:700;font-size:132px;letter-spacing:-.02em;line-height:1.08}}
.sub{{position:absolute;left:114px;top:470px;font-size:40px;font-weight:500;color:#4b433b;letter-spacing:-.01em}}
.tv{{position:absolute;left:150px;top:600px;width:1200px}}
.label{{position:absolute;left:110px;top:1370px;font-size:34px;font-weight:600;letter-spacing:-.01em}}
.label small{{display:block;font-size:24px;font-weight:400;color:#7a7066;letter-spacing:.12em;margin-top:10px}}
.was{{position:absolute;left:110px;top:1478px;font-size:36px;color:#8a8076}}
.was s{{text-decoration:none;position:relative}}
.was s::after{{content:'';position:absolute;left:-4px;right:-4px;top:62%;height:3px;background:#8a8076}}
.now{{position:absolute;left:104px;top:1522px;display:flex;align-items:baseline;gap:10px}}
.now .n{{font-size:190px;font-weight:600;letter-spacing:-.02em;line-height:1}}
.now .w{{font-size:64px;font-weight:600}}
.stamp{{position:absolute;right:120px;top:1395px;width:250px;height:250px;border-radius:50%;border:5px solid {amber};color:{amber};display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-8deg)}}
.stamp .k{{font-family:'Gowun Batang',serif;font-weight:700;font-size:78px;line-height:1}}
.stamp .e{{font-size:22px;letter-spacing:.3em;margin-top:12px;font-weight:600}}
.foot{{position:absolute;left:110px;right:110px;bottom:70px;display:flex;justify-content:space-between;align-items:flex-end}}
.foot .l{{font-size:30px;line-height:1.6;color:#2a2520}}
.foot .l em{{font-style:normal;font-weight:600}}
.foot .fine{{font-size:20px;color:#8a8076;margin-top:14px;line-height:1.5}}
.app{{display:flex;align-items:center;gap:22px;font-size:24px;color:#4b433b;text-align:right;line-height:1.5}}
</style></head><body><div class="paper"><div class="grain"></div>
<div class="top"><div class="mark">{svg('neujimak_eye', 66, amber)}{svg('neujimak2', 230, '#1d1a17')}</div>
<div class="meta">BLACK FRIDAY<b>11.27 — 12.03</b></div></div>
<div class="rule" style="top:236px"></div>
<div class="head">서두르지 마세요.</div>
<div class="sub">블프 반값은 일주일 내내, 그 자리에 있습니다.</div>
<img class="tv" src="{tv}">
<div class="label">75인치 4K UHD TV<small>NJ-75U · 벽걸이 겸용</small></div>
<div class="was">정상가 <s><span class="num">1,980,000</span>원</s></div>
<div class="now"><span class="n num">990,000</span><span class="w">원</span></div>
<div class="stamp"><span class="k">반값</span><span class="e">50% OFF</span></div>
<div class="rule" style="top:1748px;height:1px;background:#bdb3a6"></div>
<div class="foot"><div><div class="l"><em>선착순 없음.</em> 수량 넉넉히 준비했습니다.<br>11월 27일(금) 0시부터 12월 3일(목) 자정까지</div>
<div class="fine">※ 일부 상품 제외 · 이미지는 연출된 것으로 실제와 다를 수 있습니다.</div></div>
<div class="app"><div>느지막 앱에서<br>천천히 고르세요</div>{qr(132)}</div></div>
</div></body></html>"""


def flyer_a2(tv):
    """11-11 맹검(전단재: 원고 A 5 · 장면 A 4) 남은 지적을 고친 판 — 머리 표지를 끝 로고와 같은 명조 「느지막」으로,
    TV 화면을 사진 결로, 줄 그은 정가를 크게 · 붉은 사선 한 줄로(360px에서 「1,080,000」처럼 뭉개짐), 「반값」 도장을 속 찬 스티커로,
    깨알 주석 · QR은 뺐다(장면 굽기에서 외계어 획으로 깨짐 — 영상 크기에서는 어차피 안 읽힌다)."""
    amber = "#C9732E"
    html = flyer_a(tv)
    html = html.replace(f"{svg('neujimak_eye', 66, amber)}{svg('neujimak2', 230, '#1d1a17')}", svg('neujimak_serif_word', 250, '#1d1a17'))
    html = html.replace(".was{{position:absolute;left:110px;top:1478px;font-size:36px;color:#8a8076}}".replace("{{", "{").replace("}}", "}"),
                        ".was{position:absolute;left:110px;top:1462px;font-size:46px;color:#6d6359}")
    html = html.replace(".was s::after{content:'';position:absolute;left:-4px;right:-4px;top:62%;height:3px;background:#8a8076}",
                        ".was s::after{content:'';position:absolute;left:-6px;right:-6px;top:50%;height:4px;background:#B9472F;transform:rotate(-5deg)}")
    html = html.replace(f".stamp{{position:absolute;right:120px;top:1395px;width:250px;height:250px;border-radius:50%;border:5px solid {amber};color:{amber};",
                        f".stamp{{position:absolute;right:120px;top:1395px;width:260px;height:260px;border-radius:50%;background:{amber};box-shadow:inset 0 0 0 9px {amber},inset 0 0 0 13px #F5EFE4;color:#F5EFE4;")
    html = html.replace(".stamp .k{font-family:'Gowun Batang',serif;font-weight:700;font-size:78px;line-height:1}",
                        ".stamp .k{font-family:'Gowun Batang',serif;font-weight:700;font-size:96px;line-height:1}")
    html = html.replace('<div class="fine">※ 일부 상품 제외 · 이미지는 연출된 것으로 실제와 다를 수 있습니다.</div>', '')
    html = html.replace(f'<div class="app"><div>느지막 앱에서<br>천천히 고르세요</div>{qr(132)}</div>',
                        '<div class="app" style="font-size:32px">느지막 앱에서<br>천천히 고르세요</div>')
    html = html.replace('<small>NJ-75U · 벽걸이 겸용</small>', '<small>벽걸이 겸용</small>')
    return html


def flyer_a3(tv):
    """11-11 동영상 판 — Gemini 「동영상 만들기」가 A2의 작은 줄(정상가 · BLACK FRIDAY 날짜 · 아래 두 줄 · 모델 줄)을 다시 그리며
    「정인지 1,6000000원 · BLACE TOIDAT」처럼 뭉갰다(현장 노트 gemini_사진 「소품 글자는 크게 두세 줄만, 가장 작은 줄도 화면 높이의 2.5% 넘게」).
    동영상 속 전단 높이(약 500px/2000)로 재면 원고 72px 아래 글은 18px 아래가 된다 — 큰 글 다섯(로고 · 「서두르지 마세요.」 · 값 · 「반값」 ·
    「선착순 없음」)만 남기고 모두 그 크기 위로."""
    amber = "#C9732E"
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{PAPER}
.top{{position:absolute;left:110px;right:110px;top:92px;display:flex;align-items:center;justify-content:space-between}}
.rule{{position:absolute;left:110px;right:110px;height:3px;background:#1d1a17}}
.head{{position:absolute;left:110px;top:290px;font-family:'Gowun Batang',serif;font-weight:700;font-size:150px;letter-spacing:-.02em;line-height:1.05}}
.tv{{position:absolute;left:130px;top:520px;width:1240px}}
.now{{position:absolute;left:104px;top:1395px;display:flex;align-items:baseline;gap:14px}}
.now .n{{font-size:230px;font-weight:600;letter-spacing:-.02em;line-height:1}}
.now .w{{font-size:96px;font-weight:600}}
.stamp{{position:absolute;right:110px;top:1340px;width:300px;height:300px;border-radius:50%;background:{amber};box-shadow:inset 0 0 0 10px {amber},inset 0 0 0 15px #F5EFE4;color:#F5EFE4;display:flex;align-items:center;justify-content:center;transform:rotate(-8deg)}}
.stamp .k{{font-family:'Gowun Batang',serif;font-weight:700;font-size:118px;line-height:1}}
.foot{{position:absolute;left:110px;right:110px;bottom:96px;font-family:'Gowun Batang',serif;font-weight:700;font-size:96px;letter-spacing:-.01em}}
</style></head><body><div class="paper"><div class="grain"></div>
<div class="top"><div class="mark">{svg('neujimak_serif_word', 300, '#1d1a17')}</div></div>
<div class="rule" style="top:246px"></div>
<div class="head">서두르지 마세요.</div>
<img class="tv" src="{tv}">
<div class="now"><span class="n num">990,000</span><span class="w">원</span></div>
<div class="stamp"><span class="k">반값</span></div>
<div class="rule" style="top:1720px;height:2px;background:#bdb3a6"></div>
<div class="foot">선착순 없음.</div>
</div></body></html>"""


def flyer_b(tv):
    amber = "#C9732E"
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{PAPER}
.paper{{background:#FBF8F2}}
.top{{position:absolute;left:110px;right:110px;top:100px;display:flex;align-items:center;justify-content:space-between}}
.mark{{display:flex;align-items:center;gap:22px}}
.meta{{font-size:26px;letter-spacing:.28em;color:#6d6359;font-weight:500}}
.stage{{position:absolute;left:0;right:0;top:330px;height:900px}}
.half{{position:absolute;top:0;width:1200px;height:760px;overflow:hidden}}
.half img{{position:absolute;top:0;width:1200px}}
.cut{{position:absolute;left:760px;top:-40px;height:860px;width:0;border-left:6px dashed #1d1a17}}
.sc{{position:absolute;left:704px;top:-132px;font-size:84px;transform:rotate(90deg)}}
.label{{position:absolute;left:110px;top:1250px;font-size:34px;font-weight:600}}
.label small{{display:block;font-size:24px;font-weight:400;color:#7a7066;letter-spacing:.12em;margin-top:10px}}
.price{{position:absolute;left:104px;top:1380px;text-align:left}}
.price .was{{font-size:36px;color:#8a8076}}
.price .was s{{text-decoration:none;position:relative}}
.price .was s::after{{content:'';position:absolute;left:-4px;right:-4px;top:62%;height:3px;background:#8a8076}}
.price .now{{display:flex;align-items:baseline;justify-content:flex-start;gap:8px;margin-top:6px}}
.price .n{{font-size:230px;font-weight:600;line-height:.9;letter-spacing:-.02em}}
.price .w{{font-size:76px;font-weight:600}}
.foot{{position:absolute;left:110px;right:110px;bottom:100px;border-top:2px solid #1d1a17;padding-top:34px;display:flex;justify-content:space-between;align-items:center;font-size:30px}}
.foot em{{font-style:normal;font-weight:600}}
</style></head><body><div class="paper"><div class="grain"></div>
<div class="top"><div class="mark">{svg('neujimak_eye', 66, amber)}{svg('neujimak2', 230, '#1d1a17')}</div><div class="meta">BLACK FRIDAY · 11.27 — 12.03</div></div>
<div class="stage">
 <div class="half" style="left:150px;width:600px"><img src="{tv}" style="left:0"></div>
 <div class="half" style="left:792px;width:600px;transform:rotate(4deg) translateY(14px);transform-origin:0 50%"><img src="{tv}" style="left:-600px"></div>
 <div class="cut"></div><div class="sc">✂</div>
</div>
<div class="label">75인치 4K UHD TV<small>NJ-75U · 벽걸이 겸용</small></div>
<div class="price"><div class="was">정상가 <s><span class="num">198</span>만 원</s></div><div class="now"><span class="n num">99</span><span class="w">만 원</span></div></div>
<div class="foot"><span><em>블프 반값</em> · 선착순 없이 일주일 내내</span><span>느지막 앱</span></div>
</div></body></html>"""


def shoot(html, png):
    p = png.replace(".png", ".html")
    open(p, "w", encoding="utf-8").write(html)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--screenshot={png}", "--window-size=1500,2000",
                    "--virtual-time-budget=8000", "--force-device-scale-factor=1", "file:///" + p.replace("\\", "/")],
                   check=True, capture_output=True, timeout=120)
    return png


def main():
    os.makedirs(OUT, exist_ok=True)
    tv = tv_png()
    outs = [shoot(flyer_a(tv), f"{OUT}/전단_A.png"), shoot(flyer_b(tv), f"{OUT}/전단_B.png"),
            shoot(flyer_a2(tv_png(photo=True)), f"{OUT}/전단_A2.png"),
            shoot(flyer_a3(tv_png(photo=True)), f"{OUT}/전단_A3.png")]
    for o in outs:
        im = Image.open(o).convert("RGB")
        im.resize((360, 480), Image.LANCZOS).save(o.replace(".png", "_360.png"))
        print(o, im.size)


if __name__ == "__main__":
    main()
