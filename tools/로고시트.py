# -*- coding: utf-8 -*-
"""로고 실물 시트 — 확정된 다섯 자리의 «실물»을 한 장에 모은 자립형 HTML.

왜 필요한가: 정본(_브랜드킷.md §3)에는 표와 규율이 있지만 **실물을 한눈에 보는 자리**가 없다.
로고를 쓸 때 사람이 여는 것은 규율 문서가 아니라 «어떻게 생겼더라»를 보는 화면이다.
그 자리가 없으면 각자 기억으로 쓰고, 기억은 갈린다.

규율:
 · 자립형 1파일 — 이미지는 전부 base64 인라인(발표물 규칙과 같다).
 · **정본은 여전히 md 다.** 이 시트는 «보여주는 층»이고, 값(자리·쓰임)은 여기서 새로 정하지 않는다.
 · 없는 실물은 «없다»고 적는다 — 빈칸을 그럴듯하게 채우지 않는다.

통로: python tools/로고시트.py    → docs/발표물/로고/실물시트.html
"""
import base64
import io
import os
import sys

루트 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
구움 = os.path.join(루트, "docs", "Loom_자산", "구움")
나갈곳 = os.path.join(루트, "docs", "발표물", "로고", "실물시트.html")

# 자리 = (제목, 쓰임, 파일, 통로, 메모)  — 파일이 없으면 «아직 없음» 칸으로 낸다.
자리들 = [
    ("지면·인쇄 워드마크", "B2 «신호만 펠트» — 벡터 syn 옆에 이 꺾쇠가 앉는다",
     "로고꺾쇠_몸.png", "--굽기 로고꺾쇠",
     "정면 직교로 굽는다 — 벡터 정본과 외곽이 자리 그대로 맞아야 하는 합성 부품이라 원근을 못 준다."),
    ("심볼·도장·워터마크", "고리 — 양모 실 두 가닥이 서로를 꿴다",
     "로고고리_몸.png", "--굽기 로고고리",
     "각 가닥은 두 겹이 꼬인 플라이드 얀이다. 꼬임이 없으면 실이 아니라 고무로 읽힌다."),
    ("앱 아이콘", "몽글 배지 — 꺾쇠가 입이 되는 옆모습",
     "로고배지_몸.png", "--굽기 로고배지",
     "3차 마감판이 확정이다. 매끈한 쿠션이 이 부품의 결이고, 수제 눌림은 넣지 않는다."),
    ("모션·영상", "고리가 꿰이는 순간 — 떨어짐 → 다가옴 → 엮임",
     "고리모션_039.png", "--굽기 로고고리 --시퀀스 40",
     "진행 1.0 이 확정 정지 화면이라 마지막 컷이 곧 심볼이다 — 영상 끝에 로고를 겹쳐 넣지 않는다."),
]

스플래시메모 = ("앱 스플래시(다크)", "잉크 카드 — 양모 밤",
                "합성판 `로고/스플래시_잉크카드.html`",
                "벡터 syn(Paper 펠트) + 꺾쇠 렌더판을 양모 밤 카드 위에 얹은 HTML 합성이라 "
                "낱장 렌더가 아니다 — 그 파일을 열어서 본다.")


def b64(경로):
    with open(경로, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


def 줄이기(경로, 변=560):
    """시트용으로 줄인다 — 원본 1100~1400px 을 그대로 인라인하면 파일이 5MB 를 넘는다."""
    try:
        from PIL import Image
    except ImportError:
        return b64(경로)
    im = Image.open(경로).convert("RGBA")
    im = im.resize((변, 변), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def 칸(제목, 쓰임, 파일, 통로, 메모):
    경로 = os.path.join(구움, 파일)
    if not os.path.exists(경로):
        몸 = ('<div class="stage none">아직 실물이 없다<br><span>%s</span></div>'
              % 통로)
    else:
        몸 = '<div class="stage"><img src="%s" alt="%s"></div>' % (줄이기(경로), 제목)
    return """
    <figure class="card">
      %s
      <figcaption>
        <span class="tag">%s</span>
        <strong>%s</strong>
        <span class="desc">%s</span>
        <code>node tools/룸굽기.js %s</code>
      </figcaption>
    </figure>""" % (몸, 제목, 쓰임, 메모, 통로)


def main():
    칸들 = "".join(칸(*자) for 자 in 자리들)
    있는것 = sum(1 for _, _, f, _, _ in 자리들 if os.path.exists(os.path.join(구움, f)))
    html = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SYNK 로고 — 실물 시트</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;700;800&display=swap">
<style>
  :root { --ink-deep:#080605; --ink:#2B2320; --paper:#FBF7F0; --stitch:#F0E3C8;
          --stone:#C7BFB2; --ash-wool:#8D857A; --coral:#F96859; --coral-soft:#FBB7A3; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--ink-deep); color:var(--paper); padding:36px 20px 44px;
         font-family:'Inter Tight','SUIT Variable',system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; }
  header, .grid, .note, footer { max-width:1180px; margin-left:auto; margin-right:auto; }
  header { margin-bottom:26px; }
  h1 { font-size:21px; font-weight:800; margin:0 0 8px; letter-spacing:-.02em; }
  header p { margin:0; font-size:12.5px; font-weight:500; color:var(--stone); line-height:1.75; }
  header .hi { color:var(--coral-soft); font-weight:700; }
  .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fit, minmax(268px, 1fr)); }
  .card { margin:0; background:var(--ink); border-radius:18px; padding:16px 16px 15px;
          box-shadow:0 14px 36px rgba(0,0,0,.45), inset 0 0 0 1px rgba(251,247,240,.05); }
  .stage { aspect-ratio:1; border-radius:12px; display:grid; place-items:center;
           background:radial-gradient(ellipse at 50% 44%, rgba(199,191,178,.07) 0%, rgba(199,191,178,0) 70%); }
  .stage img { width:100%; height:100%; object-fit:contain; display:block; }
  .stage.none { font-size:12px; font-weight:700; color:var(--ash-wool); text-align:center; line-height:1.9; }
  .stage.none span { font-family:'DM Mono',ui-monospace,Consolas,monospace; font-size:10px; color:var(--stone); }
  figcaption { display:flex; flex-direction:column; gap:5px; margin-top:13px; }
  .tag { font-size:10px; font-weight:800; letter-spacing:.09em; color:var(--ash-wool); }
  figcaption strong { font-size:13.5px; font-weight:700; line-height:1.45; }
  .desc { font-size:11.5px; font-weight:500; color:var(--stone); line-height:1.65; }
  code { font-family:'DM Mono',ui-monospace,Consolas,monospace; font-size:10px; color:var(--stitch);
         background:rgba(240,227,200,.06); border-radius:6px; padding:5px 8px; margin-top:3px; overflow-x:auto; }
  .note { margin-top:20px; background:var(--ink); border-radius:14px; padding:15px 18px;
          font-size:11.5px; font-weight:500; color:var(--stone); line-height:1.75; }
  .note b { color:var(--paper); }
  footer { margin-top:22px; padding-top:14px; border-top:1px solid var(--ink);
           font-size:11px; font-weight:500; color:var(--ash-wool); line-height:1.8; }
</style></head>
<body>
<header>
  <h1>SYNK 로고 — 실물 시트</h1>
  <p>확정된 자리마다 <span class="hi">지금 쓰는 실물</span>이 무엇인지 한눈에 봅니다.
     값과 규율의 정본은 여전히 <b>docs/발표물/_브랜드킷.md §3</b>이고, 이 시트는 보여주는 층입니다 —
     여기서 새로 정하지 않습니다.<br>
     실물 __있는것__/4점 · 재질은 CSS 흉내가 아니라 펠트 실물 사진 타일로 굽습니다.</p>
</header>
<div class="grid">__칸들__</div>
<div class="note">
  <b>앱 스플래시(다크) — 잉크 카드</b>는 낱장 렌더가 아니라 <b>합성판</b>입니다:
  벡터 syn(Paper 펠트) 옆에 꺾쇠 렌더판을 얹어 양모 밤 카드 위에 세운 HTML이라,
  <code>docs/발표물/로고/스플래시_잉크카드.html</code>을 열어서 봅니다.
</div>
<footer>
  통로는 하나입니다 — <code>node tools/룸굽기.js --굽기 &lt;부품&gt;</code>. 구움 폴더는 git 밖이지만
  씨앗이 고정이라 언제든 같은 판이 다시 나옵니다. 앱 아이콘 13종은 <code>python tools/아이콘굽기.py</code>.<br>
  이 시트도 산출물입니다 — 로고를 다시 구우면 <code>python tools/로고시트.py</code>로 다시 냅니다.
</footer>
</body></html>"""
    html = html.replace("__칸들__", 칸들).replace("__있는것__", str(있는것))
    os.makedirs(os.path.dirname(나갈곳), exist_ok=True)
    io.open(나갈곳, "w", encoding="utf-8").write(html)
    print("wrote %s · %d KB · 실물 %d/4" % (나갈곳, len(html) // 1024, 있는것))
    if 있는것 < len(자리들):
        print("⚠아직 없는 실물이 있다 — 그 칸은 «없다»로 냈다(빈칸을 그럴듯하게 채우지 않는다)")


if __name__ == "__main__":
    main()
