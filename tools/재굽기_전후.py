# -*- coding: utf-8 -*-
"""재굽기 전후 — 08-24 «명품 재굽기»의 **전량**을 옛 판과 나란히 한 지면에 세운다.

■ 왜 있나 (유호 지시 2026-08-24 「전체적으로 전 후 사진 작업물 추합해서 html 로 만들어줘」)
  대조판(`굽기대조.py`)은 갈래마다 PNG 한 장씩 나온다 — 다섯 장이 폴더에 흩어지면
  «전체가 어떻게 달라졌나»를 아무도 한 번에 못 본다. 이 지면이 그 자리다.

■ 무엇을 싣나 — 3D 로 굽는 자산 **전량 222장**
  요소 156 · 화면 14 · 오브 26 · 퍼프로브 23 · 글자 3.
  옛 판은 갈래마다 «그 갈래가 마지막으로 커밋된 자리»에서 꺼낸다:
    · 요소·화면 → 4a4d2472 (08-24 06:42 · 새 색관리 «직전»에 옆 세션이 커밋해 둔 판)
    · 오브·퍼프로브·글자 → 2e60e210 (08-23 17:44 · 1800px 는 맞고 색만 옛 자)
  🔑 옛 판이 git 에 없으면 이 지면은 원리상 못 선다 — 덮어쓰기 전에 커밋해 두는 습관이 재료다.

■ 재는 법 — **두 판을 «같은 화소 무리»에서 잰다.** 🔴 여기서 두 번 틀렸다(08-24 · 둘 다 내기 전에 잡았다).
  1차: 굽기대조.py 를 그대로 따라 «판마다» 무대(검정)를 빼고 몸만 쟀더니 **화면이 밝기 +305%** 로 나왔다.
     실물을 열어 보니 두 판이 거의 같은 화면이었다. 까닭 — 옛 화면은 바탕이 문턱 위(회색)라 화소의 51%가
     뽑히고 새 화면은 바탕이 문턱 아래(거의 검정)라 6%만 뽑힌다. **서로 다른 무리를 재고 비교한 것**이다.
  2차: 그래서 화면만 «전 화소»로 바꿨더니 이번엔 **채도 +384%** 가 나왔다. 거의 검은 화소
     (2,1,0) 의 HSV 채도가 1.0 으로 잡히기 때문이다 — 어두울수록 채도가 «커진다».
  ⇒ 갈래마다 문턱을 다르게 하는 게 답이 아니었다. **문턱을 쌍으로 묶는다** —
     마스크 = 「둘 중 하나라도 문턱을 넘는 화소」의 합집합, 두 판에 «같은 마스크»를 쓴다.
     렌더처럼 두 판의 무대가 똑같이 검은 경우엔 옛 방식과 사실상 같은 값이 나오고(호환),
     화면처럼 바탕이 움직인 경우에만 값이 달라진다 — 그게 이 잣대가 고치려는 바로 그 자리다.
  🔑 잣대를 옮겨 붙일 때는 «그 잣대가 무엇을 빼기로 하고 만들어졌는지»부터 본다.

쓰기:  python tools/재굽기_전후.py [--폭 190]   → docs/재굽기_전후.html
"""
import base64
import io
import os
import subprocess
import sys
import colorsys

sys.stdout.reconfigure(encoding='utf-8')
try:
    from PIL import Image
except ImportError:
    print('PIL 이 없다 — pip install pillow'); raise SystemExit(2)

여기 = os.path.dirname(os.path.abspath(__file__))
루트 = os.path.dirname(여기)
인자 = {}
_v = sys.argv[1:]
_i = 0
while _i < len(_v):
    if _v[_i].startswith('--'):
        k = _v[_i][2:]
        if _i + 1 < len(_v) and not _v[_i + 1].startswith('--'):
            인자[k] = _v[_i + 1]; _i += 2; continue
        인자[k] = '1'
    _i += 1
폭 = int(인자.get('폭', '190'))
출력 = os.path.join(루트, 'docs', '재굽기_전후.html')

요소공방 = 'docs/캐릭터/요소공방_0822'
화면들 = [
    ('조합공방_0821', '조합판_v1'), ('성장공방_0821', '성장판_v1'), ('오늘공방_0822', '오늘판_v1'),
    ('소식공방_0823', '소식판_v1'), ('학부모공방_0823', '우리아이판_v1'), ('학부모공방_0823', '리포트판_v1'),
    ('학부모공방_0823', '부모소식판_v1'), ('강사공방_0823', '오늘수업판_v1'), ('강사공방_0823', '강사학생판_v1'),
    ('강사공방_0823', '검수판_v1'), ('강사공방_0823', '기록판_v1'), ('원장공방_0823', '원장오늘판_v1'),
    ('원장공방_0823', '원장학생판_v1'), ('원장공방_0823', '경영판_v1'),
]

갈래들 = [
    {'이름': '요소 세트', '옛': '4a4d2472', '방': 요소공방, '재귀': True, '수': 156,
     '왜': '앱·교재·PDF 에 서는 낱개 부품. 숫자·자모·기호·요일·살림·음식·초밥·조작·표시·구조 열세 세트.'},
    {'이름': '화면 열넷', '옛': '4a4d2472', '화면': True, '수': 14, '무대뺌': False,
     '왜': '학생·학부모·강사·원장 네 갈래의 앱 화면. 그릇을 다시 굽고 본문을 다시 부었다.'},
    {'이름': '오브 26색', '옛': '2e60e210', '방': 'docs/캐릭터/오브공방_0821', '재귀': False, '수': 26,
     '왜': '킷 색마다의 실물 오브. 「이 색이 펠트로 나오면 어떤 색인가」의 정본.'},
    {'이름': '퍼프로브 23', '옛': '2e60e210', '방': 'docs/캐릭터/퍼프로브_0819', '재귀': False, '수': 23,
     '왜': '알약·아이콘·폼폼·판 3종·품질 4종 등 «재질을 정하는» 판들.'},
    {'이름': '오브제 글자 3', '옛': '2e60e210', '방': 'docs/캐릭터/글자공방_0820', '재귀': False, '수': 3,
     '왜': '자수·레터프레스·라벨 — 글자를 실물로 낼 때의 세 문법.'},
]


def 옛판(rel, 옛):
    p = subprocess.run(['git', '-C', 루트, 'show', '%s:%s' % (옛, rel)], capture_output=True)
    if p.returncode != 0 or not p.stdout:
        return None
    try:
        return Image.open(io.BytesIO(p.stdout))
    except Exception:
        return None


def _통계(화소들):
    """🔴 채도는 «밝기로 가중»한다 — 맨 HSV S 는 어두운 화소에서 폭발한다.
       (3,1,1) 같은 거의 검은 화소의 S 가 0.67 이라, 바탕이 어두워진 판이 «채도 +396%» 로 찍힌다
       (08-24 화면 열넷 실측). 어두운 화소는 사람 눈에도 색으로 안 읽히니 그 무게만큼만 센다.
       Σ(S·V) / Σ(V) — 밝은 면이 색을 말하고, 검은 바탕은 값에 거의 기여하지 않는다.
       렌더처럼 무대가 이미 빠진 판에서는 맨 평균과 사실상 같은 값이 나온다."""
    if not 화소들:
        return None
    가중, 무게 = 0.0, 0.0
    밝 = []
    for (r, g, b) in 화소들:
        h, sat, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        가중 += sat * v
        무게 += v
        밝.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
    m = sum(밝) / len(밝)
    return {'채도': (가중 / 무게) if 무게 else 0.0, '밝기': m,
            '대비': (sum((x - m) ** 2 for x in 밝) / len(밝)) ** 0.5}


def _작게재기용(im, W=320):
    t = im.convert('RGB')
    return t.resize((W, max(1, round(W * t.height / t.width))))


def 쌍재기(옛im, 새im, 문턱=45):
    """두 판을 «같은 화소 무리»에서 잰다 — 마스크는 둘의 합집합으로 한 번만 만든다.
    이렇게 해야 「바탕이 어두워져서 뽑히는 화소가 줄었다」가 «밝아졌다»로 뒤집혀 읽히지 않는다."""
    a, b = _작게재기용(옛im), _작게재기용(새im)
    if a.size != b.size:
        b = b.resize(a.size)
    pa, pb = list(a.getdata()), list(b.getdata())
    골 = [i for i in range(len(pa)) if sum(pa[i]) > 문턱 or sum(pb[i]) > 문턱]
    if not 골:
        return None, None
    return _통계([pa[i] for i in 골]), _통계([pb[i] for i in 골])


def 잰다(im, 무대뺌=True):
    """짝이 없을 때만 쓰는 홑 잣대(옛 판이 git 에 없는 장)."""
    s = _작게재기용(im)
    몸 = [(r, g, b) for (r, g, b) in s.getdata() if (not 무대뺌) or r + g + b > 45]
    return _통계(몸)


def 작게(im, w):
    t = im.convert('RGB').copy()
    t.thumbnail((w, w * 3))          # 세로로 긴 화면판도 폭 기준으로 줄인다
    b = io.BytesIO()
    t.save(b, 'WEBP', quality=80, method=4)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def 장들(g):
    """(보일이름, 저장소상대경로, 실파일) 목록."""
    if g.get('화면'):
        for 방, 이름 in 화면들:
            rel = 'docs/캐릭터/%s/%s.png' % (방, 이름)
            yield 이름.replace('_v1', ''), rel, os.path.join(루트, *rel.split('/'))
        return
    뿌리 = os.path.join(루트, *g['방'].split('/'))
    if g.get('재귀'):
        for 세트 in sorted(d for d in os.listdir(뿌리) if os.path.isdir(os.path.join(뿌리, d))):
            for f in sorted(x for x in os.listdir(os.path.join(뿌리, 세트)) if x.endswith('.png')):
                yield '%s/%s' % (세트, f[:-4]), '%s/%s/%s' % (g['방'], 세트, f), os.path.join(뿌리, 세트, f)
    else:
        for f in sorted(x for x in os.listdir(뿌리)
                        if x.endswith('.png') and not x.startswith('_대조_')):
            yield f[:-4], '%s/%s' % (g['방'], f), os.path.join(뿌리, f)


절들, 요약, 경고들 = [], [], []
for g in 갈래들:
    칸들, 표 = [], []
    없음 = 0
    목록 = list(장들(g))
    print('■ %s — %d장 …' % (g['이름'], len(목록)), end='', flush=True)
    # 🔴 선언 수 ≠ 실물 수를 빨갛게 센다 — 안 세면 갈래가 조용히 줄어도 지면은 멀쩡해 보인다
    #   (피어 codex 지적 08-24 · batch-tool-narrower-than-its-name 과 같은 축).
    if len(목록) != g['수']:
        경고들.append('%s: 선언 %d장 ≠ 실물 목록 %d장' % (g['이름'], g['수'], len(목록)))
    for 보임, rel, 길 in 목록:
        try:
            새im = Image.open(길)
        except Exception:
            없음 += 1; continue
        옛im = 옛판(rel, g['옛'])
        뺌 = g.get('무대뺌', True)
        if 옛im:
            옛값, 새값 = 쌍재기(옛im, 새im)
        else:
            옛값, 새값 = None, 잰다(새im, 뺌)
        if 옛값 and 새값:
            표.append((옛값, 새값))
        변 = ('채도 %+.0f%%' % ((새값['채도'] / 옛값['채도'] - 1) * 100)) if (옛값 and 옛값['채도']) else '옛 판 없음'
        밝변 = ('밝기 %+.0f%%' % ((새값['밝기'] / 옛값['밝기'] - 1) * 100)) if (옛값 and 옛값['밝기']) else ''
        칸들.append(
            '<figure class="쌍"><div class="두장">'
            + ('<img src="%s" alt="옛 %s">' % (작게(옛im, 폭), esc(보임)) if 옛im
               else '<div class="빔">옛 판 없음</div>')
            + '<img src="%s" alt="새 %s">' % (작게(새im, 폭), esc(보임))
            + '</div><figcaption><b>%s</b><span class="변">%s · %s</span></figcaption></figure>'
            % (esc(보임), esc(변), esc(밝변)))
    print(' 됐다(옛 판 있는 쌍 %d · 못 읽음 %d)' % (len(표), 없음))
    평균 = None
    if 표:
        평균 = {k: (sum(o[k] for o, _ in 표) / len(표), sum(n[k] for _, n in 표) / len(표))
                for k in ('채도', '밝기', '대비')}
    else:
        # 🔴 쌍 0 갈래를 요약에서 빼면 총계가 조용히 줄어든다 — 「전량」이 갈래 하나 빠진 날에도
        #   같은 얼굴이 된다(피어 codex 지적 08-24). 0 도 줄로 세운다(값 칸은 — 로 나온다).
        경고들.append('%s: 옛·새 쌍이 0 — 대조가 통째로 빈 갈래' % g['이름'])
    요약.append((g['이름'], len(목록), len(표), g['옛'], 평균))
    절들.append((g, 칸들, 평균, len(목록), len(표)))


def 줄(평균, k):
    if not 평균:
        return '—'
    a, b = 평균[k]
    return '%.3f → %.3f <b>%+.1f%%</b>' % (a, b, (b / a - 1) * 100 if a else 0)


전체표 = ''.join(
    '<tr><td><b>%s</b></td><td>%d장</td><td><code>%s</code></td><td>%s</td><td>%s</td><td>%s</td></tr>'
    % (esc(이름), 수, 옛[:8], 줄(평균, '채도'), 줄(평균, '대비'), 줄(평균, '밝기'))
    for 이름, 수, 쌍수, 옛, 평균 in 요약)
총장 = sum(수 for _, 수, _, _, _ in 요약)
총쌍 = sum(쌍수 for _, _, 쌍수, _, _ in 요약)

몸통 = []
for i, (g, 칸들, 평균, 수, 쌍수) in enumerate(절들):
    몸통.append(
        '<h2 id="s%d" class="듦"><span class="번호">%02d</span><span>%s — %d장</span></h2>'
        '<p class="듦">%s</p>'
        '<p class="메타 듦">옛 판 = <code>%s</code> · 옛 판이 있는 쌍 %d/%d · '
        '채도 %s · 대비 %s · 밝기 %s<br>잰 화소 = %s</p>'
        '<div class="쌍줄">%s</div>'
        % (i + 1, i + 1, esc(g['이름']), 수, g['왜'], g['옛'][:8], 쌍수, 수,
           줄(평균, '채도'), 줄(평균, '대비'), 줄(평균, '밝기'),
           '옛·새 «같은 마스크»(둘 중 하나라도 문턱을 넘는 화소의 합집합)',
           ''.join(칸들)))

# 🔴 % 포매팅을 쓰면 본문의 «진짜 퍼센트»(「+25.8%」·「width:100%」)를 서식 지시자로 읽어 터진다.
#   08-24 실사고: 222쌍을 다 재고 나서 마지막 조립에서 죽었다(재는 값이 아까운 자리다).
#   ⇒ 토큰 치환으로 간다. 본문에 % 가 몇 개 있든 상관없다.
원고틀 = '''<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>재굽기 전후 — 08-24 명품 재굽기 전량</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node/python tools/재굽기_전후.py — 손 편집 금지(재생성이 덮는다) -->
<!--펠트스킨-->
<style>
.쌍줄{display:flex;flex-wrap:wrap;gap:14px;margin:1.2em 0;}
.쌍{flex:0 1 auto;padding:0;margin:0;}
.두장{display:flex;gap:3px;align-items:flex-start;}
.두장 img{display:block;width:{{폭}}px;height:auto;border-radius:9px;}
.두장 img:first-child{filter:none;opacity:.92;}
.두장 .빔{width:{{폭}}px;aspect-ratio:1;display:grid;place-items:center;font-size:.72rem;opacity:.4;
  border:1px dashed currentColor;border-radius:9px;}
.쌍 figcaption{padding:6px 2px 0;font-size:.74rem;line-height:1.45;}
.쌍 .변{display:block;opacity:.62;font-size:.68rem;}
.가름{display:flex;gap:3px;margin:.2em 0 1.1em;font-size:.72rem;opacity:.6;}
.가름 span{width:{{폭}}px;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">재굽기 전후</p>
  <ol>{{차례}}</ol>
</nav>

<div class="글">

<header class="표지">
  <div>
    <p class="꼭지">SYNK Loom · 2026-08-24</p>
    <h1>재굽기 전후 — 전량 {{총장}}장</h1>
    <p class="한줄">「색이 씻긴다」의 진범은 재료가 아니라 <b>자</b>였다. 블렌더 기본 뷰 변환(AgX)이
    채도를 눌러 온 것을 08-24 에 잡고, 3D 로 굽는 자산 <b>전량</b>을 새 자로 다시 구웠다.
    이 지면은 그 전과 후를 <b>한 자리에서</b> 나란히 놓는다 — 왼쪽이 옛 판, 오른쪽이 새 판.</p>
  </div>
</header>

<div class="유리 알림 듦"><b>채택값 셋</b> — 색관리 <code>Khronos PBR Neutral</code>(대비가 오른 유일한 변주) ·
노출 <code>+0.25</code>(중립이 내린 밝기를 되민다) · 샘플 <code>256</code>(또렷함 +25.8% · 512 는 2배 값에 +6.9%뿐).
넷을 대표 판에 걸어 <b>나란히 보고 고르지 않고 «재서»</b> 골랐다.</div>

{{경고}}
<h2 id="s0" class="듦"><span class="번호">00</span><span>한눈에</span></h2>
<table class="듦"><thead><tr><th>갈래</th><th>장수</th><th>옛 판</th><th>채도</th><th>대비</th><th>밝기</th></tr></thead>
<tbody>{{전체표}}</tbody></table>
<p class="듦"><b>합계 {{총장}}장 = 옛 판이 있어 대조된 것 {{총쌍}} + 대조 못 한 것 {{못함}}.</b>
대조가 되려면 옛 판이 git 에 있어야 한다 — <b>덮어쓰기 전에 커밋해 두는 습관이 이 지면의 재료</b>다.</p>

{{몸통}}

<footer class="메타">자동 생성 = <code>python tools/재굽기_전후.py</code> ·
굽기 = <code>node tools/명품재굽기.js</code>(Blender 5.2 · Cycles) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4) · 색 = <code>docs/디자인_토큰.json</code>.</footer>

</div><!--/글-->
</div><!--/판-->
</html>'''

채울것 = {
    '폭': str(폭),
    '차례': '<li><a href="#s0"><span class="n">00</span> 한눈에</a></li>' + ''.join(
        '<li><a href="#s%d"><span class="n">%02d</span> %s</a></li>' % (i + 1, i + 1, esc(g['이름']))
        for i, (g, _, _, _, _) in enumerate(절들)),
    '총장': str(총장), '총쌍': str(총쌍), '못함': str(총장 - 총쌍),
    '전체표': 전체표, '몸통': '\n'.join(몸통),
    '경고': ('<div class="유리 알림 듦" style="border-color:#c0392b;color:#e8998c">'
             '<b>🔴 이 지면은 완전하지 않다</b> — ' + ' · '.join(esc(w) for w in 경고들) + '</div>')
            if 경고들 else '',
}
원고 = 원고틀
for _열쇠, _값 in 채울것.items():
    원고 = 원고.replace('{{' + _열쇠 + '}}', _값)
남은 = [t for t in 채울것 if ('{{' + t + '}}') in 원고]
assert not 남은, '안 채워진 토큰: %s' % 남은

임시 = os.path.join(루트, 'docs', '_재굽기전후_원고.html')
with open(임시, 'w', encoding='utf-8') as f:
    f.write(원고)
r = subprocess.run(['node', os.path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력])
try:
    os.unlink(임시)
except OSError:
    pass
if r.returncode != 0:
    print('🔴 펠트문서 입히기 실패'); raise SystemExit(1)
print('\n■ 재굽기 전후  %s  (%dKB · 전량 %d장 · 대조된 쌍 %d)'
      % (os.path.relpath(출력, 루트), os.path.getsize(출력) // 1024, 총장, 총쌍))
if 경고들:
    print('🔴 경고 %d건 — 지면은 냈지만 완전하지 않다:' % len(경고들))
    for w in 경고들:
        print('   ' + w)
    raise SystemExit(1)
