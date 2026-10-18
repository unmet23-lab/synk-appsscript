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
if(process.env.FAKE_MARK)fs.appendFileSync(process.env.FAKE_MARK,JSON.stringify({key:key.slice(-4),cfg:!!process.env.CLAUDE_CONFIG_DIR,args,input:input.slice(0,40)})+'\\n');
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

test('할 일이 없으면 claude를 띄우지 않는다(비용 0)', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa']]);
  try {
    const { 작업 } = 가짜작업({ async 사전확인() { return { 할일: false, 이유: '쓸 줄 없음' }; } });
    const r = await 실행기.작업돌리기('시험작업', { ...t.실행옵션, 작업, 방: path.join(t.방, 'out'), fetch: 확인200, 알림: () => {} });
    assert.equal(r.상태, '할일없음');
    assert.equal(t.실행들().length, 0);
  } finally { t.지우기(); }
});

test('첫 턴에 크레딧 부족이면 그 키를 표시하고 다음 키로 같은 요청을 다시 보낸다(키·전용 설정 폴더는 자식 환경에만)', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa'], ['B', 25, 'sk-ant-test-bbbb']]);
  try {
    const { 작업, 받은 } = 가짜작업();
    const 알림 = [];
    const r = await 실행기.작업돌리기('시험작업', { ...t.실행옵션, 작업, 방: path.join(t.방, 'out'), fetch: 확인200, 알림: (s) => 알림.push(s) });
    assert.equal(r.상태, '끝'); assert.equal(r.경로, '크레딧'); assert.equal(r.키이름, 'B'); assert.equal(r.비용, 0.42);
    const 실행 = t.실행들();
    assert.deepEqual(실행.map((x) => x.key), ['aaaa', 'bbbb']);
    assert.ok(실행.every((x) => x.cfg), '크레딧 실행은 구독 로그인 없는 전용 설정 폴더로');
    assert.equal(실행[1].input, '합성 지시문');
    assert.equal(받은.사후[0].경로, '크레딧');
    assert.equal(JSON.parse(fs.readFileSync(path.join(t.방, '상태.json'), 'utf8')).A.상태, '소진');
    const 줄 = t.기록().filter((x) => x.용도 === '시험작업');
    assert.deepEqual(줄.map((x) => [x.키이름, x.경로, x.추정USD]), [['B', '크레딧', 0.42]]);
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
    const 코드2 = await 실행기.중계(['-p', '--bare'], { ...t.실행옵션, fetch: 확인소진, 입력: '요청', 통과: false, 알림줄: (s) => 줄.push(s) });
    assert.equal(코드2, 0);
    assert.match(줄[1], /경로=구독/);
    assert.deepEqual(t.실행들()[1].args, ['-p']);
    assert.equal(t.실행들()[1].key, '');
    assert.deepEqual(t.기록().filter((x) => x.용도 === '중계').map((x) => x.경로), ['크레딧', '구독']);
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
