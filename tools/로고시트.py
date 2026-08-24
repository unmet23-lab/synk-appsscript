# -*- coding: utf-8 -*-
"""로고 실물 시트 — 확정된 자리의 «실물»을 한 장에 모은 자립형 HTML.

왜 필요한가: 정본(_브랜드킷.md §3)에는 표와 규율이 있지만 **실물을 한눈에 보는 자리**가 없다.
로고를 쓸 때 사람이 여는 것은 규율 문서가 아니라 «어떻게 생겼더라»를 보는 화면이다.
그 자리가 없으면 각자 기억으로 쓰고, 기억은 갈린다.

2026-08-25 유호 확정 «두 락업» 반영:
 · 락업이 둘이다 — 대외 `synk`(어센더 k) · 앱 `syn<`(꺾쇠 T4). syn< 은퇴는 대외에서만 유효했다.
 · 색갈래 = 코랄(기본) · 단색 · 알록(특별판 — 실은 «소프트» 한 벌로 통일) · 신호색 셋(버터·메도우·팝).
 · 앱 스플래시는 알록이 상시다(그 자리는 늘 230dp 라 알록 조건 110px↑ 를 만족한다).
 · 기호 < 자수판·도장(배지 문법)은 락업이 아닌 «단독 표식» 자리 — 도장·워터마크는 기호가 승계.
 · 벡터 자리들은 tools/lib/로고정본.js 가 그 자리에서 그린다(사본 아님 — CLI 소비).

규율:
 · 자립형 1파일 — 이미지는 전부 base64 인라인, 벡터는 SVG 그대로.
 · **정본은 여전히 md(§3 판정) + 로고정본.js(도형·표현)다.** 이 시트는 «보여주는 층»이다.
 · 없는 실물은 «없다»고 적는다 — 빈칸을 그럴듯하게 채우지 않는다.

통로: python tools/로고시트.py    → docs/발표물/로고/실물시트.html
"""
import base64
import io
import json
import os
import subprocess
import sys

루트 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
구움 = os.path.join(루트, "docs", "Loom_자산", "구움")
나갈곳 = os.path.join(루트, "docs", "발표물", "로고", "실물시트.html")


def 로고표준형():
    """벡터 자리의 SVG 는 실행 정본 하나에서만 온다(브랜드킷조립.py 로고표준형과 같은 문법)."""
    r = subprocess.run(["node", os.path.join(루트, "tools", "lib", "로고정본.js"), "--json"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise SystemExit("로고정본 CLI 실패(rc=%s): %s" % (r.returncode, (r.stderr or "")[:300]))
    return json.loads(r.stdout)


# 렌더판(PNG) 자리 = (제목, 쓰임, 파일, 통로, 메모) — 파일이 없으면 «아직 없음» 칸으로 낸다.
자리들 = [
    ("심볼·워터마크(락업)", "고리 — 양모 실 두 가닥이 서로를 꿴다",
     "로고고리_몸.png", "--굽기 로고고리",
     "각 가닥은 두 겹이 꼬인 플라이드 얀이다. 꼬임이 없으면 실이 아니라 고무로 읽힌다."),
    ("앱 아이콘", "몽글 배지 — 꺾쇠가 입이 되는 옆모습",
     "로고배지_몸.png", "--굽기 로고배지",
     "3차 마감판이 확정이다. 매끈한 쿠션이 이 부품의 결이고, 수제 눌림은 넣지 않는다."),
    ("모션·영상", "고리가 꿰이는 순간 — 떨어짐 → 다가옴 → 엮임",
     "고리모션_039.png", "--굽기 로고고리 --시퀀스 40",
     "진행 1.0 이 확정 정지 화면이라 마지막 컷이 곧 심볼이다 — 영상 끝에 로고를 겹쳐 넣지 않는다."),
]


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


def 벡터칸(제목, 쓰임, 몸html, 메모, 밝게=False):
    return """
    <figure class="card">
      <div class="stage vec%s">%s</div>
      <figcaption>
        <span class="tag">%s</span>
        <strong>%s</strong>
        <span class="desc">%s</span>
        <code>tools/lib/로고정본.js</code>
      </figcaption>
    </figure>""" % (" light" if 밝게 else "", 몸html, 제목, 쓰임, 메모)


def main():
    로고 = 로고표준형()
    벡터칸들 = "".join([
        벡터칸("① 대외 synk · 다크", "이름을 «보여주는» 순간 — 스플래시 카드·간판·스토어·SNS",
              로고["펠트다크"],
              "k 는 어센더 그대로다 — syn 위로 12.6 솟는 그 쏠림이 이 로고의 인상이다(유호 확정 08-25)."),
        벡터칸("① 대외 synk · 라이트", "밝은 지면(인쇄물·수료증) — syn 이 Ink 펠트로 뒤집힌다",
              로고["펠트라이트"],
              "소형(머리띠·명함 작은 판)은 민판을 쓴다 — 필터 없는 순수 벡터가 300dpi 에서 정직하다.", 밝게=True),
        벡터칸("② 앱 syn&lt; · 다크", "앱·내부 — 이미 들어와 있는 사람에게는 기호가 브랜드를 진다",
              로고["꺾쇠다크"],
              "꺾쇠 두께 T4(직교 10.0 = n 스템의 92%). 은퇴가 아니라 «자리»를 받은 것이다 — 오인 위험은 대외에서만 유효하다."),
        벡터칸("③ 앱 스플래시 — 알록", "앱을 켤 때마다 뜨는 얼굴(상시) · 자산 = talk assets/splash-icon.png",
              로고["알록꺾쇠"],
              "하얀 펠트 몸 + 파스텔 색실 다섯이 한 땀씩(소프트 정본). 굽기 = <code>node tools/앱로고굽기.js</code> — 정본에서만 나온다."),
        벡터칸("③ 대외 알록 — 특별판", "시즌 종료·축하·기념일·한정 굿즈 — 앱 스플래시와 같은 소프트 실",
              로고["알록synk"],
              "⚠ 110px 미만 금지 — 알록의 정체는 실땀이고 민판엔 실땀이 없다. 상시로 쓰면 특별함이 닳는다."),
        벡터칸("④ 단색 락업", "색을 뺄 이유가 있는 자리 — 사진 위·1도 인쇄·각인·협업 로고 띠",
              로고["단색다크"],
              "«흰색»이 아니라 «syn 과 같은 색»이다 — 다크면 Paper, 라이트면 Ink. 흰색으로 못 박으면 밝은 바탕에서 신호가 사라진다."),
        벡터칸("⑤ 신호색 갈래 셋", "코랄(기본) 밖의 자리 — 버터=햇살·축하 · 메도우=성장 · 팝=기념",
              '<div class="row col">%s%s%s</div>' % (로고["버터다크"], 로고["메도우다크"], 로고["팝다크"]),
              "몸만 갈지 않는다 — 펠트 램프(보풀·그늘)도 그 색 Soft/Deep 으로 다시 굽는다. 안 그러면 색이 탁해진다."),
        벡터칸("기호 &lt; · 자수판", "락업이 아니라 기호 하나만 — 상단바·진행·로딩·불릿",
              '<div class="row">%s%s%s</div>' % (로고["기호_큰"], 로고["기호_중"], 로고["기호_작"]),
              "28px 이상에서 실땀이 보이고, 작아지면 스스로 접혀 둥근 끝만 남는다 — 한 기호의 두 크기다. stroke 13 = 직교 13(단독은 굵어야 산다)."),
        벡터칸("도장 — 배지 문법", "출석·칭찬 도장 · 워터마크는 이 기호가 승계",
              로고["도장"],
              "펠트 원 + 쿠션 볼록 + 실땀 링 + 광학 중심(꼭짓점 쏠림 보정). 찍힌 자국 자체가 보상이다."),
    ])
    벡터수 = 벡터칸들.count('<figure class="card">')
    칸들 = 벡터칸들 + "".join(칸(*자) for 자 in 자리들)
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
  .stage.vec > svg { width:88%; height:auto; }
  .stage.vec.light { background:var(--paper); }
  .stage.vec .row { display:flex; align-items:center; gap:18px; }
  /* 🔴 .row 안의 워드마크 SVG 는 인라인 width 가 없다 — 규칙이 없으면 폭이 접혀 «빈 칸»으로 나온다(08-25 렌더로 잡음).
        기호 SVG 는 자기 style 로 px 을 갖고 있어 이 병이 없었다. */
  .stage.vec .row.col { flex-direction:column; gap:10px; width:92%; }
  .stage.vec .row.col > svg { width:100%; height:auto; display:block; }
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
     판정의 정본은 <b>docs/발표물/_브랜드킷.md §3</b>, 도형·표현의 실행 정본은
     <b>tools/lib/로고정본.js</b>입니다(유호 확정 08-24 «synk 승격») — 이 시트는 보여주는 층이고,
     여기서 새로 정하지 않습니다.<br>
     벡터 9자리 + 렌더판 __있는것__/3점. 락업은 <b>둘</b>입니다 — 대외 <b>synk</b>, 앱 <b>syn&lt;</b>. 다른 건 신호 한 글자뿐입니다.</p>
</header>
<div class="grid">__칸들__</div>
<div class="note">
  <b>앱 스플래시(다크) — 잉크 카드</b>는 낱장 렌더가 아니라 <b>합성판</b>입니다:
  벡터 펠트 synk 를 양모 밤 카드 위에 세운 HTML이라
  <code>docs/발표물/로고/스플래시_잉크카드.html</code>을 열어서 봅니다(렌더판 의존 0 — 어느 기계에서나 섭니다).
</div>
<footer>
  렌더판 통로 — <code>node tools/룸굽기.js --굽기 &lt;부품&gt;</code>. 구움 폴더는 git 밖이지만
  씨앗이 고정이라 언제든 같은 판이 다시 나옵니다. 앱 아이콘 13종은 <code>python tools/아이콘굽기.py</code>.<br>
  이 시트도 산출물입니다 — 로고가 바뀌면 <code>python tools/로고시트.py</code>로 다시 냅니다.
</footer>
</body></html>"""
    html = html.replace("__칸들__", 칸들).replace("__있는것__", str(있는것))
    os.makedirs(os.path.dirname(나갈곳), exist_ok=True)
    io.open(나갈곳, "w", encoding="utf-8").write(html)
    print("wrote %s · %d KB · 벡터 %d + 렌더판 %d/3" % (나갈곳, len(html) // 1024, 벡터수, 있는것))
    if 있는것 < len(자리들):
        print("⚠아직 없는 실물이 있다 — 그 칸은 «없다»로 냈다(빈칸을 그럴듯하게 채우지 않는다)")


if __name__ == "__main__":
    main()
