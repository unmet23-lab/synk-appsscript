"""synk.im 광고 쪽(/studio/ · /en/studio/) 지금 공개본의 첫 화면 글 고침 — 2026-11-27 밤.

  python -X utf8 짓기.py <공개본 사본 폴더> <후보 폴더>

유호님 11-27 밤(부모 세션이 전함): 「한국 엔터테인먼트 산업 현장에서 10년이라고 바꿔줘. 그 아래 내용들도 이걸로 바꿔줘」.
「카메라 앞 10년 · 배우」에 기대던 제목, 세 칸, 연출 칸, 쪽 제목과 공유 글을 그 말에 맞춘다. 바닥의 방문 집계 한 줄도 뺀다.
하늘 판(광고_20261127)이 공개되면 본문 전체가 바뀌므로, 이것은 그 전까지 지금 공개본 위에 얹는 고침이다.
공유 그림 og/studio-ko.jpg · studio-en.jpg는 후보 첫 화면을 1200×630으로 다시 찍어 바꾼다. ?v= 값은 tools/공개.js 올리기가 고친다.
"""
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
LIVE, OUT = sys.argv[1:3]

SWAP = {
    'ko': [
        ('<h1>카메라 앞에서 10년,<br>배우가 AI 모델을 연출합니다</h1>',
         '<h1>한국 엔터테인먼트<br>산업 현장에서 10년,<br>그 눈으로 AI 모델을 연출합니다</h1>'),
        ('<li><b>10년</b><span>카메라 앞에 선 배우가 연출</span></li>',
         '<li><b>10년</b><span>한국 엔터테인먼트 산업 현장 경험</span></li>'),
        ('<h2 class="e-claim"><mark>배우</mark>가<br>AI 모델을 연출합니다.</h2><p class="e-proof">카메라 앞에 섰던 시간이 연출의 기준입니다.</p>',
         '<h2 class="e-claim"><mark>현장 10년</mark>의 눈으로<br>AI 모델을 연출합니다.</h2><p class="e-proof">한국 엔터테인먼트 산업 현장에서 일한 시간이 연출의 기준입니다.</p>'),
    ],
    'en': [
        ('<h1>Ten years on camera,<br>an actor directs AI models</h1>',
         '<h1>Ten years in Korea’s<br>entertainment industry,<br>now directing AI models</h1>'),
        ('<li><b>10 years</b><span>in front of the camera, now directing</span></li>',
         '<li><b>10 years</b><span>in Korea’s entertainment industry</span></li>'),
        ('<h2 class="e-claim"><mark>An actor</mark><br>directs the AI models.</h2><p class="e-proof">The years spent in front of the camera set the standard for directing.</p>',
         '<h2 class="e-claim">Directed with<br><mark>ten years</mark> of industry sense.</h2><p class="e-proof">Years in Korea’s entertainment industry set the standard for directing.</p>'),
    ],
}
# 윗줄 메뉴 「한국어와 유학」이 홈(/#road)으로 가던 것을 유학 쪽으로 고친다(유호님 11-28 「한국어와 유학 누르면 메인화면으로 가지거든? 이거 버그야 고쳐줘야해」)
NAV = (('<a data-g="road" href="/#road">', '<a data-g="road" href="/study-abroad/">'), ('<a data-g="road" href="/en/#road">', '<a data-g="road" href="/en/study-abroad/">'))


def nav(s):
    n = 0
    for a, b in NAV:
        n += s.count(a)
        s = s.replace(a, b)
    assert n == 1, f'메뉴 주소 {n}번'
    return s


TITLE = {
    'ko': ('광고 — 카메라 앞에서 10년, 배우가 AI 모델을 연출합니다 · SYNK', '광고 — 한국 엔터테인먼트 산업 현장 10년의 눈으로 AI 모델을 연출합니다 · SYNK'),
    'en': ('Ads — Ten years on camera, an actor directs AI models · SYNK', 'Ads — Ten years in Korea’s entertainment industry, now directing AI models · SYNK'),
}

for lang, path in (('ko', 'studio/index.html'), ('en', 'en/studio/index.html')):
    with open(os.path.join(LIVE, path), encoding='utf-8', newline='') as f:
        s = f.read()
    for i, (a, b) in enumerate(SWAP[lang]):
        assert s.count(a) == 1, (lang, i, s.count(a))
        s = s.replace(a, b)
    t0, t1 = TITLE[lang]
    assert s.count(t0) == 2, (lang, 'title', s.count(t0))
    s = s.replace(t0, t1)
    s = nav(s)
    # 바닥의 방문 집계 한 줄(유호님 11-27 밤 「이 내용도 삭제해」). 집계 스크립트와 개인정보처리방침 설명은 그대로다
    s, n = re.subn(r'<span class="foot-note">[^<]*<a href="/privacy/#visitor-stats(?:-en)?">[^<]*</a></span>', '', s)
    assert n == 1, (lang, 'foot-note', n)
    assert not re.search(r'카메라 앞|배우가|on camera|An actor', s), lang
    out = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
    print('ok', out)
