#!/usr/bin/env node
/**
 * 화면시안 — 앱 화면 **열넷**을 한 지면에 세워 판정 재료로 낸다.
 *
 * 왜 생겼나 (유호 08-23 · 화면 열넷이 하루에 다 선 뒤):
 *   화면이 공방마다 흩어져 있어(조합·성장·오늘·소식·학부모·강사·원장 일곱 폴더) 유호님이
 *   «네 역할이 한 세계로 읽히는가»를 볼 자리가 없었다. 나란히 판을 넷 만들었지만 그것도
 *   흩어진 PNG 다. **판정은 한 곳에서 해야 판정이다.**
 *
 * 🔑 요소시안·오브시안과 **같은 통로**다 — 원고(HTML)만 짓고 `<!--펠트스킨-->` 자리에
 *   `tools/펠트문서.js`(Loom L4)가 지면을 주입한다. 그림은 ffmpeg webp data URI 로 인라인해
 *   **자립형**으로 만든다(외부 그림 0 을 끝에서 기계로 검사한다).
 *
 * 🔑 **화면 순서는 «역할이 하루를 도는 순서»다** — 폴더 이름 정렬은 뜻이 없다.
 *   그래서 표를 이 파일이 든다(요소시안이 세트굽기의 차례를 그대로 쓰는 것과 같은 규율).
 *
 * 사용:  node tools/화면시안.js [--폭 340]
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 출력 = path.join(루트, 'docs', '화면_시안.html');
const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 1) {
    if (!v[i].startsWith('--')) continue;
    const k = v[i].slice(2);
    a[k] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[i += 1] : '1';
  }
  return a;
})();
const 폭 = parseInt(인자['폭'] || '340', 10);

const 캐 = (...부분) => path.join(루트, 'docs', '캐릭터', ...부분);

/* 역할 표 — 「잣대」는 그 역할의 탭을 가른 축이다. 이 한 줄이 각 절의 판정 기준이 된다. */
const 역할들 = [
  {
    이름: '학생', 잣대: '시제',
    풀이: '오늘 = «오늘 무엇을 하나»(현재의 할 일) · 나의 성장 = «어디까지 왔나»(과거의 누적) · ' +
          '소식 = «밖에서 나에게 온 것»(도착물). 셋이 겹치면 탭이 셋일 까닭이 없어진다. ' +
          '퀴즈는 탭이 아니라 «오늘의 말하기» 안에서 열리는 판이다.',
    화면들: [
      { 이름: '퀴즈(조합판)', 길: 캐('조합공방_0821', '조합판_v1.png'),
        뜻: '탭이 아니라 <b>말하기 안에서 열리는 판</b>. 부품 문법이 여기서 처음 섰다 — 카드·알약·실땀.' },
      { 이름: '오늘', 길: 캐('오늘공방_0822', '오늘판_v1.png'),
        뜻: '도전 하나 + 할 일 넷(숙제·<b>다시쓰기</b>·대화·강의). 다시쓰기는 소식 탭의 첨삭이 도착하면 뜬다 — <b>탭이 서로를 부른다</b>.' },
      { 이름: '나의 성장', 길: 캐('성장공방_0821', '성장판_v1.png'),
        뜻: '몽골 → 한국 여섯 칸. 지나온 칸은 꿰맨 단추, <b>지금 칸 하나만 코랄</b>(화면의 유일한 신호).' },
      { 이름: '소식', 길: 캐('소식공방_0823', '소식판_v1.png'),
        뜻: '가장 값진 도착물(첨삭)이 카드에, 나머지는 목록으로. <b>날짜 열</b>이 이 탭을 오늘 탭과 가른다.' },
    ],
  },
  {
    이름: '학부모', 잣대: '같은 시제 — 역할만 바뀐다',
    풀이: '오늘 ↔ <b>우리 아이</b> · 나의 성장 ↔ 리포트 · 소식 ↔ 소식. ' +
          '역할이 달라도 시제가 같으면 <b>부품을 하나도 새로 안 만들어도 된다</b> — ' +
          '학부모 앱은 «다른 앱»이 아니라 같은 학원의 두 번째 창이다.',
    화면들: [
      { 이름: '우리 아이', 길: 캐('학부모공방_0823', '우리아이판_v1.png'),
        뜻: '출석 4주 격자 — <b>온 날 vs 말한 날</b>. 전수분석이 「가장 강한 신뢰 증거」로 지목한 자리이고, 그 <b>격차</b>가 곧 무발화 신호다.' },
      { 이름: '리포트', 길: 캐('학부모공방_0823', '리포트판_v1.png'),
        뜻: 'talk 이 하는 일은 <b>열람뿐</b>이다(생성은 Slides). 오른쪽 열이 «날짜»가 아니라 «성취»라 이 탭이 «쌓인 것»이 된다.' },
      { 이름: '소식', 길: 캐('학부모공방_0823', '부모소식판_v1.png'),
        뜻: '공지 셋(단추 = 읽었나) 아래 문의하기(<b>단추 없음</b> = 눌러서 연다). 그 «없음»이 두 줄의 성격을 가른다.' },
    ],
  },
  {
    이름: '강사', 잣대: '행동 — 유일한 «사람 라벨 생산자»',
    풀이: '학생·학부모가 «보는» 쪽이라면 강사는 <b>«만드는» 쪽</b>이다. 그래서 탭을 가른 축도 ' +
          '시제가 아니라 행동이다: 지금 교실에서 · 한 사람을 본다 · <b>AI 를 가르친다</b> · 남긴다. ' +
          '<b>강사만 탭이 넷</b>이다.',
    화면들: [
      { 이름: '오늘 수업', 길: 캐('강사공방_0823', '오늘수업판_v1.png'),
        뜻: '출석 격자는 학부모 달력과 <b>같은 부품</b>이다 — 거기서는 «한 아이의 4주», 여기서는 «한 반의 오늘». 축만 바뀌었다.' },
      { 이름: '학생', 길: 캐('강사공방_0823', '강사학생판_v1.png'),
        뜻: '칭찬 4태그 — <b>개수 4는 불변</b>이다(왕관·크루의 눈의 재료라 하나만 늘어도 두 곳이 흔들린다).' },
      { 이름: '검수 🔴', 길: 캐('강사공방_0823', '검수판_v1.png'),
        뜻: '<b>이 앱에서 가장 중요한 화면.</b> Glide 가 폐기되면 강사 판정의 유일한 입구가 죽는다. 판정 셋은 퀴즈의 보기 알약과 같은 부품이다.' },
      { 이름: '기록', 길: 캐('강사공방_0823', '기록판_v1.png'),
        뜻: '차시 마감폼이 <b>「우리만 가진 것」</b>이다 — 교실에서 실제로 통한 것(진도·문법태그·도달도·미발화자)을 그대로 담는다.' },
    ],
  },
  {
    이름: '원장', 잣대: '「팔 화면인가」',
    풀이: '원장 탭은 운영 편의가 아니라 <b>출시 제품의 사전 검증 자리</b>다(유호 확정 §12-2 — ' +
          '1년 뒤 학원용 앱으로 팔 그 화면). 데이터·운영은 시트에 살고 이 탭들은 그 위에 얹는 열람·테스트 뷰다.',
    화면들: [
      { 이름: '오늘', 길: 캐('원장공방_0823', '원장오늘판_v1.png'),
        뜻: '임계 셋의 <b>꿰맨 단추 = «조용함»</b> — 「무소식 = 하트비트」를 부품이 그대로 그린다. 빈 단추 하나가 곧 오늘의 일거리다.' },
      { 이름: '학생', 길: 캐('원장공방_0823', '원장학생판_v1.png'),
        뜻: '<b>이 화면이 파는 화면이다.</b> 「우리 시스템은 떠날 학생을 미리 안다」를 한 장으로 말하는 자리라 콕핏 넷 중 레이더 하나만 남겼다.' },
      { 이름: '경영', 길: 캐('원장공방_0823', '경영판_v1.png'),
        뜻: '숫자가 주인공인 유일한 화면. 성장 탭의 「12 / 7」 기록 칸을 2×2 로 늘렸다 — <b>여기서도 새 부품은 0개</b>다.' },
    ],
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 렌더 한 장 → webp data URI. 실패는 던진다(빈 값으로 물러서면 그림 없는 칸이 조용히 나간다). */
function 인라인(파일, w) {
  const 임시 = path.join(os.tmpdir(), `화면시안-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${w}:-1`, '-quality', '86', 임시],
      { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

function main() {
  const 없는 = [];
  for (const r of 역할들) for (const s of r.화면들) if (!fs.existsSync(s.길)) 없는.push(s.길);
  if (없는.length) {
    console.error('🔴 없는 렌더 ' + 없는.length + '장 — 그 공방의 굽기·덧씌움을 먼저 돌린다:');
    for (const f of 없는) console.error('   ' + path.relative(루트, f));
    process.exit(1);
  }

  let 장수 = 0;
  for (const r of 역할들) {
    console.log(`  ${r.이름} ${r.화면들.length}장 인라인…`);
    for (const s of r.화면들) { s.uri = 인라인(s.길, 폭); 장수 += 1; }
  }

  const 화면칸 = (s) => `
    <figure class="유리 잔잔 화면칸">
      <img src="${s.uri}" alt="${esc(s.이름)} 화면">
      <figcaption><b>${esc(s.이름)}</b>${s.뜻}</figcaption>
    </figure>`;

  const 절 = (r, i) => `
<h2 id="s${i + 1}">${esc(r.이름)} — 탭 ${r.화면들.length}</h2>
<p class="한줄">탭을 가른 잣대 = <b>${r.잣대}</b>. ${r.풀이}</p>
<div class="화면줄">${r.화면들.map(화면칸).join('')}</div>`;

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>화면 공방 — 네 역할 열넷</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/화면시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 렌더 = docs/캐릭터/*공방*/ (Blender Cycles + PIL 본문층) · 지면 = tools/펠트문서.js -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.화면칸{flex:0 1 ${폭}px;max-width:${폭}px;padding:0;overflow:hidden;}
.화면칸 img{display:block;width:100%;height:auto;}
.화면칸 figcaption{padding:11px 13px 14px;font-size:.79rem;line-height:1.55;}
.화면칸 b{display:block;font-size:.95rem;margin-bottom:.28em;}
.화면줄{display:flex;flex-wrap:wrap;gap:16px;margin:1.3em 0 2.1em;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">화면 공방</p>
  <ol>
${역할들.map((r, i) => `    <li><a href="#s${i + 1}"><span class="n">0${i + 1}</span> ${esc(r.이름)}</a></li>`).join('\n')}
    <li><a href="#s9"><span class="n">05</span> 관통하는 규율</a></li>
    <li><a href="#s10"><span class="n">06</span> 정할 것</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  <div>
    <p class="꼭지">SYNK Loom · Blender Cycles 실굽기 + PIL 본문층</p>
    <h1>화면 공방 — 네 역할 열넷</h1>
    <p class="한줄">학생 넷 · 학부모 셋 · 강사 넷 · 원장 셋. <b>네 역할이 각자 화면으로 하루를 돈다.</b>
    CSS 목업이 아니라 전부 실물로 구운 판이고, 글자는 «칸 JSON»을 읽어 앉는다 — <b>그릇을 옮기면 글이 따라온다</b>.</p>
  <p class="메타">자동 생성 · <code>node tools/화면시안.js</code> · 렌더 ${장수}장 ·
  지면 = Loom L4 · 대비 = 화면마다 전 블록 AAA 실측</p>
  </div>
</header>

${역할들.map(절).join('\n')}

<h2 id="s9">관통하는 규율 — 열넷 내리 <b>새 부품이 0개</b>다</h2>
<p class="한줄">늘어난 것은 «자리»와 «본문»뿐이다. 그래서 학생이(그리고 학부모·강사·원장이)
화면마다 규칙을 새로 익히지 않는다.</p>
<ul class="듦">
<li><b>단추토글 하나가 「상태」를 다 말한다</b> — 상태가 재질 차이가 아니라 <b>바느질 유무</b>로 읽힌다.
성장 게이지 칸 · 오늘 할 일 · 소식 읽음 · 학부모 출석 격자 · 강사 출석 · 원장 임계가 전부 이것 하나다.</li>
<li><b>단추가 «없는» 줄이 뜻을 하나 더 낸다</b> — 단추 있는 줄 = 상태가 있다(했나·읽었나) ·
단추 없는 줄 = 눌러서 연다(폼·상세). 부품을 더한 게 아니라 <b>있는 부품의 «없음»</b>으로 문법이 늘었다.</li>
<li><b>코랄은 화면에 하나뿐</b>이다(명품 4계 ②). 카드 안 실 한 도막이거나 게이지의 «지금 칸»이다.
검수 화면만 코랄이 없다 — 판정 셋이 이미 초점이라 신호를 또 주면 눈이 갈린다.</li>
<li><b>가장 큰 것은 늘 같은 자리</b>다(1.21 × 0.09 × 0.70 · z 1.32). 탭을 옮겨도 그 자리가
안 흔들려야 «화면이 바뀐 것»이지 «앱이 바뀐 것»이 아니다.</li>
<li><b>탭바는 세 칸·네 칸 두 벌뿐</b>이다. 강사만 넷이고 나머지는 셋 — 치수·자리는 전부 같다.</li>
</ul>

<h2 id="s10">정할 것 — 유호님 판정 자리</h2>
<ul class="듦">
<li><b>문안은 전부 표본이다.</b> 실데이터 배선 전이고 브랜드 보이스 검수(<code>synk-brand</code>)와
몽골어 검수가 아직이다 — 키릴 줄은 <b>검수 전 표본</b>.</li>
<li><b>칭찬 4태그의 어휘</b>(강사·학생 탭) — 개수 4는 불변이되 낱말은 유호님이 정하실 자리다.</li>
<li><b>원장 경영의 숫자 넷</b> — 「팔 때 보여줄 숫자」가 기준이다(지금은 재적·활성률·신규·이탈).</li>
<li><b>결석한 날과 수업 없는 날이 같은 모양</b>이다(학부모 달력 · 둘 다 빈 칸). 달력의 목적이
«온 날 vs 말한 날의 격차»라 지금은 구별을 안 뒀다 — 색을 더하면 4계 ②가 깨진다.</li>
<li><b>본문 층이 1080px 절대값에 묶여 있다</b> — 칸 자리는 JSON 이 주지만 «칸 안 여백»(124px 등)은
아직 픽셀이다. Expo 실장 때 비율로 바꾼다(트랙 §6).</li>
</ul>

<footer class="메타">렌더 = <code>docs/캐릭터/{조합,성장,오늘,소식,학부모,강사,원장}공방*/</code> ·
그릇 = <code>tools/요소굽기.py</code>(Blender 5.2 · Cycles · GPU) ·
본문 = 각 공방의 <code>*덧씌움.py</code>(PIL · 칸 JSON) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `screen-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ 화면 시안  ${path.relative(루트, 출력)}  (${Math.round(Buffer.byteLength(html) / 1024)}KB · 역할 ${역할들.length} · 화면 ${장수}장)`);
  const 밖 = (html.match(/src\s*=\s*"(?!data:)/g) || []).length;
  if (밖) { console.error(`🔴 외부 그림 참조 ${밖}건 — 자립형이 아니다`); process.exit(1); }
  console.log('   ✅ 자립형 — 외부 그림 0');
}

if (require.main === module) main();
