# -*- coding: utf-8 -*-
# 유호님께 보여 드릴 15초 · 6초 페이지(안 1 · 2 합친 판) — 소리 있는 두 영상 · 콘티 · 찾고 고친 것(전후) · 시험 · Fable · 소리 곡선.
# 움직임페이지.py(움직임 시험 페이지)와 같은 겨울밤 결. 명품 광고 프레임은 남의 저작물이라 싣지 않는다(눈가림 시험 결과만 글로).
#   python -I -X utf8 15초페이지.py   → <밖>/움직임/15초/페이지/index.html (+ 영상 · 그림), 내용은 같은 폴더 내용.json
import html
import json
import os

밖 = r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/holiday-giftset/새컨셉/움직임/15초/페이지"
OUT = os.path.join(밖, "index.html")
J = json.load(open(os.path.join(밖, "내용.json"), encoding="utf-8"))
e = html.escape


def video(v):
    return (f'<figure class="film"><video src="{e(v["영상"])}" poster="{e(v["포스터"])}" controls playsinline preload="metadata"></video>'
            f'<figcaption><b>{e(v["이름"])}</b> {e(v["말"])}</figcaption></figure>')


def rows(table, head):
    th = "".join(f"<th>{e(h)}</th>" for h in head)
    tr = "".join("<tr>" + "".join(f'<td{" class=n" if i == 0 else ""}>{c}</td>' for i, c in enumerate(r)) + "</tr>" for r in table)
    return f'<div class="tablewrap"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'


def fix(f):
    pics = "".join(f'<figure><img src="{e(p)}" alt="{e(c)}" loading="lazy"><figcaption>{e(c)}</figcaption></figure>'
                   for p, c in zip(f["그림"], f["캡션"]))
    return f'<div class="fix"><h3>{e(f["제목"])}</h3><div class="pics">{pics}</div><p class="mute">{f["말"]}</p></div>'


def curve(c):
    """0.25초 RMS 곡선(dBFS)과 사건 자리 — 위가 큼."""
    W, H, lo, hi = 960, 220, -60.0, -6.0
    T = c["길이"]
    pts = " ".join(f"{x / T * W:.1f},{(hi - max(lo, min(hi, y))) / (hi - lo) * H:.1f}" for x, y in c["점"])
    marks = "".join(f'<line x1="{t / T * W:.1f}" y1="0" x2="{t / T * W:.1f}" y2="{H}" class="mk"/>'
                    f'<text x="{t / T * W + 4:.1f}" y="{14 + 15 * (i % 3)}" class="mt">{e(n)}</text>' for i, (t, n) in enumerate(c["사건"]))
    grid = "".join(f'<line x1="0" y1="{(hi - g) / (hi - lo) * H:.1f}" x2="{W}" y2="{(hi - g) / (hi - lo) * H:.1f}" class="gr"/>'
                   f'<text x="{W - 4}" y="{(hi - g) / (hi - lo) * H - 3:.1f}" class="gt">{g:.0f} dB</text>' for g in (-12, -24, -36, -48))
    return (f'<figure class="curve"><svg viewBox="0 0 {W} {H}" role="img" aria-label="{e(c["이름"])} 소리 크기 곡선">{grid}{marks}'
            f'<polyline points="{pts}" class="ln"/></svg><figcaption class="mute">{e(c["이름"])} — 0.25초마다 잰 크기(dBFS), 세로줄은 사건 자리</figcaption></figure>')


page = f"""<title>유리결 15초 · 6초</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@300;500&display=swap">
<style>
/* 지난 움직임 시험 페이지와 같은 겨울밤 — 짙은 남색 바탕, 서리 은빛 · 금빛 두 온도, 영상이 주인공 */
:root {{
  --night: #0b1020; --panel: #121a30; --ink: #ece6da; --mute: #a3abbf; --frost: #b9c8e6; --gold: #dcb878;
  --good: #8fd1a8; --warn: #e6b26a; --line: rgba(185, 200, 230, 0.16);
  --serif: "Noto Serif KR", "Batang", serif; --sans: "Noto Sans KR", "Malgun Gothic", sans-serif;
  color-scheme: dark;
}}
body {{ background: var(--night); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.7; }}
.wrap {{ max-width: 1080px; margin: 0 auto; padding-block: 40px 72px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: grid; gap: 48px; }}
header {{ display: grid; gap: 14px; }}
.eyebrow {{ color: var(--gold); font-size: 12px; letter-spacing: 0.14em; }}
h1 {{ font-family: var(--serif); font-weight: 500; font-size: clamp(28px, 4.4vw, 44px); line-height: 1.25; margin: 0; text-wrap: balance; }}
h2 {{ font-family: var(--serif); font-weight: 500; font-size: clamp(21px, 2.8vw, 27px); margin: 0; text-wrap: balance; }}
h3 {{ font-size: 13.5px; letter-spacing: 0.04em; color: var(--frost); margin: 0; font-weight: 500; }}
p {{ margin: 0; max-width: 70ch; }}
.mute {{ color: var(--mute); font-size: 13.5px; }}
a {{ color: var(--frost); }}
a:focus-visible, video:focus-visible {{ outline: 2px solid var(--gold); outline-offset: 3px; }}
.verdict {{ border-left: 2px solid var(--gold); padding: 4px 0 4px 18px; display: grid; gap: 8px; }}
.verdict p {{ font-size: 16px; }}
.films {{ display: grid; grid-template-columns: repeat(2, minmax(0, 360px)); gap: 28px; justify-content: start; }}
.film {{ margin: 0; display: grid; gap: 8px; }}
.film video {{ width: 100%; aspect-ratio: 9 / 16; background: #000; border-radius: 6px; display: block; }}
.film figcaption {{ color: var(--mute); font-size: 13px; }}
.film figcaption b {{ color: var(--ink); font-weight: 500; margin-right: 6px; }}
section {{ display: grid; gap: 16px; padding-top: 28px; border-top: 1px solid var(--line); }}
.tablewrap {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--line); }}
th {{ color: var(--frost); font-weight: 500; font-size: 12.5px; letter-spacing: 0.04em; }}
td.n {{ white-space: nowrap; color: var(--gold); }}
.pill {{ display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 12px; border: 1px solid currentColor; }}
.pill.good {{ color: var(--good); }} .pill.warn {{ color: var(--warn); }}
.fixes {{ display: grid; gap: 22px; }}
.fix {{ display: grid; gap: 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 14px; min-width: 0; }}
.pics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 210px)); gap: 10px; }}
.pics figure {{ margin: 0; display: grid; gap: 4px; }}
.pics img {{ width: 100%; border-radius: 4px; display: block; }}
.pics figcaption {{ color: var(--mute); font-size: 12px; }}
.curve {{ margin: 0; display: grid; gap: 6px; }}
.curve svg {{ width: 100%; height: auto; background: var(--panel); border-radius: 6px; border: 1px solid var(--line); }}
.curve .ln {{ fill: none; stroke: var(--gold); stroke-width: 2; }}
.curve .mk {{ stroke: var(--frost); stroke-opacity: 0.35; stroke-dasharray: 3 4; }}
.curve .mt {{ fill: var(--frost); font-size: 12px; font-family: var(--sans); }}
.curve .gr {{ stroke: var(--line); }}
.curve .gt {{ fill: var(--mute); font-size: 11px; text-anchor: end; font-family: var(--sans); }}
.answers {{ display: grid; gap: 10px; }}
.answers details {{ background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; }}
.answers summary {{ cursor: pointer; color: var(--frost); }}
.answers pre {{ white-space: pre-wrap; font-family: var(--sans); font-size: 13px; color: var(--ink); margin: 10px 0 0; }}
@media (max-width: 760px) {{ .films {{ grid-template-columns: minmax(0, 1fr); }} .film {{ max-width: 360px; }} }}
</style>
<div class="wrap">
<header>
  <span class="eyebrow">PULSE 포트폴리오 · 홀리데이 기프트 세트 · 안 1 · 2 합친 판</span>
  <h1>{e(J["머리"])}</h1>
  <p class="mute">{e(J["머리말"])}</p>
  <div class="verdict">{J["결론"]}</div>
</header>
<section>
  <h2>영상 — 소리를 켜고 보세요</h2>
  <div class="films">{"".join(video(v) for v in J["영상"])}</div>
</section>
<section>
  <h2>콘티 — 15초 움직임표</h2>
  {rows(J["콘티"], ["덩이 · 초", "화면", "카메라", "소리"])}
  <p class="mute">{J["육초"]}</p>
</section>
<section>
  <h2>보여 드리기 전에 찾고 고친 것</h2>
  {rows(J["자체검수"], ["자리", "찾은 것", "고친 것", "남은 것"])}
  <div class="fixes">{"".join(fix(f) for f in J["전후"])}</div>
</section>
<section>
  <h2>소리</h2>
  <p>{J["소리말"]}</p>
  {"".join(curve(c) for c in J["소리곡선"])}
</section>
<section>
  <h2>낯선 시청자 시험</h2>
  <p class="mute">{e(J["시험설명"])}</p>
  {J["시험표"]}
  <div class="answers">{J["시험답"]}</div>
</section>
<section>
  <h2>Fable 검수</h2>
  {J["페이블"]}
</section>
<section>
  <h2>다음</h2>
  <p>{J["다음"]}</p>
</section>
</div>
"""
os.makedirs(밖, exist_ok=True)
open(OUT, "w", encoding="utf-8").write(page)
print("페이지", OUT)
