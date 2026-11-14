'use strict';
// 기록 찾기(tools/기록찾기.js)가 찾은 줄을 빠짐없이 알려 주는지 본다(2026-11-14).
// 왜: 결정 표와 트랙은 한 줄이 1~4KB라 `rg`로 찾으면 출력이 도구 한도(약 3만 자)에서 잘려 뒤쪽 줄이 말없이 빠졌다.
//   이 도구가 지켜야 하는 것은 둘이다. 출력이 한도를 넘지 않는다. 다 못 보였으면 몇 줄이 더 있는지 꼭 말한다.
//   메모 목록도 같다. 하네스는 앞 200줄만 싣고 뒤는 말없이 버리므로, 넘었거나 목록과 파일이 어긋나면 알려야 한다.
// 실제 결정 표와 트랙은 읽지 않는다(임시 폴더에 만든 것만 읽는다).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 도구 = path.join(__dirname, '..', 'tools', '기록찾기.js');
const 긴글 = (n) => '가나다라마바사아자차'.repeat(n / 10);

function 판(t, { 결정행 = [], 보관행 = [], 트랙줄 = [], 관문줄 = [], 현장 = '', 메모 = null } = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), '기록찾기-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true }));
  const 쓰기 = (rel, 글) => { const p = path.join(뿌리, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
  const 표머리 = '# 현재 결정\n\n| 날짜 | 성격 | 결정 | 근거 |\n|---|---|---|---|\n';
  쓰기('docs/_ops/결정.md', 표머리 + 결정행.join('\n') + '\n');
  쓰기('docs/_ops/보관/결정_2026-10.md', 표머리 + 보관행.join('\n') + '\n');
  쓰기('docs/_ops/트랙.md', '# 이어갈 작업\n\n' + 트랙줄.join('\n') + '\n');
  쓰기('docs/_ops/관문_자동화.md', '# 관문·자동화 한 장\n\n| 이름 | 하는 일 |\n|---|---|\n' + 관문줄.join('\n') + '\n');
  쓰기('docs/현장노트/셸.md', 현장);
  쓰기('tools/있는도구.js', '');
  const 메모폴더 = path.join(뿌리, '_메모');
  if (메모) for (const [f, 글] of Object.entries(메모)) 쓰기(path.join('_메모', f), 글);
  const 돌리기 = (...인자) => {
    const r = spawnSync(process.execPath, [도구, ...인자], { encoding: 'utf8', env: { ...process.env, SYNK_기록뿌리: 뿌리, SYNK_MEMORY_DIR: 메모폴더 } });
    return { 글: r.stdout, 오류: r.stderr, 코드: r.status };
  };
  return { 뿌리, 돌리기 };
}
const 행 = (날짜, 결정, 근거 = '근거') => `| ${날짜} | 확정 | ${결정} | ${근거} |`;

test('결정 표와 보관을 함께 찾고, 긴 줄도 한 줄로 줄여 줄 번호와 함께 보인다', (t) => {
  const { 돌리기 } = 판(t, {
    결정행: [행('2026-11-14', `드라마 오늘 한 장은 A안 ${긴글(1200)}`), 행('2026-11-13', '상관없는 행')],
    보관행: [행('2026-10-20', '드라마 자막 규칙')],
    트랙줄: ['- **드라마 복습:** 16일 녹화 뒤에 맞춘다. 남은 일: 복습 판 맞추기'],
  });
  const r = 돌리기('드라마');
  assert.equal(r.코드, 0, r.오류);
  assert.match(r.글, /^「드라마」 — 결정 2 · 트랙 1 · 관문 0 · 현장 0 · 메모 0/);
  assert.match(r.글, /docs\/_ops\/결정\.md\n\s+5 {2}2026-11-14 확정 드라마 오늘 한 장은 A안/);
  assert.match(r.글, /docs\/_ops\/보관\/결정_2026-10\.md\n\s+5 {2}2026-10-20 확정 드라마 자막 규칙/);
  assert.match(r.글, /docs\/_ops\/트랙\.md\n\s+3 {2}- \*\*드라마 복습/);
  for (const 줄 of r.글.split('\n')) assert.ok([...줄].length <= 170, `한 줄이 ${[...줄].length}자다`);
  assert.doesNotMatch(r.글, /상관없는 행/);
});

test('낱말이 여럿이면 모두 든 줄만 찾고, --또는은 하나라도 든 줄을 찾는다', (t) => {
  const { 돌리기 } = 판(t, { 결정행: [행('2026-11-14', '드라마 자막'), 행('2026-11-13', '드라마 목소리'), 행('2026-11-12', '광고 자막')] });
  assert.match(돌리기('드라마', '자막').글, /결정 1 /);
  assert.match(돌리기('--또는', '드라마', '자막').글, /결정 3 /);
  assert.match(돌리기('SYNK없는말').글, /찾은 줄이 없다/);
});

test('찾은 줄이 많아도 출력은 도구 한도 안이고, 다 못 보였으면 몇 줄이 더 있는지 말한다', (t) => {
  const 많은행 = Array.from({ length: 600 }, (_, i) => 행('2026-11-14', `배포 ${i}번 ${긴글(900)}`));
  const { 돌리기 } = 판(t, { 결정행: 많은행, 트랙줄: ['- 배포 뒤 확인 한 줄'] });
  const r = 돌리기('배포');
  assert.match(r.글, /^「배포」 — 결정 600 · 트랙 1/, '찾은 수는 다 못 보여도 정확히 말한다');
  assert.ok(r.글.length < 30000, `출력이 ${r.글.length}자다 — 도구가 뒤를 자르는 선(약 3만 자)을 넘으면 줄이 말없이 빠진다`);
  const 더 = /… (\d+)줄 더 있다/.exec(r.글);
  assert.ok(더, '다 못 보였는데 몇 줄이 더 있는지 말하지 않았다');
  const 보인수 = (r.글.match(/2026-11-14 확정 배포/g) || []).length;
  assert.equal(보인수 + Number(더[1]), 600, '보인 줄과 더 있다는 줄의 합이 찾은 수와 같아야 한다');
  assert.match(r.글, /- 배포 뒤 확인 한 줄/, '적게 나온 곳은 다 보인다');
  assert.match(r.글, /다 보이지 못한 줄이 \d+줄 있다/);
  const 모두 = 돌리기('배포', '--모두');
  assert.equal((모두.글.match(/2026-11-14 확정 배포/g) || []).length, 600);
});

test('--줄은 그 줄을 통째로 보이고, 저장소 밖 파일은 보이지 않는다', (t) => {
  const 긴 = 행('2026-11-14', `드라마 ${긴글(600)} 끝말`);
  const { 돌리기 } = 판(t, { 결정행: [긴] });
  const r = 돌리기('--줄', 'docs/_ops/결정.md:5');
  assert.ok(r.글.includes(긴), '줄 전체가 나와야 한다');
  assert.match(돌리기('--줄', '../밖.md:1').글, /이 저장소에 없는 파일이다/);
});

test('현장 노트는 낱말이 든 항목의 제목으로 묶고, --곳으로 찾을 곳을 고른다', (t) => {
  const { 돌리기 } = 판(t, {
    결정행: [행('2026-11-14', '줄끝 셈')],
    현장: '# 셸\n\n## 줄끝\n\n### 글자 수가 로컬에서만 넘는다\n\n- 증상: 줄끝 CR까지 센다.\n- 고침: 줄끝을 LF로 바꿔 센다.\n\n### 상관없는 항목\n\n- 다른 이야기\n',
  });
  const r = 돌리기('줄끝', '--곳', '현장');
  assert.match(r.글, /^「줄끝」 — 현장 2\n/);
  assert.match(r.글, /docs\/현장노트\/셸\.md\n\s+3 {2}## 줄끝\n\s+5 {2}### 글자 수가 로컬에서만 넘는다 \(2줄\)/);
  assert.doesNotMatch(r.글, /결정 표와 보관/);
  assert.equal(돌리기('줄끝', '--곳', '없는곳').코드, 2);
});

const 머리 = (이름) => `---\nname: ${이름}\ndescription: 설명\n---\n\n`;
const 좋은메모 = {
  'MEMORY.md': '# 메모\n\n- [영상은 다시 뽑는다](video.md) — 후보정하지 않는다.\n- [배포할 때](deploy.md) — 확인할 것.\n',
  'video.md': 머리('video') + '시댄스로만 부분 수정한다. 도구는 `tools/있는도구.js`다.\n',
  'deploy.md': 머리('deploy') + '배포 전에 본다.\n',
};

test('메모는 본문에서 찾아 목록 줄로 보인다', (t) => {
  const { 돌리기 } = 판(t, { 메모: 좋은메모 });
  const r = 돌리기('시댄스');
  assert.match(r.글, /메모 1\n/);
  assert.match(r.글, /video\.md {2}영상은 다시 뽑는다 — 후보정하지 않는다\./);
});

test('메모 점검 — 깨끗하면 0, 목록이 200줄을 넘거나 목록과 파일이 어긋나면 1이고 찾을 때도 알린다', (t) => {
  const 깨끗 = 판(t, { 메모: 좋은메모 }).돌리기('--메모점검');
  assert.equal(깨끗.코드, 0, 깨끗.글);
  assert.match(깨끗.글, /걸린 것이 없다/);

  const 긴목록 = '# 메모\n' + Array.from({ length: 210 }, (_, i) => `- [메모 ${i}](m${i}.md) — 한 줄`).join('\n') + '\n';
  const 긴메모 = { 'MEMORY.md': 긴목록 };
  for (let i = 0; i < 210; i++) 긴메모[`m${i}.md`] = 머리(`m${i}`) + '본문\n';
  const 넘음 = 판(t, { 메모: 긴메모 });
  const 점검 = 넘음.돌리기('--메모점검');
  assert.equal(점검.코드, 1);
  assert.match(점검.글, /메모 목록이 211줄이다\. 하네스는 앞 200줄만 싣는다 — 뒤 11줄의 메모는 세션에 보이지 않는다/);
  assert.match(넘음.돌리기('본문').글, /⚠ 메모 목록이 211줄이다/, '찾을 때도 알려야 넘은 것을 놓치지 않는다');

  const 어긋남 = 판(t, { 메모: { ...좋은메모, 'orphan.md': 머리('orphan') + '목록에 없는 메모\n', 'MEMORY.md': 좋은메모['MEMORY.md'] + '- [없는 파일](gone.md) — 파일이 없다.\n' } });
  const 어 = 어긋남.돌리기('--메모점검');
  assert.equal(어.코드, 1);
  assert.match(어.글, /목록이 가리키는 메모 파일이 없다: gone\.md/);
  assert.match(어.글, /목록에 없는 메모 파일이 있다\(세션이 이 메모를 모른다\): orphan\.md/);
  assert.match(어긋남.돌리기('목록에 없는 메모').글, /orphan\.md {2}\(목록에 없는 메모 파일\)/, '목록에 없는 메모도 찾기에는 나온다');
});

test('메모가 가리키는 저장소 파일이 없으면 알린다 — 자리 표시, 다른 저장소의 길, 없다고 적은 길은 뺀다', (t) => {
  const 메모 = {
    ...좋은메모,
    'video.md': 머리('video') + [
      '도구는 `tools/있는도구.js`와 `tools/없는도구.js`다.',
      '묶음은 `docs/마케팅/LAB_*/게시/`와 `tools/<이름>.js`에 있다.',
      '다른 저장소의 `SYNK-talk/tools/precommit.js`도 돈다.',
      '옛 콘티는 `docs/옛콘티.md`(지금 저장소에는 없다)다.',
    ].join('\n') + '\n',
  };
  const r = 판(t, { 메모 }).돌리기('--메모점검');
  assert.equal(r.코드, 0, '없는 길은 알림이지 막는 문제가 아니다');
  assert.match(r.글, /메모가 가리키는 저장소 파일 1개가 없다: video\.md → tools\/없는도구\.js/);
});

test('메모 폴더가 없는 곳에서도 찾기는 돌고, 모르는 플래그는 거절한다', (t) => {
  const { 돌리기 } = 판(t, { 결정행: [행('2026-11-14', '드라마')] });
  const r = 돌리기('드라마');
  assert.equal(r.코드, 0, r.오류);
  assert.match(r.글, /결정 1 .*메모 0/);
  assert.match(돌리기('--메모점검').글, /메모 폴더가 없다/);
  assert.notEqual(돌리기('드라마', '--없는플래그').코드, 0);
});
