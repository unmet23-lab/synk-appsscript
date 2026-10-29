# -*- coding: utf-8 -*-
# 유호님께 보여 드릴 움직임 시험 페이지(안 1 · 2 합친 판) — 우리 두 장면 mp4와 명품 광고 비교 프레임을 옆 파일로 두는 한 장.
# 명품 광고 프레임은 남의 저작물이라 git 밖 페이지 폴더에만 두고, 아티팩트에는 작게 몇 장만 비교용으로 싣는다.
#   python -I -X utf8 움직임페이지.py   → <밖>/움직임/페이지/index.html (+ 영상 · 그림 파일), 내용은 같은 폴더 내용.json
import html
import json
import os

밖 = r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/holiday-giftset/새컨셉/움직임/페이지"
OUT = os.path.join(밖, "index.html")
J = json.load(open(os.path.join(밖, "내용.json"), encoding="utf-8"))
e = html.escape


def ref_block(r):
    frames = "".join(f'<img src="{e(p)}" alt="{e(r["이름"])} {i + 1}번째 장면" loading="lazy">' for i, p in enumerate(r["그림"]))
    return (f'<div class="ref"><div class="refhead"><b>{e(r["이름"])}</b><span>{e(r["브랜드"])} · {e(r["연도"])} · '
            f'{e(r["조회"])}</span></div><div class="refstrip">{frames}</div>'
            f'<p class="mute">{e(r["한줄"])} <a href="{e(r["주소"])}" target="_blank" rel="noopener">유튜브에서 {e(r["구간"])} 보기</a></p></div>')


def before_after(ba):
    if not ba:
        return ""
    return (f'<div class="ba"><figure><img src="{e(ba["전"])}" alt="첫 판 끝 장" loading="lazy"><figcaption>첫 판</figcaption></figure>'
            f'<figure><img src="{e(ba["후"])}" alt="고친 판 끝 장" loading="lazy"><figcaption>고친 판</figcaption></figure>'
            f'<p class="mute">{ba["말"]}</p></div>')


def scene(sc):
    refs = "".join(ref_block(r) for r in sc["견줄광고"])
    notes = "".join(f"<li>{x}</li>" for x in sc["볼것"]) + ""
    return f"""<section class="scene">
  <div class="scenehead"><span class="beat">{e(sc["자리"])}</span><h2>{e(sc["제목"])}</h2></div>
  <div class="pair">
    <figure class="ours"><video src="{e(sc["영상"])}" poster="{e(sc["포스터"])}" autoplay muted loop playsinline controls></video>
      <figcaption>우리 판 · 블렌더 · 3초 · 30fps</figcaption></figure>
    <div class="side"><ul class="notes">{notes}</ul>{before_after(sc.get("전후"))}<h3>나란히 볼 명품 광고</h3>{refs}</div>
  </div>
</section>"""


page = f"""<title>유리결 움직임 시험</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@300;500&display=swap">
<style>
/* 한 줄 흐름: 지난 새 컨셉 페이지와 같은 겨울밤 — 짙은 남색 바탕, 서리 은빛 · 금빛 두 온도, 영상이 주인공 */
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
h3 {{ font-size: 13px; letter-spacing: 0.08em; color: var(--frost); margin: 6px 0 0; font-weight: 500; }}
p {{ margin: 0; max-width: 68ch; }}
.mute {{ color: var(--mute); font-size: 13.5px; }}
a {{ color: var(--frost); }}
a:focus-visible, video:focus-visible {{ outline: 2px solid var(--gold); outline-offset: 3px; }}
.verdict {{ border-left: 2px solid var(--gold); padding: 4px 0 4px 18px; display: grid; gap: 8px; }}
.verdict p {{ font-size: 16px; }}
.scene {{ display: grid; gap: 18px; padding-top: 28px; border-top: 1px solid var(--line); }}
.scenehead {{ display: grid; gap: 4px; }}
.beat {{ color: var(--gold); font-size: 12.5px; letter-spacing: 0.1em; }}
.pair {{ display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 28px; align-items: start; }}
.ours {{ margin: 0; display: grid; gap: 8px; }}
.ours video {{ width: 100%; aspect-ratio: 9 / 16; max-width: 100%; background: #000; border-radius: 6px; display: block; }}
.ours figcaption {{ color: var(--mute); font-size: 12.5px; }}
.side {{ display: grid; gap: 14px; min-width: 0; }}
.notes {{ margin: 0; padding-left: 18px; display: grid; gap: 6px; }}
.ref {{ display: grid; gap: 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px; min-width: 0; }}
.refhead {{ display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }}
.refhead span {{ color: var(--mute); font-size: 12.5px; }}
.refstrip {{ display: grid; grid-auto-flow: column; grid-auto-columns: minmax(64px, 1fr); gap: 6px; overflow-x: auto; }}
.refstrip img {{ width: 100%; border-radius: 3px; display: block; }}
.ba {{ display: grid; grid-template-columns: repeat(2, minmax(0, 120px)) minmax(0, 1fr); gap: 10px; align-items: end; }}
.ba figure {{ margin: 0; display: grid; gap: 4px; }}
.ba img {{ width: 100%; border-radius: 4px; display: block; }}
.ba figcaption {{ color: var(--mute); font-size: 12px; }}
.tablewrap {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--line); }}
th {{ color: var(--frost); font-weight: 500; font-size: 12.5px; letter-spacing: 0.04em; }}
td.n {{ white-space: nowrap; }}
.pill {{ display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 12px; border: 1px solid currentColor; }}
.pill.good {{ color: var(--good); }} .pill.warn {{ color: var(--warn); }}
.flow {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }}
.flow div {{ background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px; display: grid; gap: 4px; align-content: start; }}
.flow b {{ color: var(--gold); font-size: 12.5px; font-weight: 500; letter-spacing: 0.06em; }}
.flow .here {{ border-color: var(--gold); }}
section > h2 + * {{ margin-top: 0; }}
.block {{ display: grid; gap: 14px; }}
@media (max-width: 760px) {{
  .pair {{ grid-template-columns: minmax(0, 1fr); }}
  .ours {{ max-width: 340px; }}
  .flow {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
}}
@media (prefers-reduced-motion: reduce) {{ video {{ animation: none; }} }}
</style>
<div class="wrap">
<header>
  <span class="eyebrow">PULSE 포트폴리오 · 홀리데이 기프트 세트 · 안 1 · 2 합친 판</span>
  <h1>{e(J["머리"])}</h1>
  <p class="mute">{e(J["머리말"])}</p>
  <div class="verdict">{J["결론"]}</div>
</header>
{"".join(scene(sc) for sc in J["장면"])}
<section class="block scene">
  <h2>명품 광고 사이에 끼워 본 눈가림 시험</h2>
  <p class="mute">{e(J["시험설명"])}</p>
  {J["시험표"]}
</section>
<section class="block scene">
  <h2>Fable 검수</h2>
  {J["페이블"]}
</section>
<section class="block scene">
  <h2>보여 드리기 전에 찾고 고친 것</h2>
  {J["자체검수"]}
</section>
<section class="block scene">
  <h2>15초 안에서 이 두 장면의 자리</h2>
  <div class="flow">{J["흐름"]}</div>
  <p class="mute">{e(J["다음"])}</p>
</section>
</div>
"""
open(OUT, "w", encoding="utf-8").write(page)
print("페이지", OUT)
