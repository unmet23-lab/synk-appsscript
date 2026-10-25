'use strict';

// 크레딧 실행기 — 가짜 claude(노드 스크립트)와 가짜 키만 쓴다. 실제 키 폴더·네트워크·텔레그램은 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 실행기 = require('../tools/크레딧실행.js');

const 가짜claude = `const fs=require('fs');let input='';process.stdin.on('data',d=>input+=d).on('end',()=>{
const key=process.env.ANTHROPIC_API_KEY||'';const args=process.argv.slice(2);
if(process.env.FAKE_MARK)fs.appendFileSync(process.env.FAKE_MARK,JSON.stringify({key:key.slice(-4),cfg:!!process.env.CLAUDE_CONFIG_DIR,args,input:input.slice(0,40),unattended:process.env.SYNK_UNATTENDED||null})+'\\n');
if(!key&&process.env.FAKE_LIMIT){console.log(JSON.stringify({type:'result',is_error:true,result:process.env.FAKE_LIMIT,total_cost_usd:0,num_turns:1}));process.exit(1);}
if(key.endsWith('aaaa')){console.log(JSON.stringify({type:'result',is_error:true,result:'Credit balance is too low',total_cost_usd:0,num_turns:1}));process.exit(1);}
console.log(JSON.stringify({type:'result',is_error:false,result:'{"ok":true,"key":"'+key.slice(-4)+'"}',total_cost_usd:0.42,num_turns:3,session_id:'s1'}));});`;

function 방만들기(키들) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-credit-run-'));
  const 목록 = { 키: [] };
  for (const [이름, 갱신일, 값] of 키들) { fs.writeFileSync(path.join(방, `${이름}.txt`), 값); 목록.키.push({ 이름, 키파일: `${이름}.txt`, 갱신일 }); }
  fs.writeFileSync(path.join(방, '목록.json'), JSON.stringify(목록));
  fs.writeFileSync(path.join(방, 'claude.js'), 가짜claude);
  const 이전 = { ...process.env };
  Object.assign(process.env, { SYNK_CLAUDE_KEYS: path.join(방, '목록.json'), SYNK_CLAUDE_KEY_STATE: path.join(방, '상태.json'),
    SYNK_CLAUDE_KEY_LEDGER: path.join(방, '기록.jsonl'), FAKE_MARK: path.join(방, '실행.jsonl'), SYNK_CREDIT_NO_TELEGRAM: '1' });
  return {
    방, 실행옵션: { 실행파일: process.execPath, 앞인자: [path.join(방, 'claude.js')], 설정폴더: path.join(방, 'cfg') },
    실행들: () => (fs.existsSync(path.join(방, '실행.jsonl')) ? fs.readFileSync(path.join(방, '실행.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []),
    기록: () => fs.readFileSync(path.join(방, '기록.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)),
    지우기: () => { for (const k of Object.keys(process.env)) if (!(k in 이전)) delete process.env[k]; Object.assign(process.env, 이전); fs.rmSync(방, { recursive: true, force: true }); },
  };
}
const 확인200 = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ usage: { input_tokens: 8, output_tokens: 1 } }) });
const 확인소진 = async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: { message: 'Your credit balance is too low to access the Anthropic API.' } }) });

function 가짜작업(덮개 = {}) {
  const 받은 = { 사후: [] };
  return {
    받은,
    작업: {
      모델: 'claude-opus-5-5', 구독대체: true,
      async 사전확인() { return { 할일: true, 줄: [1] }; },
      인자() { return ['-p', '--output-format', 'json']; }, // 크레딧·구독이 같은 인자 — 크레딧은 키와 전용 설정 폴더로만 갈린다
      지시문() { return '합성 지시문'; },
      async 사후(결과, 자료, ctx) { 받은.사후.push({ 글: 결과.글, 경로: ctx.경로, 키이름: ctx.키이름 }); return { 기록: 1 }; },
      ...덮개,
    },
  };
}

test('결과읽기·환경만들기: json·stream-json 결과를 읽고, 자격은 지운 뒤 크레딧 키 하나만 넣는다', () => {
  const 한덩이 = 실행기.결과읽기(JSON.stringify({ type: 'result', is_error: false, result: '답', total_cost_usd: 0.5, num_turns: 2 }));
  assert.deepEqual([한덩이.읽음, 한덩이.글, 한덩이.비용, 한덩이.턴], [true, '답', 0.5, 2]);
  const 줄들 = 실행기.결과읽기(['{"type":"system","subtype":"init"}', '{"type":"result","is_error":true,"result":"Credit balance is too low","num_turns":1}'].join('\n'));
  assert.equal(줄들.크레딧부족, true);
  assert.equal(실행기.결과읽기('엉망').읽음, false);
  const env = 실행기.환경만들기('sk-ant-test-zzzz', { PATH: 'p', ANTHROPIC_API_KEY: 'old', ANTHROPIC_BASE_URL: 'x', CLAUDE_CODE_OAUTH_TOKEN: 'o' }, 'C:/cfg');
  assert.deepEqual(env, { PATH: 'p', ANTHROPIC_API_KEY: 'sk-ant-test-zzzz', CLAUDE_CONFIG_DIR: 'C:/cfg' });
  assert.throws(() => 실행기.환경만들기('sk-ant-test-zzzz', {}), /전용 설정 폴더/);
  const 줄들인증 = 실행기.결과읽기('{"type":"system","subtype":"init","apiKeySource":"ANTHROPIC_API_KEY"}\n{"type":"result","result":"x"}');
  assert.equal(줄들인증.인증, 'ANTHROPIC_API_KEY');
  assert.deepEqual(실행기.환경만들기(null, { PATH: 'p', ANTHROPIC_API_KEY: 'old', CLAUDE_CODE_OAUTH_TOKEN: 'o' }), { PATH: 'p', CLAUDE_CODE_OAUTH_TOKEN: 'o' });
});

test('할 일이 없으면 claude를 띄우지 않고(비용 0), 15분마다 돌아도 기록 파일을 쌓지 않는다', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa']]);
  try {
    const { 작업 } = 가짜작업({ async 사전확인() { return { 할일: false, 이유: '쓸 줄 없음' }; } });
    const out = path.join(t.방, 'out');
    for (let i = 0; i < 3; i++) {
      const r = await 실행기.작업돌리기('시험작업', { ...t.실행옵션, 작업, 방: out, fetch: 확인200, 알림: () => {} });
      assert.equal(r.상태, '할일없음');
    }
    assert.equal(t.실행들().length, 0);
    assert.deepEqual(fs.readdirSync(out), ['마지막확인.json']);
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, '마지막확인.json'), 'utf8')).이유, '쓸 줄 없음');
  } finally { t.지우기(); }
});

test('팁적용안: 방금 받은 줄 뒤로 공유가 이어질 수 있으면 기다리고, 오래 기다렸거나 시각을 모르면 바로 돈다', () => {
  const { 기다릴까 } = require('../tools/크레딧작업/팁적용안.js');
  const 지금 = Date.UTC(2026, 9, 21, 9, 0, 0);
  const 분전 = (m) => 지금 - m * 60000;
  assert.equal(기다릴까([분전(3)], 지금), true, '마지막 공유 3분 뒤 — 더 올 수 있다');
  assert.equal(기다릴까([분전(12)], 지금), false, '마지막 공유 뒤 10분 넘게 조용하다');
  assert.equal(기다릴까([분전(31), 분전(2)], 지금), false, '첫 공유가 30분 넘게 기다렸다');
  assert.equal(기다릴까([분전(25), 분전(2)], 지금), true, '몰려 오는 중 — 첫 공유가 아직 30분 안');
  assert.equal(기다릴까([NaN], 지금), false, 'intake.json이 없는 줄(옛 줄)은 기다리지 않는다');
  assert.equal(기다릴까([], 지금), false);
});

// 키는 「다음 갱신일이 가장 가까운 것부터」 쓴다. 실제 시계로 돌리면 갱신일 20·25일인 A·B의 순서가 매달 20~24일에 뒤집혀
// 이 시험이 날짜 따라 빨개졌다(10-20 master CI) — 기준 시각을 고정해 넘긴다(tests/클로드키.test.js와 같은 방식).
// 지난 날로 잡아 실제 시계로 센 값과 우연히 겹치지 않게 한다(주입이 빠지면 풀림·기록 시각 단언이 늘 깨진다).
const 지금 = new Date(2025, 2, 10, 12, 0, 0); // 2025년 3월 10일 정오(이 PC 시간대) — A(20일)가 B(25일)보다 먼저 갱신된다

test('첫 턴에 크레딧 부족이면 그 키를 표시하고 다음 키로 같은 요청을 다시 보낸다(키·전용 설정 폴더는 자식 환경에만)', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa'], ['B', 25, 'sk-ant-test-bbbb']]);
  try {
    const { 작업, 받은 } = 가짜작업();
    const 알림 = [];
    const r = await 실행기.작업돌리기('시험작업', { ...t.실행옵션, 작업, 방: path.join(t.방, 'out'), fetch: 확인200, 알림: (s) => 알림.push(s), 지금 });
    assert.equal(r.상태, '끝'); assert.equal(r.경로, '크레딧'); assert.equal(r.키이름, 'B'); assert.equal(r.비용, 0.42);
    const 실행 = t.실행들();
    assert.deepEqual(실행.map((x) => x.key), ['aaaa', 'bbbb']);
    assert.ok(실행.every((x) => x.cfg), '크레딧 실행은 구독 로그인 없는 전용 설정 폴더로');
    assert.ok(실행.every((x) => x.unattended === 'credit-job:시험작업'), '사람 없는 실행 표시(텔레그램 승인 훅이 읽는다)');
    assert.equal(실행[1].input, '합성 지시문');
    assert.equal(받은.사후[0].경로, '크레딧');
    const 상태 = JSON.parse(fs.readFileSync(path.join(t.방, '상태.json'), 'utf8'));
    assert.equal(상태.A.상태, '소진');
    assert.equal(+new Date(상태.A.풀림), +new Date(2025, 2, 20), '소진 풀림도 넘긴 기준 시각으로 센다(다음 갱신일 0시)');
    const 줄 = t.기록().filter((x) => x.용도 === '시험작업');
    assert.deepEqual(줄.map((x) => [x.키이름, x.경로, x.추정USD, x.시각]), [['B', '크레딧', 0.42, 지금.toISOString()]]);
    for (const 파일 of fs.readdirSync(path.join(t.방, 'out'))) {
      if (파일.endsWith('.json')) assert.equal(fs.readFileSync(path.join(t.방, 'out', 파일), 'utf8').includes('sk-ant-test'), false);
    }
    assert.equal(fs.existsSync(path.join(t.방, 'out', '잠금')), false);
    assert.equal(알림.length, 0);
  } finally { t.지우기(); }
});

test('크레딧 키가 없으면 허용한 작업만 구독으로 돈다(키 없이 · 원래 설정 그대로)', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa']]);
  try {
    const { 작업, 받은 } = 가짜작업();
    const r = await 실행기.작업돌리기('시험작업', { ...t.실행옵션, 작업, 방: path.join(t.방, 'out'), fetch: 확인소진, 알림: () => {} });
    assert.equal(r.경로, '구독');
    const 실행 = t.실행들();
    assert.equal(실행.length, 1); assert.equal(실행[0].key, ''); assert.equal(실행[0].cfg, false, '구독 실행은 원래 설정 그대로');
    assert.equal(받은.사후[0].경로, '구독');

    const 막힘 = 가짜작업({ 구독대체: false });
    const 알림 = [];
    const r2 = await 실행기.작업돌리기('시험작업2', { ...t.실행옵션, 작업: 막힘.작업, 방: path.join(t.방, 'out2'), fetch: 확인소진, 알림: (s) => 알림.push(s) });
    assert.equal(r2.상태, '키없음');
    assert.equal(t.실행들().length, 1, '구독 대체를 허용하지 않으면 띄우지 않는다');
    assert.match(알림[0], /크레딧 키가 없어/);
  } finally { t.지우기(); }
});

test('한도읽기: 구독 사용 한도 문구에서 풀리는 시각을 읽는다(날짜가 없으면 다가오는 그 시각)', () => {
  const 읽기 = 실행기.한도읽기;
  // 10-24~25 운영 사본 기록에 찍힌 문구 그대로
  const 밤 = new Date('2026-10-24T11:46:07Z'); // 서울 10-24 20:46
  assert.equal(읽기("You've hit your weekly limit · resets Oct 26, 12pm (Asia/Seoul)", 밤).풀림.toISOString(), '2026-10-26T03:00:00.000Z');
  const 낮 = new Date('2026-10-25T05:46:09Z'); // 서울 10-25 14:46 — 오늘 정오는 지났다
  assert.equal(읽기("You've hit your weekly limit · resets 12pm (Asia/Seoul)", 낮).풀림.toISOString(), '2026-10-26T03:00:00.000Z');
  assert.equal(읽기("You've hit your session limit · resets 8:20pm (Asia/Seoul)", 낮).풀림.toISOString(), '2026-10-25T11:20:00.000Z');
  assert.equal(읽기("You've hit your session limit · resets 12am (Asia/Seoul)", 낮).풀림.toISOString(), '2026-10-25T15:00:00.000Z');
  assert.equal(읽기("You've hit your weekly limit · resets Jan 2, 9am (Asia/Seoul)", new Date('2026-12-30T00:00:00Z')).풀림.toISOString(),
    '2027-01-02T00:00:00.000Z', '12월 끝에 받은 1월 날짜는 다음 해');
  // 시간대가 없거나 모르는 이름이면 이 PC 시간대로 센다
  assert.equal(+읽기("You've hit your session limit · resets 9:00am", new Date(2026, 9, 25, 14, 46)).풀림, +new Date(2026, 9, 26, 9, 0));
  assert.equal(+읽기("You've hit your session limit · resets 3pm (Mars/Base)", new Date(2026, 9, 25, 14, 46)).풀림, +new Date(2026, 9, 25, 15, 0));
  assert.equal(읽기('Claude AI usage limit reached|1793000000', 낮).풀림.toISOString(), new Date(1793000000 * 1000).toISOString());
  assert.deepEqual(읽기("You've hit your weekly limit", 낮), { 풀림: null }, '한도지만 풀리는 시각을 모름');
  assert.equal(읽기('Credit balance is too low', 낮), null);
  assert.equal(읽기('API Error: 529 overloaded', 낮), null);
  assert.equal(읽기('', 낮), null);
});

test('구독이 사용 한도에 걸리면 풀릴 때까지 띄우지도 알리지도 않고, 풀린 뒤 다시 돈다', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa']]);
  try {
    const { 작업, 받은 } = 가짜작업();
    const out = path.join(t.방, 'out');
    const 알림 = [];
    const 돌기 = (때) => 실행기.작업돌리기('시험작업', { ...t.실행옵션, 작업, 방: out, fetch: 확인소진, 알림: (s) => 알림.push(s), 지금: 때 });
    const 밤 = new Date('2026-10-24T11:46:07Z');
    const 분뒤 = (m) => new Date(+밤 + m * 60000);
    const 한도파일 = path.join(t.방, '구독한도.json');

    process.env.FAKE_LIMIT = "You've hit your weekly limit · resets Oct 26, 12pm (Asia/Seoul)";
    const r = await 돌기(밤);
    assert.deepEqual([r.상태, r.경로, r.풀림], ['한도쉼', '구독', '2026-10-26T03:00:00.000Z']);
    assert.equal(알림.length, 1); assert.match(알림[0], /사용 한도에 걸려 .+까지 쉬어요/);
    for (const m of [15, 30, 60 * 24]) assert.equal((await 돌기(분뒤(m))).상태, '한도쉼');
    assert.equal(t.실행들().length, 1, '쉬는 동안은 claude를 띄우지 않는다');
    assert.equal(알림.length, 1, '같은 한도 알림은 한 번');
    assert.equal(fs.readdirSync(out).filter((f) => /^\d{4}-/.test(f)).length, 1, '실행 기록도 한 번만 쌓인다');
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, '마지막확인.json'), 'utf8')).상태, '한도쉼');

    // 풀릴 시각 뒤에도 한도면(시각을 못 읽는 문구) 한 시간씩 다시 쉬고, 앞 알림 뒤 12시간이 지났을 때만 다시 알린다
    process.env.FAKE_LIMIT = "You've hit your weekly limit";
    const 풀린뒤 = new Date('2026-10-26T03:01:00Z');
    assert.equal((await 돌기(풀린뒤)).풀림, '2026-10-26T04:01:00.000Z');
    assert.equal(알림.length, 2, '앞 알림(10-24 밤) 뒤 12시간이 지났다');
    assert.equal((await 돌기(new Date('2026-10-26T04:02:00Z'))).상태, '한도쉼');
    assert.equal(알림.length, 2, '한 시간 전에 알렸다 — 다시 알리지 않는다');
    assert.equal(t.실행들().length, 3);

    delete process.env.FAKE_LIMIT;
    const 끝 = await 돌기(new Date('2026-10-26T05:03:00Z'));
    assert.equal(끝.상태, '끝'); assert.equal(받은.사후.length, 1);
    assert.equal(fs.existsSync(한도파일), false, '구독이 다시 돌면 한도 표시를 지운다');
  } finally { t.지우기(); }
});

test('구독이 쉬는 동안에도 크레딧 키가 있으면 그 키로 돈다', async () => {
  const t = 방만들기([['B', 25, 'sk-ant-test-bbbb']]);
  try {
    fs.writeFileSync(path.join(t.방, '구독한도.json'), JSON.stringify({ 풀림: '2025-03-11T00:00:00.000Z', 알림: '2025-03-10T00:00:00.000Z' }));
    const { 작업 } = 가짜작업();
    const r = await 실행기.작업돌리기('시험작업', { ...t.실행옵션, 작업, 방: path.join(t.방, 'out'), fetch: 확인200, 알림: () => {}, 지금 });
    assert.deepEqual([r.상태, r.경로, r.키이름], ['끝', '크레딧', 'B']);
    assert.equal(fs.existsSync(path.join(t.방, '구독한도.json')), true, '크레딧으로 돈 것은 구독 한도가 풀렸다는 뜻이 아니다');
  } finally { t.지우기(); }
});

test('같은 작업이 겹쳐 돌지 않는다(최근 잠금이 있으면 멈춤)', async () => {
  const t = 방만들기([['B', 25, 'sk-ant-test-bbbb']]);
  try {
    const out = path.join(t.방, 'out');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, '잠금'), '{}');
    const { 작업 } = 가짜작업();
    await assert.rejects(실행기.작업돌리기('시험작업', { ...t.실행옵션, 작업, 방: out, fetch: 확인200, 알림: () => {} }), { code: '크레딧실행_겹침' });
    assert.equal(t.실행들().length, 0);
  } finally { t.지우기(); }
});

test('중계: 헤르메스 인자를 그대로 넘기고, 키가 없으면 --bare를 빼고 구독으로, 종료 코드를 돌려준다', async () => {
  const t = 방만들기([['B', 25, 'sk-ant-test-bbbb']]);
  try {
    const 줄 = [];
    const 코드 = await 실행기.중계(['-p', '--output-format', 'json', '--permission-mode', 'auto'], { ...t.실행옵션, fetch: 확인200, 입력: '요청', 통과: false, 알림줄: (s) => 줄.push(s) });
    assert.equal(코드, 0);
    assert.match(줄[0], /경로=크레딧\(B\)/);
    assert.deepEqual(t.실행들()[0].args, ['-p', '--output-format', 'json', '--permission-mode', 'auto']);
    assert.equal(t.실행들()[0].key, 'bbbb');
    const 코드2 = await 실행기.중계(['-p', '--bare'], { ...t.실행옵션, fetch: 확인소진, 입력: '요청', 통과: false, 알림줄: (s) => 줄.push(s), 지금 });
    assert.equal(코드2, 0);
    assert.match(줄[1], /경로=구독/);
    assert.deepEqual(t.실행들()[1].args, ['-p']);
    assert.equal(t.실행들()[1].key, '');
    assert.deepEqual(t.기록().filter((x) => x.용도 === '중계').map((x) => x.경로), ['크레딧', '구독']);
    assert.equal(+new Date(JSON.parse(fs.readFileSync(path.join(t.방, '상태.json'), 'utf8')).B.풀림), +new Date(2025, 2, 25), '중계도 넘긴 기준 시각으로 소진을 표시한다');
  } finally { t.지우기(); }
});

test('크레딧 전용 설정 폴더에는 유호님 설정의 autoMode·permissions만 옮긴다(훅·플러그인·모델은 안 옮김)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-credit-cfg-'));
  try {
    const 사용자 = path.join(방, 'user-settings.json');
    fs.writeFileSync(사용자, JSON.stringify({ permissions: { defaultMode: 'auto' }, autoMode: { soft_deny: ['clasp push'] }, hooks: { PreToolUse: [1] }, enabledPlugins: { a: true }, model: 'x' }));
    const 폴더 = 실행기.설정폴더준비(path.join(방, 'cfg'), 사용자);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(폴더, 'settings.json'), 'utf8')), { autoMode: { soft_deny: ['clasp push'] }, permissions: { defaultMode: 'auto' } });
    const 없음 = 실행기.설정폴더준비(path.join(방, 'cfg2'), path.join(방, '없는파일.json'));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(없음, 'settings.json'), 'utf8')), {});
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('텔레그램 승인 훅만은 크레딧 전용 설정 폴더로 옮긴다(다른 훅은 그대로 빠진다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-credit-cfg-'));
  try {
    const 승인 = { type: 'command', command: 'C:/Program Files/nodejs/node.exe', args: ['C:/repo/tools/텔레그램승인.js', '훅'], timeout: 60 };
    const 남의훅 = { type: 'command', command: 'node other-hook.js' };
    const 사용자 = path.join(방, 'user-settings.json');
    fs.writeFileSync(사용자, JSON.stringify({ autoMode: { allow: ['$defaults'] }, hooks: {
      PermissionDenied: [{ hooks: [승인, 남의훅] }], Stop: [{ hooks: [승인] }], PreToolUse: [{ matcher: 'Artifact', hooks: [남의훅] }] } }));
    const 폴더 = 실행기.설정폴더준비(path.join(방, 'cfg'), 사용자);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(폴더, 'settings.json'), 'utf8')), {
      autoMode: { allow: ['$defaults'] }, hooks: { PermissionDenied: [{ hooks: [승인] }], Stop: [{ hooks: [승인] }] } });
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});
