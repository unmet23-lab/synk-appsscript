"""SYNK 브랜드 킷 완성본 조립 — docs/브랜드킷.html 을 «기계로» 만든다 (2026-08-15 유호 지시).

왜 조립인가(사본 3중화의 교훈 · _브랜드킷.md 머리말): 색표를 손으로 또 쓰면 네 번째 사본이 된다.
  이 도구는 값을 전부 정본에서 읽는다 — hex·직책 = 디자인_토큰.json · 재질 역할 = 라이브러리.json ·
  로고 도형 = _브랜드킷.md §3 정본에서 «복사»(좌표 재작도 금지 — 아래 SVG 가 그 복사본이고,
  좌표가 바뀌면 그 문서에서 다시 복사한다). 값이 바뀌면 이 도구를 재실행한다 — 손 편집 금지.

사용법:  python tools/브랜드킷조립.py          → docs/브랜드킷.html
"""
import base64
import io
import json
import os
import sys

if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

뿌리 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
토큰경로 = os.path.join(뿌리, 'docs', '디자인_토큰.json')
패치뿌리 = os.path.join(뿌리, 'docs', '캐릭터', '펠트패치_0815')
# 마스코트 그림 = «지금 정본» — 토큰 정본사진.평상복(펠트 코랄 · 유호 픽 08-15 ㉠재염색)을 그대로 싣는다.
# ⚠구판(마스코트_렌더/본체.png 체리 젤리 · 그 누끼)을 쓰지 않는다 — 유호 교정 08-15 「적용 제대로」.
#   경로를 하드코딩하지 않고 토큰에서 읽으므로 정본이 갈리면 재조립이 따라간다(F472 문법).
펠트표정 = ['재염색_눈웃음.png', '재염색_눈감음.png']   # 평상복 정본 사진과 같은 폴더의 표정판
출력 = os.path.join(뿌리, 'docs', '브랜드킷.html')


def 럼(hexv):
    h = hexv.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def 글자색(hexv):
    """스와치 위 라벨 색 — 순백·순검정 금지라 킷의 Cream/Ink 로만 가른다."""
    return '#E4E4E7' if 럼(hexv) < 0.35 else '#1B1B1A'


def png_uri(경로, 최대변=None):
    im = Image.open(경로)
    if 최대변 and max(im.size) > 최대변:
        r = 최대변 / max(im.size)
        im = im.resize((round(im.size[0] * r), round(im.size[1] * r)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def main():
    with open(토큰경로, encoding='utf-8') as f:
        토큰 = json.load(f)
    킷 = 토큰['색']['킷']
    마 = 토큰['색']['마스코트']
    펠트 = 토큰['재질']['펠트']
    with open(os.path.join(패치뿌리, '라이브러리.json'), encoding='utf-8') as f:
        장부 = json.load(f)['패치']

    # ── 색 스와치 (팔레트별 묶음 — 순서는 토큰 그대로) ──────────────────────
    팔레트들 = {}
    for c in 킷:
        팔레트들.setdefault(c.get('팔레트', '기타'), []).append(c)
    색절 = []
    for 팔, 줄 in 팔레트들.items():
        칸 = ''.join(
            f'<div class="sw" style="background:{c["hex"]};color:{글자색(c["hex"])}">'
            f'<b>{esc(c["이름"])}</b><code>{c["hex"]}</code>'
            f'<span>{esc(c.get("직책", ""))}</span></div>'
            for c in 줄)
        색절.append(f'<h3>{esc(팔)}</h3><div class="swrow">{칸}</div>')

    # ── 마스코트 램프 (킷 밖 IP — 두 의상) ─────────────────────────────────
    def 램프줄(단들):
        return ''.join(
            f'<div class="sw sm" style="background:{d["hex"]};color:{글자색(d["hex"])}">'
            f'<b>{esc(d["이름"])}</b><code>{d["hex"]}</code></div>'
            for d in 단들)
    체리램프 = 램프줄(마['램프'])
    평상복램프 = 램프줄(마.get('평상복램프', []))
    정본사진 = os.path.join(뿌리, 펠트['정본사진']['평상복'].replace('/', os.sep))
    마컷 = png_uri(정본사진, 최대변=460) if os.path.exists(정본사진) else None
    표정컷 = ''.join(
        f'<img src="{png_uri(os.path.join(os.path.dirname(정본사진), n), 최대변=150)}" alt="" '
        f'style="width:104px;border-radius:12px">'
        for n in 펠트표정 if os.path.exists(os.path.join(os.path.dirname(정본사진), n)))

    # ── 펠트 패치 (역할 장부에서 — 노출층/무대 뒤를 갈라서) ────────────────
    def 패치칸(이름, 항, 작게=False):
        p = os.path.join(패치뿌리, f'{이름}.png')
        if not os.path.exists(p):
            return ''
        태그 = {'공용': '', '마스코트전용': ' · 마스코트 전용', '원료': ' · 무대 뒤(노출 금지)'}[항['역할']]
        목표 = f'<code>{항["목표"]}</code>' if '목표' in 항 else ''
        return (f'<div class="patch{" dim" if 작게 else ""}">'
                f'<img src="{png_uri(p, 최대변=144)}" alt="{esc(이름)}">'
                f'<b>{esc(이름)}{esc(태그)}</b>{목표}</div>')
    노출패치 = ''.join(패치칸(n, e) for n, e in 장부.items() if e['역할'] in ('공용', '마스코트전용'))
    원료패치 = ''.join(패치칸(n, e, 작게=True) for n, e in 장부.items() if e['역할'] == '원료')
    헌법 = ''.join(f'<li>{esc(x)}</li>' for x in 펠트.get('_헌법', []))

    # ── 감각·사운드 (토큰 규칙을 그대로 인용) ──────────────────────────────
    def 규칙들(블록):
        r = 블록.get('규칙', [])
        return r if isinstance(r, list) else [r]
    감각li = ''.join(f'<li>{esc(x)}</li>' for x in 규칙들(토큰.get('감각', {})))
    사운드li = ''.join(f'<li>{esc(x)}</li>' for x in 규칙들(토큰.get('사운드', {})))
    사운드이벤트 = 토큰.get('사운드', {}).get('이벤트', {})
    이벤트칸 = ''.join(f'<span class="chip">{esc(k)}</span>' for k in 사운드이벤트) \
        if isinstance(사운드이벤트, dict) else ''

    html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SYNK 브랜드 킷</title>
<!-- 파생: docs/디자인_토큰.json · docs/캐릭터/펠트패치_0815/라이브러리.json · docs/발표물/_브랜드킷.md -->
<!-- 로고 도형 = 위 _브랜드킷.md §3 복사 · 조립: python tools/브랜드킷조립.py — 손 편집 금지(재조립이 덮는다) -->
<style>
:root {{ --paper:#FAFAF9; --ink:#1B1B1A; --navy:#262626; --navy2:#08090C; --navy3:#373737;
  --cream:#E4E4E7; --coral:#FF6B5C; --coral3:#E8543F; --wash:#FFE9E4; --slate2:#676767; }}
* {{ box-sizing:border-box; margin:0 }}
body {{ background:var(--paper); color:var(--ink); line-height:1.6;
  font-family:'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; }}
.band {{ background:var(--navy2); color:var(--cream); padding:56px 8% 48px; }}
.band svg {{ width:200px; display:block }}
.band h1 {{ font-size:30px; font-weight:800; margin-top:20px }}
.band p {{ color:#8A8A8A; font-size:13px; margin-top:6px }}
section {{ padding:44px 8% }}
section+section {{ border-top:1px solid #D1D2D4 }}
h2 {{ font-size:21px; font-weight:800; margin-bottom:4px }}
h2 em {{ font-style:normal; color:var(--coral3); }}
h3 {{ font-size:13px; font-weight:800; color:var(--slate2); margin:22px 0 8px; text-transform:uppercase; letter-spacing:.06em }}
.lead {{ color:var(--navy3); font-size:14px; max-width:72ch }}
.swrow {{ display:flex; flex-wrap:wrap; gap:10px }}
.sw {{ width:168px; min-height:96px; border-radius:12px; padding:12px 12px 10px; display:flex; flex-direction:column; gap:2px;
  outline:1px solid rgba(0,0,0,.08); outline-offset:-1px }}
.sw b {{ font-size:13px }} .sw code {{ font-family:'DM Mono',ui-monospace,Consolas,monospace; font-size:11px; opacity:.85 }}
.sw span {{ font-size:10.5px; opacity:.8; line-height:1.45; margin-top:auto }}
.sw.sm {{ width:128px; min-height:74px }}
.rulebox {{ background:var(--wash); border-radius:14px; padding:18px 20px; margin-top:18px; font-size:13.5px; max-width:80ch }}
.rulebox b {{ color:var(--coral3) }}
ul {{ padding-left:1.2em; font-size:13.5px; max-width:80ch }} li {{ margin:4px 0 }}
table {{ border-collapse:collapse; font-size:13.5px; margin-top:10px }}
td,th {{ border:1px solid #D1D2D4; padding:7px 12px; text-align:left }}
th {{ background:var(--wash); font-weight:800 }}
code {{ font-family:'DM Mono',ui-monospace,Consolas,monospace; font-size:.92em }}
.dark {{ background:var(--navy2); color:var(--cream) }}
.dark h3 {{ color:#8A8A8A }} .dark .lead {{ color:#8A8A8A }}
.dark td,.dark th {{ border-color:var(--navy3) }} .dark th {{ background:var(--navy3) }}
.mascotrow {{ display:flex; gap:36px; align-items:center; flex-wrap:wrap; margin-top:14px }}
.patchrow {{ display:flex; flex-wrap:wrap; gap:14px; margin-top:12px }}
.patch {{ width:150px; text-align:center; font-size:12px }}
.patch img {{ width:144px; height:144px; border-radius:12px; display:block;
  outline:1px solid rgba(255,255,255,.1); outline-offset:-1px }}
.patch b {{ display:block; margin-top:6px; font-weight:600 }}
.patch.dim {{ opacity:.62; width:110px }} .patch.dim img {{ width:104px; height:104px }}
.chip {{ display:inline-block; background:var(--navy3); color:var(--cream); border-radius:999px;
  padding:3px 12px; font-size:12px; margin:3px 4px 0 0 }}
.logogrid {{ display:flex; gap:22px; flex-wrap:wrap; align-items:stretch; margin-top:14px }}
.logocard {{ border-radius:14px; padding:26px 30px; display:flex; align-items:center; justify-content:center; min-width:230px }}
.logocard svg {{ width:170px }}
.cap {{ font-size:11.5px; color:var(--slate2); margin-top:6px; text-align:center }}
footer {{ padding:26px 8% 40px; font-size:12px; color:var(--slate2) }}
@media print {{ @page {{ margin:0 }} body {{ print-color-adjust:exact; -webkit-print-color-adjust:exact }} }}
</style></head><body class="룸">

<div class="band">
  <svg viewBox="-8 -2 296 116" role="img" aria-label="SYNK">
    <text x="0" y="86" font-family="Inter Tight, system-ui, sans-serif" font-size="72" font-weight="600" letter-spacing="-1" fill="#E4E4E7">syn</text>
    <path d="M138 44 L112 66 L138 88 L150 88 L124 66 L150 44 Z" fill="#FF6B5C"/>
    <path d="M196 92 L216 40 L228 40 L208 92 Z" fill="#E4E4E7" opacity=".5"/>
    <path d="M234 92 L254 40 L266 40 L246 92 Z" fill="#E4E4E7" opacity=".5"/>
  </svg>
  <h1>SYNK 브랜드 킷 — 완성본</h1>
  <p>2026-08-15 · 값 원천 = 디자인_토큰.json(23색+마스코트+재질+사운드+감각) · 이 문서는 조립 산출물 — 고칠 땐 토큰을 고치고 <code>python tools/브랜드킷조립.py</code></p>
</div>

<section>
  <h2>1 · 이름 체계 <em>확정 08-15</em></h2>
  <p class="lead">브랜드 = <b>SYNK LAB</b> · 학습 엔진 = <b>SYNK Core</b> · 그래픽 엔진 = <b>Loom</b> · 마스코트 = <b>몽글</b></p>
</section>

<section>
  <h2>2 · 로고</h2>
  <p class="lead">로고는 그림이 아니라 글자다 — <code>syn&lt;</code> 넉 자. <b>&lt; 는 언제나 Coral</b>(유일한 신호) ·
  <code>//</code> 는 세 번째 색이 아니라 잉크의 저채도. 도형 정본 = 발표물 브랜드킷 §3(복사해 쓰고 재작도 금지).</p>
  <div class="logogrid">
    <div class="logocard" style="background:var(--navy2)">
      <svg viewBox="-8 -2 181 116" role="img" aria-label="SYNK">
        <text x="0" y="86" font-family="Inter Tight, system-ui, sans-serif" font-size="72" font-weight="600" letter-spacing="-1" fill="#E4E4E7">syn</text>
        <path d="M138 44 L112 66 L138 88 L150 88 L124 66 L150 44 Z" fill="#FF6B5C"/>
      </svg>
    </div>
    <div class="logocard" style="background:var(--paper); outline:1px solid #D1D2D4">
      <svg viewBox="-8 -2 181 116" role="img" aria-label="SYNK">
        <text x="0" y="86" font-family="Inter Tight, system-ui, sans-serif" font-size="72" font-weight="600" letter-spacing="-1" fill="#262626">syn</text>
        <path d="M138 44 L112 66 L138 88 L150 88 L124 66 L150 44 Z" fill="#FF6B5C"/>
      </svg>
    </div>
    <div class="logocard" style="background:var(--navy2)">
      <svg viewBox="0 0 240 110" role="img" aria-label="SYNK">
        <g fill="none" stroke="#FAFAF9" stroke-width="11" stroke-linecap="butt" stroke-linejoin="miter">
          <path d="M10 62 C17 50, 29 50, 36 60 C41 67, 48 67, 52 58"/>
          <path d="M68 68 L88 34 L108 68"/>
          <path d="M124 68 L144 34 L164 68"/>
          <path d="M228 22 L186 52 L228 82"/>
        </g>
      </svg>
    </div>
  </div>
  <table><tr><th>자리</th><th>쓰는 것</th></tr>
  <tr><td>인쇄물 머리 띠 · 명함 · 앱 상단</td><td>W5 <code>syn&lt;</code> (기본값)</td></tr>
  <tr><td>표지 · 배너 (가로 넉넉)</td><td>W1 <code>syn&lt; //</code></td></tr>
  <tr><td>정사각 · 워터마크 · 앱 아이콘</td><td>심볼 <code>~ ^ ^ &lt;</code> (= s·y·n·k)</td></tr></table>
</section>

<section>
  <h2>3 · 색 — 23색 킷</h2>
  <p class="lead"><b>철칙 4</b> — ①순백·순검정 금지 ②라이트 배경에 Coral 글자 금지(글자는 Coral 3)
  ③코랄 면 위 글자는 Ink·Navy 2만 ④한 지면 = 바탕+잉크+<b>신호 1점</b>(Lime·KC 는 전용 구역 밖 반입 금지).
  오류에 빨강을 새로 만들지 않는다 — Coral 3+아이콘+문구가 진다.</p>
  {''.join(색절)}
</section>

<section class="dark">
  <h2 style="color:var(--cream)">4 · 마스코트 — 몽글 <em style="color:var(--coral)">킷 밖 IP 색</em></h2>
  <p class="lead">체리는 브랜드 킷 색이 아니라 <b>몽글의 고유색</b>이다(마리오 빨강이 닌텐도 UI 색이 아닌 문법).
  의상이 둘 — 평소 = 코랄(평상복) · 특별한 순간 = 체리. 다크가 주 무대다.</p>
  <div class="mascotrow">
    <div>
      {f'<img src="{마컷}" alt="몽글 — 펠트 정본(평상복)" style="width:250px;border-radius:16px;display:block">' if 마컷 else ''}
      <div style="display:flex;gap:8px;margin-top:8px">{표정컷}</div>
      <div class="cap" style="color:#8A8A8A">정본 = 펠트 코랄(평상복) · 유호 픽 08-15 ㉠재염색</div>
    </div>
    <div>
      <h3>평상복 램프 (코랄 · 킷 계열 — 기본 모습)</h3><div class="swrow">{평상복램프}</div>
      <h3>체리 램프 (특별한 순간 의상)</h3><div class="swrow">{체리램프}</div>
    </div>
  </div>
  <ul style="margin-top:16px">
    <li>체리는 버튼·알약·진행바·링크·강조 글자에 안 쓴다 — 화면 속 체리는 <b>몽글 그림 + 몽글이 직접 내는 것</b>뿐.</li>
    <li>체리 딥은 UI 어디에도 안 쓴다(오류 빨강으로 읽힌다 — 그림 안의 음영은 무관).</li>
    <li>바닥은 목록이 아니라 계산(ΔE 임계 12) — 코랄 짙은 면 위에만 못 올린다. 다크에서 가장 잘 뜬다.</li>
    <li>코랄 UI 와 체리 몽글이 한 화면에서 만나면 색상이 아니라 <b>명도 단</b>으로 가른다.</li>
  </ul>
</section>

<section class="dark" style="border-top:1px solid var(--navy3)">
  <h2 style="color:var(--cream)">5 · 재질 — 펠트 <em style="color:var(--coral)">SYNK 전용 재질</em></h2>
  <p class="lead">니들펠트 양모가 회사 전용 재질이다 — 좌표는 <b>수공 리얼리즘</b>(잔섬유·크림 스티치·미세 불균일 —
  CGI 완벽주의는 흡수하지 않는다). 결은 정본 사진에서만 오고, 색은 재염색 연산이 0원에 낸다.</p>
  <h3>천 팔레트 (실물 패치 — 재염색 파생)</h3>
  <div class="patchrow">{노출패치}</div>
  <h3>무대 뒤 — 파생 원료 (산출물 노출 금지)</h3>
  <div class="patchrow">{원료패치}</div>
  <h3>헌법 (재론 금지 · 실측 근거는 각 정본)</h3>
  <ul>{헌법}</ul>
</section>

<section>
  <h2>6 · 타이포 — 3종 배타</h2>
  <table><tr><th>용도</th><th>서체</th><th>규칙</th></tr>
  <tr><td>한글</td><td>SUIT Variable</td><td>본문 500 · 헤드 800</td></tr>
  <tr><td>라틴·키릴(몽골어)</td><td>Inter Tight — 스택에서 SUIT 보다 <b>앞</b></td><td>순서 불변(글리프 폴백이 3언어를 가른다) · 몽골어 병기 1.04배</td></tr>
  <tr><td>시스템 라벨·숫자</td><td>DM Mono</td><td><b>한글·키릴 금지</b>(글리프 없음 — 즉시 깨진다)</td></tr></table>
  <div class="rulebox"><code>--synk-font: 'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;</code><br>
  <code>--synk-font-mono: 'DM Mono',ui-monospace,SFMono-Regular,Consolas,monospace;</code></div>
</section>

<section>
  <h2>7 · 사운드</h2>
  <p class="lead">이벤트: {이벤트칸 or '토큰 「사운드」 참조'}</p>
  <ul>{사운드li}</ul>
</section>

<section>
  <h2>8 · 감각 — 모서리·그림자·모션</h2>
  <ul>{감각li}</ul>
</section>

<footer>정본 사슬 — 색·서체·감각·사운드·재질 값: docs/디자인_토큰.json · 규칙 전문: DESIGN.md · 컨셉: docs/디자인_컨셉_정본_v1.md ·
로고 도형: docs/발표물/_브랜드킷.md §3 · 재질 역할 장부: docs/캐릭터/펠트패치_0815/라이브러리.json ·
마스코트 렌더 정본: docs/캐릭터/마스코트_렌더</footer>
</body></html>'''

    with open(출력, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'■ 조립  {os.path.relpath(출력, 뿌리)}  ({len(html)//1024} KB · 킷 {len(킷)}색 · 패치 {len(장부)}장)')
    얹기()


def 얹기():
    """Loom 부품 CSS 를 얹는다 — **이 함수가 없으면 재조립할 때마다 킷이 Loom 을 잃는다.**

    파이썬이 CSS 를 만들지 않는다: 부품 값의 정본은 `tools/lib/loom.js` 하나이고, 여기서 베끼면
    두 벌이 되어 갈라진다(갈라지는 방향은 늘 「통과」). 그래서 판정도 조립도 노드 통로에 맡기고
    이 자리는 **부르기만** 한다. 얹기는 멱등이라 두 번 돌려도 블록이 안 쌓인다.

    ⚠ 조용히 실패하지 않는다 — 노드가 없거나 통로가 죽으면 그 사실을 찍는다.
      말 없는 폴백은 「초록 얼굴의 오류」다(F630 계보).
    """
    import subprocess
    통로 = os.path.join(뿌리, 'tools', '지면얹기.js')
    try:
        r = subprocess.run(['node', 통로, '--적용'], cwd=뿌리,
                           capture_output=True, text=True, encoding='utf-8', errors='replace')
    except OSError as e:
        print(f'🔴 Loom 얹기를 못 돌렸다 — {e}. 손으로: node tools/지면얹기.js --적용')
        return
    if r.returncode != 0:
        print(f'🔴 Loom 얹기 실패(exit {r.returncode}) — 킷은 Loom 없이 남았다')
        print((r.stdout or '') + (r.stderr or ''))
        return
    print('■ Loom  node tools/지면얹기.js --적용 (멱등)')


if __name__ == '__main__':
    main()
