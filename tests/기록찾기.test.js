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

test('현재 — 이웃 프로젝트의 담당 문서를 후보로 보존하고 명시한 경우에만 읽는다', t => {
  const { 뿌리 } = 판(t);
  const 작업본 = path.join(뿌리, '프로젝트');
  fs.mkdirSync(path.join(작업본, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(작업본, 'docs/문서_지도.md'),
    '| 홈페이지 | [현재 원고](../../웹/안내.md#현재), [구성 이력](옛안.md) |\n' +
    '| 앱 | [앱 안내](../../앱/안내.md) |\n');
  fs.writeFileSync(path.join(작업본, 'docs/옛안.md'), '# 이전 설계\n한때 쓰던 절차\n');
  const { 현재찾기 } = require('../tools/lib/작업원문.js');
  const 찾기 = (말, 명시 = []) => 현재찾기(작업본, [말], 명시);
  const 섞임 = 찾기('홈페이지');
  assert.equal(섞임.상태, '원문 선택 필요');
  assert.deepEqual(섞임.원문, []);
  assert.deepEqual(섞임.후보.map(x => x.이름), ['현재 원고', '구성 이력']);
  const 외부 = 섞임.후보[0].위치;
  assert.equal(외부, path.join(fs.realpathSync(뿌리), '웹/안내.md') + '#현재');
  assert.equal(찾기('앱 안내').후보[0].외부, true);
  fs.mkdirSync(path.join(뿌리, '웹'));
  fs.writeFileSync(path.join(뿌리, '웹/안내.md'), '# 웹\n## 현재\n이번에 쓰는 원고.\n');
  assert.deepEqual(찾기('현재 원고').원문, []);
  const 읽음 = 찾기('홈페이지', [외부]).원문[0];
  assert.equal(읽음.제목, '현재');
  assert.equal(읽음.발췌[0].글, '이번에 쓰는 원고.');
});

test('현재 — 한 담당 원문의 실제 제목, 범위와 조건을 인용하고 이전 승인과 추정을 가져오지 않는다', t => {
  const { 뿌리, 돌리기 } = 판(t, { 보관행: [행('2026-10-01', '펜던트 모든 면 확정(예전 안)')] });
  fs.writeFileSync(path.join(뿌리, 'docs/문서_지도.md'), '| 펜던트 | [제작](제작.md#조건) |\n');
  const src = path.join(뿌리, 'docs/제작.md');
  fs.writeFileSync(src, '# 펜던트\n\n외부 공개 전이다.\n\n<a id="조건"></a>\n## 관찰과 사용자 선택\n- 사용자가 선택한 범위는 앞면 색뿐이다.\n- 검수자는 뒷면을 추천했지만 사용자는 아직 고르지 않았다.\n## 과거 안\n펜던트 모든 면 확정(예전 안)\n');
  const get = () => JSON.parse(돌리기('--현재', '펜던트', '--json').글);
  const 첫 = get();
  assert.equal(첫.상태, '원문 발췌');
  assert.equal(첫.승인판정, '자동 판정하지 않음');
  assert.equal(첫.원문[0].제목, '관찰과 사용자 선택');
  assert.equal(첫.원문[0].안내.글, '외부 공개 전이다.');
  const 글 = 돌리기('--현재', '펜던트').글;
  assert.match(글, /앞면 색뿐/); assert.match(글, /아직 고르지/); assert.doesNotMatch(글, /모든 면 확정/);
  assert.match(돌리기('펜던트').글, /모든 면 확정/);
  fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace('앞면 색뿐', '앞면과 옆면 색'));
  assert.notEqual(get().원문[0].지문, 첫.원문[0].지문);
});

test('현재 — 동명 후보는 선택을 미루고, 누락·긴 문장·중복 앵커를 승인으로 채우지 않는다', t => {
  const { 뿌리, 돌리기 } = 판(t);
  fs.writeFileSync(path.join(뿌리, 'docs/문서_지도.md'), '| 장식 | [시안](시안.md), [결과](결과.md) |\n');
  fs.writeFileSync(path.join(뿌리, 'docs/시안.md'), '# 임시 시안\n## 초안\n이력\n## 초안\n이력 둘\n## 보류\n' + '아직'.repeat(700) + ' 승인 전.\n');
  const 둘 = JSON.parse(돌리기('--현재', '장식', '--json').글);
  assert.equal(둘.상태, '원문 선택 필요'); assert.equal(둘.원문.length, 0); assert.equal(둘.후보.length, 2);
  fs.writeFileSync(path.join(뿌리, 'docs/결과.md'), '# 결과\n기록\n');
  assert.equal(JSON.parse(돌리기('--현재', '결과', '--json').글).원문[0].제목, '결과');
  assert.equal(JSON.parse(돌리기('--현재', '무관한말', '--json').글).상태, '지정된 원문 없음');
  const 없다 = 돌리기('--현재', '장식', '--원문', 'docs/시안.md#없는곳');
  assert.equal(없다.코드, 2); assert.match(없다.오류, /원문에 없습니다/);
  assert.equal(돌리기('--현재', '장식', '--원문', 'docs/시안.md#초안').코드, 2);
  const 긴 = JSON.parse(돌리기('--현재', '장식', '--원문', 'docs/시안.md#보류', '--json').글).원문[0];
  assert.equal(긴.발췌.length, 0); assert.equal(긴.생략줄, 1);
  assert.equal(돌리기('--현재', '장식', '--곳', '결정').코드, 2);
});

test('현재 — 제목 없는 본문 앵커는 다른 단락과 코드 예시를 구분한다', t => {
  const { 뿌리 } = 판(t);
  const { 현재찾기 } = require('../tools/lib/작업원문.js');
  const 파일 = 'docs/담당.md';
  fs.writeFileSync(path.join(뿌리, 파일), [
    '# 작업 기준', '## 역할', '<a id="화면"></a>', '<a name="화면별칭"></a>', '',
    '**화면 담당**', '화면 구현은 화면 담당에게 맡긴다.',
    '<a id="다음"></a>', '다음 단락이다.',
    '<a id="검수"></a>', '## 검수 방법', '~~~', '<a id="화면"></a>', '~~~',
  ].join('\n'));
  const 읽기 = 앵커 => 현재찾기(뿌리, ['화면'], [파일 + 앵커]).원문[0];
  const 단락 = 읽기('#화면');
  assert.deepEqual(단락.발췌.map(x => x.글), ['**화면 담당**', '화면 구현은 화면 담당에게 맡긴다.']);
  assert.deepEqual([단락.첫줄, 단락.끝줄], [3, 7]);
  assert.deepEqual(읽기('#화면별칭'), 단락);
  assert.deepEqual(읽기('#다음').발췌.map(x => x.글), ['다음 단락이다.']);
  assert.equal(읽기('#검수').제목, '검수 방법');
  assert.deepEqual(읽기('').절후보.map(x => x.제목), ['역할', '검수 방법']);
  fs.appendFileSync(path.join(뿌리, 파일), '\n<a id="화면"></a>\n다른 단락');
  assert.throws(() => 읽기('#화면'), /둘 이상/);
});

test('현재 — 옛 사본의 상대·절대 원문도 공용 작업본을 읽고 받은 원격판과 동시 수정은 구분한다', t => {
  const { 뿌리 } = 판(t);
  const { 현재찾기 } = require('../tools/lib/작업원문.js');
  const git = (d, ...args) => {
    const r = spawnSync('git', ['-c', 'user.name=시험', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false',
      '-c', 'core.hooksPath=/dev/null', '-c', 'core.autocrlf=false', ...args], { cwd: d, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  const 파일 = 'docs/정본.md', p = path.join(뿌리, 파일), 옛 = path.join(뿌리, '옛사본');
  fs.writeFileSync(p, '# 정본\n## 현재\n시험 A\n');
  fs.writeFileSync(path.join(뿌리, 'docs/예전.md'), '# 예전\n## 현재\n옛 자료\n');
  git(뿌리,'init','-b','master'); git(뿌리,'add',파일,'docs/예전.md');
  git(뿌리,'commit','-m','시험 바탕'); git(뿌리,'worktree','add','--detach',옛,'HEAD');
  const 읽기 = (입력 = 파일) => 현재찾기(옛, ['시험'], [입력 + '#현재']).원문[0];
  fs.writeFileSync(p, '# 정본\n## 현재\n공용 미커밋 B\n');
  assert.equal(읽기().발췌[0].글, '공용 미커밋 B');
  assert.equal(읽기(path.join(옛, 파일)).발췌[0].글, '공용 미커밋 B');
  fs.writeFileSync(path.join(옛, 파일),'# 정본\n## 현재\n받은 판 C\n');
  const 신설 = 'docs/새자료.md';
  fs.writeFileSync(path.join(옛, 신설), '# 새 자료\n## 현재\n첫 판\n## 보관\n' + '가'.repeat(400000));
  git(옛, 'add', 신설); git(옛, 'rm', 'docs/예전.md'); git(옛,'commit','-am','변경');
  git(뿌리,'update-ref','refs/remotes/origin/master',git(옛,'rev-parse','HEAD'));
  assert.throws(읽기, /겹칩니다/);
  fs.writeFileSync(p,'# 정본\n## 현재\n시험 A\n');
  assert.equal(읽기().발췌[0].글, '받은 판 C');
  assert.equal(읽기(신설).발췌[0].글, '첫 판');
  assert.throws(() => 읽기('docs/예전.md'), /원문을 삭제/);
  fs.writeFileSync(path.join(뿌리, 신설), '# 새 자료\n## 현재\n동시 초안\n');
  assert.throws(() => 읽기(신설), /겹칩니다/);
});
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

test('--줄은 여러 파일을 섞어 요청해도 파일마다 한 번 읽고 요청 순서를 지킨다', t => {
  const { 줄보기 } = require(도구);
  t.mock.method(fs, 'existsSync', () => true);
  const 읽기 = t.mock.method(fs, 'readFileSync', p => path.basename(p) + ' 첫줄\n둘째 줄');
  const 결과 = 줄보기(['가.md:2', '나.md:1', './가.md:1', '나.md:4', '가.md:2']);
  assert.equal(읽기.mock.callCount(), 2);
  assert.deepEqual(결과.split('\n').filter((_, i) => i % 3 === 1),
    ['둘째 줄', '나.md 첫줄', '가.md 첫줄', '(그 줄이 없다)', '둘째 줄']);
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

test('짧은 메모 입구가 참조하는 목차의 주제는 자료용으로 검색하고 직접 등록 항목과 중복하지 않는다', t => {
  const 메모 = {
    'MEMORY.md': '# 입구\n- [현재 작업](current.md)\n- 이전 사례는 [참고 목차](catalog.md)에서 고른다.\n',
    'catalog.md': '# 사례 색인\n- [옛 제목](current.md)\n- [보관 사례](example.md)\n',
    'current.md': '공통낱말은 지금의 지시다.\n',
    'example.md': '공통낱말을 사용했던 이전 사례다.\n',
  };
  const { 돌리기 } = 판(t, { 메모 });
  const 점검 = 돌리기('--메모점검', '--json');
  assert.equal(점검.코드, 0, 점검.글);
  const r = JSON.parse(점검.글);
  assert.deepEqual(r.목차, ['catalog.md']);
  assert.deepEqual(r.항목.map(x => [x.파일, x.구분]), [['current.md', '현재 목록'], ['example.md', '자료용']]);
  const 검색 = JSON.parse(돌리기('--곳', '메모', '공통낱말', '--json').글).결과.메모;
  assert.deepEqual(검색.map(x => [x.파일, x.구분]), [['current.md', '현재 목록'], ['example.md', '자료용']]);
  assert.match(돌리기('--곳', '메모', '공통낱말').글, /example\.md  \[자료용\]/);
});

test('실제 미등록·끊긴 상세 링크를 알리고 메모를 제외한 조회에서는 개인 파일을 읽지 않는다', t => {
  const { 뿌리, 돌리기 } = 판(t, { 결정행: [행('2026-11-10', '입구 시험')], 메모: {
    'MEMORY.md': '# 입구\n- 사례는 [참고 목차](catalog.md)에서 확인한다.\n- 표기 예 `[예시](lost.md)`\n',
    'catalog.md': '# 자료 목차\n- [없는 파일](missing.md)\n~~~\n- [코드 예](lost.md)\n~~~\n',
    'lost.md': '목록에 없는 사례 본문\n',
  } });
  const 점검 = 돌리기('--메모점검', '--json'), r = JSON.parse(점검.글);
  assert.equal(점검.코드, 1);
  assert.deepEqual(r.파일없음, ['missing.md']); assert.deepEqual(r.목록에없음, ['lost.md']);
  fs.renameSync(path.join(뿌리, '_메모/MEMORY.md'), path.join(뿌리, '_메모/입구복사'));
  fs.mkdirSync(path.join(뿌리, '_메모/MEMORY.md'));
  const 결정 = 돌리기('--곳', '결정', '입구');
  assert.equal(결정.코드, 0, 결정.오류); assert.match(결정.글, /입구 시험/);
  assert.doesNotMatch(결정.글, /메모점검|목록에 없는/);
});
