"""부품 견줌판 — 지면이 «지금 쓰는» 부품 47벌을 옛것/새것 나란히 세워 고르게 한다 (2026-09-07).

왜 이것이 있나 (09-07 실사고):
  유호님이 「이 유리 요소 예전 거 아니야?」·「단추도 그렇고 다 예전 걸 사용하고 있네」로 잡으셨다.
  잡아낸 자는 **사람 눈**이었고, 기계는 그때 초록이었다 — `node tools/lib/loom.js --분모` 는
  「그 CSS 가 나갔나」만 세고 「그것이 최신인가」는 안 본다. 그래서 옛 판이 조용히 이겨도 초록이다.
  이 지면이 그 빈칸을 메운다: **옛것과 새것을 같은 줄에 세워 눈이 바로 가르게 한다.**

🔑 «실크기 줄»이 진짜 자다. 크게 띄우면 무엇이든 좋아 보인다 — 불릿은 지면에서 7px 이고
   링크 표식은 3px 다. 그 크기에서 실 결이 남는지가 유일한 물음이다(계획.json 규율).

사용:
  python tools/부품견줌판.py                     # 옛것 = git HEAD 판, 새것 = 지금 파일
  python tools/부품견줌판.py --옛 <경로|커밋>

🔴 **새 배선을 커밋한 «뒤»에는 기본값이 못 쓴다.** 기본 「옛것 = HEAD」는 «아직 안 커밋한 상태»를
   전제한다 — 커밋하고 나면 HEAD 가 곧 새 판이라 47벌이 전부 「같음」으로 뜬다(거짓 초록).
   ⇒ 그때는 갈리기 «전» 커밋을 손으로 준다. 09-07 판갈이의 그 자리는 `2cc317998` 바로 앞이다:
     python tools/부품견줌판.py --옛 88212dc57
"""
import argparse
import io
import json
import os
import subprocess
import sys

for 흐름 in (sys.stdout, sys.stderr):
    try:
        흐름.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass

루트 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
재질경로 = 'docs/Loom_자산/구운재질.json'

# ── 지면에서 «실제로» 그려지는 크기 (tools/lib/loom.js 의 CSS 값 · 글자 16px 기준) ──────
#   🔑 여기 적는 수는 내가 고른 것이 아니라 loom.js 의 규칙에서 읽은 것이다.
#      바꾸려면 loom.js 를 고치고 여기를 맞춘다(두 곳에 적힌 값이라 갈릴 수 있는 자리다).
실크기 = {
    '매듭점': (7, 'ul 목록 점 · 7px'),
    '땀점': (3, '본문 링크 뒤 표식 · 3px'),
    '단추민판': (14, '분류 표식 · 14px (번호 받침으로는 33px)'),
    '폼폼민방울': (46, '히어로 숫자 그릇 · 2.9em ≈ 46px'),
    '합주': (240, '표지 배경 장면'),
}
실크기.update({f'단추숫자_{i:02d}': (33, '절 번호 · 2.05em ≈ 33px') for i in range(1, 13)})
실크기.update({n: (26, '자수 표식 · 1.62em ≈ 26px') for n in [
    '요소_체크', '요소_별', '요소_하트', '요소_말풍선', '요소_탭집', '요소_탭책',
    '요소_탭차트', '요소_탭사람', '요소_도장', '요소_게이지', '요소_폼폼',
    '요소_시침핀', '요소_와펜', '요소_매듭']})
실크기.update({n: (46, '가로 띠 · 넓은 자리') for n in [
    '요소_녹음대기', '요소_녹음중', '요소_녹음맺음', '요소_내려놓은바늘']})
실크기.update({f'히어로_{n}': (240, '소개서 표지 얼굴')
               for n in ['Core', 'Loom', 'Vellum', 'Trail', 'Prism', 'Temper', 'Reed']})
실크기.update({n: (26, '은퇴한 자리 — 지금 지면은 안 쓴다') for n in [
    '유리구', '레진구', '레진구_글자', '칩', '판']})

무리들 = [
    ('절 번호 단추 열둘', '문서의 절마다 앞에 앉는 번호. 열두 절까지는 번호가 «천에 수놓여» 있고, '
                    '열셋부터는 번호 없는 민판 위에 글자가 앉는다.',
     [f'단추숫자_{i:02d}' for i in range(1, 13)]),
    ('자수 요소 열여덟', '체크·별·하트처럼 지면과 앱이 같이 쓰는 표식들. '
                   '08-22 에 블렌더로 구운 판이 그동안 실려 있었다.',
     ['요소_체크', '요소_별', '요소_하트', '요소_말풍선', '요소_탭집', '요소_탭책', '요소_탭차트',
      '요소_탭사람', '요소_도장', '요소_게이지', '요소_녹음대기', '요소_녹음중', '요소_녹음맺음',
      '요소_내려놓은바늘', '요소_폼폼', '요소_시침핀', '요소_와펜', '요소_매듭']),
    ('가장 작은 넷', '지면에서 제일 작게 그려지는 것들이라 «실크기 줄»이 특히 중요하다. '
                '링크 표식은 3px, 목록 점은 7px 다.',
     ['매듭점', '단추민판', '땀점', '폼폼민방울']),
    ('표지 여덟', '문서 맨 위에 깔리는 그림. 「합주」는 09-01 판에 유리·레진 구슬이 남아 있었고, '
              '이번에 펠트 구슬 셋으로 다시 세웠다.',
     ['합주', '히어로_Core', '히어로_Loom', '히어로_Vellum', '히어로_Trail', '히어로_Prism',
      '히어로_Temper', '히어로_Reed']),
    ('안 구운 다섯 — 은퇴한 자리', '09-03 에 「유리·레진 구슬은 나간다」로 자리를 잃은 것들. '
                          '지금 지면은 이 다섯을 안 쓰지만, 배선에는 옛 그림이 남아 있다.',
     ['유리구', '레진구', '레진구_글자', '칩', '판']),
]

큰것 = {'합주'} | {f'히어로_{n}' for n in
                ['Core', 'Loom', 'Vellum', 'Trail', 'Prism', 'Temper', 'Reed']}


def 판읽기(어디):
    """파일 경로 또는 git 커밋 이름에서 구운재질.json 을 읽는다."""
    길 = os.path.join(루트, 어디) if not os.path.isabs(어디) else 어디
    if os.path.exists(길):
        return json.load(io.open(길, encoding='utf-8'))
    # 🔑 git 에서 꺼낸다 — 사본을 새로 만들지 않는다(보존은 git 이력이 한다).
    #   ⚠ 셸을 태우지 않고 인자 목록으로 부른다(Git Bash 는 한글 경로에서 조용히 빈 출력을 낸다).
    r = subprocess.run(['git', 'show', f'{어디}:{재질경로}'], capture_output=True, cwd=루트)
    if r.returncode != 0 or not r.stdout:
        raise SystemExit(f'옛 판을 못 읽었다 — 「{어디}」 (git: {r.stderr[:200]!r})')
    return json.loads(r.stdout.decode('utf-8'))


def 견본(p, 크기, 테두리=False):
    """부품 하나를 그리는 상자. 몸 위에 접지가 깔린다(두 층일 때)."""
    if not p:
        return f'<div class="빔" style="width:{크기}px;height:{크기}px"></div>'
    층 = [f'url("{p["몸"]}")']
    if p.get('층') == 2 and p.get('접지'):
        층.append(f'url("{p["접지"]}")')
    스타일 = (f'width:{크기}px;height:{크기}px;'
            f'background-image:{",".join(층)};'
            'background-size:contain;background-position:center;background-repeat:no-repeat')
    return f'<div class="견본{" 테두리" if 테두리 else ""}" style="{스타일}"></div>'


def 쪽쓰기(옛부품, 새부품, 옛이름, 새이름):
    조각 = []
    갈린수 = 그대로수 = 0

    for 제목, 설명, 이름들 in 무리들:
        칸들 = []
        for 이름 in 이름들:
            옛 = 옛부품.get(이름)
            새 = 새부품.get(이름)
            출처 = (새 or {}).get('출처', '')
            구운날 = (새 or {}).get('구운날', '')
            갈렸나 = bool(출처.endswith('.avif'))   # 09-07 배치가 낸 것만 avif 다
            if 갈렸나:
                갈린수 += 1
            else:
                그대로수 += 1
            px, 자설명 = 실크기.get(이름, (26, ''))
            보는크기 = 260 if 이름 in 큰것 else 104
            띠 = ('<span class="띠 갈림">새로 구웠다</span>' if 갈렸나
                  else '<span class="띠 그대로">그대로 뒀다</span>')
            칸들.append(f'''
      <article class="칸{' 넓게' if 이름 in 큰것 else ''}" data-부품="{이름}">
        <header class="칸머리">
          <h3>{이름.replace('_', ' ')}</h3>
          {띠}
        </header>
        <p class="쓰임">{(새 or 옛 or {}).get('쓰임', '')}</p>
        <div class="견줌">
          <div class="쪽"><span class="쪽표">옛것</span>{견본(옛, 보는크기)}</div>
          <div class="쪽"><span class="쪽표">새것</span>{견본(새, 보는크기)}</div>
        </div>
        <div class="자">
          <span class="자표">실크기 {px}px</span>
          <div class="자줄">{견본(옛, px)}{견본(새, px)}</div>
          <span class="자설명">{자설명}</span>
        </div>
        <dl class="속">
          <dt>온 곳</dt><dd>{출처 or '(옛 판에는 기록이 없다)'}</dd>
          <dt>구운 날</dt><dd>{구운날 or '기록 없음'}</dd>
        </dl>
        <div class="고르기" role="group" aria-label="{이름} 판정">
          <button type="button" class="픽" data-값="좋다">좋다</button>
          <button type="button" class="픽" data-값="다시">다시 굽자</button>
        </div>
      </article>''')
        조각.append(f'''
    <section class="무리">
      <div class="무리머리">
        <h2>{제목}</h2>
        <p>{설명}</p>
      </div>
      <div class="판">{''.join(칸들)}</div>
    </section>''')

    return '\n'.join(조각), 갈린수, 그대로수


CSS = r'''
:root{
  --종이:#FBF7F0; --카드:#FFFFFF; --잉크:#2B2320; --보조:#575046; --흐림:#8D857A;
  --실땀:#F0E3C8; --귀리:#EDE7DC; --돌:#C7BFB2;
  --코랄:#F96859; --코랄글자:#AE322A; --코랄면:#FEF0E9;
  --자람:#3F6B2E; --자람면:#D3E8BE;
  --견본바닥:#EDE7DC; --그림자:0 1px 0 rgba(43,35,32,.04);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --종이:#080605; --카드:#2B2320; --잉크:#FBF7F0; --보조:#EDE7DC; --흐림:#C7BFB2;
    --실땀:#575046; --귀리:#3a322c; --돌:#575046;
    --코랄:#F96859; --코랄글자:#FBB7A3; --코랄면:#3a201c;
    --자람:#D3E8BE; --자람면:#2c3d22;
    --견본바닥:#3a322c; --그림자:none;
  }
}
:root[data-theme="dark"]{
  --종이:#080605; --카드:#2B2320; --잉크:#FBF7F0; --보조:#EDE7DC; --흐림:#C7BFB2;
  --실땀:#575046; --귀리:#3a322c; --돌:#575046;
  --코랄:#F96859; --코랄글자:#FBB7A3; --코랄면:#3a201c;
  --자람:#D3E8BE; --자람면:#2c3d22;
  --견본바닥:#3a322c; --그림자:none;
}

@font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo'),
  local('Noto Sans KR'),local('Noto Sans CJK KR');unicode-range:U+300C-300D;}

*{box-sizing:border-box}
body{
  margin:0;background:var(--종이);color:var(--잉크);
  font-family:'SYNK Bracket','Inter Tight','SUIT Variable',system-ui,-apple-system,
    'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  font-weight:500;letter-spacing:-.02em;line-height:1.62;
  -webkit-font-smoothing:antialiased;
}
.몸{max-width:1180px;margin:0 auto;padding:clamp(28px,5vw,64px) clamp(18px,4vw,40px) 96px}

/* ── 머리 ─────────────────────────────────────────────── */
.머리{border-bottom:1px solid var(--실땀);padding-bottom:28px;margin-bottom:40px}
.눈표{font-family:'DM Mono',ui-monospace,SFMono-Regular,Consolas,monospace;
  font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--흐림);margin:0 0 10px}
h1{font-size:clamp(30px,4.4vw,46px);font-weight:800;letter-spacing:-.04em;
  line-height:1.12;margin:0 0 14px;text-wrap:balance}
.한줄{font-size:17px;color:var(--보조);margin:0;max-width:62ch}
.셈{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:24px;
  font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:13px;
  font-variant-numeric:tabular-nums;color:var(--보조)}
.셈 b{color:var(--잉크);font-weight:600}
.셈 .큰{font-size:22px;font-weight:600;letter-spacing:-.02em}

.일러두기{margin:28px 0 0;padding:16px 18px;background:var(--코랄면);
  border-left:3px solid var(--코랄);font-size:14.5px;color:var(--보조);max-width:70ch}
.일러두기 b{color:var(--코랄글자);font-weight:600}

/* ── 무리 ─────────────────────────────────────────────── */
.무리{margin-top:52px}
.무리머리{margin-bottom:20px;max-width:66ch}
.무리머리 h2{font-size:21px;font-weight:800;letter-spacing:-.03em;margin:0 0 6px}
.무리머리 p{margin:0;font-size:14.5px;color:var(--흐림)}
.판{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(268px,1fr))}

/* ── 칸 ───────────────────────────────────────────────── */
.칸{background:var(--카드);border:1px solid var(--실땀);border-radius:6px;
  padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:var(--그림자)}
.칸.넓게{grid-column:span 2}
@media (max-width:640px){.칸.넓게{grid-column:span 1}}
.칸머리{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.칸머리 h3{margin:0;font-size:15px;font-weight:600;letter-spacing:-.02em}
.쓰임{margin:0;font-size:13px;color:var(--흐림);line-height:1.5}

.띠{font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:10.5px;
  letter-spacing:.06em;padding:2px 7px;border-radius:3px;white-space:nowrap;flex:none}
.띠.갈림{background:var(--자람면);color:var(--자람)}
.띠.그대로{background:var(--귀리);color:var(--보조)}

.견줌{display:flex;gap:10px}
.쪽{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;
  background:var(--견본바닥);border-radius:4px;padding:12px 8px}
.쪽표{font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:10.5px;
  letter-spacing:.1em;color:var(--흐림)}
.견본{flex:none;max-width:100%}
.빔{background:repeating-linear-gradient(45deg,transparent,transparent 4px,
  var(--돌) 4px,var(--돌) 5px);border-radius:3px;opacity:.5}

.자{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  border-top:1px dashed var(--실땀);padding-top:11px}
.자표{font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:11px;
  color:var(--코랄글자);font-variant-numeric:tabular-nums;flex:none}
.자줄{display:flex;align-items:center;gap:10px;background:var(--견본바닥);
  border-radius:3px;padding:7px 10px;min-height:26px;overflow-x:auto;max-width:100%}
.자설명{font-size:11.5px;color:var(--흐림);flex:1 1 100%}

.속{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0;
  font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:11px;color:var(--흐림)}
.속 dt{color:var(--돌)}
.속 dd{margin:0;overflow-wrap:anywhere}

.고르기{display:flex;gap:8px;margin-top:auto;padding-top:4px}
.픽{flex:1;font:inherit;font-size:13px;font-weight:600;padding:7px 10px;cursor:pointer;
  background:transparent;color:var(--보조);border:1px solid var(--실땀);border-radius:4px;
  transition:background .12s,color .12s,border-color .12s}
.픽:hover{border-color:var(--돌)}
.픽:focus-visible{outline:2px solid var(--코랄);outline-offset:2px}
.칸[data-판정="좋다"] .픽[data-값="좋다"]{background:var(--자람면);color:var(--자람);
  border-color:var(--자람)}
.칸[data-판정="다시"] .픽[data-값="다시"]{background:var(--코랄면);color:var(--코랄글자);
  border-color:var(--코랄)}

/* ── 고른 것 요약 (위에 붙는다) ──────────────────────────── */
.요약{position:sticky;top:0;z-index:5;background:var(--종이);border-bottom:1px solid var(--실땀);
  margin:0 0 -1px;padding:11px 0;font-family:'DM Mono',ui-monospace,Consolas,monospace;
  font-size:12.5px;color:var(--보조);display:flex;gap:20px;flex-wrap:wrap;
  font-variant-numeric:tabular-nums}
.요약 b{font-weight:600;color:var(--잉크)}
.요약 .저장{color:var(--흐림)}

@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
'''

JS = r'''
(function(){
  var 저장;                              // db 가 서면 db, 아니면 이 브라우저에만
  var 판정 = {};
  var 요약줄 = document.getElementById('요약셈');
  var 저장줄 = document.getElementById('저장곳');

  function 셈그리기(){
    var 좋다 = 0, 다시 = 0;
    for (var k in 판정){ if (판정[k] === '좋다') 좋다++; else if (판정[k] === '다시') 다시++; }
    요약줄.innerHTML = '좋다 <b>' + 좋다 + '</b> · 다시 굽자 <b>' + 다시 + '</b> · 아직 <b>'
      + (전체수 - 좋다 - 다시) + '</b>';
  }
  function 칸에그리기(){
    document.querySelectorAll('.칸').forEach(function(칸){
      var v = 판정[칸.dataset.부품];
      if (v) 칸.dataset.판정 = v; else delete 칸.dataset.판정;
    });
  }

  var 전체수 = document.querySelectorAll('.칸').length;
  try { 판정 = JSON.parse(localStorage.getItem('부품판정') || '{}'); } catch(e){ 판정 = {}; }
  칸에그리기(); 셈그리기();

  document.addEventListener('click', function(e){
    var 단추 = e.target.closest('.픽'); if (!단추) return;
    var 칸 = 단추.closest('.칸'); var 이름 = 칸.dataset.부품; var 값 = 단추.dataset.값;
    판정[이름] = (판정[이름] === 값) ? null : 값;
    if (!판정[이름]) delete 판정[이름];
    칸에그리기(); 셈그리기();
    try { localStorage.setItem('부품판정', JSON.stringify(판정)); } catch(err){}
    if (저장) {
      if (판정[이름]) 저장.doc('고르기/' + 이름).set({ 판정: 값, 때: new Date().toISOString() })
        .catch(function(){});
      else 저장.doc('고르기/' + 이름).delete().catch(function(){});
    }
  });

  if (window.claude && window.claude.use) {
    window.claude.use('db').then(function(db){
      if (!db) return;
      저장 = db;
      저장줄.textContent = '고른 것이 저장된다 — 세션이 그대로 읽는다';
      db.collection('고르기').get().then(function(줄들){
        (줄들 || []).forEach(function(줄){
          var 이름 = (줄.id || '').split('/').pop();
          var 값 = (줄.data && 줄.data.판정) || 줄.판정;
          if (이름 && 값) 판정[이름] = 값;
        });
        칸에그리기(); 셈그리기();
      }).catch(function(){});
    }).catch(function(){});
  }
})();
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--옛', default='HEAD', help='옛 판 — 파일 경로 또는 git 커밋(기본 HEAD)')
    ap.add_argument('--새', default=재질경로, help='새 판 파일 경로')
    ap.add_argument('--낼곳', default='docs/Loom_자산/부품_견줌판.html')
    a = ap.parse_args()

    옛 = 판읽기(a.옛)
    새 = 판읽기(a.새)
    본문, 갈린수, 그대로수 = 쪽쓰기(옛['부품'], 새['부품'], a.옛, a.새)
    전체 = 갈린수 + 그대로수

    html = f'''<title>펠트 부품 견줌판</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;800&family=DM+Mono:wght@400;500&display=swap">
<style>{CSS}</style>
<div class="몸">
  <div class="요약">
    <span id="요약셈">세는 중</span>
    <span class="저장" id="저장곳">고른 것은 이 브라우저에 남는다</span>
  </div>

  <header class="머리">
    <p class="눈표">SYNK · Loom 자산</p>
    <h1>지면이 지금 쓰는 부품 {전체}벌</h1>
    <p class="한줄">왼쪽이 그동안 실려 있던 것, 오른쪽이 09-07 새벽에 4K로 다시 구운 것이다.
      마음에 안 드는 것은 「다시 굽자」를 눌러 두시면 된다 — 그대로 다음 굽기 일감이 된다.</p>
    <div class="셈">
      <span><span class="큰">{갈린수}</span> 벌이 <b>새 판으로 갈렸다</b></span>
      <span><span class="큰">{그대로수}</span> 벌은 <b>그대로 뒀다</b> (은퇴한 자리)</span>
      <span>배선 정본 = <b>{재질경로}</b></span>
    </div>
    <p class="일러두기"><b>실크기 줄이 진짜 자다.</b> 크게 띄우면 무엇이든 좋아 보인다.
      목록 점은 지면에서 7px, 링크 뒤 표식은 3px 다 — 그 크기에서도 실 결이 남는지가
      이 판의 유일한 물음이다.</p>
  </header>
{본문}
</div>
<script>{JS}</script>
'''

    낼길 = os.path.join(루트, a.낼곳)
    임시 = 낼길 + '.tmp'
    with io.open(임시, 'w', encoding='utf-8', newline='') as f:
        f.write(html)
        f.flush()
        os.fsync(f.fileno())
    os.replace(임시, 낼길)
    print(f'■ 견줌판 — 부품 {전체}벌 = 갈린 것 {갈린수} + 그대로 {그대로수}')
    print(f'✅ {a.낼곳} · {len(html) / 1024 / 1024:.2f}MB')


if __name__ == '__main__':
    main()
