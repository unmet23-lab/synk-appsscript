'use strict';

// 클라우드 실행기 — Managed Agents API를 흉내 내는 가짜 fetch만 쓴다. 실제 키·GitHub 토큰·네트워크는 쓰지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 클라우드 = require('../tools/클로드클라우드.js');

function 방만들기({ 토큰 = 'github_pat_test_123' } = {}) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-cloud-'));
  fs.writeFileSync(path.join(방, 'A.txt'), 'sk-ant-test-aaaa');
  fs.writeFileSync(path.join(방, '목록.json'), JSON.stringify({ 키: [{ 이름: 'A', 키파일: 'A.txt', 갱신일: 24 }] }));
  if (토큰) fs.writeFileSync(path.join(방, 'gh.txt'), 토큰);
  const 이전 = { ...process.env };
  Object.assign(process.env, { SYNK_CLAUDE_KEYS: path.join(방, '목록.json'), SYNK_CLAUDE_KEY_STATE: path.join(방, '상태.json'),
    SYNK_CLAUDE_KEY_LEDGER: path.join(방, '기록.jsonl'), SYNK_CLAUDE_CLOUD_STATE: path.join(방, '클라우드.json'), SYNK_GITHUB_CLOUD_TOKEN_FILE: path.join(방, 'gh.txt') });
  return { 방, 지우기: () => { for (const k of Object.keys(process.env)) if (!(k in 이전)) delete process.env[k]; Object.assign(process.env, 이전); fs.rmSync(방, { recursive: true, force: true }); } };
}

function 가짜서버({ 끝내기 = true, 대기먼저 = false } = {}) {
  const 기록 = { 요청: [], 보낸사건: [], 만든세션: null };
  let 상태조회 = 0;
  const 답 = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
  const fetch = async (url, init) => {
    const u = new URL(url); const 방법 = init.method; const body = init.body ? JSON.parse(init.body) : undefined;
    기록.요청.push([방법, u.pathname + u.search, init.headers['anthropic-beta'] || null, init.headers['x-api-key']]);
    if (u.pathname === '/v1/messages') return 답(200, { usage: { input_tokens: 8, output_tokens: 1 } });
    if (u.pathname === '/v1/environments') return 답(200, { id: 'env_1' });
    if (u.pathname === '/v1/agents') return 답(200, { id: 'agent_1', version: 3 });
    if (u.pathname === '/v1/sessions' && 방법 === 'POST') { 기록.만든세션 = body; return 답(200, { id: 'sesn_1' }); }
    if (u.pathname === '/v1/sessions/sesn_1/events' && 방법 === 'POST') { 기록.보낸사건.push(...body.events); return 답(200, {}); }
    if (u.pathname === '/v1/sessions/sesn_1' && 방법 === 'GET') {
      상태조회++;
      const 끝 = 끝내기 && 상태조회 >= 2;
      return 답(200, { id: 'sesn_1', status: 끝 || (대기먼저 && 상태조회 === 1) ? 'idle' : 'running', usage: { list_cost: { amount: '123', currency: 'USD' }, active_seconds: 600 } });
    }
    if (u.pathname === '/v1/sessions/sesn_1/events' && 방법 === 'GET') {
      // 요청을 받기 전에 남은 대기 사건 — 끝으로 세면 안 된다.
      if (대기먼저 && 상태조회 === 1) return 답(200, { data: [{ id: 'e0', type: 'session.status_idle', stop_reason: { type: 'end_turn' } }], next_page: null });
      if (!u.searchParams.get('page')) {
        return 답(200, { data: [{ id: 'e1', type: 'session.status_running' }, { id: 'e2', type: 'agent.tool_use', name: 'bash', evaluated_permission: 'ask' }], next_page: 'p2' });
      }
      const 끝 = 끝내기 && 상태조회 >= 2;
      return 답(200, { data: 끝 ? [
        { id: 'e3', type: 'agent.message', content: [{ type: 'text', text: '고쳤어요.\n```json {"branch":"claude/cloud-t1","commits":1,"tests":"3/3","unverified":""} ```' }] },
        { id: 'e4', type: 'session.status_idle', stop_reason: { type: 'end_turn' } },
      ] : [], next_page: null });
    }
    return 답(404, { error: { message: `없는 경로 ${u.pathname}` } });
  };
  return { fetch, 기록 };
}

test('세션을 만들고(저장소·예산·토큰) 사람 승인 대기 도구는 거절하며, 끝나면 claude -p 모양 결과와 브랜치·비용을 낸다', async () => {
  const t = 방만들기();
  try {
    const 서버 = 가짜서버();
    const 줄 = [];
    const r = await 클라우드.실행({ 저장소: 'synk-appsscript', 요청: '버튼 색 고쳐줘', 작업ID: 't1', 예산USD: 3, fetch: 서버.fetch, 잠깐: async () => {}, 간격: 0, 알림줄: (s) => 줄.push(s) });
    assert.equal(r.type, 'result'); assert.equal(r.is_error, false); assert.equal(r.subtype, 'success');
    assert.equal(r.session_id, 'sesn_1'); assert.equal(r.total_cost_usd, 1.23);
    assert.equal(r.cloud.브랜치, 'claude/cloud-t1'); assert.equal(r.cloud.멈춤, 'end_turn');
    assert.match(r.result, /고쳤어요/);
    // 헤르메스는 result 글만 보여 준다 — 브랜치·비용·추적 주소가 글 끝에 붙는다.
    assert.match(r.result, /\[클라우드\] 브랜치 claude\/cloud-t1 · 쓴 크레딧 \$1\.23 · 멈춤 end_turn · 추적 https:\/\/platform\.claude\.com\/\S+sesn_1$/);
    assert.equal(서버.기록.요청.filter((x) => x[0] === 'GET' && x[1].includes('/events')).length, 2, '도는 동안에는 사건 목록을 읽지 않는다');
    const 세션 = 서버.기록.만든세션;
    assert.deepEqual(세션.agent, { type: 'agent', id: 'agent_1', version: 3 });
    assert.equal(세션.environment_id, 'env_1');
    assert.equal(세션.resources[0].url, 'https://github.com/unmet23-lab/synk-appsscript');
    assert.equal(세션.resources[0].authorization_token, 'github_pat_test_123');
    assert.equal(세션.resources[0].checkout, undefined, '가지를 안 주면 저장소 기본 브랜치');
    assert.deepEqual(세션.budget, { type: 'limit', max_list_cost: { amount: '300', currency: 'USD' } });
    assert.equal(서버.기록.보낸사건[0].type, 'user.message');
    assert.match(서버.기록.보낸사건[0].content[0].text, /작업 ID: t1[\s\S]*버튼 색 고쳐줘/);
    const 거절 = 서버.기록.보낸사건.filter((e) => e.type === 'user.tool_confirmation');
    assert.equal(거절.length, 1, '같은 ask 사건은 한 번만 거절한다');
    assert.deepEqual([거절[0].tool_use_id, 거절[0].result], ['e2', 'deny']);
    assert.ok(서버.기록.요청.filter((x) => x[1].startsWith('/v1/sessions') || x[1].startsWith('/v1/agents')).every((x) => x[2] === 'managed-agents-2026-04-01'));
    assert.match(줄[0], /세션=sesn_1/);
    const 기록 = fs.readFileSync(path.join(t.방, '기록.jsonl'), 'utf8');
    assert.match(기록, /"용도":"클라우드","경로":"크레딧"/);
    for (const 글 of [기록, JSON.stringify(r), 줄.join('')]) {
      assert.equal(글.includes('github_pat_test_123'), false);
      assert.equal(글.includes('sk-ant-test'), false);
    }
    const 저장 = JSON.parse(fs.readFileSync(path.join(t.방, '클라우드.json'), 'utf8'));
    assert.equal(저장.A.agent_id, 'agent_1');
    // PC를 껐다 켜서 실행기가 사라져도 작업 ID로 같은 결과를 다시 받는다(세션을 만든 키로 · 키 확인 요청 없이 · 거절 없이).
    const 세션기록 = JSON.parse(fs.readFileSync(path.join(t.방, '클라우드_세션', 'sesn_1.json'), 'utf8'));
    assert.deepEqual([세션기록.키이름, 세션기록.작업ID, 세션기록.저장소], ['A', 't1', 'synk-appsscript']);
    assert.equal(JSON.stringify(세션기록).includes('sk-ant-test'), false);
    const 전 = 서버.기록.요청.length;
    const 다시 = await 클라우드.다시보기('t1', { fetch: 서버.fetch });
    assert.equal(다시.cloud.브랜치, 'claude/cloud-t1'); assert.match(다시.result, /고쳤어요/); assert.equal(다시.is_error, false);
    assert.equal(서버.기록.요청.slice(전).some((x) => x[1] === '/v1/messages'), false);
    assert.equal(서버.기록.보낸사건.filter((e) => e.type === 'user.tool_confirmation').length, 1);
    await assert.rejects(클라우드.다시보기('../밖', { fetch: 서버.fetch }), /세션 ID나 작업 ID/);
    // 같은 정의면 다음 실행은 에이전트·환경을 새로 만들지 않는다.
    const 서버2 = 가짜서버();
    await 클라우드.실행({ 저장소: 'SYNK-talk', 요청: '두 번째', 작업ID: 't2', 가지: 'master', fetch: 서버2.fetch, 잠깐: async () => {}, 간격: 0, 알림줄: () => {} });
    assert.equal(서버2.기록.요청.some((x) => x[1] === '/v1/agents' || x[1] === '/v1/environments'), false);
    assert.deepEqual(서버2.기록.만든세션.resources[0].checkout, { type: 'branch', name: 'master' });
  } finally { t.지우기(); }
});

test('요청을 받기 전의 대기(idle)는 끝으로 세지 않고 실제로 돈 뒤의 멈춤까지 기다린다', async () => {
  const t = 방만들기();
  try {
    const 서버 = 가짜서버({ 대기먼저: true });
    const r = await 클라우드.실행({ 저장소: 'synk-appsscript', 요청: '고쳐줘', 작업ID: 't4', fetch: 서버.fetch, 잠깐: async () => {}, 간격: 0, 알림줄: () => {} });
    assert.equal(r.is_error, false); assert.match(r.result, /고쳤어요/);
    assert.equal(서버.기록.요청.filter((x) => x[0] === 'GET' && x[1] === '/v1/sessions/sesn_1').length, 3, '대기 → 끝 확인 → 최종 조회');
  } finally { t.지우기(); }
});

test('시간을 넘기면 세션을 멈추고(user.interrupt) 실패로 낸다', async () => {
  const t = 방만들기();
  try {
    const 서버 = 가짜서버({ 끝내기: false });
    const r = await 클라우드.실행({ 저장소: 'synk-appsscript', 요청: '오래 걸리는 일', 작업ID: 't3', 시간분: 0, fetch: 서버.fetch, 잠깐: async () => {}, 간격: 0, 알림줄: () => {} });
    assert.equal(r.is_error, true); assert.equal(r.cloud.멈춤, 'timeout');
    assert.ok(서버.기록.보낸사건.some((e) => e.type === 'user.interrupt'));
  } finally { t.지우기(); }
});

test('GitHub 토큰이 없거나 모르는 저장소면 아무것도 만들지 않고 멈춘다', async () => {
  const t = 방만들기({ 토큰: null });
  try {
    const 서버 = 가짜서버();
    await assert.rejects(클라우드.실행({ 저장소: 'synk-appsscript', 요청: 'x', fetch: 서버.fetch, 잠깐: async () => {}, 간격: 0 }), /GitHub 토큰이 없다/);
    await assert.rejects(클라우드.실행({ 저장소: '없는저장소', 요청: 'x', fetch: 서버.fetch }), /모르는 저장소/);
    assert.equal(서버.기록.요청.length, 0);
  } finally { t.지우기(); }
});

test('에이전트 정의: 무인 실행 규칙(브랜치만 push·배포 금지)과 Opus 5.5·auto 권한·웹 검색 끔', () => {
  const 정의 = 클라우드.에이전트정의;
  assert.equal(정의.model, 'claude-opus-5-5');
  assert.match(정의.system, /claude\/cloud-<작업 ID>/);
  assert.match(정의.system, /master·main·기본 브랜치에 커밋·push 하지 않는다/);
  assert.equal(정의.tools[0].default_config.permission_policy.type, 'auto');
  assert.deepEqual(정의.tools[0].configs.find((c) => c.name === 'web_search'), { name: 'web_search', enabled: false });
  assert.equal(클라우드.환경정의.config.networking.type, 'limited');
  assert.equal(클라우드.끝JSON('끝\n```json {"branch":"b"} ```').branch, 'b');
  assert.equal(클라우드.끝JSON('json 없음'), null);
});
