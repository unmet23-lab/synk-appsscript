"""SYNK 브랜드 킷 완성본 조립 — docs/브랜드킷.html 을 «기계로» 만든다 (2026-08-15 유호 지시).

왜 조립인가(사본 3중화의 교훈 · _브랜드킷.md 머리말): 색표를 손으로 또 쓰면 네 번째 사본이 된다.
  이 도구는 값을 전부 정본에서 읽는다 — hex·직책 = 디자인_토큰.json · 재질 역할 = 라이브러리.json ·
  로고 도형 = _브랜드킷.md §3 정본에서 «복사»(좌표 재작도 금지 — 아래 SVG 가 그 복사본이고,
  좌표가 바뀌면 그 문서에서 다시 복사한다). 값이 바뀌면 이 도구를 재실행한다 — 손 편집 금지.

사용법:  python tools/브랜드킷조립.py          → docs/브랜드킷.html
"""
import base64
import datetime
import io
import json
import os
import subprocess
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
# 마스코트 그림 = «지금 정본» — 토큰 정본사진.평상복(정본_4K)을 그대로 싣는다.
#   경로를 하드코딩하지 않고 토큰에서 읽으므로 정본이 갈리면 재조립이 따라간다(F472 문법).
# 🔴 2026-09-05 수리 — 표정 두 장의 «파일 이름»이 여기 손으로 적혀 있었다(`재염색_눈웃음.png`·
#   `재염색_눈감음.png`). 그 이름은 그날 정본에서 내려간 옛 세트의 것이라(유호 「색 표현이
#   싸구려 같아」) 정본_4K 에는 없는 파일이고, 아래 조립이 `os.path.exists` 로 감싸 있어서
#   **표정 두 장이 소리 없이 빠질 참이었다** — 오류도 안 나고 지면만 조용히 얇아진다.
#   ⇒ 이름을 여기 안 적는다. 컷 어휘의 주인(`tools/lib/마스코트자산.js`)에게 «어느 파일인가»를
#     묻고, 없으면 던진다(홈페이지 시안 굽기와 같은 규율).
펠트표정어휘 = ['눈웃음', '눈감음']   # «감정»이 아니라 그림 컷 이름 — 모듈이 파일로 옮겨 준다
출력 = os.path.join(뿌리, 'docs', '브랜드킷.html')


def 정본컷경로(컷: str) -> str:
    """마스코트자산 모듈에 «어느 파일인가»를 묻는다 — 경로도 파일 이름도 여기 안 적는다."""
    모듈 = os.path.join(뿌리, 'tools', 'lib', '마스코트자산.js').replace(os.sep, '/')
    r = subprocess.run(
        ['node', '-e', f"const a=require({모듈!r});process.stdout.write(a.경로({컷!r},{{누끼:true}}));"],
        capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0 or not (r.stdout or '').strip():
        raise SystemExit(f'마스코트자산 모듈이 컷 「{컷}」의 경로를 안 준다: ' + (r.stderr or '').strip())
    p = os.path.join(뿌리, (r.stdout or '').strip().replace('/', os.sep))
    if not os.path.exists(p):
        raise SystemExit(f'모듈이 준 경로에 파일이 없다: {p}')
    return p


def 럼(hexv):
    h = hexv.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def 대비(a, b):
    x, y = sorted((럼(a), 럼(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def 글자색(hexv, 잉크, 종이):
    """스와치 위 라벨 색 — 순백·순검정 금지라 킷의 잉크/종이 둘로만 가른다.

    밝기 문턱이 아니라 «대비가 큰 쪽»을 고른다. 문턱(구판 0.35)은 코랄 면에서 틀렸다 —
    Coral 은 휘도상 어두운 쪽에 떨어져 종이색 라벨을 골랐는데 대비 2.31 로 미달이었다.
    철칙 ③(코랄 면 위 글자는 Ink)이 이미 그 답을 적어 뒀고, 대비로 고르면 그것과 일치한다.
    """
    return 잉크 if 대비(hexv, 잉크) >= 대비(hexv, 종이) else 종이


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



def 로고표준형():
    """로고 SVG 는 실행 정본(tools/lib/로고정본.js) 하나에서만 온다 — 유호 확정 08-24 «synk 승격».

    파이썬이라 require 를 못 하므로 CLI 로 받는다(_룸입히기와 같은 이유 — 베끼면 통로가 둘이 된다).
    실패는 조용히 넘기지 않는다: 로고 없는 브랜드킷을 «성공»으로 내면 안 된다.
    """
    import subprocess
    r = subprocess.run(['node', os.path.join(뿌리, 'tools', 'lib', '로고정본.js'), '--json'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        raise SystemExit(f'로고정본 CLI 실패(rc={r.returncode}): {(r.stderr or "")[:300]}')
    return json.loads(r.stdout)


def main():
    with open(토큰경로, encoding='utf-8') as f:
        토큰 = json.load(f)
    킷 = 토큰['색']['킷']
    이름값 = {c['이름']: c['hex'] for c in 킷}
    오늘 = datetime.date.today().isoformat()
    # 역할은 내가 고르지 않는다 — 토큰 시맨틱이 정본이다(내 눈대중 매핑이 대비 위반을 만들었다).
    라 = {k: 이름값[v] for k, v in 토큰['색']['시맨틱']['라이트'].items() if not k.startswith('_')}
    다 = {k: 이름값[v] for k, v in 토큰['색']['시맨틱']['다크'].items() if not k.startswith('_')}
    잉크, 종이 = 라['잉크'], 라['바탕']
    마 = 토큰['색']['마스코트']
    로고 = 로고표준형()
    펠트 = 토큰['재질']['펠트']
    with open(os.path.join(패치뿌리, '라이브러리.json'), encoding='utf-8') as f:
        장부 = json.load(f)['패치']

    # ── 색 스와치 — «현행만» 싣는다 ─────────────────────────────────────────
    # 🔴 퇴역 대기 색(⏳)은 이 킷 문서에 **아예 안 나온다**(유호 확정 2026-08-20 「아예 빼줘」).
    #    접어 두는 것으로도 부족하다 — 남겨두면 반드시 다시 참조된다(CLAUDE.md 「낡은 것은 남기지 않는다」).
    #    ⚠토큰에서 못 지우는 이유는 따로다: Loom 지면 층(tools/lib/loom.js)이 아직 그 무채를 쓴다.
    #      그 층이 양모로 옮겨지면 토큰에서도 사라지고, 그때 이 필터는 저절로 빈 집합이 된다.
    #    판정은 손 목록이 아니라 토큰 직책의 ⏳ 표식이다 — 목록으로 적으면 색이 늘 때 조용히 갈라진다.
    def 퇴역대기(c):
        return c.get('직책', '').lstrip().startswith('⏳')

    현행 = [c for c in 킷 if not 퇴역대기(c)]

    def 칸들(줄):
        return ''.join(
            f'<div class="sw" style="background:{c["hex"]};color:{글자색(c["hex"], 잉크, 종이)}">'
            f'<b>{esc(c["이름"])}</b><code>{c["hex"]}</code>'
            f'<span>{esc(c.get("직책", ""))}</span></div>'
            for c in 줄)

    팔레트들 = {}
    for c in 현행:
        팔레트들.setdefault(c.get('팔레트', '기타'), []).append(c)
    색절 = [f'<h3>{esc(팔)}</h3><div class="swrow">{칸들(줄)}</div>'
            for 팔, 줄 in 팔레트들.items()]

    # ── 마스코트 램프 — 의상은 «코랄 하나»다 (체리 퇴역 · 유호 확정 2026-08-19) ──
    # 🚫 체리 램프를 여기 다시 싣지 않는다. 08-15 의 «상태 의상 2벌»은 끝났다.
    평상복램프 = ''.join(
        f'<div class="sw sm" style="background:{d["hex"]};color:{글자색(d["hex"], 잉크, 종이)}">'
        f'<b>{esc(d["이름"])}</b><code>{d["hex"]}</code></div>'
        for d in 마.get('평상복램프', []))
    정본사진 = os.path.join(뿌리, 펠트['정본사진']['평상복'].replace('/', os.sep))
    if not os.path.exists(정본사진):
        raise SystemExit(f'토큰이 가리키는 평상복 정본이 없다: {정본사진}')
    마컷 = png_uri(정본사진, 최대변=460)
    # 꼬리말이 가리키는 폴더도 토큰에서 «파생»한다 — 손으로 적으면 정본이 갈리는 날 거짓말이 된다.
    마스코트정본폴더 = os.path.dirname(펠트['정본사진']['평상복'])
    표정컷 = ''.join(
        f'<img src="{png_uri(정본컷경로(컷), 최대변=150)}" alt="" '
        f'style="width:104px;border-radius:12px">'
        for 컷 in 펠트표정어휘)

    # ── 펠트 패치 (역할 장부에서 — 노출층/무대 뒤를 갈라서) ────────────────
    # 🔴 천은 «구운 실물»이라 색표처럼 걷어낼 수 없다 — 감추면 「천이 다 있다」로 읽힌다.
    #    그래서 지우는 대신 **낡음을 얼굴에 붙인다**: 목표색을 현행 토큰에 대고 자동 판정한다.
    #    (실측 08-20: 공용 9벌 중 현행 킷 색은 KCSun·KCCoolBlue 둘뿐 — 그 둘도 Part 6 전용이다.)
    현행hex = {c['hex'].upper() for c in 현행}
    퇴역hex = {c['hex'].upper() for c in 킷 if 퇴역대기(c)}

    def 천판정(항):
        h = str(항.get('목표', '')).upper()
        if not h:
            return '', ''
        if h in 현행hex:
            return '', ''
        if h in 퇴역hex:
            return ' stale', '<b class="badge">⏳ 퇴역 대기 색 — 재염색 대상</b>'
        return ' stale', '<b class="badge">🔴 구 킷 색 — 재염색 필요</b>'

    def 패치칸(이름, 항, 작게=False):
        p = os.path.join(패치뿌리, f'{이름}.png')
        if not os.path.exists(p):
            return ''
        태그 = {'공용': '', '마스코트전용': ' · 마스코트 전용', '원료': ' · 무대 뒤(노출 금지)',
              '정본사진': ' · 원천 사진'}.get(항['역할'], '')
        목표 = f'<code>{항["목표"]}</code>' if '목표' in 항 else ''
        낡음, 배지 = 천판정(항)
        return (f'<div class="patch{" dim" if 작게 else ""}{낡음}">'
                f'<img src="{png_uri(p, 최대변=144)}" alt="{esc(이름)}">'
                f'<b>{esc(이름)}{esc(태그)}</b>{목표}{배지}</div>')
    노출패치 = ''.join(패치칸(n, e) for n, e in 장부.items() if e['역할'] in ('공용', '마스코트전용'))
    원료패치 = ''.join(패치칸(n, e, 작게=True) for n, e in 장부.items() if e['역할'] == '원료')
    # 2027 실 천이 아예 없다는 사실을 «빈칸»으로 두지 않는다 — 없는 것은 없다고 적는다.
    실이름 = ['Lapis', 'Meadow', 'Butter', 'Pop', 'Stitch', 'Oat', 'Stone', 'Ink']
    없는천 = [n for n in 실이름 if n not in 장부]
    천결손 = (f'<p class="lead" style="margin-top:12px"><b>🔴 2027 킷 천 {len(없는천)}벌이 없다</b> — '
              f'{esc(" · ".join(없는천))}. 펠트는 SYNK 전용 재질인데 2027 실(청금석·메도우·버터·팝)과 '
              '양모 밤 축의 천이 아직 한 벌도 안 구워졌다. 굽는 통로 = <code>tools/펠트색굽기.js</code> — '
              '⚠ 2026-09-05 부터 <b>그 통로가 멈춰 있다</b>: 색 참조로 쓰던 옛 마스코트 견본이 '
              '같은 날 지워졌다(정본이 4K 로 갈리며 재염색 자체가 내려갔다). 다시 열려면 견본을 '
              '새 정본에서 먼저 뜬다.</p>'
              ) if 없는천 else ''
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
/* 값은 전부 토큰 «시맨틱»에서 온다 — 어느 색을 어디 쓸지는 이 파일이 정하지 않는다. */
:root {{ --paper:{라["바탕"]}; --ink:{라["잉크"]}; --navy2:{다["바탕"]}; --navy3:{라["보조잉크"]};
  --cream:{다["잉크"]}; --darkmute:{다["보조잉크2"]}; --line:{이름값["Stone"]};
  --coral:{라["신호_면"]}; --coral3:{라["신호_글자_대형"]}; --wash:{라["신호_바닥"]}; --slate2:{라["보조잉크"]}; }}
* {{ box-sizing:border-box; margin:0 }}
body {{ background:var(--paper); color:var(--ink); line-height:1.6;
  font-family:'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; }}
.band {{ background:var(--navy2); color:var(--cream); padding:56px 8% 48px; }}
.band svg {{ width:200px; display:block }}
.band h1 {{ font-size:30px; font-weight:800; margin-top:20px }}
.band p {{ color:var(--darkmute); font-size:13px; margin-top:6px }}
section {{ padding:44px 8% }}
section+section {{ border-top:1px solid var(--line) }}
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
td,th {{ border:1px solid var(--line); padding:7px 12px; text-align:left }}
th {{ background:var(--wash); font-weight:800 }}
code {{ font-family:'DM Mono',ui-monospace,Consolas,monospace; font-size:.92em }}
.dark {{ background:var(--navy2); color:var(--cream) }}
.dark h3 {{ color:var(--darkmute) }} .dark .lead {{ color:var(--darkmute) }}
.dark td,.dark th {{ border-color:var(--navy3) }} .dark th {{ background:var(--navy3) }}
.mascotrow {{ display:flex; gap:36px; align-items:center; flex-wrap:wrap; margin-top:14px }}
.patchrow {{ display:flex; flex-wrap:wrap; gap:14px; margin-top:12px }}
.patch {{ width:150px; text-align:center; font-size:12px }}
.patch img {{ width:144px; height:144px; border-radius:12px; display:block;
  outline:1px solid rgba(255,255,255,.1); outline-offset:-1px }}
.patch b {{ display:block; margin-top:6px; font-weight:600 }}
.patch.dim {{ opacity:.62; width:110px }} .patch.dim img {{ width:104px; height:104px }}
.patch.stale img {{ opacity:.45; filter:grayscale(.5) }}
.badge {{ display:block; margin-top:4px; font-size:10.5px; font-weight:700; color:var(--coral) }}
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
  {로고['펠트다크_슬래시']}
  <h1>SYNK 브랜드 킷 — 완성본</h1>
  <p>값 원천 = 디자인_토큰.json({len(현행)}색+마스코트+재질+사운드+감각) · 이 문서는 조립 산출물(마지막 조립 {오늘}) — 고칠 땐 토큰을 고치고 <code>python tools/브랜드킷조립.py</code></p>
</div>

<section>
  <h2><span class="번호">1</span> 이름 체계 <em>확정 08-15</em></h2>
  <p class="lead">브랜드 = <b>SYNK LAB</b> · 학습 엔진 = <b>SYNK Core</b> · 그래픽 엔진 = <b>Loom</b> · 마스코트 = <b>몽글</b></p>
</section>

<section>
  <h2><span class="번호">2</span> 로고</h2>
  <p class="lead">로고는 그림이 아니라 글자다 — <code>synk</code> 넉 자(k = Inter Tight 실제 글리프 · <b>언제나 Coral</b>).
  기호 <code>&lt;</code> 는 워드마크에서 독립한 표식이다(상단바·진행·도장·워터마크 — 이름을 반복하지 않는 자리).
  <code>//</code> 는 세 번째 색이 아니라 잉크의 저채도. 실행 정본 = <code>tools/lib/로고정본.js</code>(재작도·복붙 금지).</p>
  <div class="logogrid">
    <div class="logocard" style="background:var(--navy2)">
      {로고['펠트다크']}
    </div>
    <div class="logocard" style="background:var(--paper); outline:1px solid var(--line)">
      {로고['펠트라이트']}
    </div>
    <div class="logocard" style="background:var(--navy2)">
      <svg viewBox="0 0 240 110" role="img" aria-label="SYNK">
        <g fill="none" stroke="{다["잉크"]}" stroke-width="11" stroke-linecap="butt" stroke-linejoin="miter">
          <path d="M10 62 C17 50, 29 50, 36 60 C41 67, 48 67, 52 58"/>
          <path d="M68 68 L88 34 L108 68"/>
          <path d="M124 68 L144 34 L164 68"/>
          <path d="M228 22 L186 52 L228 82"/>
        </g>
      </svg>
    </div>
  </div>
  <table><tr><th>자리</th><th>쓰는 것</th></tr>
  <tr><td>인쇄물 머리 띠 · 명함 · 표지</td><td>워드마크 <code>synk</code> — 벡터 펠트(기본) · 소형은 민판</td></tr>
  <tr><td>앱 상단바 · 진행 · 로딩 · 도장 · 워터마크</td><td>기호 <code>&lt;</code> 자수판 — 이름을 반복하지 않는 자리</td></tr>
  <tr><td>정사각 · 워터마크 · 앱 아이콘</td><td>심볼 <code>~ ^ ^ &lt;</code> (= s·y·n·k)</td></tr></table>
</section>

<section>
  <h2><span class="번호">3</span> 색 — {len(현행)}색 킷</h2>
  <p class="lead"><b>두 원리</b> — ①<b>색이 아니라 램프다</b>(유채색은 전부 3단: 보풀 빛 Soft·몸통·그늘 Deep)
  ②<b>실은 부품, 램프가 정본</b>(2027 실은 유행이 지나면 그 실만 갈아끼운다).</p>
  <p class="lead"><b>철칙 4</b> — ①순백·순검정 금지(라이트 하한 = Paper·Ink)
  ②라이트 배경에 <b>몸통색 글자 금지</b> — Coral·Meadow 는 면이고 글자는 그 실의 Deep
  ③몸통 면 위 글자는 실마다 정해져 있다: 코랄·버터 = <b>Ink</b> / 청금석 = <b>Paper</b> / 팝 = Ink(큰 글자)
  ④<b>주연 1실 + 조연 1실</b> — 한 화면의 유채 실은 둘까지, 나머지 실은 그 화면에서 쉰다(KC 4색은 Part 6 전용).
  오류에 빨강을 새로 만들지 않는다 — Coral 3+아이콘+문구가 진다.</p>
  {''.join(색절)}
</section>

<section class="dark">
  <h2 style="color:var(--cream)"><span class="번호">4</span> 마스코트 — 몽글 <em style="color:var(--coral)">펠트 코랄</em></h2>
  <p class="lead">의상은 <b>펠트 코랄 하나</b>다 — 체리(빨간 구판)는 퇴역했다(유호 확정 2026-08-19).
  평상복 램프와 킷 <b>Coral Soft~Rim 이 같은 값</b>이다: 마스코트 색이 곧 UI 색이다. 다크가 주 무대다.</p>
  <div class="mascotrow">
    <div>
      {f'<img src="{마컷}" alt="몽글 — 펠트 정본(평상복)" style="width:250px;border-radius:16px;display:block">' if 마컷 else ''}
      <div style="display:flex;gap:8px;margin-top:8px">{표정컷}</div>
      <div class="cap" style="color:var(--darkmute)">정본 = 펠트 코랄(평상복) · 유호 픽 08-15 ㉠재염색</div>
    </div>
    <div>
      <h3>평상복 램프 (코랄 — 유일한 의상 · 킷 코랄 축과 같은 값)</h3><div class="swrow">{평상복램프}</div>
    </div>
  </div>
  <ul style="margin-top:16px">
    <li>🚫 체리(구판)는 자산·토큰·배선에서 걷혔다 — 경로 정본은 <code>tools/lib/마스코트자산.js</code> 하나가 안다.</li>
    <li>Coral Felt Deep 은 UI 어디에도 안 쓴다(오류 빨강으로 읽힌다 — 그림 안의 음영은 무관).</li>
    <li>바닥은 목록이 아니라 계산(ΔE 임계 12) — 코랄 짙은 면 위에만 못 올린다. 다크에서 가장 잘 뜬다.</li>
    <li>인라인하면 <code>data-synk-mascot</code> — 린트는 <code>src</code> 경로로 그림을 찾는다.</li>
  </ul>
</section>

<section class="dark" style="border-top:1px solid var(--navy3)">
  <h2 style="color:var(--cream)"><span class="번호">5</span> 재질 — 펠트 <em style="color:var(--coral)">SYNK 전용 재질</em></h2>
  <p class="lead">니들펠트 양모가 회사 전용 재질이다 — 좌표는 <b>수공 리얼리즘</b>(잔섬유·크림 스티치·미세 불균일 —
  CGI 완벽주의는 흡수하지 않는다). 결은 정본 사진에서만 오고, 색은 재염색 연산이 0원에 낸다.</p>
  <h3>천 팔레트 (실물 패치 — 재염색 파생)</h3>
  <div class="patchrow">{노출패치}</div>
  {천결손}
  <h3>무대 뒤 — 파생 원료 (산출물 노출 금지)</h3>
  <div class="patchrow">{원료패치}</div>
  <h3>헌법 (재론 금지 · 실측 근거는 각 정본)</h3>
  <ul>{헌법}</ul>
</section>

<section>
  <h2><span class="번호">6</span> 타이포 — 3종 배타</h2>
  <table><tr><th>용도</th><th>서체</th><th>규칙</th></tr>
  <tr><td>한글</td><td>SUIT Variable</td><td>본문 500 · 헤드 800</td></tr>
  <tr><td>라틴·키릴(몽골어)</td><td>Inter Tight — 스택에서 SUIT 보다 <b>앞</b></td><td>순서 불변(글리프 폴백이 3언어를 가른다) · 몽골어 병기 1.04배</td></tr>
  <tr><td>시스템 라벨·숫자</td><td>DM Mono</td><td><b>한글·키릴 금지</b>(글리프 없음 — 즉시 깨진다)</td></tr></table>
  <div class="rulebox"><code>--synk-font: 'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;</code><br>
  <code>--synk-font-mono: 'DM Mono',ui-monospace,SFMono-Regular,Consolas,monospace;</code></div>
</section>

<section>
  <h2><span class="번호">7</span> 사운드</h2>
  <p class="lead">이벤트: {이벤트칸 or '토큰 「사운드」 참조'}</p>
  <ul>{사운드li}</ul>
</section>

<section>
  <h2><span class="번호">8</span> 감각 — 모서리·그림자·모션</h2>
  <ul>{감각li}</ul>
</section>

<footer>정본 사슬 — 색·서체·감각·사운드·재질 값: docs/디자인_토큰.json · 규칙 전문: DESIGN.md · 컨셉: docs/디자인_컨셉_정본_v1.md ·
로고 도형: docs/발표물/_브랜드킷.md §3 · 재질 역할 장부: docs/캐릭터/펠트패치_0815/라이브러리.json ·
마스코트 렌더 정본: {마스코트정본폴더}</footer>
</body></html>'''

    with open(출력, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'■ 조립  {os.path.relpath(출력, 뿌리)}  ({len(html)//1024} KB · 현행 {len(현행)}색(퇴역 {len(킷)-len(현행)} 제외) · 패치 {len(장부)}장)')
    _룸입히기(출력)


def _룸입히기(경로):
    """Loom 부품을 얹는다 — 판정도 절차도 `tools/lib/loom얹기.js` 하나가 진다.

    🔑 파이썬이라 그 모듈을 require 할 수 없다. 그렇다고 여기서 «얹는 법»을 다시 적으면
       그 순간 통로가 둘이 되고, 갈라지는 방향은 늘 「통과」다(한쪽만 훅 게이트를 빠뜨리면
       그 지면은 부품 0 인 채 마커만 켜진 초록이 된다 · F517②).
       ⇒ 베끼지 않고 **그 통로의 CLI 를 부른다.** 재는 자는 하나로 남는다.
    ⚠node 가 없거나 실패하면 «조용히» 넘기지 않는다 — 안 얹힌 것이 초록으로 보이면 안 된다.
    """
    import subprocess
    통로 = os.path.join(뿌리, 'tools', 'lib', 'loom얹기.js')
    # Windows 기본 인코딩(cp949)으로 읽으면 node 의 UTF-8 출력이 리더 스레드에서 죽는다 —
    # 그러면 「얹혔는지」를 아무도 못 읽는 채로 rc 만 보고 넘어간다.
    r = subprocess.run(['node', 통로, 경로], capture_output=True,
                       text=True, encoding='utf-8', errors='replace')
    출 = (r.stdout or '') + (r.stderr or '')
    for 줄 in 출.strip().splitlines():
        if 줄.strip():
            print('   ' + 줄.strip())
    if r.returncode != 0:
        raise SystemExit(f'🔴 Loom 얹기 실패(rc={r.returncode}) — 부품 없이 굽힌 판을 남기지 않는다')

    # 🔴 2026-09-05 — 서체를 여기서 «같이» 심는다. 그전엔 이 도구가 지면을 새로 쓰면서 심긴 SUIT 를
    #   날렸고, 다시 심는 것은 사람 손에 맡겨져 있었다(그래서 재조립할 때마다 `tests/지면폰트.test.js`
    #   ④⑦ 이 빨개졌다). 굽는 자가 자기 산출물을 완성하지 않으면 그 빈칸은 매번 사람이 메워야 한다.
    통로2 = os.path.join(뿌리, 'tools', 'lib', '브랜드폰트.js')
    r2 = subprocess.run(['node', 통로2, '--심기', 경로], capture_output=True,
                        text=True, encoding='utf-8', errors='replace')
    for 줄 in ((r2.stdout or '') + (r2.stderr or '')).strip().splitlines():
        if 줄.strip():
            print('   ' + 줄.strip())
    if r2.returncode != 0:
        raise SystemExit(f'🔴 서체 심기 실패(rc={r2.returncode}) — 서체 없는 판을 남기지 않는다')


if __name__ == '__main__':
    main()
