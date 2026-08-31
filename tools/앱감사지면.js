#!/usr/bin/env node
/**
 * 앱 감사 지면 — 08-31 전면 감사(디자인 디테일 + 시스템)를 «한 지면»으로 세운다.
 *   (유호 지시 08-31 「앱의 모든 기능들을 훑어보면서 … 디테일의 끝판왕으로 체크리스트 만들어줘 ·
 *    시스템을 더 효율적으로 발전시킬 수 있는 게 있는지도 확인해줘」)
 *
 * ■ 자료의 정본 = docs/_ops/앱감사_0831.json 하나. 이 파일은 «그리기만» 한다.
 *   감사의 자(무엇으로 쟀나)는 JSON 메타에 있다 — 지면 머리에 그대로 싣는다.
 *   항목 문안은 감사 요원 산출을 그대로 싣는다(고치면 근거와 갈린다) — 요약·큐레이션만 이 지면 몫.
 *
 * 사용:  node tools/앱감사지면.js   →  docs/앱_디테일_체크리스트.html
 */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 자료길 = path.join(루트, 'docs', '_ops', '앱감사_0831.json');
const 출력 = path.join(루트, 'docs', '앱_디테일_체크리스트.html');
const 자료 = JSON.parse(fs.readFileSync(자료길, 'utf8'));

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 절 배치 — 학생이 겪는 순서로 왼다(감사 갈래 순서가 아니라). */
const 절들 = [
  ['첫 만남', ['D1'], '학생이 앱을 처음 여는 10분 — 인증·첫등록·빈 상태'],
  ['코어 루프', ['D2'], '매일의 말하기 세 호흡 — 듣기·따라·답하기·녹음·제출'],
  ['성장과 추억', ['D3'], '답장·회고·나침반·어제의 나 — 잘한 순간이 «남는» 자리'],
  ['마스코트 생명력', ['D4'], '몽글·까몽·NPC — 살아있는 무언의 선생님'],
  ['모션·소리·감각', ['D5'], '전환·손맛·효과음·햅틱 — 펠트 세계관과 한 몸인 움직임'],
  ['가시성·문자', ['D6', 'G3'], '타이포·대비·키릴/한글·다크·저사양 폰·접근성'],
  ['우아한 실패', ['D7'], '오프라인·오류·빈손 — 무너질 때 어떻게 무너지나'],
  ['운영자의 눈', ['D8'], '강사·검수·감수 화면 — 매일 수십 번 여는 손의 마찰'],
  ['빠졌던 자리 보충', ['G1'], '원장초기화 화면 · API층 10벌 (완결 비평이 잡은 구멍)'],
  ['구조 건전성', ['S1'], '신앱 아키텍처 — 결합도·중복 정의·상태 관리'],
  ['안정성 축', ['G2'], '백버튼·오류 경계·가상화·크래시 관측·게임 큐 (보충)'],
  ['파이프라인', ['S2'], '생성→검문→평가→채점→교정→회고 사슬이 닫혀 있나'],
  ['최신 기능 수용', ['S3'], '2026-08 기준 — Expo·RN·Supabase·Skia 신기능 중 «우리 것»'],
  ['엔진·지면(이 저장소)', ['S4'], 'Apps Script 엔진 6종과 과도기 이중 유지 자리'],
];

const 항목들 = 자료.생존;
const 색인 = {};
for (const it of 항목들) (색인[it.id.split('-')[0]] ||= []).push(it);
const 우선 = new Set(자료.메타.우선);
const 결함 = new Set(자료.메타.결함);

const 배지 = (t, 결) => `<span class="배지${결 ? ' 배지결함' : ''}">${esc(t)}</span>`;
/* 진행 배지 — 끝난 결(구현·수리·반영·해소·걷음·이미·기각·닫힘·측정·선언·채택·보류 확정)은 초록 테,
 * 나머지(유호 픽 대기·실기기 게이트·피어 레인)는 흐린 테. 기각도 닫힘이다 — 판정이 내려앉았다. */
const 끝난상태 = (s) => /^(구현됨|수리됨|반영됨|해소됨|걷음|이미 반영|기각|닫힘|측정 완료|선언 완료|A안 채택|보류 확정)/.test(s);
const 상태배지 = (s) => (s ? `<span class="배지 ${끝난상태(s) ? '배지끝' : '배지대기'}">${끝난상태(s) ? '✅ ' : ''}${esc(s)}</span>` : '');
function 항목카드(it) {
  const 결 = 결함.has(it.id);
  const 별 = 우선.has(it.id);
  const 확정메모 = 자료.메타.확정메모[it.id];
  return `<div class="유리 잔잔 항목${결 ? ' 항목결함' : ''}" id="${esc(it.id)}">
  <p class="항목머리">${별 ? '⭐ ' : ''}${배지(it.id, 결)}${결 ? 배지('결함', true) : ''}${it.loom_use && it.loom_use !== '해당없음' ? 배지('Loom') : ''}${상태배지(it.상태)} <b>${esc(it.spot)}</b></p>
  <p class="항목제안">${esc(it.proposal)}</p>
  <p class="항목장면">👁 ${esc(it.scene)}</p>
  <p class="항목왜">${esc(it.why_luxury)}</p>
  ${it.loom_use && it.loom_use !== '해당없음' ? `<p class="항목룸">🧶 ${esc(it.loom_use)}</p>` : ''}
  <p class="항목메타">비용 ${esc(it.cost || '안 적음')}${확정메모 ? ` · <b>${esc(확정메모)}</b>` : ''}${[].concat(it.검증 || []).filter((v) => v && v.fix).map((v) => ` · 렌즈: ${esc(v.fix)}`).join('')}</p>
</div>`;
}

function 절그리기([이름, 갈래들, 뜻], 번호) {
  const 것들 = 갈래들.flatMap((g) => 색인[g] || []);
  if (!것들.length) return '';
  const 좋은것 = 것들.filter((it) => /이미 좋|건드리지 않|손대지 않/.test(it.spot + it.proposal.slice(0, 30)));
  const 일감 = 것들.filter((it) => !좋은것.includes(it));
  return `<h2 id="s${번호}" class="듦"><span class="번호">${String(번호).padStart(2, '0')}</span><span>${esc(이름)} <small class="절수">${일감.length}</small></span></h2>
<p class="듦 절뜻">${esc(뜻)}</p>
${일감.map(항목카드).join('\n')}
${좋은것.length ? `<div class="유리 알림 듦 좋은것"><b>이미 좋아서 손대지 않는 것</b> — ${좋은것.map((it) => esc(it.proposal.replace(/^손대지 않는다[.: —]*|^바꾸지 않는다[.: —]*|^그대로 둔다[.: —]*/, '').trim() || it.spot)).join(' · ')}</div>` : ''}`;
}

function main() {
  const 별들 = 항목들.filter((it) => 우선.has(it.id));
  const 결함들 = 항목들.filter((it) => 결함.has(it.id));
  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>앱 디테일 감사 — 명품 체크리스트</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/앱감사지면.js — 손 편집 금지(재생성이 덮는다) · 자료 정본 = docs/_ops/앱감사_0831.json -->
<!--펠트스킨-->
<style>
.항목{padding:14px 16px;margin:10px 0;}
.항목결함{border-left:3px solid rgba(249,104,89,.75);}
.항목머리{margin:0 0 6px;font-size:.9rem;}
.항목제안{margin:0 0 7px;font-size:.86rem;line-height:1.62;}
.항목장면{margin:0 0 6px;font-size:.8rem;line-height:1.55;opacity:.82;}
.항목왜{margin:0 0 6px;font-size:.8rem;line-height:1.55;}
.항목룸{margin:0 0 6px;font-size:.8rem;line-height:1.55;}
.항목메타{margin:0;font-size:.74rem;opacity:.62;}
.배지{display:inline-block;padding:1px 8px;border-radius:99px;border:1px solid rgba(251,247,240,.28);font-size:.72rem;margin-right:6px;vertical-align:1px;}
.배지결함{border-color:rgba(249,104,89,.6);}
.배지끝{border-color:rgba(134,197,151,.55);opacity:.85;}
.배지대기{border-color:rgba(251,247,240,.18);opacity:.6;}
.절수{opacity:.5;font-size:.72em;}
.절뜻{opacity:.75;font-size:.86rem;margin-top:-.4em;}
.좋은것{font-size:.8rem;line-height:1.6;}
details.탈락절 summary{cursor:pointer;font-size:.9rem;padding:8px 0;}
.탈락항목{font-size:.78rem;line-height:1.55;margin:8px 0;opacity:.72;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">앱 감사</p>
  <ol>
    <li><a href="#s0"><span class="n">00</span> 먼저 보실 것</a></li>
    ${절들.map((절, i) => `<li><a href="#s${i + 1}"><span class="n">${String(i + 1).padStart(2, '0')}</span> ${esc(절[0])}</a></li>`).join('\n    ')}
    <li><a href="#s90"><span class="n">${절들.length + 1}</span> 탈락 · 안 잰 것</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  <div>
    <p class="꼭지">SYNK 신앱 전면 감사 · 2026-08-31</p>
    <h1>디테일의 끝판왕 — 앱 감사 체크리스트</h1>
    <p class="한줄">${esc(자료.메타.한줄)}</p>
    <p class="메타">${esc(자료.메타.자)}</p>
  </div>
</header>

<div class="유리 알림 듦"><b>합계 = 갈래 + 갈래.</b> ${esc(자료.메타.합계줄)}
<br>⭐ = 먼저 보실 ${별들.length} · 🔴 결함 = 지금 고칠 ${결함들.length} · 나머지는 절마다 값진 순.
<br><b>진행(08-31 밤 물결 1·2):</b> ${(() => { const 끝 = 항목들.filter((it) => 끝난상태(it.상태 || '')).length; return `${끝}/${항목들.length} 닫힘 — 남은 것 = 유호님 판정 ${항목들.filter((it) => /^유호/.test(it.상태 || '')).length} · 게이트 대기(실기기·EAS·배포창) ${항목들.filter((it) => /^게이트|판올림|^걸림/.test(it.상태 || '')).length} · 그 외 ${항목들.length - 끝 - 항목들.filter((it) => /^유호/.test(it.상태 || '')).length - 항목들.filter((it) => /^게이트|판올림|^걸림/.test(it.상태 || '')).length}`; })()} · 새 문구 초안 43벌 = <b>docs/감사_문구초안_검토.md</b>
<br><small>모든 항목이 <b>실물 파일·행 번호</b>를 쥐고 있고, 세 렌즈(철학 정합 · 확정 충돌 · 실현성)의 적대 검증에서 살아남은 것만 실었다 — 두 렌즈 이상이 죽인 ${자료.탈락.length}개는 맨 끝 접힌 절에 사유와 함께 있다.</small></div>

<h2 id="s0" class="듦"><span class="번호">00</span><span>먼저 보실 것 — 결함 ${결함들.length} + 별 ${별들.length}</span></h2>
<p class="듦 절뜻">🔴 결함은 「고치면 좋은 것」이 아니라 「지금 틀려 있는 것」이다 — 행 번호까지 확정했다. ⭐ 별은 값 대비 비용이 가장 좋은 디테일이다. 전부 아래 절들에도 제자리에 서 있다 — 여기는 그 «차례»다.</p>
${결함들.map((it) => `<p class="항목장면">🔴 <a href="#${esc(it.id)}"><b>${esc(it.id)}</b></a> — ${esc(it.spot)}</p>`).join('\n')}
${별들.filter((it) => !결함.has(it.id)).map((it) => `<p class="항목장면">⭐ <a href="#${esc(it.id)}"><b>${esc(it.id)}</b></a> — ${esc(it.spot)}</p>`).join('\n')}

${절들.map((절, i) => 절그리기(절, i + 1)).join('\n\n')}

<h2 id="s90" class="듦"><span class="번호">${String(절들.length + 1).padStart(2, '0')}</span><span>탈락 ${자료.탈락.length} · 안 잰 것</span></h2>
<details class="탈락절 듦"><summary><b>탈락 ${자료.탈락.length}개</b> — 두 렌즈 이상이 죽였다(사유와 함께 · 다시 살릴 때 여기서 꺼낸다)</summary>
${자료.탈락.map((t) => `<p class="탈락항목"><b>${esc(t.id)}</b> [${esc(t.spot)}] ${esc(t.proposal)}<br>↳ 죽인 사유: ${esc(Array.isArray(t.reason) ? t.reason.join(' / ') : t.reason)}</p>`).join('\n')}
</details>
<div class="유리 알림 듦"><b>이 감사가 «안 잰» 것</b> — 「없다」가 아니라 「안 재봤다」다.<br>${esc(자료.메타.안잰것)}</div>

<footer class="메타">자동 생성 · <code>node tools/앱감사지면.js</code> · 자료 정본 = <code>docs/_ops/앱감사_0831.json</code> ·
감사 = 읽기 5 + 사냥 12 + 보충 3 + 검증 4 렌즈(에이전트 ${esc(String(자료.메타.에이전트수))}) · 지면 = <code>tools/펠트문서.js</code>(Loom L4)</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `앱감사-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }
  const 크기 = Math.round(fs.statSync(출력).size / 1024);
  /* 별과 결함은 겹치지 않는 두 집합이다(큐레이션 규약) — 합계 = 결함 + 별 + 나머지. */
  console.log(`■ 앱 감사 지면  ${path.relative(루트, 출력)}  (${크기}KB · 항목 ${항목들.length} = 결함 ${결함들.length} + 별 ${별들.length} + 나머지 ${항목들.length - 결함들.length - 별들.length})`);
}

if (require.main === module) main();
