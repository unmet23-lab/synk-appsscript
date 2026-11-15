'use strict';
// 지금 상태(tools/지금상태.js, SessionStart · UserPromptSubmit 훅) — 세션이 고친 곳의 트랙 줄 · 결정 행 · 커밋을 넣고, 지금 문맥에 있는 것은 빼고,
// 곳이 없거나 SYNK 밖이거나 입력이 깨지면 아무것도 내지 않는지. 끝 코드는 늘 0.
// 곳은 어시스턴트가 부른 도구의 입력에서만 찾는다 — 돌리기만 한 도구(node tools/x.js)와 읽기만 한 곳은 곳이 아니다(11-15 되짚기 · Fable 5.2 설계 검토 D6).
// 시험마다 Fable 5.2 설계 검토(11-15)의 지적 번호를 적었다 — D1 압축 직후 문맥 · D2 이 세션이 쓴 행 · D3 글 상한 · D4 docs 상대 링크 · D7 남은 일 물음.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const z = require('../tools/지금상태.js');

const 도구 = path.join(__dirname, '..', 'tools', '지금상태.js');
const j = (o) => JSON.stringify(o);
const 부름 = (name, input, timestamp = '2026-11-14T10:00:00.000Z', cwd = 'C:\\Users\\q1212\\Documents\\SYNK-appsscript\\.claude\\worktrees\\sad') => ({ type: 'assistant', timestamp, cwd, message: { content: [{ type: 'tool_use', name, input }] } });
const 줄들 = (os_) => `${os_.map((o) => j(o)).join('\n')}\n`;
const 결과글 = (s) => ({ type: 'user', timestamp: '2026-11-14T16:16:05Z', message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: s }] } });

const 결정머리 = '# 현재 결정\n\n| 날짜 | 성격 | 결정 | 근거 |\n|---|---|---|---|\n';
const 행 = (날, 결정, 근거 = '근거') => `| ${날} | 확정 | ${결정} | ${근거} |`;
const 트랙머리 = '# 이어갈 작업\n\n';

function 저장소(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '지금상태-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const g = (args, env = {}) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  g(['init', '-q', '-b', 'master']);
  g(['config', 'user.email', 't@example.invalid']);
  g(['config', 'user.name', 't']);
  g(['config', 'core.autocrlf', 'false']);
  const 쓰기 = (rel, 글) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), 글); };
  const 올림 = (때, 제목) => { g(['add', '-A']); g(['commit', '-q', '-m', 제목], { GIT_COMMITTER_DATE: 때, GIT_AUTHOR_DATE: 때 }); return g(['rev-parse', 'HEAD']).trim(); };
  return { dir, g, 쓰기, 올림, git: (args) => g(args) };
}

test('경로를 저장소 안 곳으로 묶는다 — 세 뿌리 꼴 · /c/ 꼴 · 상대 · 공용 문서 · 다른 저장소', () => {
  assert.equal(z.저장소상대('C:\\Users\\q1212\\Documents\\SYNK-appsscript\\.claude\\worktrees\\sad-mendel-282a95\\experiences\\solo-backup-rust\\STAGE1_DESIGN.md'), 'experiences/solo-backup-rust/STAGE1_DESIGN.md');
  assert.equal(z.저장소상대('D:\\SYNK-worktrees\\SYNK-appsscript\\sleepy-northcutt-3da55b\\tools\\지금상태.js'), 'tools/지금상태.js');
  assert.equal(z.저장소상대('/d/SYNK-worktrees/SYNK-appsscript/x/tools/a.js'), 'tools/a.js');
  assert.equal(z.저장소상대('/c/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/synkbrief_x_20261111/컷표.json'), 'docs/마케팅/synkbrief_x_20261111/컷표.json');
  assert.equal(z.저장소상대('D:\\SYNK-worktrees\\codex\\a\\SYNK-appsscript\\docs\\x.md'), 'docs/x.md');
  assert.equal(z.저장소상대('experiences/path-travel/README.md'), 'experiences/path-travel/README.md');
  assert.equal(z.저장소상대('src/main.rs', 'experiences/solo-backup-rust'), 'experiences/solo-backup-rust/src/main.rs', '상대 경로는 부른 자리에서 푼다');
  assert.equal(z.저장소상대('tools/x.js', 'experiences/solo-backup-rust/server'), 'experiences/solo-backup-rust/server/tools/x.js', 'server/tools 안의 tools/x는 뿌리의 tools/x가 아니다');
  assert.equal(z.저장소상대('C:\\Users\\q1212\\Documents\\SYNK-talk\\docs\\x.md'), null);
  assert.equal(z.저장소상대('C:\\Users\\q1212\\.claude\\projects\\C--Users-q1212-Documents-SYNK-appsscript\\memory\\a.md'), null, '메모 폴더는 저장소가 아니다');
  assert.equal(z.저장소상대('/tmp/foo/tools/x.js'), null);
  assert.equal(z.저장소안('C:\\Users\\q1212\\Documents\\SYNK-appsscript\\.claude\\worktrees\\sad-mendel-282a95'), '', '워크트리 뿌리 자체');
  assert.equal(z.곳으로('experiences/solo-backup-rust/server/a.mjs'), 'experiences/solo-backup-rust');
  assert.equal(z.곳으로('tools/lib/git-publish-core.cjs'), 'tools/lib/git-publish-core.cjs');
  assert.equal(z.곳으로('docs/마케팅/synkbrief_x_20261111/컷표.json'), 'docs/마케팅/synkbrief_x_20261111');
  assert.equal(z.곳으로('docs/아틀라스_설계.md'), 'docs/아틀라스_설계.md');
  for (const 공용 of ['docs/_ops/결정.md', 'docs/_ops/트랙.md', 'AGENTS.md', 'docs/AI_운영원칙.md', 'docs/현장노트/git_줄끝_잠금.md', 'tests/a.test.js', '.claude/settings.json'])
    assert.equal(z.곳으로(공용), null, 공용);
});

test('곳은 고친 흔적이 있는 곳만 — 돌리기만 한 도구 · 읽기만 한 곳 · cd 뒤 상대 경로(D6)', () => {
  const 뿌리 = 'C:\\Users\\q1212\\Documents\\SYNK-appsscript\\.claude\\worktrees\\sad';
  const 도구들 = [
    ...Array.from({ length: 10 }, () => ({ 이름: 'Edit', 입력: { file_path: `${뿌리}\\experiences\\a\\b.md` }, cwd: 뿌리 })),
    ...Array.from({ length: 40 }, () => ({ 이름: 'Bash', 입력: { command: 'node tools/검수묶음.mjs GPT 이름 && python -I tools/컷연속성검사.py docs/마케팅/편/컷표.json' }, cwd: 뿌리 })),
    ...Array.from({ length: 20 }, () => ({ 이름: 'Bash', 입력: { command: `cd "/c/Users/q1212/Documents/SYNK-appsscript/.claude/worktrees/sad/experiences/a" && sed -n 1,9p engine/src/lib.rs` }, cwd: 뿌리 })),
    { 이름: 'Read', 입력: { file_path: 'tools/c.js' }, cwd: 뿌리 },
    { 이름: 'Write', 입력: { file_path: 'C:\\Users\\q1212\\AppData\\Local\\Temp\\x\\a.py' }, cwd: 뿌리 },
  ];
  const 곳 = z.곳찾기(도구들);
  assert.deepEqual(곳.map((x) => x.곳), ['experiences/a'], '읽기 점수는 순위에만 쓴다');
  assert.equal(곳[0].점수, 50, 'cd 뒤의 engine/src/lib.rs도 experiences/a로 센다');
  const r = z.명령경로들('cd "C:/Users/q1212/Documents/SYNK-appsscript/.claude/worktrees/sad" && grep -n x experiences/b/README.md', '');
  assert.deepEqual(r, { 바탕: '', 길들: ['experiences/b/README.md'] });
});

test('태그 첫 마디는 이름으로 쓰고 붙임말 · 짧은 말은 버린다', () => {
  assert.equal(z.첫마디('업무 백업 · 솔리오와의 관계와 로드맵 셋 · Claude 판단(기술)'), '업무 백업');
  assert.equal(z.첫마디('업무 백업 0.7.0 화면 — A 확인서로 확정(11-13, Claude 곁 세션)'), '업무 백업 0.7.0 화면');
  assert.equal(z.첫마디('후속 구현 요청 · 로컬 반영'), null);
  assert.equal(z.첫마디('PC'), null);
  assert.ok(z.이름맞음('업무 백업', new Set(['업무 백업 0.7.0 화면'])));
  assert.ok(!z.이름맞음('업무 백업', new Set(['업무 백업기'])), '낱말 경계에서만 앞머리로 본다');
  assert.ok(!z.이름맞음('백업', new Set(['백업 앱'])), '4글자 아래는 잇지 않는다');
  assert.deepEqual(z.줄길들('- **편(11-15):** [기획](../마케팅/편이름/기획.md) · [로드맵](../../experiences/a/R.md)'), ['docs/마케팅/편이름/기획.md', 'experiences/a/R.md'], 'D4 트랙의 ../ 링크를 docs/_ops 자리에서 푼다');
});

/** 실수 하나를 줄인 꼴 — 업무 백업 세션, 곁 세션이 정한 A 확인서, 이 세션이 압축 앞에 쓴 B2 행, 다른 일의 행. */
function 오늘판(t) {
  const r = 저장소(t);
  r.쓰기('experiences/solo-backup-rust/STAGE1_DESIGN.md', '# 설계\n');
  r.쓰기('docs/_ops/결정.md', `${결정머리 + 행('2026-11-11', '[1인 기업 업무 백업 앱 · 꺼 두기] 0.5.0을 닫고 Windows 시작 등록을 지웠다. 지킨 것이 시험 폴더 하나였다. [로드맵](a.md)')}\n`);
  r.쓰기('docs/_ops/트랙.md', `${트랙머리}## 1. 유호님 차례 — 한곳에 모음\n\n- **업무 백업 앱 시범 5명 — 모집 경로 고르기(11-12, 유호님 차례):** 고르신다.\n\n## 3. 앱\n\n- **1인 기업 업무 백업 앱(11-10 ~, Claude):** [로드맵](../../experiences/solo-backup-rust/ROADMAP.md). 남은 일: 도우미.\n`);
  const 처음 = r.올림('2026-11-12T08:00:00Z', '처음');
  r.쓰기('docs/_ops/결정.md', `${결정머리}${[
    행('2026-11-13', '[1인 기업 업무 백업 앱 · 0.7.0 화면 시안 고르기 · 유호님 결정] 1단계 화면은 시안 A 「확인서」로 간다. 정본은 [README](../../experiences/solo-backup-rust/ui-mockups/README.md)'),
    행('2026-11-13', '[1인 기업 업무 백업 앱 · 손님용 B2 계정 준비 · Claude 판단(기술)] 손님 계정에 비공개 버킷 하나와 수명 규칙을 만들었다'),
    행('2026-11-15', '[업무 백업 · 솔리오와의 관계와 로드맵 셋 · Claude 판단(기술) + 유호님 말씀] 솔리오와 백업 엔진은 「한 제품, 두 프로그램」으로 간다'),
    행('2026-11-15', '[Workspace 초대 · GPT] 백업 담당자를 초대한다'),
    행('2026-11-11', '[1인 기업 업무 백업 앱 · 꺼 두기] 0.5.0을 닫고 Windows 시작 등록을 지웠다. 지킨 것이 시험 폴더 하나였다. [로드맵](../../experiences/solo-backup-rust/ROADMAP.md)'),
  ].join('\n')}\n`);
  r.쓰기('docs/_ops/트랙.md', `${트랙머리}## 1. 유호님 차례 — 한곳에 모음\n\n- **업무 백업 앱 시범 5명 — 모집 경로 고르기(11-12, 유호님 차례):** 고르신다.\n\n## 3. 앱\n\n`
    + '- **업무 백업 0.7.0 화면 — A 확인서로 확정(11-13, Claude 곁 세션 · 유호님 「A로 정하기」):** [README](../../experiences/solo-backup-rust/ui-mockups/README.md). 남은 일: 12-07 주 Tauri로 옮기기.\n'
    + '- **1인 기업 업무 백업 앱(11-10 ~, Claude):** [로드맵](../../experiences/solo-backup-rust/ROADMAP.md). 끝난 증분 — 손님용 B2 준비 · 폴더 더하기. 남은 일: 도우미.\n'
    + '- **업무 백업 · 솔리오 연결(11-15, Claude):** [로드맵](../../experiences/solo-backup-rust/ROADMAP.md). 남은 일: 설계에 옮기기.\n'
    + '- **Workspace 사람·조직(11-13, GPT):** 백업 담당 초대. 남은 일: 없음\n');
  r.쓰기('experiences/solo-backup-rust/ui-mockups/README.md', '# 시안\nA로 정함\n');
  const 곁 = r.올림('2026-11-13T09:00:00Z', 'fix(업무 백업 0.7.0 화면 A · 곁 세션): 시안 A로');
  // 이 세션 — 11-12부터 experiences/solo-backup-rust를 고쳤고, 손님용 B2 행은 11-13에 자기가 결정.js로 썼다. 그 뒤 압축이 한 번 있었다.
  const 기록 = z.기록풀기(줄들([
    { type: 'user', timestamp: '2026-11-12T08:30:00Z', message: { content: '업무 백업 1단계 설계' } },
    부름('Edit', { file_path: 'C:\\Users\\q1212\\Documents\\SYNK-appsscript\\.claude\\worktrees\\sad\\experiences\\solo-backup-rust\\STAGE1_DESIGN.md', old_string: 'a', new_string: 'b' }, '2026-11-12T09:00:00Z'),
    부름('Bash', { command: 'node tools/결정.js --추가 "[1인 기업 업무 백업 앱 · 손님용 B2 계정 준비 · Claude 판단(기술)] 손님 계정에 비공개 버킷 하나와 수명 규칙을 만들었다" --근거 "x"' }, '2026-11-13T05:00:00Z'),
    { type: 'system', subtype: 'compact_boundary', timestamp: '2026-11-14T15:12:00Z' },
    { type: 'user', timestamp: '2026-11-14T15:12:01Z', message: { content: 'This session is being continued from a previous conversation …' } },
    부름('Edit', { file_path: 'C:\\Users\\q1212\\Documents\\SYNK-appsscript\\.claude\\worktrees\\sad\\experiences\\solo-backup-rust\\ROADMAP.md', old_string: 'a', new_string: 'b' }, '2026-11-14T15:20:00Z'),
    부름('Bash', { command: 'grep -n "솔리오와의 관계" docs/_ops/결정.md' }, '2026-11-14T16:16:00Z'),
    결과글('| 2026-11-15 | 확정 | [업무 백업 · 솔리오와의 관계와 로드맵 셋 · Claude 판단(기술) + 유호님 말씀] 솔리오와 백업 엔진은 「한 제품, 두 프로그램」으로 간다'),
  ]));
  return { ...r, 처음, 곁, 기록 };
}

const 기본 = (r, 덧) => ({ 기록: r.기록, 시작때: '2026-11-12T08:30:00Z', 판: r.git(['rev-parse', 'HEAD']).trim(), git: r.git, ...덧 });

test('압축 뒤 — 트랙 줄 · 시안 결정 행 · 이 세션이 압축 앞에 쓴 B2 행 · 커밋을 넣고, 다른 일과 옛 행은 뺀다(D1 · D2)', (t) => {
  const r = 오늘판(t);
  const 결과 = z.한번(기본(r, { 사건: 'SessionStart', source: 'compact', 지금: Date.parse('2026-11-15T00:12:00Z') }));
  assert.ok(결과.글, '넣을 것이 있다');
  const 글 = 결과.글;
  assert.match(글, /^〔지금 상태〕/);
  assert.match(글, /experiences\/solo-backup-rust/);
  assert.match(글, /A 확인서로 확정/);
  assert.match(글, /0\.7\.0 화면 시안 고르기/);
  assert.match(글, /손님용 B2 계정 준비/, 'D2 이 세션이 쓴 행도 압축 뒤에는 넣는다');
  assert.match(글, /끝난 것: 손님용 B2 준비/, 'D8 큰 줄의 끝난 증분을 보인다');
  assert.match(글, /솔리오와의 관계/, 'D1 압축 직후에는 앞 문맥에서 본 행도 다시 넣는다(경계 줄이 아직 없어도)');
  assert.match(글, /fix\(업무 백업 0\.7\.0 화면 A/);
  assert.doesNotMatch(글, /Workspace/, '다른 일의 행 · 줄은 「백업」이 들어 있어도 잇지 않는다');
  assert.doesNotMatch(글, /꺼 두기/, 'D16 링크만 고친 옛 행은 새것이 아니다');
  assert.match(글, /유호님 차례\(트랙 1절\) — 이 곳으로 적힌 것은 이 1줄이다:\n· 트랙\.md:\d+ 업무 백업 앱 시범 5명/, 'D8 유호님 차례를 따로 묶어 먼저');
  assert.ok([...글].length <= 4000);
});

test('이어 받기(resume)는 지금 문맥(마지막 압축 뒤)에 있는 행만 뺀다', (t) => {
  const r = 오늘판(t);
  const 결과 = z.한번(기본(r, { 사건: 'SessionStart', source: 'resume', 지금: Date.parse('2026-11-15T09:00:00Z') }));
  assert.ok(결과.글);
  assert.doesNotMatch(결과.글, /솔리오와의 관계/, '압축 뒤에 grep으로 본 행');
  assert.match(결과.글, /손님용 B2 계정 준비/, '압축 앞에 쓴 행은 지금 문맥에 없다');
  assert.match(결과.글, /시안 고르기/);
});

test('새 말 — 10분 안이면 아무것도 안 하고, 지나면 마지막으로 넣은 뒤 바뀐 것만 넣는다', (t) => {
  const r = 오늘판(t);
  const 지금 = Date.parse('2026-11-15T09:00:00Z');
  const 이른 = z.한번(기본(r, { 사건: 'UserPromptSubmit', 지금, 상태: { 본때: '2026-11-15T08:55:00Z' }, 말: '이어서 해' }));
  assert.equal(이른.글, null);
  assert.equal(이른.까닭, '간격');
  const 판 = r.git(['rev-parse', 'HEAD']).trim();
  const 그대로 = z.한번(기본(r, { 사건: 'UserPromptSubmit', 지금, 상태: { 본때: '2026-11-15T05:00:00Z', 본판: 판, 곳들: ['experiences/solo-backup-rust'] }, 말: '이어서 해' }));
  assert.equal(그대로.까닭, '바뀐 것 없음', '본 판 뒤로 곳 · 결정 · 트랙이 그대로면 기록을 읽지 않는다');
  const 다넣음 = z.한번(기본(r, { 사건: 'UserPromptSubmit', 지금, 상태: { 본때: '2026-11-15T05:00:00Z', 넣은때: '2026-11-14T00:00:00Z' }, 말: '이어서 해' }));
  assert.equal(다넣음.글, null, '11-13 곁 커밋 뒤에 넣은 적이 있으면 새것이 없다');
  const 새것 = z.한번(기본(r, { 사건: 'UserPromptSubmit', 지금, 상태: { 본때: '2026-11-15T05:00:00Z', 넣은때: '2026-11-12T09:00:00Z' }, 말: '이어서 해' }));
  assert.ok(새것.글);
  assert.match(새것.글, /A 확인서로 확정/);
  assert.doesNotMatch(새것.글, /모집 경로 고르기/, '새 말 때는 바뀐 트랙 줄만');
  assert.doesNotMatch(새것.글, /솔리오와의 관계/, '지금 문맥에 있는 행');
  assert.ok([...새것.글].length <= 1500);
  assert.equal(새것.상태.넣은때, '2026-11-15T09:00:00.000Z');
});

test('남은 일을 묻는 말에는 새것이 없어도 그 곳의 트랙 줄을 다시 넣는다 — 30분 안에 넣었으면 뺀다(D7)', (t) => {
  const r = 오늘판(t);
  const 지금 = Date.parse('2026-11-15T09:10:57Z');
  const 물음 = '오케이 그럼 나머지 작업 다 하는데 얼마나 걸릴것같아? 아직 시작은 하지마.';
  assert.ok(z.남은일물음.test(물음));
  const 다시 = z.한번(기본(r, { 사건: 'UserPromptSubmit', 지금, 상태: { 본때: '2026-11-15T09:05:00Z', 넣은때: '2026-11-15T08:22:00Z' }, 말: 물음 }));
  assert.ok(다시.글, '본 지 6분이어도 물음에는 돈다');
  assert.match(다시.글, /모집 경로 고르기/);
  assert.match(다시.글, /A 확인서로 확정/);
  const 막넣음 = z.한번(기본(r, { 사건: 'UserPromptSubmit', 지금, 상태: { 본때: '2026-11-15T09:05:00Z', 넣은때: '2026-11-15T08:50:00Z' }, 말: 물음 }));
  assert.equal(막넣음.글, null);
});

test('docs 아래 곳(편 폴더)도 트랙의 ../마케팅/… 링크로 잇는다(D4)', (t) => {
  const r = 저장소(t);
  r.쓰기('docs/마케팅/PULSE_홍보_20261113/기획.md', '# 기획\n');
  r.쓰기('docs/_ops/결정.md', 결정머리);
  r.쓰기('docs/_ops/트랙.md', 트랙머리);
  r.올림('2026-11-12T08:00:00Z', '처음');
  r.쓰기('docs/_ops/트랙.md', `${트랙머리}- **PULSE 홍보 영상(11-14, Claude):** [기획](../마케팅/PULSE_홍보_20261113/기획.md). 남은 일: 끝 3초 다시.\n`);
  r.쓰기('docs/_ops/결정.md', `${결정머리}${행('2026-11-14', '[PULSE 홍보 영상 · 끝 장면] 로고는 그린다. [기획](../마케팅/PULSE_홍보_20261113/기획.md)')}\n`);
  r.올림('2026-11-14T08:00:00Z', '기록');
  const 기록 = z.기록풀기(줄들([부름('Edit', { file_path: 'C:\\Users\\q1212\\Documents\\SYNK-appsscript\\docs\\마케팅\\PULSE_홍보_20261113\\기획.md' }, '2026-11-12T09:00:00Z', 'C:\\Users\\q1212\\Documents\\SYNK-appsscript')]));
  const 결과 = z.한번({ 사건: 'SessionStart', source: 'compact', 기록, 시작때: '2026-11-12T08:30:00Z', 지금: Date.parse('2026-11-15T00:00:00Z'), 판: r.git(['rev-parse', 'HEAD']).trim(), git: r.git });
  assert.ok(결과.글);
  assert.match(결과.글, /docs\/마케팅\/PULSE_홍보_20261113/);
  assert.match(결과.글, /끝 3초 다시/);
  assert.match(결과.글, /로고는 그린다/);
});

test('곳이 없는 세션(대화만 · 다른 저장소 · 읽기만)에는 아무것도 넣지 않는다', (t) => {
  const r = 오늘판(t);
  const 기록 = z.기록풀기(줄들([부름('Read', { file_path: 'C:/Users/q1212/Documents/SYNK-talk/docs/a.md' }), 부름('Bash', { command: 'git status' }), ...Array.from({ length: 5 }, () => 부름('Read', { file_path: 'experiences/solo-backup-rust/ROADMAP.md' }))]));
  const 결과 = z.한번({ 사건: 'SessionStart', source: 'compact', 기록, 시작때: '2026-11-12T08:30:00Z', 지금: Date.parse('2026-11-15T00:00:00Z'), 판: r.git(['rev-parse', 'HEAD']).trim(), git: r.git });
  assert.equal(결과.글, null);
  assert.equal(결과.까닭, '곳 없음');
});

test('글은 상한 안에서 자르고 남은 수를 적는다(D3)', (t) => {
  const r = 오늘판(t);
  const 많은 = Array.from({ length: 80 }, (_, i) => 행('2026-11-14', `[1인 기업 업무 백업 앱 · 증분 ${i} · Claude 판단(기술)] ${'긴 결정 글 '.repeat(20)}${i}`)).join('\n');
  r.쓰기('docs/_ops/결정.md', `${fs.readFileSync(path.join(r.dir, 'docs/_ops/결정.md'), 'utf8')}${많은}\n`);
  r.올림('2026-11-14T10:00:00Z', '많은 행');
  const 결과 = z.한번(기본(r, { 사건: 'SessionStart', source: 'compact', 지금: Date.parse('2026-11-15T00:12:00Z') }));
  assert.ok([...결과.글].length <= 4000, `${[...결과.글].length}자`);
  assert.match(결과.글, /· … \d+개 더/);
  assert.match(결과.글, /A 확인서로 확정/, '트랙 줄이 결정 행보다 먼저 자리를 받는다');
});

test('넣은 주입 줄(〔지금 상태〕 첨부)을 지난 주입으로 읽는다 — 코드에 그 글자를 쓴 도구 입력은 아니다', () => {
  const 기록 = z.기록풀기(줄들([
    { type: 'attachment', timestamp: '2026-11-15T01:00:00Z', attachment: { type: 'hook_additional_context', content: ['〔지금 상태〕 …'] } },
    부름('Write', { file_path: 'tools/x.js', content: '〔지금 상태〕 글자를 코드에 쓴 것' }, '2026-11-15T02:00:00Z'),
  ]));
  assert.equal(z.세션읽기(기록).지난주입, '2026-11-15T01:00:00Z');
});

test('훅 — SYNK 밖 · 깨진 입력 · clear는 아무것도 내지 않고, 압축 뒤에는 hookSpecificOutput을 낸다. 끝 코드는 늘 0', (t) => {
  const r = 오늘판(t);
  const 상태 = fs.mkdtempSync(path.join(os.tmpdir(), '지금상태-상태-'));
  t.after(() => fs.rmSync(상태, { recursive: true, force: true }));
  const 기록파일 = path.join(상태, 's.jsonl');
  fs.writeFileSync(기록파일, `${r.기록.map((x) => x.raw).join('\n')}\n`);
  const env = { ...process.env, SYNK_지금상태뿌리: r.dir, SYNK_지금상태폴더: 상태, SYNK_지금상태_받은때검사: '0' };
  const 돌림 = (input) => spawnSync(process.execPath, [도구], { input: typeof input === 'string' ? input : j(input), encoding: 'utf8', env, timeout: 30000 });
  const 바탕 = { session_id: 's1', transcript_path: 기록파일, cwd: 'C:\\Users\\q1212\\Documents\\SYNK-appsscript', hook_event_name: 'SessionStart', source: 'compact' };
  for (const input of ['{깨짐', j(null), { ...바탕, cwd: 'C:\\Users\\q1212\\Documents\\SYNK-talk' }, { ...바탕, source: 'clear' }, { ...바탕, transcript_path: path.join(상태, '없음.jsonl') }]) {
    const p = 돌림(input);
    assert.equal(p.status, 0);
    assert.equal(p.stdout, '', String(typeof input === 'string' ? input : input.cwd));
  }
  const p = 돌림(바탕);
  assert.equal(p.status, 0);
  const 나옴 = JSON.parse(p.stdout);
  assert.equal(나옴.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(나옴.hookSpecificOutput.additionalContext, /A 확인서로 확정/);
  assert.ok(fs.existsSync(path.join(상태, 's1.json')), '상태 파일을 남긴다');
  const 기록줄 = fs.readFileSync(path.join(상태, '기록.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(기록줄.at(-1).까닭, '넣음', 'D9 훅마다 한 줄을 남긴다');
  assert.ok(기록줄.at(-1).글자 > 0);
  const 말 = 돌림({ ...바탕, hook_event_name: 'UserPromptSubmit', prompt: '이어서' });
  assert.equal(말.status, 0);
  assert.equal(말.stdout, '', '곧바로 온 새 말은 간격 안이라 기록을 읽지 않는다');
});

test('운영 사본이 30분 넘게 origin을 받지 못했으면 그 사실 한 줄만 넣는다(D9)', (t) => {
  const r = 오늘판(t);
  const 상태 = fs.mkdtempSync(path.join(os.tmpdir(), '지금상태-상태-'));
  t.after(() => fs.rmSync(상태, { recursive: true, force: true }));
  const 기록파일 = path.join(상태, 's.jsonl');
  fs.writeFileSync(기록파일, `${r.기록.map((x) => x.raw).join('\n')}\n`);
  const 받음 = path.join(r.dir, '.git', 'FETCH_HEAD');
  fs.writeFileSync(받음, '');
  const 옛 = new Date(Date.now() - 2 * 36e5);
  fs.utimesSync(받음, 옛, 옛);
  const p = spawnSync(process.execPath, [도구], { input: j({ session_id: 's2', transcript_path: 기록파일, cwd: 'C:\\Users\\q1212\\Documents\\SYNK-appsscript', hook_event_name: 'SessionStart', source: 'compact' }), encoding: 'utf8', env: { ...process.env, SYNK_지금상태뿌리: r.dir, SYNK_지금상태폴더: 상태 }, timeout: 30000 });
  assert.equal(p.status, 0);
  assert.match(JSON.parse(p.stdout).hookSpecificOutput.additionalContext, /운영 사본이 .* 뒤로 origin을 따라가지 못해/);
});

test('되짚기 — 기록의 압축 · 사람 말마다 그때의 판으로 돌린다(압축 훅은 경계 줄 앞까지만 본다)', (t) => {
  const r = 오늘판(t);
  const 파일 = path.join(r.dir, '..', `${path.basename(r.dir)}-r.jsonl`);
  t.after(() => fs.rmSync(파일, { force: true }));
  const 앞 = r.기록.slice(0, 3).map((x) => x.raw);   // 11-13 05:00 B2 행을 쓴 데까지
  앞.push(j({ type: 'system', subtype: 'compact_boundary', timestamp: '2026-11-13T10:00:00Z' }));
  앞.push(j({ type: 'user', timestamp: '2026-11-13T10:00:01Z', message: { content: 'This session is being continued from a previous conversation …' } }));
  앞.push(j({ type: 'user', timestamp: '2026-11-13T10:05:00Z', message: { content: '이어서 해' } }));
  fs.writeFileSync(파일, `${앞.join('\n')}\n`);
  const 결과 = z.되짚기(파일, { 판이름: 'master', 뿌리: r.dir });
  const 압축 = 결과.find((x) => x.사건 === '압축 뒤');
  assert.ok(압축, '11-13 10:00 압축 뒤에 넣는다');
  assert.equal(압축.판, r.곁, '그때(11-13 09:00 커밋 뒤)의 판으로 돈다');
  assert.match(압축.글, /A 확인서로 확정/);
  assert.match(압축.글, /손님용 B2 계정 준비/, '압축 앞 문맥에 쓴 행도 압축 뒤에는 넣는다');
  assert.ok(!결과.some((x) => x.사건 === '사람 말'), '압축 뒤 5분의 말은 간격 안이다');
});
