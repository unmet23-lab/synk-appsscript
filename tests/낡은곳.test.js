'use strict';
// 낡은 곳(tools/낡은곳.js) — 새 결정 행이 옛 모습으로 남긴 줄 · 물러난 낱말 · 사라진 길은 알림만, 설계 문서 계획 표의 머리 줄은 막는지.
// 11-15 업무 백업 세션이 설계 문서의 11-12 일정표 · 「여쭐 것」 표를 읽고 끝난 일을 다시 여쭌 실수와, Fable 5.2 설계 검토(D5 닿은 절만 · D10 문턱 ·
// D11 표를 공개 관문과 떼기 · D13 한 번만 계산)를 시험으로 묶었다. 끝에 바로올리기를 실제로 돌려 알림 · 막음 · 건너뜀을 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const n = require('../tools/낡은곳.js');
const { 도구, 새판 } = require('./lib/바로올리기판.js');

const 행 = (날, 결정) => `| ${날} | 확정 | ${결정} | 근거 |`;
const 시안행 = 행('2026-11-13', '[1인 기업 업무 백업 앱 · 0.7.0 화면 시안 고르기 · 유호님 결정] 1단계 화면은 시안 A 「확인서」로 간다. 정본은 [README](../../experiences/solo-backup-rust/ui-mockups/README.md)');
const 비투행 = 행('2026-11-13', '[1인 기업 업무 백업 앱 · 손님용 B2 계정 준비 · Claude 판단(기술)] 손님 계정에 비공개 버킷 하나를 만들었다');

test('행을 풀어 주제 낱말과 문턱을 정한다 — 넷 넘으면 절반 넘게, 셋 · 둘이면 모두(D10)', () => {
  const r = n.행풀기(시안행);
  assert.deepEqual(r.낱말, ['0.7.0', '화면', '시안', '고르기']);
  assert.equal(r.필요, 3);
  assert.deepEqual(r.곳들, ['experiences/solo-backup-rust']);
  assert.deepEqual(r.새이름, ['확인서']);
  const b = n.행풀기(비투행);
  assert.deepEqual(b.낱말, ['손님용', 'B2', '계정']);
  assert.equal(b.필요, 3);
  assert.equal(n.행풀기(행('2026-11-13', '태그 없는 행 — 하지 않는다')), null);
  assert.equal(n.행풀기(행('2026-11-13', '[크기 · Claude 판단]')), null, '주제 낱말이 둘 아래면 하지 않는다');
  assert.deepEqual(n.낱말로('솔리오와의 관계와 로드맵'), ['솔리오', '관계', '로드맵'], '토씨를 뗀다');
});

/** 옛 판 b997a64e6의 STAGE1_DESIGN.md 세 줄(419 · 594 · 614)과 걸리면 안 되는 줄을 줄인 꼴. */
const 설계줄 = [
  { 경로: 'experiences/solo-backup-rust/STAGE1_DESIGN.md', 줄: 20, 글: '끝난 기준은 관문 1이다. 유호님 손은 화면 시안 고르기 한 번과 11장의 일뿐이다.' },
  { 경로: 'experiences/solo-backup-rust/STAGE1_DESIGN.md', 줄: 419, 글: '- 뼈대부터 다시 짠다 → 시안 둘(정적 HTML) → 유호님이 고른다 → Claude가 Tauri 화면으로 옮긴다. 5주차에 시안 · 고르기 · 구현을 넣으면 물러설 자리가 없다.' },
  { 경로: 'experiences/solo-backup-rust/STAGE1_DESIGN.md', 줄: 594, 글: '| 11-16 ~ 22 | 엔진 갈래 · 설치기. 화면 시안 둘 → 유호님 고르기. |' },
  { 경로: 'experiences/solo-backup-rust/STAGE1_DESIGN.md', 줄: 614, 글: '| 2주차 | 손님용 B2 계정을 새로 만든다(결제 수단 없이 무료 한도로 시작). 가입 뒤 Claude가 버킷을 만든다 | 가입 |' },
  { 경로: 'experiences/solo-backup-rust/STAGE1_DESIGN.md', 줄: 597, 글: '| 12-07 ~ 13 | 고른 시안으로 화면 구현 |' },
  { 경로: 'experiences/solo-backup-rust/ui-mockups/README.md', 줄: 3, 글: '시안 A 「확인서」로 정했다. 화면 고르기는 끝났다' },
  { 경로: 'experiences/solo-backup-rust/STAGE1_DESIGN.md', 줄: 700, 글: '| 11-13 | 화면 시안 고르기 | 끝 |' },
  { 경로: 'experiences/solo-backup-rust/QA.md', 줄: 5, 글: '화면 시안 고르기 0.7.0 기록' },
  { 경로: 'docs/WORLD_학교프론트_설계_20261108.md', 줄: 9, 글: '화면 시안 둘을 유호님이 고르기' },
  { 경로: 'AGENTS.md', 줄: 4, 글: '화면 시안을 고르기 전에 본다' },
  { 경로: 'AGENTS.md', 줄: 5, 글: '0.7.0 화면 시안 고르기는 유호님 차례다' },
];
const 가짜찾기 = (낱말, 범위) => 설계줄.filter((x) => 범위.some((g) => x.경로 === g || x.경로.startsWith(`${g}/`)) && 낱말.some((w) => x.글.includes(w)));

test('(가) 새 결정 행 → 그 곳의 옛 모습 줄을 잡고, 새 이름 · 「끝」 · 기록류 · 다른 제품 · 더한 줄은 뺀다', () => {
  const r = n.결정낡은줄({ 새행들: [시안행, 비투행], 찾기: 가짜찾기, 바뀐곳들: ['experiences/solo-backup-rust'], 핵심: ['AGENTS.md'] });
  const 시안 = r.find((x) => /시안/.test(x.주제));
  assert.deepEqual(시안.모두.map((x) => `${x.경로.split('/').pop()}:${x.줄}`).sort(), ['AGENTS.md:5', 'STAGE1_DESIGN.md:20', 'STAGE1_DESIGN.md:419', 'STAGE1_DESIGN.md:594']);
  assert.deepEqual(시안.걸림.map((x) => `${x.경로.split('/').pop()}:${x.줄}`), ['AGENTS.md:5', 'STAGE1_DESIGN.md:20', 'STAGE1_DESIGN.md:419'], 'push 알림의 셋 — 늘 읽히는 문서의 옛 사실, 그다음 그 행의 곳 설계 문서');
  const 비투 = r.find((x) => /B2/.test(x.주제));
  assert.deepEqual(비투.모두.map((x) => x.줄), [614]);
  const 고친뒤 = n.결정낡은줄({ 새행들: [비투행], 찾기: 가짜찾기, 바뀐곳들: ['experiences/solo-backup-rust'], 더한줄: new Map([['experiences/solo-backup-rust/STAGE1_DESIGN.md', new Set([설계줄[3].글])]]) });
  assert.deepEqual(고친뒤, [], '이 push가 더한 줄(이미 고친 줄)은 뺀다');
  const 이름만 = n.결정낡은줄({ 새행들: [비투행], 찾기: 가짜찾기, 이름곳: (이름) => (이름 === '1인 기업 업무 백업 앱' ? ['experiences/solo-backup-rust'] : []) });
  assert.equal(이름만[0].수, 1, '행에 경로가 없으면 태그 이름의 곳에서 찾는다');
});

test('(나) 물러난 낱말 — 산문만 보고, 백틱 · 링크 · 인용 · 물러났다고 적은 줄 · 그 결정 앞의 기록 · 코드 주석은 걸리지 않는다', () => {
  const 표 = n.물러난표(fs.readFileSync(path.join(__dirname, '..', n.표길), 'utf8'));
  assert.ok(표.length >= 1);
  const 줄들 = [
    { 경로: 'AGENTS.md', 줄: 1, 글: '화면 검수는 아르곤에게 먼저 보인다' },
    { 경로: 'AGENTS.md', 줄: 2, 글: '`tools/아르곤웹.js`를 돌린다 · [계정](AI.md#아르곤-계정)' },
    { 경로: 'AGENTS.md', 줄: 3, 글: '검수자 이름은 카본이다. 「아르곤」이라 쓰지 않는다' },
    { 경로: 'AGENTS.md', 줄: 4, 글: '유호님 「예약작업 … 아르곤이라고 뜨네」' },
    { 경로: 'docs/설계.md', 줄: 5, 글: '11-08 아르곤 검수 P1 2 반영' },
    { 경로: 'docs/설계.md', 줄: 6, 글: '아르곤웹 점검을 돌린다' },
    { 경로: 'tools/검수묶음.mjs', 줄: 7, 글: "      ? '아르곤이 한도·로그인으로 막혔다 — 남은 묶음은 보내지 않는다'" },
    { 경로: 'tools/검수묶음.mjs', 줄: 8, 글: "  아르곤: { 출처: '아르곤', 번호앞: '' }, // 아르곤 묶음" },
    { 경로: 'tools/검수묶음.mjs', 줄: 9, glob: '', 글: '// 아르곤이 막히면 그록' },
  ];
  assert.deepEqual(n.물러난말({ 표, 줄들 }).map((x) => x.줄), [1, 7]);
});

test('(다) 줄이 가리키는 경로 — 백틱 속 경로와 md 링크, 자리 표시와 「없다」고 적은 것은 뺀다', () => {
  assert.deepEqual(n.줄의길들('`tools/a.js`로 본다 · [설계](../experiences/b/R.md) · `tools/<이름>.js` · `tools/c.js`는 없다', 'docs/x.md').sort(), ['experiences/b/R.md', 'tools/a.js']);
});

const 설계글 = (머리줄) => [
  '# 설계', '', '## 4. 화면', '', '- 시안 둘 → 유호님이 고른다', '',
  '## 10. 일정 · 담당', '', ...(머리줄 ? ['이 표는 11월 12일의 계획이다. 지금 상태는 [트랙](../../docs/_ops/트랙.md)에 있다.', ''] : []),
  '| 주 | 하는 일 |', '|---|---|', '| 11-16 ~ 22 | 엔진 |', '',
  '## 11. 유호님께 여쭐 것', '', ...(머리줄 ? ['이 표는 2026-11-12의 계획이다. 지금 상태는 트랙에 있다.', ''] : []), '- 손님용 B2 계정 가입', '',
  '## 12. 여행 일정 짜기', '', '| 단계 | 하는 일 |', '|---|---|', '| 고르기 | 장소 |', '',
].join('\n');

test('(라) 계획 표 머리 — 설계 문서의 일정표 · 여쭐 것 목록에 머리 줄이 없으면 걸리고, 있으면 · 여행 일정 같은 제품 절 · 설계 문서가 아니면 지난다', () => {
  assert.deepEqual(n.계획표검사('experiences/a/STAGE1_DESIGN.md', 설계글(false)).map((x) => x.머리), ['10. 일정 · 담당', '11. 유호님께 여쭐 것']);
  assert.deepEqual(n.계획표검사('experiences/a/STAGE1_DESIGN.md', 설계글(true)), []);
  assert.deepEqual(n.계획표검사('experiences/a/README.md', 설계글(false)), [], '설계 문서가 아니다');
  assert.deepEqual(n.계획표검사('docs/마케팅/편/게시/계획.md', 설계글(false)), [], '게시 폴더는 예약 작업이 올린다');
  assert.deepEqual(n.계획표검사('experiences/a/ROADMAP.md', 설계글(false), { 닿은줄: new Set([5, 19]) }), [], 'D5 이 push가 닿은 절만 본다(4절 · 여행 일정 절)');
  assert.deepEqual(n.계획표검사('experiences/a/ROADMAP.md', 설계글(false), { 닿은줄: new Set([15]) }).map((x) => x.줄), [13]);
});

test('diff -U0에서 더한 줄과 그 새 줄 번호를 읽는다', () => {
  const m = n.더한줄읽기('diff --git a/x.md b/x.md\n--- a/x.md\n+++ b/x.md\n@@ -3,0 +4,2 @@\n+가\n+나\n@@ -9 +11 @@\n-옛\n+새\n');
  assert.deepEqual([...m.get('x.md').글], ['가', '나', '새']);
  assert.deepEqual([...m.get('x.md').번호], [4, 5, 11]);
});

// ── 바로올리기로 실제 push ───────────────────────────────────────────────

const 결정머리 = '# 결정\n\n| 날짜 | 성격 | 결정 | 근거 |\n|---|---|---|---|\n';
const 바탕파일 = () => ({
  'AGENTS.md': '# 입구\n\n- 검수는 `tools/x.js`로 본다.\n',
  'docs/문서_지도.md': '# 지도\n\n| 내용 | 원문 |\n|---|---|\n| 백업 | [로드맵](../experiences/solo-backup-rust/ROADMAP.md) |\n',
  'docs/_ops/결정.md': `${결정머리}${행('2026-11-01', '[옛 · 행] 옛 행')}\n`,
  'docs/_ops/트랙.md': '# 트랙\n',
  'tools/x.js': '// x\n',
  'tools/lib/물러난말.json': fs.readFileSync(path.join(__dirname, '..', n.표길), 'utf8'),
  'experiences/solo-backup-rust/ROADMAP.md': '# 로드맵\n\n## 3. 이기는 가설\n\n- 가설 하나\n\n## 7. 유호님 차례와 돈\n\n| 때 | 할 일 |\n|---|---|\n| 1단계 | 손님용 B2 계정 만들기 |\n',
  'experiences/solo-backup-rust/STAGE1_DESIGN.md': '# 설계\n\n## 4. 화면\n\n- 뼈대부터 다시 짠다 → 화면 시안 둘 → 유호님이 고르기\n',
});

test('바로올리기 — 낡은 곳은 알리기만 하고, 닿은 절의 계획 표 머리 줄이 없으면 막고, --계획표건너뜀이면 까닭을 남기고 올린다', async (t) => {
  const 판 = 새판(t, { 파일: 바탕파일() });
  const 워 = 판.워크트리('wt');
  // 1) 로드맵의 다른 절만 고친 push — §7의 머리 줄이 없어도 막지 않는다(D5)
  워.쓰기('experiences/solo-backup-rust/ROADMAP.md', 바탕파일()['experiences/solo-backup-rust/ROADMAP.md'].replace('- 가설 하나', '- 가설 하나\n- 가설 둘'));
  const 다른절 = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '가설', 실행: true });
  assert.equal(다른절.결과, '올림', JSON.stringify(다른절));
  assert.equal(다른절.계획표, undefined);
  // 2) §7을 고친 push — 멈춘다
  워.쓰기('experiences/solo-backup-rust/ROADMAP.md', fs.readFileSync(path.join(워.폴더, 'experiences/solo-backup-rust/ROADMAP.md'), 'utf8').replace('| 1단계 | 손님용 B2 계정 만들기 |', '| 1단계 | 손님용 B2 계정 만들기 |\n| 2단계 | 시범 5명 |'));
  const 막힘 = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '차례' });
  assert.equal(막힘.결과, '멈춤', JSON.stringify(막힘));
  assert.match(막힘.이유, /머리 줄이 없다/);
  assert.equal(막힘.계획표.막음[0].머리, '7. 유호님 차례와 돈');
  assert.match(도구._시험.올리기글(막힘), /✗ 계획 표 머리 줄 없음: experiences\/solo-backup-rust\/ROADMAP\.md:\d+ 「7\. 유호님 차례와 돈」/);
  const 건너뜀 = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '차례', 계획표건너뜀: '시험 — 표 주인이 머리 줄을 단다', 실행: true });
  assert.equal(건너뜀.결과, '올림', JSON.stringify(건너뜀));
  assert.match(require('node:child_process').execFileSync('git', ['--git-dir', 판.원격, 'log', '-1', '--format=%B', 'master'], { encoding: 'utf8' }), /계획표 검사 건너뜀: 시험 — 표 주인이 머리 줄을 단다/);
  // 3) 결정 행 · 물러난 낱말 · 지운 파일 — 알림만, push는 된다
  워.쓰기('docs/_ops/결정.md', `${결정머리}${[행('2026-11-01', '[옛 · 행] 옛 행'), 행('2026-11-13', '[1인 기업 업무 백업 앱 · 0.7.0 화면 시안 고르기 · 유호님 결정] 시안 A 「확인서」로 간다. [README](../../experiences/solo-backup-rust/ui-mockups/README.md)')].join('\n')}\n`);
  워.쓰기('AGENTS.md', '# 입구\n\n- 검수는 `tools/x.js`로 본다.\n- 화면 검수는 아르곤에게 먼저 보인다.\n');
  fs.rmSync(path.join(워.폴더, 'tools/x.js'));
  const 알림 = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '결정', 실행: true });
  assert.equal(알림.결과, '올림', JSON.stringify(알림));
  const 글 = 알림.낡은곳.join('\n');
  assert.match(글, /결정 「0\.7\.0 화면 시안 고르기」\(11-13\)와 낱말이 겹치는데 이번 push에서 그대로인 줄 1개 — experiences\/solo-backup-rust\/STAGE1_DESIGN\.md:5/);
  assert.match(글, /물러난 낱말이 든 줄을 더했다 1개 — AGENTS\.md 「아르곤」/);
  assert.match(글, /이 push가 지우거나 옮긴 tools\/x\.js를 지금 읽히는 문서 1줄이 아직 가리킨다 — AGENTS\.md:3/);
  assert.match(도구._시험.올리기글(알림), /낡은 곳\(막지 않음\): 결정 「0\.7\.0 화면 시안 고르기」/);
});
