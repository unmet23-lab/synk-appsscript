"""synk.im AI 강의 쪽(/ai/ · /en/ai/) 강사 구역 — 2026-11-27~28.

  python -X utf8 짓기.py <공개본 사본 폴더> <후보 폴더>

<공개본 사본 폴더>에는 지금 공개본의 ai/index.html과 en/ai/index.html이 있어야 한다.
양유호 카드의 작은 글과 채널 줄을 바꾸고, 옆에 김재헌 카드를 더한다.
두 카드는 넓은 화면에서 나란히, 900px 아래에서는 위아래로 선다. 나머지는 공개본 그대로다.
김재헌 그림은 이 폴더의 t-jaeheon.webp를 <후보 폴더>/assets/v11/d/로 옮긴다.
"""
import os
import shutil
import sys

sys.stdout.reconfigure(encoding='utf-8')
LIVE, OUT = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))

# 유호님 11-27: 「이 화면에서 synk창업자 뺴고 1인 기업 전문 강사 로 바꿔줘. 그리고 옆에 jeo 808 김재헌 / 강의 / 채널 항목 추가해줘」
# 유호님 11-27: 「양유호 : 인스타 = synk.mn / yuhobuilds / 이렇게 해주고」
SWAP = {
    'ko': [
        ('<h3><small>강사 · SYNK 창업자</small>양유호</h3>', '<h3><small>1인 기업 전문 강사</small>양유호</h3>'),
        ('<dt>채널</dt><dd>유튜브 · 인스타그램 yuhobuilds</dd>', '<dt>채널</dt><dd>인스타그램 synk.mn · yuhobuilds</dd>'),
    ],
    'en': [
        ('<h3><small>Instructor · Founder of SYNK</small>Yuho Yang</h3>',
         '<h3><small>Instructor for one-person businesses</small>Yuho Yang</h3>'),
        ('<dt>Channels</dt><dd>YouTube · Instagram yuhobuilds</dd>', '<dt>Channels</dt><dd>Instagram synk.mn · yuhobuilds</dd>'),
        # 강사가 둘이 되어 영어 머리의 한 사람 표현(someone · his)을 여럿으로. 한국어 머리는 수가 없는 말이라 그대로 둔다.
        ('<h2>Taught by someone who uses it</h2>', '<h2>Taught by people who use it</h2>'),
        ('<p>The person at the front runs his own work on AI and has shared the process openly on his channels.</p>',
         '<p>The people at the front run their own work on AI and share the process openly on their channels.</p>'),
    ],
}

# 김재헌 카드. 그림은 유호님 11-27 「김재헌님 사진은 니가 몇개 남자사진 시안 그냥 줘볼수있어 ?」에 시안 넷을 보여 드리고
# 「가 · 안경과 니트」를 고르신 판(11-28)이다. 실제 얼굴이 아니라 새로 그린 3D 인물이다. 지시문은 지시문/김재헌_가_*.txt.
# 강의 줄은 유호님 11-28 「강의 줄 빼기」로 두지 않는다. 채널은 받은 표기 그대로, 영어 이름은 Jaeheon Kim(11-28 Claude가 정함).
PIC = '/assets/v11/d/t-jaeheon.webp'
CARD = {
    'ko': ('강사', '김재헌', '김재헌. 3D로 그린 인물이다.', '채널', 'jeo 808'),
    'en': ('Instructor', 'Jaeheon Kim', 'Jaeheon Kim. A figure drawn in 3D.', 'Channel', 'jeo 808'),
}

STYLE = '''<style>
.teachers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--g4) var(--split-gap);align-items:start}
.teachers .teacher{grid-template-columns:1fr;gap:var(--g3)}
.teachers .teacher-say{align-self:start}
@media (max-width:900px){.teachers{grid-template-columns:1fr}}
</style>
'''


def rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def once(s, a, b, name):
    n = s.count(a)
    assert n == 1, f'{name}: {n}번'
    return s.replace(a, b)


def card(lang):
    role, name, alt, dt, channel = CARD[lang]
    return f'''    <div class="teacher">
      <div class="teacher-pic"><img src="{PIC}" alt="{alt}" loading="lazy"></div>
      <div class="teacher-say">
        <h3><small>{role}</small>{name}</h3>
        <dl class="cv">
          <dt>{dt}</dt><dd>{channel}</dd>
        </dl>
      </div>
    </div>'''


def build(lang, src):
    s = src
    for i, (a, b) in enumerate(SWAP[lang]):
        s = once(s, a, b, f'{lang} 바꿈 {i + 1}')
    s = once(s, '<link rel="stylesheet" href="/assets/v11/detail.css', STYLE + '<link rel="stylesheet" href="/assets/v11/detail.css', f'{lang} 스타일')
    # 양유호 카드를 .teachers로 감싸고 그 뒤에 김재헌 카드를 둔다
    a = '    <div class="teacher">\n      <div class="teacher-pic"><img src="/assets/v11/d/t-yuho.webp"'
    s = once(s, a, '    <div class="teachers">\n' + a, f'{lang} 감싸기')
    end = '\n    <p class="more-teachers">'
    assert s.count(end) == 1, f'{lang} 끝 자리'
    j = s.index(end)
    return s[:j] + '\n' + card(lang) + '\n    </div>' + s[j:]


dst = os.path.join(OUT, PIC.lstrip('/'))
os.makedirs(os.path.dirname(dst), exist_ok=True)
shutil.copyfile(os.path.join(HERE, os.path.basename(PIC)), dst)

for lang, rel in (('ko', 'ai/index.html'), ('en', 'en/ai/index.html')):
    wr(os.path.join(OUT, rel), build(lang, rd(os.path.join(LIVE, rel))))
    print(lang, rel)
print('그림', PIC)
