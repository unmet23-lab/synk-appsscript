# synk.im AI 강의(/ai/)에 솔리오 단락을 넣는다(유호님 11-26 · 11-27).
# 11-27 「가 가 좋은데」 · 「원클릭으로 사업계획서, 보안, 백업, 사무실 … 만들고있는걸 보여줬으면」 · 「ai 1인 창업가(기업가)를 위해 필요한 모든것들을
# 준비하고있다는걸 … 3000시간 및 5천만원 …」에 따라, 쪽 바탕(가) 위에 솔리오가 맡는 일 여섯을 고르는 줄과 실제 화면을 둔다.
#   python -X utf8 짓기.py <작업 폴더>
# <작업 폴더>/live/ai/index.html 에 공개본 사본, <작업 폴더>/img 에 그림(solio-tour-<열쇠>.webp · solio-tour-<열쇠>-m.webp)이 있어야 한다.
# <작업 폴더>/live/en/ai/index.html 도 있으면 영어 쪽도 짓는다. 결과는 <작업 폴더>/tour/(ai · en/ai)/index.html 과 그림이다.
import os
import shutil
import sys

from PIL import Image

W = sys.argv[1]
LIVE = os.path.join(W, 'live')
DAY = '20261127'


def rd(p):
    with open(os.path.join(LIVE, p), encoding='utf-8', newline='') as f:
        return f.read()


def once(s, a, b, name):
    n = s.count(a)
    assert n == 1, f'{name}: {n}번'
    return s.replace(a, b)


REAL = '솔리오의 실제 화면입니다. 이름과 숫자는 예시 값입니다.'
# 사무실 · 원클릭은 아직 볼 계정(미리보기)에만 열려 있다(Fable 검수 ai-solio-20261127 F1, desktop/src/main.cjs · solio-backup.cjs)
NOT_OPEN = '솔리오의 실제 화면이며, 아직 모든 회원에게 열지 않았습니다.'
BUILDING = '지금 만들고 있는 화면이며, 아직 모든 회원에게 열지 않았습니다. 이름과 숫자는 예시 값입니다.'
# (열쇠, 줄 이름, 한 줄, 아래 작은 글, 대체 글)
TOUR = {'ko': [
    ('todo', '한 번에 처리', '흩어진 할 일을 급한 순서로 줄 세웁니다. 단추 하나로 1순위부터 한 장씩 끝냅니다.', '솔리오의 실제 화면입니다. 카드 가운데 사무실 일은 아직 모든 회원에게 열지 않았습니다. 이름과 숫자는 예시 값입니다.',
     '솔리오의 「한 번에 처리」 화면. 맨 앞 카드는 1순위 「고객이 기다립니다 · 견적부」로, 견적 문의에 보낼 답장 초안이 있다고 알리고 「초안 복사」 단추를 둔다. 뒤에 다음 일 셋이 겹쳐 있다.'),
    ('office', '사무실', '부서마다 AI 직원이 무엇을 하고 있는지 한 화면에 모아 봅니다.', BUILDING,
     '솔리오의 사무실 화면. 왼쪽에 마케팅부 · 개발부 같은 부서가 있고, 가운데 개발부 책상의 AI 직원이 3분 전에 승인을 물었다고 알린다.'),
    ('plan', '사업계획서', '계획서를 넣으면 심사위원 셋이 항목마다 점수를 매기고, 가장 약한 곳부터 고치게 돕습니다.', '지금 만들고 있는 화면이며, 아직 앱에 열지 않았습니다. 점수는 예시 값입니다.',
     '솔리오 기획부의 사업계획서 심사 화면. 심사위원 셋이 책상에 앉아 점수를 매겼고, 평균 3.1점과 가장 약한 곳이 신뢰성이라는 한 줄이 보인다.'),
    ('backup', '원클릭 백업', '단추 한 번에 백업하고, 되살려 맞춰 보고, 비울 수 있는 공간을 찾고, 업데이트까지 확인합니다.', NOT_OPEN + ' 백업은 Windows에서만 씁니다. 숫자는 예시 값입니다.',
     '솔리오 원클릭 화면. 지금 바뀐 파일을 올리는 백업 차례이고, 그 아래로 되살리기 확인 · 공간 · 업데이트 확인 차례가 이어진다.'),
    ('safe', '보안', '로그인이 풀린 계정을 바로 알려 줍니다. API 키는 이 PC에만 암호화해 두고, 로그인 정보와 사용량은 이 PC 밖으로 보내지 않습니다.', REAL,
     '솔리오의 계정 관리 화면. 로그인이 풀린 계정 하나에 「다시 로그인해야 합니다」와 다시 로그인하면 이어서 읽는다는 줄이 떠 있다.'),
    ('subs', '구독', '구독마다 남은 양과 다시 차는 때를 모아, 지금 쓸 계정을 골라 줍니다.', REAL,
     '솔리오의 AI 구독 관리 화면. 서비스마다 지금 쓸 수 있는 계정 수와 남은 양이 막대로 보이고, 다 쓴 구독에는 다시 열리는 때가 적혀 있다.'),
]}

REAL_EN = 'An actual SOLIO screen (in Korean). Names and numbers are example values.'
NOT_OPEN_EN = 'An actual SOLIO screen (in Korean), not yet open to all members.'
BUILDING_EN = 'A screen we are building (in Korean), not yet open to all members. Names and numbers are example values.'
TOUR['en'] = [
    ('todo', 'One-click to-dos', 'Scattered tasks are lined up by urgency. One button takes you through them, top priority first, one card at a time.', 'An actual SOLIO screen (in Korean). Office task cards are not yet open to all members. Names and numbers are example values.',
     'SOLIO’s one-click to-do screen. The front card is priority 1, a customer waiting on the quotes department: a reply draft for a quote request is ready, with a button to copy it. Three more tasks are stacked behind it.'),
    ('office', 'Office', 'See what the AI staff in each department are working on, all on one screen.', BUILDING_EN,
     'SOLIO’s office screen. Departments such as marketing and development are listed on the left; in the middle, an AI worker at the development desk asked for approval three minutes ago.'),
    ('plan', 'Business plan', 'Hand in your plan and three judges score every item, then help you fix the weakest part first.', 'A screen we are building (in Korean), not yet in the app. The scores are example values.',
     'SOLIO’s business plan review screen. Three judges sit at a desk and have scored the plan; a line shows an average of 3.1 and credibility as the weakest point.'),
    ('backup', 'One-click backup', 'One button backs up your files, test-restores them, finds space you can free and checks for updates.', NOT_OPEN_EN + ' Backup runs on Windows only. Numbers are example values.',
     'SOLIO’s one-click screen. The backup step is uploading changed files, followed by the restore check, space and update check steps.'),
    ('safe', 'Security', 'Flags any account that has been logged out. API keys stay encrypted on this PC, and login details and usage never leave it.', REAL_EN,
     'SOLIO’s account screen. One logged-out account says it needs to sign in again and will resume reading once you do.'),
    ('subs', 'Subscriptions', 'Gathers what is left on each subscription and when it refills, then picks the account to use right now.', REAL_EN,
     'SOLIO’s AI subscription screen. Each service shows how many accounts are usable now and what is left on a bar, and a used-up subscription shows when it reopens.'),
]
HEAD = {
    'ko': ('솔리오 앱', 'AI 1인 기업가에게 필요한 것을<br>솔리오 하나에 준비하고&nbsp;있습니다',
           '3,000시간과 5천만 원어치 시행착오를 솔리오에 담았습니다. 같은 길을 처음부터 걷지 않아도 됩니다.',
           '솔리오가 맡는 일', '/#platform', 'PC 앱 받기', '회원은 무료입니다. Windows와 Mac에서 쓰며, 지금은 미리보기판입니다.'),
    'en': ('SOLIO app', 'Everything a one-person AI company needs,<br>coming together in SOLIO',
           'We built 3,000 hours and 50 million won of trial and error into SOLIO. You don’t have to walk the same road from the start.',
           'What SOLIO handles', '/en/#platform', 'Get the PC app', 'Free for members. Runs on Windows and Mac, now in preview.'),
}
# 쪽마다 걷을 옛 솔리오 칸의 머리와 강사 구역 꼬리표
PAGE = {'ko': ('ai/index.html', '솔리오 앱', '강사'), 'en': ('en/ai/index.html', 'SOLIO app', 'Teacher')}
SIZE = {'w': (1440, 820)}

AI_CSS = '''<style>
.app-sec{scroll-margin-top:80px}
.app-sec .sec-head p:not(.tag){font:var(--t-lead);max-width:34em;text-wrap:pretty}
.tour-tabs{position:relative;isolation:isolate;display:inline-flex;gap:2px;max-width:100%;margin:0 0 var(--g3);padding:5px;border-radius:999px;background:#ebe9e4;box-shadow:inset 0 1px 2px rgba(17,17,19,.09),inset 0 0 0 1px rgba(17,17,19,.04);overflow-x:auto;scrollbar-width:none}
.tour-tabs::-webkit-scrollbar{display:none}
.tour-tabs button{position:relative;z-index:1;flex:none;font:inherit;font-size:15px;font-weight:500;line-height:1;padding:12px 18px;border:0;border-radius:999px;background:transparent;color:#56565c;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:color .25s var(--ease)}
.tour-tabs button:hover,.tour-tabs button[aria-selected="true"]{color:var(--ink)}
.tour-tabs button:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}
.tour-tabs:not(.on) button[aria-selected="true"]{background:#fff;box-shadow:0 6px 14px -8px rgba(17,17,19,.4)}
/* 고른 칸의 말랑한 알약: 위는 밝게 비치고 아래는 살짝 눌린 젤리 */
.jelly{position:absolute;z-index:0;top:5px;bottom:5px;left:0;width:0;border-radius:999px;pointer-events:none;
  background:linear-gradient(180deg,#fff 0%,#fdfcfa 48%,#f2f0eb 100%);
  box-shadow:0 1px 1px rgba(17,17,19,.07),0 10px 18px -10px rgba(17,17,19,.45),inset 0 1px 0 #fff,inset 0 -3px 6px rgba(17,17,19,.06)}
.jelly::before{content:"";position:absolute;left:10px;right:10px;top:2px;height:46%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,0))}
.tour-tabs:not(.on) .jelly{display:none}
/* 줄이 넘칠 때: 고른 칸으로 옮겨도 흐린 끝에 걸리지 않게, 옆으로 더 있는 쪽 끝은 흐리게 지운다(클래스는 넘칠 때만 붙는다) */
.tour-tabs{scroll-padding-inline:48px}
.tour-tabs.more-r{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 48px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 48px),transparent)}
.tour-tabs.more-l{-webkit-mask-image:linear-gradient(270deg,#000 calc(100% - 48px),transparent);mask-image:linear-gradient(270deg,#000 calc(100% - 48px),transparent)}
.tour-tabs.more-l.more-r{-webkit-mask-image:linear-gradient(90deg,transparent,#000 48px,#000 calc(100% - 48px),transparent);mask-image:linear-gradient(90deg,transparent,#000 48px,#000 calc(100% - 48px),transparent)}
.app-shot{margin:0}
.app-panel[hidden]{display:none}
.app-shot .frame{background:#0a0a0b;border-radius:var(--r-lg);padding:clamp(6px,.9vw,12px);box-shadow:var(--shadow)}
.app-shot img{display:block;width:100%;height:auto;border-radius:calc(var(--r-lg) - 8px)}
.app-shot figcaption{margin-top:16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 24px;align-items:baseline}
.app-shot figcaption b{grid-column:1/-1;font:var(--t-h4);letter-spacing:-.01em}
.app-shot figcaption span{font:var(--t-body);color:var(--ink);max-width:40em}
.app-shot figcaption small{font:var(--t-cap);color:var(--cap);text-align:right;max-width:24em}
.app-go{margin-top:var(--g4);display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}
.app-go small{font:var(--t-cap);color:var(--cap)}
@media (max-width:820px){.app-shot figcaption{grid-template-columns:1fr}.app-shot figcaption small{text-align:left}}
@media (max-width:600px){
  .tour-tabs button{font-size:14px;padding:11px 14px}
  .app-shot .frame{padding:6px}
}
@media (prefers-reduced-motion:reduce){.tour-tabs button{transition:none}}
</style>
'''

AI_JS = '''<script>(()=>{const s=document.getElementById('solio');if(!s)return;
const bar=s.querySelector('.tour-tabs'),jelly=bar.querySelector('.jelly'),tabs=[...bar.querySelectorAll('[role=tab]')];
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;let at=null;
// 젤리는 고른 칸으로 옮겨 갈 때만 늘었다 줄어든다(앞쪽 끝이 먼저 닿고 뒤쪽 끝이 따라온다). 움직임 줄이기면 바로 옮긴다
const place=(b,move)=>{const to={x:b.offsetLeft,w:b.offsetWidth},end=[`translateX(${to.x}px)`,to.w+'px'];
if(move&&at&&!still&&jelly.animate&&(at.x!==to.x||at.w!==to.w)){const r=to.x>at.x,L=(a,c,t)=>a+(c-a)*t;
const l=r?L(at.x,to.x,.22):L(at.x,to.x,.78),rr=r?L(at.x+at.w,to.x+to.w,.78):L(at.x+at.w,to.x+to.w,.22);
jelly.animate([{transform:`translateX(${at.x}px) scaleY(1)`,width:at.w+'px'},{transform:`translateX(${l}px) scaleY(.88)`,width:(rr-l)+'px',offset:.45},
{transform:`translateX(${to.x}px) scaleY(1.05)`,width:to.w+'px',offset:.78},{transform:`translateX(${to.x}px) scaleY(1)`,width:to.w+'px'}],{duration:480,easing:'cubic-bezier(.3,.7,.25,1)'});}
jelly.style.transform=end[0];jelly.style.width=end[1];at=to;};
const pick=(b,focus)=>{tabs.forEach(t=>{const on=t===b;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!on;});
place(b,true);if(focus)b.focus();b.scrollIntoView({block:'nearest',inline:'nearest',behavior:still?'auto':'smooth'});};
tabs.forEach((b,i)=>{b.addEventListener('click',()=>pick(b));b.addEventListener('keydown',e=>{const k=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
if(e.key==='Home'||e.key==='End'){e.preventDefault();pick(tabs[e.key==='Home'?0:tabs.length-1],true);return;}
if(k){e.preventDefault();pick(tabs[(i+k+tabs.length)%tabs.length],true);}});});
const now=()=>tabs.find(t=>t.getAttribute('aria-selected')==='true')||tabs[0];
const edge=()=>{const m=bar.scrollWidth-bar.clientWidth;bar.classList.toggle('more-l',m>2&&bar.scrollLeft>2);bar.classList.toggle('more-r',m>2&&bar.scrollLeft<m-2);};
bar.classList.add('on');place(now(),false);edge();bar.addEventListener('scroll',edge,{passive:true});
const fit=()=>{place(now(),false);edge();};addEventListener('resize',fit);document.fonts&&document.fonts.ready.then(fit);window.ResizeObserver&&new ResizeObserver(fit).observe(tabs[tabs.length-1]);})();</script>
'''


def ai_section(lang):
    w, h = SIZE['w']
    tabs = ''.join(
        f'<button type="button" role="tab" id="tour-t-{k}" aria-controls="tour-p-{k}" aria-selected="{str(i == 0).lower()}"{"" if i == 0 else " tabindex=\"-1\""}>{name}</button>'
        for i, (k, name, *_rest) in enumerate(TOUR[lang]))
    panels = ''
    tag, h2, lead, label, href, go, fine = HEAD[lang]
    for i, (k, name, line, small, alt) in enumerate(TOUR[lang]):
        hid = '' if i == 0 else ' hidden'
        load = 'eager' if i == 0 else 'lazy'
        mw, mh = Image.open(os.path.join(W, 'img', f'solio-tour-{k}-m.webp')).size
        # figcaption을 가진 figure에는 role을 주지 않는다(Fable F5). 탭 판은 바깥 div다
        panels += f'''
    <div class="app-panel" role="tabpanel" id="tour-p-{k}" aria-labelledby="tour-t-{k}"{hid}><figure class="app-shot">
      <div class="frame"><picture><source media="(max-width:600px)" srcset="/assets/v11/solio-tour-{k}-m-{DAY}.webp" width="{mw}" height="{mh}"><img src="/assets/v11/solio-tour-{k}-{DAY}.webp" width="{w}" height="{h}" alt="{alt}" loading="{load}"></picture></div>
      <figcaption><b>{name}</b><span>{line}</span><small>{small}</small></figcaption>
    </figure></div>'''
    return f'''  <section class="sec app-sec" id="solio" aria-labelledby="solio-title">
    <div class="sec-head">
      <p class="tag">{tag}</p>
      <h2 id="solio-title">{h2}</h2>
      <p>{lead}</p>
    </div>
    <div class="tour-tabs" role="tablist" aria-label="{label}"><span class="jelly" aria-hidden="true"></span>{tabs}</div>{panels}
    <div class="app-go"><a class="pill" href="{href}">{go} <span class="arr" aria-hidden="true">→</span></a><small>{fine}</small></div>
  </section>
{AI_JS}'''


def build_ai(lang):
    path, old, teacher = PAGE[lang]
    s = rd(path)
    a = s.index(f'      <li class="e"><div class="e-say"><span class="e-no">{old}</span>')
    b = s.index('</li>\n', a) + len('</li>\n')
    s = s[:a] + s[b:]
    # 강사 구역 바로 앞에 단락을 둔다
    head = f'  <section class="sec">\n    <div class="sec-head">\n      <p class="tag">{teacher}</p>'
    s = once(s, head, ai_section(lang) + '\n' + head, lang + ' 강사 앞')
    s = once(s, '<link rel="stylesheet" href="/assets/v11/detail.css', AI_CSS + '<link rel="stylesheet" href="/assets/v11/detail.css', lang + ' css')
    return s


out = os.path.join(W, 'tour')
for lang, (path, *_r) in PAGE.items():
    if not os.path.exists(os.path.join(LIVE, path)):
        continue
    p = os.path.join(out, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(build_ai(lang))
    print('ok', p)
os.makedirs(os.path.join(out, 'assets', 'v11'), exist_ok=True)
for k, *_ in TOUR['ko']:
    for suf in ('', '-m'):
        shutil.copyfile(os.path.join(W, 'img', f'solio-tour-{k}{suf}.webp'), os.path.join(out, 'assets', 'v11', f'solio-tour-{k}{suf}-{DAY}.webp'))
