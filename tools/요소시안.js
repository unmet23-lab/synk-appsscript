#!/usr/bin/env node
/**
 * 요소시안 — `tools/세트굽기.js` 가 구운 요소 전부를 **한 지면**에 세운다.
 *
 * 왜 있나 (유호 08-22 「전부 해줘」):
 *   93장이 폴더에 흩어져 있으면 «다 됐는지»도 «맞는지»도 못 본다. 판정은 나란히 놓고 하는 것이다.
 *   오브 시안(`tools/오브시안.js`)과 같은 통로다 — 원고만 짓고 지면은 Loom L4 가 입힌다.
 *
 * 🚫 브랜드렌더린트에 등록하지 않는다 — 여러 요소를 나란히 세우는 것이 이 지면의 «내용»이라
 *   신호 1점 규율이 원리상 위반으로 잡힌다(브랜드킷·오브 시안과 같은 갈래).
 *
 * 사용:  node tools/요소시안.js [--방 docs/캐릭터/요소공방_0822] [--폭 300]
 *        → docs/요소_시안.html
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 1) {
    if (!v[i].startsWith('--')) continue;
    a[v[i].slice(2)] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[i += 1] : '1';
  }
  return a;
})();
const 방 = path.resolve(루트, 인자['방'] || path.join('docs', '캐릭터', '요소공방_0822'));
const 출력 = path.join(루트, 'docs', '요소_시안.html');
const 미리폭 = parseInt(인자['폭'] || '300', 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 세트마다의 «왜» — 격자만 있으면 예쁜지만 보게 된다. 판정에 필요한 것은 «어디에 쓰이나»다. */
const 설명 = {
  기호: ['정답·보상·좋아요와 하단 탭 넷 — <b>학생이 하루에 가장 여러 번 보는 픽셀</b>이다.',
        '도안 여덟은 함수가 아니라 «점 목록»이라(<code>요소굽기.py 도안들</code>) 새 기호는 한 줄로 는다.'],
  숫자: ['0~9 낱장은 <b>조합용</b>(어떤 수든 나열로 선다) · 01~12 통짜는 자간에 손맛이 필요한 자리(단락 머리·월).',
        '「/ · % +」 는 진행 표기(3/10 · 85%)를 위한 것이다.'],
  자모: ['우리는 <b>한국어 학원</b>이다 — 자모가 실물이면 그 자체가 교보재다.',
        '획이 가는 홑획(ㅡ·ㅣ)은 복셀 리메시가 뭉갤 수 있어 눈으로 본다(글자공방 함정 ①).'],
  요일: ['출석 달력·시간표 — 반복 노출이 많은 자리다.'],
  살림: ['도장 = 찍힌다는 «행위»가 곧 보상 · 게이지 고리 = 털실이 12시부터 시계 방향으로 감겨 차오른다.',
        '직선 진행바가 이미 털실이라 원형도 같은 재료여야 학생이 두 번 안 배운다.'],
  음식: ['플레이팅 갈래 <b>17종</b> — 학생이 «먼저 배우는 낱말» 순으로 골랐다. 셋(만두·김밥·붕어빵)에서 두 번 늘렸다:',
        '1차(유호 「음식이 조금 더 많이」) 여섯 — 떡볶이·호떡·라면·김치·딸기·바나나우유. <b>마시는 것 하나</b>를 넣은 까닭은 먹는 것만 열이면 목록이 한 결로 눕기 때문이다.',
        '2차(유호 「삼겹살같은 한식도 퀄리티있게 다양하게」) 여덟 — 삼겹살·불고기(구이) · 비빔밥(밥) · 치킨(튀김) · 잡채(면) · 파전(전) · 김치찌개(찌개) · 송편(떡). <b>끼니 역할이 안 겹치게</b> 골랐다.',
        '3차 — 게장(유호 「어렵겠지?」의 답: <b>게장은 김치보다 쉽다</b>. 게의 정체는 «형태»라 펠트가 잘 내고, 어려운 건 간장의 «윤기» 하나뿐이다).',
        '🔑 이 갈래에서 세 번 같은 실패를 했다 — <b>작은 덩이에 털을 심으면 실루엣이 죽는다</b>(어묵·김치·치킨·송편). 바삭함·쫀득함은 털이 아니라 «잔 범프»가 낸다.'],
  넘버쿠키: ['번호의 «요리 플레이팅»판 — 표지·특별면의 한 점용(본문 자동 번호는 CSS <code>counter</code> 몫 그대로).'],
  음식되굽기: ['접시가 <b>평평한 원반 → 그릇(바닥판+림)</b> 으로 올라간 뒤의 1호·2호. 옛 v1 은 그 전 판이다.'],
  초밥: ['<b>이 재료가 가장 잘하는 음식</b>이다 — 한식이 어려운 것과 정확히 반대 자리다. 초밥은 «기하»(둥근 밥덩이 + 색 판 하나 + 검은 띠)이고, 펠트는 마르고 각이 살아 있어 단정한 형태를 그대로 낸다.',
        '네타 한 줄이면 새 초밥이 는다 — 밥·비례·조명은 안 갈리고 <b>색과 결줄</b>만 바뀐다(연어 지방줄 · 새우 마디 · 참치 힘줄 · 장어 소스).',
        '⚠결줄은 네타 «윗면»에 앉혀야 한다 — 1판은 «윗면 + 두께»에 놓아 네타 속에 묻혀 한 픽셀도 안 나왔다(호떡·딸기와 같은 사고).'],
  조작: ['앱에서 <b>손이 닿는</b> 부품 여섯 — 요소사전 §5 「다음 굽기 후보」로 남아 있던 자리다.',
        '슬라이더·스테퍼는 <b>상태가 곧 값</b>이라 여러 칸을 굽는다 — 한 칸만 구우면 «상태»가 안 보인다.',
        '탭 전환은 <b>지금 탭만</b> 털을 입는다: 넷 다 보풀을 심으면 씻겨 한 덩어리가 된다(함정 1). 그 제약이 뜻과 맞았다 — 「지금 것만 살아 있다」.'],
  조작2: ['유호님 08-23 「무심코 디테일하게 명품화 못하고 지나간 요소들을 체크해서 발전시켜줘」 — <b>기계로 세어 보니 사전 자기 표의 부품 줄 45 중 12줄에 실물이 없었다.</b> 그런데 §5 는 「다음 굽기 후보: 비어 있다」로 적혀 있었다. 큐가 빈 게 아니라 «✅ 를 손으로 다는 방식»이 놓친 것이다.',
         '<b>단추위계</b>는 셋이 한 판이다 — 「이게 으뜸이냐」는 옆에 보조가 있어야만 판정된다. 위계는 물건의 속성이 아니라 «관계»다. 셋의 크기·모양은 같고 <b>털 → 결 → 민판</b>만 내려간다.',
         '<b>라디오</b>가 스냅(체크박스)과 갈리는 자리: 스냅은 각자 잠기지만 라디오는 «한 벌이 한 천에 뚫린다» — 「하나만」이라는 뜻을 천이 낸다.',
         '<b>스와이프의 실은 곧고 풀다운의 실은 늘어졌다</b> — 곧은 실은 잡고 있는 것, 느슨한 실은 막 놓은 것이다. 두 부품을 가르는 것은 모양이 아니라 그 한 가지다.'],
  표시2: ['<b>뱃지</b>에서 함정 ①(털 위에 털)이 정면으로 걸린다 — 폼폼은 요소 중 유일하게 «긴» 보풀이라 그 위에 자수 글자를 올리면 숫자가 파묻힌다. 숫자는 털을 걷고 폼폼 «앞»에 매끈하게 앉는다.',
         '<b>코치마크</b>는 「임시」를 재료가 말한다 — 핀은 뺐다 꽂는 것이고 초크는 털면 지워진다. 둘 다 실이 아니니 확정이 아니다(사다리 ①).',
         '<b>시접자</b>는 정렬을 «격자»로 안 그린다 — 재단에서 정렬은 가장자리에서 잰 한 값이다. 그래서 여백이 「남은 자리」가 아니라 <b>먼저 정한 값</b>이 된다.'],
  구조2: ['🔴 <b>녹음이 이 공방의 가장 큰 구멍이었다</b> — 사전이 「별도 트랙 소관」으로 넘겼는데 그 트랙에 자산이 <b>0</b> 이었다. 우리는 «말하기» 학원이고 학생이 하루에 가장 여러 번 누르는 단추인데도. <b>남에게 넘긴 자리는 아무도 안 본다.</b>',
         '은유는 새로 안 지었다 — 사전 §0 의 <b>바느질 사다리를 시간축으로</b> 읽었다: 대기 = ⓪빈 구멍 · 말하는중 = ②시침(성긴 긴 땀 + 바늘까지 이어진 실) · 맺음 = ③꿰맴 + 끝매듭. <b>말한 것이 곧 한 줄의 땀</b>이라 오늘판의 「말한 학생」·달력의 V·성장 게이지가 한 물건이 된다.',
         '<b>내려놓은 바늘</b>(오류·오프라인)에는 <b>유채가 0점</b>이다 — 오류에 신호색을 안 쓰는 확정이 여기서 그림이 된다. 실은 느슨할 뿐 끊기지 않는다.',
         '<b>고르개</b>가 탭 전환과 갈리는 자리: 탭은 «나란한 것 사이를 오가고» 고르개는 «쌓여 안 보이던 것을 꺼낸다». 같은 견본을 쓰되 <b>배열</b>이 뜻을 가른다.'],
  로딩: ['<b>이 여섯은 한 물건의 여섯 순간이다</b> — 낱개로 보지 말고 <b>차례로</b> 보시라(유호 확정 09-01 「살아 움직이는 재질」 · 갈래 ㄱ「구운 프레임 + Animated」).',
        '「기다림 = 실이 풀리는 시간」인데, <b>감긴 실을 줄이면 되감기가 없다</b> — 한 바퀴 뒤 빈 보빈이 남는다. 그래서 줄인 것은 실이 아니라 <b>꼬리를 지나는 파동의 위상</b>이고, 여섯째 다음이 첫째라 이음매가 없다.',
        '📏 실측 — 이웃 컷끼리 바뀐 픽셀 <b>3.6~4.0%</b>, <b>마지막→첫도 3.80%</b>(같은 크기 = 루프가 닫혔다). 이 수가 0 이면 손잡이가 죽은 것이라 그때는 그림이 아니라 코드를 본다.'],
};

/** 렌더 한 장 → webp data URI. 실패는 던진다(빈 값으로 물러서면 그림 없는 칸이 조용히 나간다). */
function 인라인(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `요소시안-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '84', 임시],
      { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

function main() {
  if (!fs.existsSync(방)) {
    console.error(`🔴 렌더 방이 없다 — \`node tools/세트굽기.js --세트 전부\` 를 먼저 돌린다.\n   ${방}`);
    process.exit(1);
  }
  // 세트 표의 «차례»를 그대로 쓴다 — 폴더 이름 정렬은 뜻이 없다.
  const 차례 = Object.keys(require('./세트굽기.js').세트들);
  const 세트들 = 차례.filter((s) => fs.existsSync(path.join(방, s)));
  if (!세트들.length) { console.error('🔴 구운 세트가 0 — 세트굽기부터.'); process.exit(1); }

  let 총 = 0;
  const 절들 = 세트들.map((세트, i) => {
    const 파일들 = fs.readdirSync(path.join(방, 세트)).filter((f) => f.endsWith('.png')).sort();
    총 += 파일들.length;
    process.stdout.write(`  ${세트} ${파일들.length}장 인라인… `);
    const 칸 = 파일들.map((f) => {
      const uri = 인라인(path.join(방, 세트, f), 미리폭);
      return `<figure class="유리 잔잔 요소칸"><img src="${uri}" alt="${esc(f)}">
        <figcaption>${esc(f.replace(/\.png$/, ''))}</figcaption></figure>`;
    }).join('');
    console.log('됐다');
    const 왜 = (설명[세트] || []).map((p) => `<p class="듦">${p}</p>`).join('');
    return `<h2 id="s${i + 1}" class="듦"><span class="번호">${String(i + 1).padStart(2, '0')}</span>
      <span>${esc(세트)} — ${파일들.length}장</span></h2>${왜}
      <div class="요소줄">${칸}</div>`;
  });

  const 첫 = (() => {
    const s = 세트들[0];
    const f = fs.readdirSync(path.join(방, s)).find((x) => x.endsWith('.png'));
    return 인라인(path.join(방, s, f), 320);
  })();

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>요소 공방 — 세트 굽기</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/요소시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 렌더 = ${path.relative(루트, 방).replace(/\\/g, '/')} (Blender Cycles · tools/세트굽기.js) · 지면 = tools/펠트문서.js -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.요소칸{flex:0 1 168px;padding:0;overflow:hidden;text-align:center;}
.요소칸 img{display:block;width:100%;height:auto;}
.요소칸 figcaption{padding:8px 8px 11px;font-size:.78rem;}
.요소줄{display:flex;flex-wrap:wrap;gap:12px;margin:1.15em 0;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">요소 공방</p>
  <ol>${세트들.map((s, i) => `
    <li><a href="#s${i + 1}"><span class="n">${String(i + 1).padStart(2, '0')}</span> ${esc(s)}</a></li>`).join('')}
  </ol>
</nav>

<div class="글">

<header class="표지">
  <img src="${첫}" alt="" style="width:150px;border-radius:18px" aria-hidden="true">
  <div>
    <p class="꼭지">SYNK Loom · Blender Cycles 실굽기</p>
    <h1>요소 공방</h1>
    <p class="한줄">유호님 08-22 「전부 해줘」 — 앱·교재·PDF 에 설 요소를 <b>세트 단위로</b> 구웠다.
    전부 같은 통로(<code>요소굽기.py</code>) · 같은 재료(펠트·실) · 같은 조명이라 <b>한 세계의 물건</b>이다.</p>
    <p class="메타">자동 생성 · <code>node tools/세트굽기.js --세트 전부</code> → <code>node tools/요소시안.js</code> ·
    렌더 ${총}장 · 지면 = Loom L4 · 색 = 디자인_토큰.json</p>
  </div>
</header>

<div class="유리 알림 듦"><b>도안은 함수가 아니라 «점 목록»이다</b> — 기호 여덟(체크·별·하트·집·책·차트·사람·말풍선)은
같은 함수 하나가 낸다. 새 기호를 더하는 값은 <b>점 목록 한 줄</b>이고, 리메시·실땀·조명 규율은 판마다 안 갈린다.
요소가 늘 때마다 굽기 함수가 늘면 그 규율이 먼저 갈린다 — 그게 진짜 비용이다.</div>

${절들.join('\n')}

<h2 id="끝" class="듦"><span class="번호">${String(세트들.length + 1).padStart(2, '0')}</span><span>정할 것</span></h2>
<ul class="듦">
<li><b>더 구울 것 — 지금은 비어 있다. 그리고 이번엔 그 문장을 기계가 보증한다.</b>
08-22 에 「후보 비었다」고 적어 둔 것이 <b>틀린 문장</b>이었다 — 사전 자기 표의 45줄 중 12줄에 실물이 없었다.
08-23 에 그 12줄(→10판)과 표에 «줄조차 없던» 넷(녹음·오류/오프라인·드롭다운·아코디언)을 세워 <b>열넷 18장</b>을 구웠고,
판정을 「✅ 손 표기」에서 <b>「등록부에 함수가 있는가」</b>로 옮겼다: <code>node tools/부품대조.js</code>.</li>
<li><b>08-23 에 값을 치르고 얻은 규율 하나</b> — <b>무채는 보풀을 입으면 «밝기와 무관하게» 흰 솜이 된다.</b>
Ash Wool 이 씻겨 Deep Wool 로 내렸는데 그것도 똑같이 씻겼다(네 판이 같은 병 · 단추위계에서는 보조가 코랄보다 밝아 <b>위계가 뒤집혔다</b>).
⇒ <b>무채 면은 «결», 유채만 «털».</b> 탭 전환이 이미 적어 둔 「지금 탭만 털을 입는다」와 같은 명제였다.</li>
<li><b>배선은 끝났다</b> — 이 렌더를 지면·앱에 «부품»으로 꽂는 통로가 섰다:
<code>tools/요소부품굽기.js</code>(알파 두 층) → <code>tools/룸자산화.py</code> → <code>tools/lib/loom.js</code> 구움표.
지면에 자리를 얻은 것은 체크·별·하트·도장·말풍선 다섯이고, 탭 얼굴 넷은 자산까지다(앱은 형제 저장소라 여기 CI 밖이다).</li>
<li><b>유호님 판정 둘</b> — ①<b>도장의 천 결</b>이 이 노출에서 거의 안 보인다(「손으로 판 인장」으로는 읽혀서 거기서 멈췄다).
②<b>김밥 단면</b>이 음식 다섯 중 가장 평평하다. 더 갈지는 보시고 정하실 몫이다.</li>
<li><b>해상도는 1000px 로 마쳤다</b> — 털 선명도의 진짜 손잡이는 해상도지만(900→1800px = +83%),
먼저 구운 67장이 1000px 이라 섞으면 세트가 갈린다. «털이 뭉갠다» 하시면 전량 <code>--너비 1800</code> 로 다시 굽는다(≈4시간).</li>
</ul>

<footer class="메타">렌더 = <code>${esc(path.relative(루트, 방).replace(/\\/g, '/'))}/</code> ·
굽기 = <code>node tools/세트굽기.js</code>(Blender 5.2 · Cycles) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4) · 색 = <code>docs/디자인_토큰.json</code>.</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `요소-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ 요소 시안  ${path.relative(루트, 출력)}  ` +
    `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 세트 ${세트들.length} · 렌더 ${총}장)`);
}

if (require.main === module) main();
