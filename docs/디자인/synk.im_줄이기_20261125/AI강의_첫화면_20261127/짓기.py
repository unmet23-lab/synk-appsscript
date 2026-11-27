"""synk.im AI 강의 쪽(/ai/ · /en/ai/) 첫 화면과 증거 구역 다시 쓰기 — 2026-11-27 밤.

  python -X utf8 짓기.py <공개본 사본 폴더> <후보 폴더>

<공개본 사본 폴더>에는 지금 공개본의 ai/index.html과 en/ai/index.html이 있어야 한다(솔리오 단락이 들어간 판).
첫 화면의 제목 · 이끄는 글, 그 아래 세 칸, 증거 칸의 제목 · 글을 바꾸고, 바닥의 방문 집계 한 줄을 뺀다.
나머지(솔리오 단락 · 강의 방식 · 강사 · 하는 일 · 스크립트)는 공개본 그대로 둔다.
"""
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
LIVE, OUT = sys.argv[1:3]


def rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def once(s, a, b, name):
    n = s.count(a)
    assert n == 1, f'{name}: {n}번'
    return s.replace(a, b)


# 유호님 11-27 밤(부모 세션이 전함): 「26년 6월 출시하고나서부터 ai가 일반인들에게도 활용할수있게 적용되었다고생각해 … 강사진은 26년 6월부터
# 오늘 11월 27일까지 … 5천만원 이상의 구독비 + 3천시간 이상의, 말 그대로 밥이랑 잠만 자고 ai만했거든 … 이 경험을 판다고 생각해주면 좋을것같아.
# 그래서 결국 ai활용을 잘해서 이런저런걸 하고있다는걸 강조해주면 좋을것같아.」 숫자는 읽는 사람의 이득으로 끝낸다. 도구 · 모델 이름은 쓰지 않는다.
SWAP = {
    'ko': [
        ('<h1>AI로 회사를 돌리는 사람이<br>직접 강의하러 갑니다</h1>',
         '<h1>AI를 어렵게 익힌 강사진이<br>쉽게 가르칩니다</h1>'),
        ('<p class="hero-lead">가르치는 사람의 회사가, 지금 이 시각에도 AI로 돌고 있습니다.</p>',
         '<p class="hero-lead">2026년 6월, AI가 처음으로 누구나 쓸 만해졌습니다. 저희는 그때부터 먹고 자는 시간 빼고 AI만 썼습니다.</p>'),
        ('<li><b>30개 넘는 일</b><span>사람 없이 제시간에 돕니다</span></li>',
         '<li><b>5천만 원 · 3,000시간</b><span>그만큼의 시행착오를 저희가 먼저 겪었습니다</span></li>'),
        ('<li><b>결과물 하나</b><span>강의가 끝나면 남습니다</span></li>',
         '<li><b>컴퓨터가 낯설어도</b><span>시간과 돈을 들이지 않고 바로 씁니다</span></li>'),
        ('<li><b>솔리오</b><span>배운 것을 잇는 앱</span></li>',
         '<li><b>수업 뒤 2주</b><span>궁금한 것은 메일로 계속 묻습니다</span></li>'),
        ('<h2 class="e-claim">강사의 회사가<br><mark>지금도 AI로 돕니다.</mark></h2><p class="e-proof">30개 넘는 일이 사람 없이 제시간에 돌고, 20가지 넘는 검사가 실수를 막습니다.</p>',
         '<h2 class="e-claim">가르치는 방법으로<br><mark>회사가 돌아갑니다.</mark></h2><p class="e-proof">유학 상담과 광고 영상, 매일의 SNS에 AI를 씁니다. 정해진 때에 사람 손 없이 도는 일이 60가지가 넘습니다.</p>'),
        ('<span class="foot-note">방문 목적과 경로를 익명으로 집계합니다. <a href="/privacy/#visitor-stats">자세히</a></span>', ''),
    ],
    'en': [
        ('<h1>The person who runs a company on AI<br>comes to teach in person</h1>',
         '<h1>We learned AI the hard way<br>so you can learn it the easy way</h1>'),
        ('<p class="hero-lead">The instructor’s own company is running on AI at this very moment.</p>',
         '<p class="hero-lead">In June 2026, AI first became good enough for anyone to use. Since then, we have done little but eat, sleep and use it.</p>'),
        ('<li><b>30+ jobs</b><span>run on time without people</span></li>',
         '<li><b>50 million won · 3,000 hours</b><span>of trial and error we went through first</span></li>'),
        ('<li><b>One finished piece</b><span>stays with you after the lecture</span></li>',
         '<li><b>New to computers?</b><span>Start using it right away, without spending time or money</span></li>'),
        ('<li><b>SOLIO</b><span>the app that carries on what you learned</span></li>',
         '<li><b>Two weeks after class</b><span>keep asking questions by email</span></li>'),
        ('<h2 class="e-claim">The instructor’s company<br><mark>runs on AI right now.</mark></h2><p class="e-proof">More than 30 jobs run on time without people, and more than 20 kinds of checks catch mistakes.</p>',
         '<h2 class="e-claim">What we teach<br><mark>runs our company.</mark></h2><p class="e-proof">We use AI for study-abroad counselling, ad films and daily social posts. More than 60 jobs run on schedule without anyone at the keyboard.</p>'),
        ('<span class="foot-note">We anonymously count why and how people visit. <a href="/privacy/#visitor-stats-en">Details</a></span>', ''),
    ],
}

META = {
    'ko': (('AI 강의 — AI로 회사를 돌리는 사람이 직접 강의하러 갑니다 · SYNK', 'AI 강의 — AI를 어렵게 익힌 강사진이 쉽게 가르칩니다 · SYNK'),
           ('가르치는 사람의 회사가, 지금 이 시각에도 AI로 돌고 있습니다.', '2026년 6월, AI가 처음으로 누구나 쓸 만해졌습니다. 저희는 그때부터 먹고 자는 시간 빼고 AI만 썼습니다.')),
    'en': (('AI lectures — The person who runs a company on AI comes to teach in person · SYNK', 'AI lectures — We learned AI the hard way so you can learn it the easy way · SYNK'),
           ('The instructor’s own company is running on AI at this very moment.', 'In June 2026, AI first became good enough for anyone to use. Since then, we have done little but eat, sleep and use it.')),
}

# 50분 수업 예시 칸(강의 방식)은 지운다. 유호님 11-27 밤 「뭔 내용인지 하나도 이해가 안가. 삭제하던지 다시 만들어야해」.
# 실제 강의 결과물로 다시 지으려 했으나 출강은 2027년 2월부터라(결정 11-19) 아직 실제 강의 결과물이 없다.
LESSON = {'ko': '<li class="e"><div class="e-say"><span class="e-no">강의 방식</span>', 'en': '<li class="e"><div class="e-say"><span class="e-no">How the lecture works</span>'}

for lang, path in (('ko', 'ai/index.html'), ('en', 'en/ai/index.html')):
    s = rd(os.path.join(LIVE, path))
    for i, (a, b) in enumerate(SWAP[lang]):
        s = once(s, a, b, f'{lang} {i}')
    a = s.index('      ' + LESSON[lang])
    b = s.index('</li>\n', s.index('</figure>', a)) + len('</li>\n')
    assert s.count(LESSON[lang]) == 1 and '<li class="e' not in s[a + 10:b]
    s = s[:a] + s[b:]
    # 쪽 제목 · 설명 · 공유 글(공유 그림 og/ai-ko.jpg · ai-en.jpg는 후보 첫 화면을 1200×630으로 다시 찍어 바꾼다)
    (t0, t1), (d0, d1) = META[lang]
    assert s.count(t0) == 2 and s.count(d0) == 2, (lang, s.count(t0), s.count(d0))
    s = s.replace(t0, t1).replace(d0, d1)
    out = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
    print('ok', out)
