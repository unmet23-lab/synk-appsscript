"""공방 배치 지면 — 한 배치에서 «오늘 구운 것»만 모아 발행용 한 장으로 굽는다 (2026-09-05).

왜 따로 있나:
  `tools/공방지면.js` 는 그림을 «상대 경로»로 참조한다 — 727장을 base64 로 심으면 지면이
  수백 MB 가 되어 브라우저가 열기를 거부하기 때문이다. 그래서 그 지면들은 저장소 안에서만 보인다.
  그런데 유호님은 폰으로도 보셔야 한다(아티팩트로 발행하면 상대 경로 그림이 통째로 빈다).
  ⇒ 이 도구는 «한 배치»(수십 장)만 골라 작은 크기로 줄여 심는다. 그 크기라야 발행이 된다.

🔑 무엇을 싣나 — 계획.json 의 «그 묶음»에 든 것만. 손 목록을 안 적는다(자산이 늘어도 안 낡는다).
🔑 크기 둘을 나란히 — 큰 판(고르는 눈)과 실제 쓰이는 88px(작은 크기에서 갈린다 · 계획 규율 ④).

쓰기:
  python tools/공방배치지면.py --묶음 "마린 꾸밈 소품" "세 얼굴 표지" --낸곳 docs/공방/배치_0905.html
  python tools/공방배치지면.py --오늘            # 오늘 구운 것 전부(파일 시각으로 고른다)
"""
import argparse
import base64
import datetime as dt
import io
import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

뿌리 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
계획경로 = os.path.join(뿌리, 'docs/공방/계획.json')
구움방 = os.path.join(뿌리, 'docs/Loom_자산/구움')


def 그림찾기(것):
    """계획 항목 하나가 가리키는 실제 파일. 없으면 None."""
    후보 = []
    if 것.get('파일'):
        후보.append(것['파일'])
    쇠 = 것.get('쇠')
    if 쇠:
        후보 += [쇠 + '.png', 쇠 + '.webp', 쇠 + '.avif']
    후보.append('공방_' + 것['이름'].replace(' ', '') + '.png')
    for f in 후보:
        p = os.path.join(구움방, f)
        if os.path.exists(p):
            return p
    return None


def 심기(경로, 폭, 품질=86):
    im = Image.open(경로)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    im.thumbnail((폭, 폭), Image.LANCZOS)
    b = io.BytesIO()
    if im.mode == 'RGBA':
        im.save(b, 'WEBP', quality=품질, method=6)
    else:
        im.save(b, 'WEBP', quality=품질, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


머리 = '''<title>{제목}</title>
<style>
:root{{
  --paper:#FBF7F0; --ink:#2B2320; --stitch:#F0E3C8; --oat:#EDE7DC;
  --stone:#C7BFB2; --ash:#8D857A; --deepwool:#575046;
  --coral:#F96859; --wash:#FEF0E9; --rim:#941F19;
  --kr:'SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
}}
@media (prefers-color-scheme: dark){{
  :root:not([data-theme="light"]){{
    --paper:#1C1815; --ink:#F2EDE5; --stitch:#3A322B; --oat:#262019;
    --stone:#4A4038; --ash:#9A8F82; --deepwool:#C9BFB2; --wash:#2A1F1B;
  }}
}}
:root[data-theme="dark"]{{
  --paper:#1C1815; --ink:#F2EDE5; --stitch:#3A322B; --oat:#262019;
  --stone:#4A4038; --ash:#9A8F82; --deepwool:#C9BFB2; --wash:#2A1F1B;
}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--paper);color:var(--ink);font-family:var(--kr);
  font-weight:500;letter-spacing:-0.02em;line-height:1.72;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1000px;margin:0 auto;padding:44px 24px 90px}}
h1{{font-size:clamp(26px,5.4vw,36px);font-weight:800;letter-spacing:-0.035em;line-height:1.24;
  margin:0 0 10px;text-wrap:balance}}
.lead{{font-size:16.5px;color:var(--deepwool);margin:0 0 6px;max-width:44em}}
.meta{{font-size:13.5px;color:var(--ash);margin:0 0 8px}}
.tally{{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0 8px}}
.tally a{{font-size:13.5px;font-weight:650;color:var(--deepwool);text-decoration:none;
  background:var(--oat);border-radius:99px;padding:6px 15px}}
.tally a:hover{{background:var(--wash);color:var(--rim)}}
h2{{font-size:12.5px;font-weight:800;letter-spacing:0.07em;color:var(--ash);
  margin:52px 0 4px;scroll-margin-top:20px}}
.h2sub{{font-size:14px;color:var(--ash);margin:0 0 18px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}}
.it{{background:var(--oat);border-radius:14px;padding:14px;text-align:center}}
.it img.big{{width:100%;height:auto;border-radius:9px;display:block;background:transparent}}
.it .nm{{font-size:13.5px;font-weight:700;margin-top:10px;line-height:1.35;word-break:keep-all}}
.it .sm{{margin-top:9px;padding-top:9px;border-top:1px solid var(--stitch);
  display:flex;align-items:center;justify-content:center;gap:8px}}
.it .sm img{{border-radius:4px;display:block}}
.it .sm span{{font-size:11.5px;color:var(--ash)}}
.miss{{background:var(--wash);color:var(--rim);font-size:13px;padding:14px;border-radius:14px}}
.fine{{font-size:13.5px;color:var(--ash);line-height:1.68;margin-top:30px}}
code{{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;
  background:var(--oat);padding:.1em .45em;border-radius:6px}}
</style>

<div class="wrap">
<h1>{제목}</h1>
<p class="lead">{한줄}</p>
<p class="meta">{메타}</p>
<div class="tally">{차례}</div>
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--묶음', nargs='*', default=None)
    ap.add_argument('--낸곳', default='docs/공방/배치_%s.html' % dt.date.today().isoformat())
    ap.add_argument('--제목', default=None)
    ap.add_argument('--큰', type=int, default=440)
    args = ap.parse_args()

    계획 = json.load(io.open(계획경로, encoding='utf-8'))
    묶음들 = [b for b in 계획['제미나이']['묶음']
              if args.묶음 is None or b['이름'] in args.묶음]
    if not 묶음들:
        sys.exit('그 이름의 묶음이 없다: %s' % args.묶음)

    쪽 = []
    차례 = []
    실린수 = 0
    빠진 = []
    for i, b in enumerate(묶음들):
        칸 = []
        for 것 in b['것들']:
            p = 그림찾기(것)
            if not p:
                빠진.append((b['이름'], 것['이름']))
                continue
            큰 = 심기(p, args.큰)
            작 = 심기(p, 88, 82)
            칸.append(
                '<div class="it"><img class="big" src="%s" alt="%s">'
                '<div class="nm">%s</div>'
                '<div class="sm"><img src="%s" width="44" height="44" alt="">'
                '<span>실제 44픽셀</span></div></div>'
                % (큰, 것['이름'], 것['이름'], 작))
            실린수 += 1
        if not 칸:
            continue
        아이디 = 'g%d' % i
        차례.append('<a href="#%s">%s %d</a>' % (아이디, b['이름'], len(칸)))
        쪽.append('<h2 id="%s">%s</h2><p class="h2sub">%s</p><div class="grid">%s</div>'
                  % (아이디, b['이름'], b.get('쓰는 곳', ''), ''.join(칸)))

    제목 = args.제목 or '펠트 배치 %s' % dt.date.today().strftime('%m-%d')
    한줄 = ('제미나이로 구운 펠트 자산입니다. 큰 판은 고르시는 눈이고, 아래 작은 것은 '
            '앱과 지면에서 실제로 보이는 크기입니다. 작은 크기에서 갈립니다.')
    메타 = ('%s · %d장 · 4K 원본에서 줄여 실었습니다 · 원본은 저장소 '
            'docs/Loom_자산/구움/' % (dt.date.today().isoformat(), 실린수))

    html = 머리.format(제목=제목, 한줄=한줄, 메타=메타, 차례=''.join(차례))
    html += ''.join(쪽)
    if 빠진:
        html += ('<p class="fine">아직 안 구운 것 %d개 — %s</p>'
                 % (len(빠진), ' · '.join('%s' % n for _, n in 빠진[:14])))
    html += ('<p class="fine">이 지면은 판정 재료입니다. 고르신 것이 '
             '<code>docs/_ops/결정.md</code> 에 적힙니다.</p></div>')

    낸곳 = os.path.join(뿌리, args.낸곳)
    os.makedirs(os.path.dirname(낸곳), exist_ok=True)
    io.open(낸곳, 'w', encoding='utf-8').write(html)
    print('%s · %d장 · %.1fMB · 못 실은 것 %d'
          % (args.낸곳, 실린수, os.path.getsize(낸곳) / 1048576, len(빠진)))


if __name__ == '__main__':
    main()
