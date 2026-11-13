'use strict';
// 편 실측(tools/편실측.js · 2026-11-13) — 한 편에 든 것을 Claude 세션 기록에서 세는 자가 뜻대로 세는지 본다.
//   실제 세션 기록(~/.claude/projects)과 정본 장부(docs/_ops/편실측.jsonl)는 건드리지 않는다 — 모두 임시 폴더의 가짜 기록 · 임시 장부(--장부)로 돌린다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 도구 = path.join(__dirname, '..', 'tools', '편실측.js');
const { 세기, 편들, 때풀기, 선 } = require(도구);
const 임시 = () => fs.mkdtempSync(path.join(os.tmpdir(), 'synk-piece-'));
const 돌리기 = (...args) => spawnSync(process.execPath, [도구, ...args], { encoding: 'utf8' });

const T0 = Date.parse('2026-11-13T00:00:00.000Z');
const 때 = (분) => new Date(T0 + 분 * 60000).toISOString();
const 사람 = (분, 글) => ({ type: 'user', timestamp: 때(분), origin: { kind: 'human' }, message: { role: 'user', content: 글 } });
const 기계 = (분, 꼴, 글) => ({ type: 'user', timestamp: 때(분), origin: { kind: 꼴 }, message: { role: 'user', content: [{ type: 'text', text: 글 }] } });
const 답 = (분, id, 출력, 도구들 = [], 더 = {}) => ({ type: 'assistant', timestamp: 때(분), ...더,
  message: { id, role: 'assistant', usage: { output_tokens: 출력, cache_read_input_tokens: 출력 * 10, cache_creation_input_tokens: 출력, input_tokens: 1 },
    content: [{ type: 'text', text: '…' }, ...도구들.map(([name, input]) => ({ type: 'tool_use', name, input }))] } });
const 결과줄 = (분) => ({ type: 'user', timestamp: 때(분), message: { role: 'user', content: [{ type: 'tool_result', content: '사람이 친 말처럼 보이는 글' }, { type: 'text', text: '덧글' }] } });
const 알림 = (분, 일, 토큰, ms) => ({ type: 'attachment', timestamp: 때(분),
  attachment: { prompt: `<task-notification>\n<task-id>${일}</task-id>\n<status>completed</status>\n<usage><subagent_tokens>${토큰}</subagent_tokens><tool_uses>3</tool_uses><duration_ms>${ms}</duration_ms></usage>\n</task-notification>` } });
const 굽기명령 = ['Bash', { command: 'python -X utf8 "C:/x/차례.py" gemini 기다리기 light "견본" && bash ./차례.sh ""' }];

function 기록쓰기(줄들) {
  const f = path.join(임시(), '00000000-aaaa-bbbb-cccc-000000000000.jsonl');
  fs.writeFileSync(f, 줄들.map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8');
  return f;
}

function 본보기() {
  return 기록쓰기([
    사람(0, '빛 견본 만들어 줘'),
    답(1, 'm1', 100, [굽기명령]),
    답(2, 'm1', 150, [['Agent', { description: '빛 견본 여섯 장 맹검', subagent_type: 'general-purpose' }]]),   // 같은 메시지의 둘째 블록 — 사용량은 한 번만
    결과줄(2),
    알림(3, 'T1', 5000, 600000),
    알림(4, 'T1', 7000, 900000),                                    // 같은 일이 다시 알림 — 마지막 값
    기계(4, 'task-notification', '<task-notification><task-id>T2</task-id><usage><subagent_tokens>1000</subagent_tokens><tool_uses>1</tool_uses><duration_ms>300000</duration_ms></usage></task-notification>'),
    답(5, 'm2', 200, [['Agent', { description: '굽기 전 지시문 검수' }], ['Bash', { command: 'node tools/미학맹검.js a.png b.png' }], ['Agent', { description: '메모 목록 줄이기' }]]),
    답(35, 'm3', 50),                                               // 30분 틈 — 일한 시간에서 빠진다
    { type: 'user', timestamp: 때(36), message: { role: 'user', content: 'This session is being continued from a previous conversation that ran out of context.' } },
    사람(40, '이어서 해'),
    답(41, 'm4', 10, [['PowerShell', { command: 'python 크레딧내기.py --꾸러미 p --실행' }], ['Bash', { command: 'grep -n "기다리기" "C:/x/차례.py"; sed -n \'1,60p\' tools/미학맹검.js' }]]),   // 읽기만 한 명령 — 세지 않는다
    답(41, 's1', 99999, [굽기명령], { isSidechain: true }),         // 곁가지 — 세지 않는다
    { type: 'user', timestamp: 때(42), isMeta: true, message: { role: 'user', content: '<system-reminder>알림</system-reminder>' } },
    기계(43, 'peer', 'Another Claude session sent a message: …'),
    답(44, 'm5', 5),
    사람(50, '고마워'),
  ]);
}

test('세는 것 — 사람 말씀 · 재개 · 압축 · 토큰(메시지 id마다 한 번) · 굽기 · 심사 · 하위 에이전트 끝 알림 · 일한 시간', async () => {
  const r = await 세기([본보기()]);
  assert.deepEqual([r.유호님_말씀, r.재개_말씀, r.압축], [3, 1, 1], '도구 결과 · 시스템 알림 · 다른 세션 글 · 압축 요약은 사람 말씀이 아니다');
  assert.deepEqual(r.토큰, { 출력: 150 + 200 + 50 + 10 + 5, 캐시읽기: (150 + 200 + 50 + 10 + 5) * 10, 캐시쓰기: 150 + 200 + 50 + 10 + 5, 입력: 5 }, '같은 메시지 id의 사용량은 마지막 줄 하나만, 곁가지는 뺀다');
  assert.deepEqual(r.굽기, { 'Gemini 그림 차례': 1, '영상 내기': 1, 합: 2 }, '곁가지의 굽기와 낱말만 닮은 grep 명령은 세지 않는다');
  assert.deepEqual(r.심사, { 하위_맹검: 1, 하위_검수: 1, 미학맹검: 1, 합: 3 });
  assert.deepEqual(r.하위_에이전트, { 부름: 3, 끝알림: 2, 토큰: 7000 + 1000, 시간: 0.3 }, '같은 일의 알림은 마지막 값(15분) + 다른 일 5분 = 20분');
  assert.equal(r.도구_호출, 7);
  assert.deepEqual([r.부터, r.까지], [때(0), 때(50)]);
  assert.equal(r.벽시계_시간, 0.8, '50분');
  // 답 줄 시각 1 · 2 · 5 · 35 · 41 · 44분 → 5분 이하 틈만: 1 + 3 + 3 = 7분 → 0.1시간
  assert.equal(r.일한_시간, 0.1);
  assert.deepEqual(r.선, [`심사 3번(선 ${선.심사})`]);
});

test('구간 — --부터 · --까지로 한 세션에서 그 편의 구간만 잰다(한국 시각 · UTC 둘 다 읽는다)', async () => {
  const f = 본보기();
  const 뒤 = await 세기([f], { 부터: T0 + 39 * 60000 });
  assert.deepEqual([뒤.유호님_말씀, 뒤.재개_말씀, 뒤.압축, 뒤.굽기.합, 뒤.심사.합, 뒤.토큰.출력], [2, 1, 0, 1, 0, 15]);
  const 앞 = await 세기([f], { 까지: T0 + 6 * 60000 });
  assert.deepEqual([앞.유호님_말씀, 앞.굽기.합, 앞.심사.합, 앞.하위_에이전트.끝알림], [1, 1, 3, 2]);
  assert.equal(때풀기('2026-11-13T09:00', '부터'), T0, '시간대가 없으면 한국 시각');
  assert.equal(때풀기('2026-11-13T00:00:00Z', '부터'), T0);
  assert.equal(때풀기('2026-11-13', '부터'), T0 - 9 * 3600000, '날짜만이면 한국 시각 0시');
  await assert.rejects(세기([f], { 부터: T0 + 999 * 60000 }), /그 구간에 기록이 없다/);
});

test('origin 칸이 없는 옛 꼴 — 글 머리로 가른다', async () => {
  const 옛 = (분, 글, 더 = {}) => ({ type: 'user', timestamp: 때(분), ...더, message: { role: 'user', content: 글 } });
  const r = await 세기([기록쓰기([옛(0, '시작해'), 답(1, 'a', 1), 옛(2, '<system-reminder>x</system-reminder>'), 옛(3, '[SYSTEM NOTIFICATION - NOT USER INPUT] …'), 옛(4, '<task-notification>…'), 옛(5, '계속 해줘'), 옛(6, '   ')])]);
  assert.deepEqual([r.유호님_말씀, r.재개_말씀], [2, 1]);
});

test('지금 — 선 안이면 끝 코드 0, 선을 넘으면 2와 먼저 알릴 것', () => {
  let r = 돌리기('지금', '--세션', 기록쓰기([사람(0, '시작'), 답(1, 'a', 10, [굽기명령])]));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /선 안이다/);
  assert.match(r.stdout, /Gemini 그림 차례 1 · 영상 내기 0/);
  const 많이 = [사람(0, '시작')];
  for (let i = 0; i < 선.굽기; i++) 많이.push(답(1 + i, `m${i}`, 10, [굽기명령]));
  r = 돌리기('지금', '--세션', 기록쓰기(많이), '--편', '시험 편');
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`⚠ 선을 넘었다 — 굽기 ${선.굽기}차례\\(선 ${선.굽기}\\)`));
  assert.match(r.stdout, /무엇을 위해 · 지금까지 든 것 · 여기서 끊으면 잃는 것/);
  assert.match(r.stdout, /편 「시험 편」/);
});

test('재기 --적기 → 임시 장부에 한 줄, 표는 같은 편의 마지막 줄을 쓴다 · 받은 것은 「받음」 폴더만', () => {
  const 장부 = path.join(임시(), '편실측.jsonl');
  const 폴더 = 임시();
  fs.mkdirSync(path.join(폴더, '받음', '옛'), { recursive: true });
  for (const f of ['받음/a.png', '받음/b.JPG', '받음/c.mp4', '받음/옛/d.webp', '받음/글.txt', '밖.png']) fs.writeFileSync(path.join(폴더, f), 'x');
  const f = 본보기();
  let r = 돌리기('재기', '--편', '빛 견본', '--세션', f, '--폴더', 폴더, '--단계', '이미지', '--장르', '향수 · 뷰티', '--결과', '여섯 장', '--적기', '--장부', 장부, '--때', '2026-11-13T01:00:00.000Z');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /받은 그림 3 · 영상 1\(받음 폴더\)/);
  assert.match(r.stdout, /장부에 적음/);
  r = 돌리기('재기', '--편', '빛 견본', '--세션', f, '--부터', '2026-11-13T09:39', '--결과', '다시 잼', '--적기', '--장부', 장부, '--json');
  assert.equal(r.status, 0, r.stderr);
  const 줄들 = fs.readFileSync(장부, 'utf8').trim().split('\n').map((x) => JSON.parse(x));
  assert.equal(줄들.length, 2, '덧붙이기만 한다');
  assert.deepEqual([줄들[0].편, 줄들[0].단계, 줄들[0].장르, 줄들[0].결과, 줄들[0].세션, 줄들[0].받은것.그림], ['빛 견본', '이미지', '향수 · 뷰티', '여섯 장', ['00000000'], 3]);
  assert.ok(!JSON.stringify(줄들).includes('이어서 해') && !JSON.stringify(줄들).includes('만들어 줘'), '말씀의 내용은 적지 않는다');
  assert.deepEqual(편들(줄들).map((e) => e.결과), ['다시 잼']);
  r = 돌리기('표', '--장부', 장부);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /빛 견본 \| 0\.2 · 0\.1 \| 2\(1\) \| 1 \| 0 \| 15 \| 다시 잼/, '뒤 구간의 답 줄 41 · 44분 → 3분 = 0.1시간(반올림)');
  assert.match(돌리기('표', '--장부', path.join(임시(), '없음.jsonl')).stdout, /적힌 편이 없다/);
});

test('받지 않음 — 빠진 칸 · 없는 기록 · 모르는 선택은 끝 코드 1', () => {
  const f = 본보기();
  for (const [args, 글] of [
    [['지금'], /--세션이 없다/],
    [['재기', '--세션', f], /--편이 없다/],
    [['지금', '--세션', path.join(임시(), '없음.jsonl')], /세션 기록이 없다/],
    [['지금', '--세션', f, '--몰라', 'x'], /모르는 선택: --몰라/],
    [['지금', '--세션', f, '--부터'], /--부터 뒤에 값이 없다/],
    [['지금', '--세션', f, '--부터', '어제'], /--부터을 못 읽었다/],
    [['재기', '--편', 'x', '--세션', f, '--폴더', path.join(임시(), '없는폴더')], /--폴더가 없다/],
  ]) {
    const r = 돌리기(...args);
    assert.equal(r.status, 1, `${args.join(' ')} → ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, 글);
  }
  assert.equal(돌리기().status, 0, '명령 없이 부르면 쓰는 법');
  assert.match(돌리기().stdout, /편 실측 — 한 편에 든 것/);
});
