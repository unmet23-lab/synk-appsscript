# synk.im AI 강의(/ai/)에 솔리오 단락을 넣는다(유호님 11-26).
# 공개본(공개 사본 origin/main)의 쪽을 읽어 두 판(가 · 나)을 후보 폴더에 쓴다.
#   python -X utf8 짓기.py <작업 폴더>   — <작업 폴더>/live/ai/index.html 에 공개본 사본, <작업 폴더>/img 에 그림이 있어야 한다
# 가: 쪽 바탕 그대로.  나: 쪽과 반대색 띠.
import os, sys, shutil

W = sys.argv[1]
LIVE = os.path.join(W, 'live')


def rd(p):
    with open(os.path.join(LIVE, p), encoding='utf-8', newline='') as f:
        return f.read()


def once(s, a, b, name):
    n = s.count(a)
    assert n == 1, f'{name}: {n}번'
    return s.replace(a, b)


# ── AI 강의 · 솔리오 ─────────────────────────────────────────────
AI_CSS = '''<style>
.app-sec{scroll-margin-top:80px}
.app-sec .sec-head p:not(.tag){font:var(--t-lead);max-width:34em;text-wrap:pretty}
.app-shot{margin:0}
.app-shot .frame{background:#0a0a0b;border-radius:var(--r-lg);padding:clamp(6px,.9vw,12px);box-shadow:var(--shadow)}
.app-shot img{display:block;width:100%;height:auto;border-radius:calc(var(--r-lg) - 8px)}
.app-shot figcaption{margin-top:12px;font:var(--t-cap);color:var(--cap)}
.app-facts{list-style:none;margin:var(--g4) 0 0;padding:var(--g3) 0 0;border-top:1px solid var(--hair);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--g3) var(--g4)}
.app-facts b{display:block;font:var(--t-h4);letter-spacing:-.01em}
.app-facts span{display:block;margin-top:6px;font:var(--t-body);color:var(--cap)}
.app-go{margin-top:var(--g4)}
.app-sec.dark{margin-top:var(--S);padding-bottom:var(--S)}
.app-sec.dark .app-shot .frame{background:none;box-shadow:none;padding:0}
.app-sec.dark .app-shot img{border-radius:var(--r-md);box-shadow:0 0 0 1px var(--hair-d)}
.app-sec.dark .app-shot figcaption,.app-sec.dark .app-facts span{color:var(--cap-d)}
.app-sec.dark .app-facts{border-top-color:var(--hair-d)}
@media (max-width:820px){.app-facts{grid-template-columns:1fr;gap:var(--g2)}}
@media (max-width:600px){.app-shot .frame{padding:6px}}
</style>
'''


def ai_section(v):
    dark = v == 'na'
    pill = 'pill light' if dark else 'pill'
    tone = ' dark" data-tone="dark' if dark else ''
    return f'''  <section class="sec app-sec{tone}" id="solio" aria-labelledby="solio-title">
    <div class="sec-head">
      <p class="tag">솔리오 앱</p>
      <h2 id="solio-title">오늘은 어느 AI로 일할지<br>솔리오가 먼저 알려 줍니다</h2>
      <p>강의가 끝나고 AI를 일에 쓰기 시작하면 구독이 하나둘 늘어납니다. 솔리오는 구독마다 이번 주에 얼마 남았는지, 언제 다시 차는지, 결제일이 언제인지 한 화면에 모으고 지금 쓸 계정을 골라 줍니다.</p>
    </div>
    <figure class="app-shot">
      <div class="frame"><picture><source media="(max-width:600px)" srcset="/assets/v11/solio-room-m-20261127.webp" width="640" height="453"><img src="/assets/v11/solio-room-20261127.webp" width="1440" height="640" alt="솔리오의 AI 구독 관리 화면. 서비스마다 지금 쓸 수 있는 계정 수와 남은 양이 막대로 보이고, 오른쪽 「솔리오 보고」는 다 쓴 구독이 언제 다시 열리는지와 그동안 쓸 계정을 알린다." loading="lazy"></picture></div>
      <figcaption>솔리오의 실제 화면입니다. 계정과 숫자는 예시 값입니다.</figcaption>
    </figure>
    <ul class="app-facts" aria-label="솔리오를 쓰는 조건">
      <li><b>회원은 무료</b><span>SYNK ID로 로그인해 씁니다.</span></li>
      <li><b>숫자는 공식 값만</b><span>각 서비스가 알려 주는 숫자만 읽습니다. 기록은 내 PC에 둡니다.</span></li>
      <li><b>PC 앱</b><span>Windows와 Mac에서 씁니다. 지금은 미리보기판입니다.</span></li>
    </ul>
    <div class="app-go"><a class="{pill}" href="/#platform">PC 앱 받기 <span class="arr" aria-hidden="true">→</span></a></div>
  </section>
'''


def build_ai(v):
    s = rd('ai/index.html')
    a = s.index('      <li class="e"><div class="e-say"><span class="e-no">솔리오 앱</span>')
    b = s.index('</li>\n', a) + len('</li>\n')
    s = s[:a] + s[b:]
    # 강사 구역 바로 앞에 단락을 둔다
    s = once(s, '  <section class="sec">\n    <div class="sec-head">\n      <p class="tag">강사</p>', ai_section(v) + '\n  <section class="sec">\n    <div class="sec-head">\n      <p class="tag">강사</p>', 'ai 강사 앞')
    s = once(s, '<link rel="stylesheet" href="/assets/v11/detail.css', AI_CSS + '<link rel="stylesheet" href="/assets/v11/detail.css', 'ai css')
    return s


IMG = ('assets/v11/solio-room-20261127.webp', 'assets/v11/solio-room-m-20261127.webp')
for v in ('ga', 'na'):
    out = os.path.join(W, v)
    for rel, txt in (('ai/index.html', build_ai(v)),):
        p = os.path.join(out, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8', newline='') as f:
            f.write(txt)
    for rel in IMG:
        p = os.path.join(out, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        shutil.copyfile(os.path.join(W, 'img', os.path.basename(rel)), p)
    print('ok', v)
