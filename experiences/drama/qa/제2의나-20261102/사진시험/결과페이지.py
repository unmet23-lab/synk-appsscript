"""
「제2의 나」 사진 기반 아바타 시험 — 결과 페이지(아티팩트) 빌더 (2026-11-03).
결과.json(사람마다 올린 사진 · 기준 셋 · 셀카 · 숫자 · 시험관 답 요약)을 읽어 그림을 긴 변 900px JPEG data URI로 싣고 한 장짜리 HTML을 쓴다.
유호님 사진이 들어가므로 페이지는 비공개 아티팩트로만 올리고, HTML은 git 밖(.tmp)에 둔다.

    python -I -X utf8 결과페이지.py <결과.json> <밖.html>
"""
import base64
import html
import json
import sys

import cv2
import numpy as np

결과 = json.load(open(sys.argv[1], encoding="utf-8"))


def 그림(p, 긴변=900):
    im = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    s = 긴변 / max(h, w)
    if s < 1:
        im = cv2.resize(im, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    return "data:image/jpeg;base64," + base64.b64encode(cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 84])[1].tobytes()).decode()


e = html.escape


def 칸(c):
    숫자 = "".join(f"<div class='n'><span>{e(k)}</span><b>{e(str(v))}</b></div>" for k, v in c.get("숫자", {}).items())
    표 = f"<span class='tag {e(c.get('표', ''))}'>{e(c.get('표글', ''))}</span>" if c.get("표글") else ""
    return (f"<figure class='cell'><img src='{그림(c['그림'])}' alt='{e(c['이름'])}' loading='lazy'>"
            f"<figcaption><div class='cap'><b>{e(c['이름'])}</b>{표}</div>{숫자}"
            + (f"<p class='note'>{e(c['메모'])}</p>" if c.get("메모") else "") + "</figcaption></figure>")


몸 = []
for 사람 in 결과["사람"]:
    몸.append(f"<section class='person'><header><h2>{e(사람['제목'])}</h2><p>{e(사람.get('설명', ''))}</p></header>")
    for 줄 in 사람["줄"]:
        몸.append(f"<h3>{e(줄['제목'])}</h3>" + (f"<p class='lead'>{e(줄['설명'])}</p>" if 줄.get("설명") else ""))
        몸.append("<div class='row'>" + "".join(칸(c) for c in 줄["칸"]) + "</div>")
    if 사람.get("판정"):
        몸.append(f"<div class='verdict'>{사람['판정']}</div>")
    몸.append("</section>")

문서 = f"""<title>제2의 나 사진 아바타</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 시험 기록지 — 사람마다 한 띠: 올린 사진 → 보정 셋 → 셀카, 숫자는 그림 바로 아래 같은 자리에. */
:root{{--bg:#F4F4F1;--card:#FFFFFF;--ink:#171A18;--ink2:#4D5550;--ink3:#7B827D;--line:#DCDFD9;--accent:#E4553D;--ok:#2C6A4D;--warn:#A8740E;--bad:#B23A2D;
  --sans:'SUIT Variable',SUIT,system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#0F1211;--card:#171B19;--ink:#ECF0EC;--ink2:#A9B2AC;--ink3:#7D8680;--line:#2A302D;--accent:#FF7A63;--ok:#7FC59D;--warn:#E3B44C;--bad:#F08A7E;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#0F1211;--card:#171B19;--ink:#ECF0EC;--ink2:#A9B2AC;--ink3:#7D8680;--line:#2A302D;--accent:#FF7A63;--ok:#7FC59D;--warn:#E3B44C;--bad:#F08A7E;color-scheme:dark}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.6}}
.wrap{{max-width:1240px;margin:0 auto;padding-block:28px 72px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:28px}}
h1{{font-size:clamp(26px,4vw,36px);line-height:1.2;margin:0;letter-spacing:-.02em;text-wrap:balance}}
.top p{{margin:8px 0 0;color:var(--ink2);max-width:72ch}}
.summary{{background:var(--card);border-radius:16px;padding:18px 20px;box-shadow:0 0 0 1px var(--line);display:grid;gap:8px}}
.summary h2{{margin:0;font-size:17px}}
.summary ul{{margin:0;padding-left:18px;display:grid;gap:4px}}
.person{{display:grid;gap:12px}}
.person header h2{{margin:0;font-size:22px}}
.person header p{{margin:4px 0 0;color:var(--ink2);max-width:80ch}}
h3{{margin:10px 0 0;font-size:15px;color:var(--ink2);font-weight:700}}
.lead{{margin:0;color:var(--ink3);font-size:13.5px;max-width:80ch}}
.row{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}}
.cell{{margin:0;background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 0 0 1px var(--line);display:flex;flex-direction:column;min-width:0}}
.cell img{{width:100%;aspect-ratio:3/4;object-fit:cover;display:block;background:var(--line)}}
figcaption{{padding:10px 12px 12px;display:grid;gap:4px;font-size:13px;min-width:0}}
.cap{{display:flex;justify-content:space-between;gap:8px;align-items:baseline}}
.cap b{{font-size:14px}}
.n{{display:flex;justify-content:space-between;gap:8px;color:var(--ink2);font-variant-numeric:tabular-nums}}
.n b{{color:var(--ink)}}
.note{{margin:2px 0 0;color:var(--ink3);font-size:12.5px}}
.tag{{font-size:12px;font-weight:700;border-radius:999px;padding:1px 8px;border:1px solid currentColor}}
.tag.ok{{color:var(--ok)}}.tag.warn{{color:var(--warn)}}.tag.bad{{color:var(--bad)}}
.verdict{{background:var(--card);border-left:4px solid var(--accent);border-radius:10px;padding:12px 16px;color:var(--ink2)}}
.foot{{color:var(--ink3);font-size:13px;max-width:85ch}}
</style>
<div class="wrap">
  <div class="top"><h1>제2의 나 — 내 사진으로 만든 아바타 시험</h1><p>{e(결과['머리말'])}</p></div>
  <div class="summary"><h2>먼저 결론</h2><ul>{''.join(f'<li>{x}</li>' for x in 결과['결론'])}</ul></div>
  {''.join(몸)}
  <p class="foot">{e(결과['꼬리말'])}</p>
</div>
"""
open(sys.argv[2], "w", encoding="utf-8").write(문서)
print(json.dumps({"쓴곳": sys.argv[2], "MB": round(len(문서.encode()) / 1e6, 1)}, ensure_ascii=False))
