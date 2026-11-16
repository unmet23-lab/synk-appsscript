// 마케팅 리포트 올리기 도구(tools/마케팅리포트.js)를 실제 회사 서버 코드(createCompanyApp, 임시 SQLite, 이 PC 안에서만)에 끝까지 돌린다.
// 꼴 검사에서 걸리면 로그인하지 않는 것, 미리 보기가 쓰지 않는 것, 올리기와 덮어쓰기와 내리기, 쓰기 잠금, 권한, 고객 방까지 닿는 것을 본다.
// 견본은 모두 이 파일에서 지은 합성 자료다. 보관함의 실제 자료를 옮기지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCompanyApp } = await import(new URL('../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs', import.meta.url));
const 도구 = require('../tools/마케팅리포트.js');
const { Workspace } = require('../tools/작업실예약.js');

const 비밀번호 = '시험용-비밀번호-0123456789';
let 차례 = 0;

// ── 합성 견본 ──
const base = (kind, runId, extra) => ({ kind, version: 1, runId, title: '합성 1회차', measuredAt: { from: '2026-11-15T20:29:11Z', to: '2026-11-15T21:33:06Z' }, notes: ['읽는 법을 적은 합성 문장'], ...extra });
const memo = (runId = 'm1', extra = {}) => base('memo', runId, { headline: '한 문장 합성 결론', body: ['첫 문단'], nextActions: ['다음 달 할 일'], ...extra });
const cell = (q, s, extra = {}) => ({ q, s, answered: true, mentioned: false, cited: false, sources: [], aiBriefing: null, excerpt: '', ms: 1000, ...extra });
const aiSearch = (runId = 'a1') => base('ai-search', runId, { subject: { brand: '합성브랜드', site: 'pulse-synthetic.test' },
  services: [{ id: 'engine_a', name: '검색 가', condition: '로그아웃' }],
  questions: [{ id: 'Q01', group: '일반', lang: 'ko', text: '합성 질문 하나', branded: false }, { id: 'Q02', group: '일반', lang: 'ko', text: '합성 질문 둘', branded: false }],
  cells: [cell('Q01', 'engine_a', { mentioned: true, sources: ['video.example'] }), cell('Q02', 'engine_a', { answered: false, excerpt: '가입해야 볼 수 있어요' })] });

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '마케팅리포트-'));
  const app = createCompanyApp({ dataDir: path.join(root, 'server'), clientIntakeDir: path.join(root, 'inbox'), host: '127.0.0.1', port: 0, origin: 'http://127.0.0.1:0', allowTestHost: true,
    schedule: false, workNotificationsEnabled: false, webPushEnabled: false, synkIdentityConfig: null, synkCustomerIdentityConfig: null, pulseRequestFreeBytes: async () => 100 * 1024 ** 3 });
  const address = await app.start(), 주소 = 'http://127.0.0.1:' + address.port;
  t.after(async () => { await app.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  const person = (name, email, role, teamId) => app.store.createUser({ name, email, role, teamId, password: 비밀번호 });
  const admin = person('관리자', 'admin@pulse-synthetic.test', 'admin', null);
  const owner = person('담당자', 'owner@pulse-synthetic.test', 'member', 'team-a');
  const viewer = person('보기 전용', 'viewer@pulse-synthetic.test', 'viewer', 'team-a');
  const outsider = person('다른 팀', 'outsider@pulse-synthetic.test', 'member', 'team-b');
  const project = app.clientProjects.save(admin, { title: '합성 프로젝트 가', customerName: '합성 고객', ownerId: owner.id, dueDate: '2026-12-01' }).project;
  const 세기 = { 로그인: 0 };
  // 도구에 넘기는 시험용 연결. 실제 로그인 경로(/api/login)를 그대로 탄다.
  const 연결 = (who) => async () => { 세기.로그인++; const ws = new Workspace(app.origin, { base: 주소 }); await ws.login({ email: who.email, password: 비밀번호 }); 세기.마지막 = ws; return ws; };
  // 쓰기 잠금은 이 PC 전체에 하나다. 시험은 실제 이름을 쓰지 않고 시험마다 다른 이름을 쓴다(실제 올리기나 다른 시험 파일과 부딪히지 않게).
  const 잠금이름 = `synk-marketing-report-test-${process.pid}-${++차례}`;
  const 옵 = (who, extra = {}) => ({ 연결: 연결(who), 잠금이름, ...extra });
  const 파일 = (이름, 내용) => { const f = path.join(root, 이름); fs.writeFileSync(f, typeof 내용 === 'string' ? 내용 : JSON.stringify(내용)); return f; };
  const 저장된 = () => app.store.get('pulseMarketingIndex', project.id)?.heads || [];
  const 몸통 = (kind, runId) => app.store.get('pulseMarketingReports', `${project.id}:${kind}:${runId}`)?.report;
  return { app, 주소, root, admin, owner, viewer, outsider, project, 세기, 연결, 옵, 잠금이름, 파일, 저장된, 몸통 };
}

// 관리자 연결로 스위치를 바꾼다(도구가 아니라 서버의 설정 경로로).
async function 스위치(f, value) {
  const ws = await f.연결(f.admin)();
  await ws.post('/api/settings/pulse-features', { marketing: value });
}

test('꼴 검사에서 하나라도 걸리면 로그인도 하지 않고 아무것도 올리지 않는다', async (t) => {
  const f = await fixture(t);
  const 좋은 = f.파일('memo.json', memo());
  const 모르는칸 = f.파일('extra.json', { ...memo('m2'), 몰래: 1 });
  const 깨진 = f.파일('broken.json', '{ 이건 JSON이 아니다');
  const 같은회차 = f.파일('memo-again.json', memo('m1', { headline: '다른 결론' }));
  const 결과 = await 도구.올리기(f.project.id, [좋은, 모르는칸, 깨진, path.join(f.root, '없는파일.json'), 같은회차, f.root], f.옵(f.admin, { 실행: true }));
  assert.equal(결과.끝코드, 1);
  assert.equal(f.세기.로그인, 0, '걸림이 있으면 로그인하지 않는다');
  assert.deepEqual(결과.걸림, [
    'extra.json: 리포트의 몰래 칸을 확인해 주세요.',
    'broken.json: JSON으로 읽지 못했다',
    '없는파일.json: 파일이 없다',
    'memo-again.json: memo.json와 종류와 회차(memo:m1)가 같다',
    `${path.basename(f.root)}: 폴더다`,
  ]);
  assert.deepEqual(f.저장된(), []);
  assert.match(도구.글(결과), /꼴 검사에서 5건이 걸려 아무것도 올리지 않았다/);
});

test('걸림 글에 리포트 원문 조각과 절대 경로를 싣지 않는다', async (t) => {
  const f = await fixture(t);
  const 비밀 = '비공개-고객-원문-7391';
  // JSON.parse의 오류 글에는 깨진 자리 둘레의 원문이 실린다. 꼴 검사의 오류 글에는 칸 이름만 실린다.
  const 깨진 = f.파일('leak.json', `{"body": ${비밀} 그리고 더}`);
  const 틀린값 = f.파일('value.json', memo('m9', { headline: 비밀 + String.fromCharCode(0x202e) }));
  const 결과 = await 도구.올리기(f.project.id, [깨진, 틀린값], f.옵(f.admin, { 실행: true }));
  assert.deepEqual(결과.걸림, ['leak.json: JSON으로 읽지 못했다', 'value.json: 리포트의 headline 칸을 확인해 주세요.']);
  for (const 낸글 of [JSON.stringify(결과), 도구.글(결과)]) {
    assert.ok(!낸글.includes(비밀), '원문 조각이 없다');
    assert.ok(!낸글.includes(f.root) && !낸글.includes(f.root.replaceAll('\\', '\\\\')) && !낸글.includes(os.tmpdir()), '절대 경로가 없다');
  }
  assert.equal(f.세기.로그인, 0);
});

test('보낼 몸통이 서버의 두 상한(바이트, 글자) 가운데 하나라도 넘으면 보내기 전에 막는다', async (t) => {
  const f = await fixture(t);
  // 서버는 올린 쪽의 summary를 읽지 않고 버린다. 그래서 꼴 검사는 통과하지만 몸통은 상한을 넘는 견본을 지을 수 있다.
  const 바이트넘음 = memo('bytes', { summary: '가'.repeat(Math.ceil(도구.몸통한도.바이트 / 3) + 10) });
  const 글자넘음 = memo('chars', { summary: 'a'.repeat(도구.몸통한도.글자 + 1) });
  assert.ok(Buffer.byteLength(JSON.stringify({ report: 글자넘음 })) < 도구.몸통한도.바이트, '글자만 넘는 견본이다');
  const 읽음 = await 도구.파일읽기([f.파일('bytes.json', 바이트넘음), f.파일('chars.json', 글자넘음), f.파일('ok.json', memo('ok', { summary: '올린 쪽이 센 요약' }))]);
  assert.deepEqual(읽음.줄.map((r) => r.runId), ['ok'], 'summary가 있어도 상한 아래면 통과한다');
  assert.equal(읽음.걸림.length, 2);
  assert.match(읽음.걸림[0], /^bytes\.json: 보낼 몸통이 \d+바이트라 서버 상한 900000바이트를 넘는다$/);
  assert.match(읽음.걸림[1], /^chars\.json: 보낼 몸통이 \d+자라 서버 상한 300000자를 넘는다/);
  const 결과 = await 도구.올리기(f.project.id, [f.파일('ok.json', memo('ok')), f.파일('chars.json', 글자넘음)], f.옵(f.admin, { 실행: true }));
  assert.equal(결과.끝코드, 1); assert.equal(f.세기.로그인, 0);
  assert.deepEqual(f.저장된(), [], '뒤 파일이 걸리면 앞 파일도 올리지 않는다');
  // 서버가 실제로 그 몸통을 거절하는지 본다(미리 막는 상한이 서버와 어긋나지 않게).
  const ws = await f.연결(f.admin)();
  await assert.rejects(ws.post(`/api/client-projects/${f.project.id}/marketing/report`, { report: 글자넘음 }), (e) => e.status === 413);
});

test('미리 보기는 서버 목록까지 읽지만 쓰지 않고, --실행이 올린다. 스위치가 꺼져 있으면 고객에게 보이지 않는다고 적는다', async (t) => {
  const f = await fixture(t);
  const 파일들 = [f.파일('memo.json', memo()), f.파일('ai.json', aiSearch())];
  const 미리 = await 도구.올리기(f.project.id, 파일들, f.옵(f.admin));
  assert.equal(미리.끝코드, 0); assert.equal(미리.실행, false); assert.equal(미리.앞건수, 0); assert.equal(미리.스위치, '꺼짐');
  assert.deepEqual(미리.줄.map((r) => [r.kind, r.runId, r.한줄]), [['memo', 'm1', '한 문장 합성 결론'], ['ai-search', 'a1', '일반 질문에 받은 답 1건 가운데 합성브랜드 언급 1건']]);
  assert.deepEqual(미리.이름, { name: '합성 프로젝트 가', client: '합성 고객' });
  assert.deepEqual(f.저장된(), [], '미리 보기는 쓰지 않는다');
  assert.match(도구.글(미리), /미리 보기다\. 올리지 않았다\..*스위치 marketing이 꺼져 있어 고객에게는 보이지 않는다\./s);
  assert.ok(!('report' in 미리.줄[0]) && !('파일' in 미리.줄[0]), '결과에 리포트 몸통과 파일 경로를 싣지 않는다');

  const 올림 = await 도구.올리기(f.project.id, 파일들, f.옵(f.owner, { 실행: true }));
  assert.equal(올림.끝코드, 0, 올림.오류);
  assert.deepEqual(올림.올림, [{ kind: 'memo', runId: 'm1', 덮음: false }, { kind: 'ai-search', runId: 'a1', 덮음: false }]);
  assert.equal(올림.뒤건수, 2); assert.equal(올림.고객에게보임, false);
  // 담당자는 스위치 설정을 읽지 못한다. 그래도 리포트가 있는데 보이지 않으면 스위치가 꺼진 것이라 「모름」으로 적지 않는다.
  assert.equal(올림.스위치, '꺼짐');
  assert.match(도구.글(올림), /이제 2건이 있다\. 스위치 marketing이 꺼져 있어 고객에게는 보이지 않는다\./);
  assert.ok(!/올리는 즉시 보인다/.test(도구.글(올림)), '방금 올렸는데 「올리면 보인다」고 적지 않는다');
  assert.deepEqual(f.저장된().map((h) => `${h.kind}:${h.runId}`).sort(), ['ai-search:a1', 'memo:m1']);
  assert.equal(f.저장된().find((h) => h.kind === 'ai-search').summaryLine, 미리.줄[1].한줄, '도구가 미리 보인 한 줄과 서버가 저장한 한 줄이 같다');
  assert.equal(f.app.store.all('audit').filter((row) => row.action === 'pulse-marketing-report-saved').length, 2);
  assert.match(도구.글(올림), /2건을 올렸다\(새로 2건, 덮어쓴 것 0건\)\. 이제 2건이 있다\./);
});

test('보이는지를 틀리지 않게 적는다: 리포트가 없을 때만 스위치를 모른다고 하고, 다 올린 뒤 확인 읽기가 실패해도 올린 것을 실패로 적지 않는다', async (t) => {
  const f = await fixture(t);
  // 담당자, 리포트 0건: 스위치를 알 길이 없다.
  const 빈 = await 도구.올리기(f.project.id, [f.파일('memo.json', memo())], f.옵(f.owner));
  assert.equal(빈.스위치, '모름'); assert.match(도구.글(빈), /올라가 있는 리포트가 없어 지금은 고객에게 보이지 않는다\. 스위치 marketing이 켜져 있으면 올리는 즉시 보인다/);
  // 다 올린 뒤 마지막 목록 읽기만 실패하게 한다(목록 읽기의 두 번째 부름).
  const 끝읽기실패 = async () => { const ws = await f.연결(f.owner)(); let n = 0; const get = ws.get.bind(ws); ws.get = async (p) => { if (p.endsWith('/marketing') && ++n === 2) throw Object.assign(new Error('목록 읽기 실패(503)'), { status: 503 }); return get(p); }; return ws; };
  const 올림 = await 도구.올리기(f.project.id, [f.파일('memo.json', memo()), f.파일('memo2.json', memo('m2'))], { 연결: 끝읽기실패, 잠금이름: f.잠금이름, 실행: true });
  assert.equal(올림.끝코드, 0, 올림.오류); assert.equal(올림.오류, undefined); assert.equal(올림.뒤확인, '못 읽음');
  assert.equal(올림.올림.length, 2); assert.equal(f.저장된().length, 2);
  assert.match(도구.글(올림), /2건을 올렸다\(새로 2건, 덮어쓴 것 0건\)\. 올린 뒤 목록을 다시 읽지 못해 지금 건수는 확인하지 못했다\(저장 답은 건마다 받았다\)\. 스위치 marketing이 꺼져 있어 고객에게는 보이지 않는다\./);
  // 스위치가 꺼진 채 마지막 한 건을 내리는 미리 보기: 지금 보이지 않는 칸이 「사라진다」고 적지 않는다.
  await 도구.내리기(f.project.id, 'memo', 'm2', f.옵(f.admin, { 실행: true }));
  const 미리 = await 도구.내리기(f.project.id, 'memo', 'm1', f.옵(f.owner));
  assert.equal(미리.마지막, true); assert.equal(미리.고객에게보임, false);
  assert.match(도구.글(미리), /이 프로젝트의 마지막 리포트다\. 스위치 marketing이 꺼져 있어 지금도 고객에게는 칸이 보이지 않는다\./);
  assert.ok(!/칸이 사라진다/.test(도구.글(미리)));
});

test('같은 종류와 회차가 이미 있으면 멈추고, --덮어쓰기를 붙여야 고쳐 올린다', async (t) => {
  const f = await fixture(t);
  const 첫 = f.파일('memo.json', memo());
  assert.equal((await 도구.올리기(f.project.id, [첫], f.옵(f.admin, { 실행: true }))).끝코드, 0);
  const 앞 = f.저장된()[0];
  const 고친 = f.파일('memo-fixed.json', memo('m1', { headline: '고친 결론' }));
  const 새것 = f.파일('memo-new.json', memo('m2'));
  const 막힘 = await 도구.올리기(f.project.id, [새것, 고친], f.옵(f.admin, { 실행: true }));
  assert.equal(막힘.끝코드, 1); assert.deepEqual(막힘.겹침, ['memo:m1']); assert.match(막힘.오류, /이미 올라가 있는 회차다: memo:m1.*--덮어쓰기/);
  assert.deepEqual(막힘.올림, [], '겹치는 것이 하나라도 있으면 겹치지 않는 것도 올리지 않는다');
  assert.deepEqual(f.저장된(), [앞]);
  const 덮음 = await 도구.올리기(f.project.id, [새것, 고친], f.옵(f.admin, { 실행: true, 덮어쓰기: true }));
  assert.equal(덮음.끝코드, 0, 덮음.오류);
  assert.deepEqual(덮음.올림, [{ kind: 'memo', runId: 'm2', 덮음: false }, { kind: 'memo', runId: 'm1', 덮음: true }]);
  assert.equal(f.저장된().find((h) => h.runId === 'm1').summaryLine, '고친 결론');
  assert.equal(덮음.뒤건수, 2);
});

test('쓰기 잠금: 같은 회차를 동시에 올려도 하나만 올라가고, 진 쪽은 로그인도 하지 않으며 다시 하면 「이미 있다」로 멈춘다', async (t) => {
  const f = await fixture(t);
  const 가 = f.파일('a.json', memo('m1', { headline: '먼저 올린 결론' })), 나 = f.파일('b.json', memo('m1', { headline: '나중에 올린 결론' }));
  // 두 실행을 한꺼번에 띄운다. 잠금이 없으면 둘 다 빈 목록을 읽고 차례로 올려 뒤의 것이 앞의 것을 덮는다.
  const [하나, 둘] = await Promise.all([도구.올리기(f.project.id, [가], f.옵(f.admin, { 실행: true })), 도구.올리기(f.project.id, [나], f.옵(f.admin, { 실행: true }))]);
  const 된것 = [하나, 둘].filter((r) => r.끝코드 === 0), 진것 = [하나, 둘].filter((r) => r.끝코드 === 4);
  assert.equal(된것.length, 1, JSON.stringify([하나.오류, 둘.오류])); assert.equal(진것.length, 1);
  assert.match(진것[0].오류, /다른 마케팅 리포트 올리기나 내리기가 도는 중이다/);
  assert.equal(f.세기.로그인, 1, '진 쪽은 로그인하지 않는다');
  assert.equal(f.저장된().length, 1);
  const 남은결론 = f.몸통('memo', 'm1').headline;
  assert.equal(남은결론, 된것[0] === 하나 ? '먼저 올린 결론' : '나중에 올린 결론', '된 쪽의 내용이 그대로 남는다');
  // 진 쪽이 다시 하면 잠금은 풀려 있고, 이제는 목록에 그 회차가 있어 멈춘다.
  const 다시 = await 도구.올리기(f.project.id, [된것[0] === 하나 ? 나 : 가], f.옵(f.admin, { 실행: true }));
  assert.equal(다시.끝코드, 1); assert.match(다시.오류, /이미 올라가 있는 회차다: memo:m1/);
  assert.equal(f.몸통('memo', 'm1').headline, 남은결론, '덮이지 않았다');
  // 미리 보기와 목록은 쓰지 않으므로 잠금을 잡지 않는다: 누가 잠금을 쥐고 있어도 돈다. 쓰기는 4로 멈춘다.
  const 풀기 = await 도구.쓰기잠그기(f.잠금이름);
  try {
    assert.equal((await 도구.목록(f.project.id, f.옵(f.admin))).끝코드, 0);
    assert.equal((await 도구.내리기(f.project.id, 'memo', 'm1', f.옵(f.admin))).끝코드, 0);
    assert.equal((await 도구.내리기(f.project.id, 'memo', 'm1', f.옵(f.admin, { 실행: true }))).끝코드, 4);
    assert.equal(f.저장된().length, 1);
  } finally { await 풀기(); }
  // 실패로 끝난 실행도 잠금을 푼다.
  assert.equal((await 도구.올리기(f.project.id, [가], f.옵(f.viewer, { 실행: true, 덮어쓰기: true }))).끝코드, 1);
  assert.equal((await 도구.내리기(f.project.id, 'memo', 'm1', f.옵(f.admin, { 실행: true }))).끝코드, 0);
});

test('목록을 읽은 뒤 이 PC 밖에서 같은 회차가 올라와 덮였으면 그대로 알리고 더 올리지 않는다', async (t) => {
  const f = await fixture(t);
  // 잠금이 닿지 않는 다른 곳의 올리기를 흉내 낸다: 도구가 목록을 읽은 바로 뒤에 다른 세션이 같은 회차를 서버에 직접 올린다.
  const 끼어들기 = async () => {
    const ws = await f.연결(f.admin)(); let 끼었나 = false;
    const get = ws.get.bind(ws);
    ws.get = async (p) => { const 답 = await get(p); if (!끼었나 && p.endsWith('/marketing')) { 끼었나 = true; const 남 = await f.연결(f.owner)(); await 남.post(`/api/client-projects/${f.project.id}/marketing/report`, { report: memo('m1', { headline: '다른 곳에서 올린 결론' }) }); } return 답; };
    return ws;
  };
  const 결과 = await 도구.올리기(f.project.id, [f.파일('a.json', memo('m1')), f.파일('b.json', memo('m2'))], { 연결: 끼어들기, 잠금이름: f.잠금이름, 실행: true });
  assert.equal(결과.끝코드, 1);
  assert.match(결과.오류, /a\.json: 목록을 읽을 때는 없던 회차\(memo:m1\)가 그 사이 다른 곳에서 올라와 있었고, 이번 올리기가 그것을 덮었다\..*여기까지 1건이 올라갔고 나머지는 올리지 않았다\./);
  assert.deepEqual(결과.올림, [{ kind: 'memo', runId: 'm1', 덮음: true }]);
  assert.deepEqual(f.저장된().map((h) => h.runId), ['m1'], '뒤의 파일은 올리지 않았다');
  assert.match(도구.글(결과), /올리기 실패: a\.json: 목록을 읽을 때는 없던 회차/);
  assert.ok(!/건을 올렸다\(새로/.test(도구.글(결과)), '성공한 것처럼 적지 않는다');
});

test('내리기: 미리 보기는 지우지 않고, 마지막 리포트는 칸이 사라진다고 알리며, 없는 회차는 막는다', async (t) => {
  const f = await fixture(t);
  await 도구.올리기(f.project.id, [f.파일('memo.json', memo()), f.파일('memo2.json', memo('m2'))], f.옵(f.admin, { 실행: true }));
  await 스위치(f, true);
  const 없음 = await 도구.내리기(f.project.id, 'memo', 'none', f.옵(f.admin, { 실행: true }));
  assert.equal(없음.끝코드, 1); assert.match(없음.오류, /올라가 있지 않다\(memo:none\)/);
  const 미리 = await 도구.내리기(f.project.id, 'memo', 'm2', f.옵(f.admin));
  assert.equal(미리.끝코드, 0); assert.equal(미리.내림, false); assert.equal(미리.마지막, false); assert.equal(미리.고객에게보임, true);
  assert.equal(f.저장된().length, 2, '미리 보기는 지우지 않는다');
  const 내림 = await 도구.내리기(f.project.id, 'memo', 'm2', f.옵(f.admin, { 실행: true }));
  assert.equal(내림.끝코드, 0, 내림.오류); assert.equal(내림.내림, true); assert.equal(내림.뒤건수, 1); assert.equal(내림.고객에게보임, true);
  const 마지막 = await 도구.내리기(f.project.id, 'memo', 'm1', f.옵(f.admin));
  assert.equal(마지막.마지막, true); assert.match(도구.글(마지막), /마지막 리포트라서 내리면 고객 방에서 칸이 사라진다/);
  const 끝 = await 도구.내리기(f.project.id, 'memo', 'm1', f.옵(f.admin, { 실행: true }));
  assert.equal(끝.고객에게보임, false); assert.deepEqual(f.저장된(), []);
  assert.equal(f.app.store.all('audit').filter((row) => row.action === 'pulse-marketing-report-removed').length, 2);
});

test('권한: 보기 전용 계정은 올리지 못하고, 다른 팀 계정은 그 프로젝트를 보지 못한다', async (t) => {
  const f = await fixture(t);
  const 파일들 = [f.파일('memo.json', memo())];
  const 보기 = await 도구.올리기(f.project.id, 파일들, f.옵(f.viewer, { 실행: true }));
  assert.equal(보기.끝코드, 1); assert.match(보기.오류, /memo\.json에서 멈췄다\(앞의 0건은 올라갔다\)/);
  const 남 = await 도구.목록(f.project.id, f.옵(f.outsider));
  assert.equal(남.끝코드, 1); assert.ok(남.오류);
  assert.deepEqual(f.저장된(), []);
});

test('목록과 프로젝트 찾기, 그리고 올린 리포트가 고객 방까지 닿는다', async (t) => {
  const f = await fixture(t);
  const 찾음 = await 도구.프로젝트목록(f.옵(f.owner));
  assert.deepEqual(찾음.프로젝트.map((p) => [p.id, p.이름, p.고객]), [[f.project.id, '합성 프로젝트 가', '합성 고객']]);
  await 스위치(f, true);
  const 빈 = await 도구.올리기(f.project.id, [f.파일('ai.json', aiSearch())], f.옵(f.admin));
  assert.equal(빈.스위치, '켜짐'); assert.match(도구.글(빈), /스위치 marketing이 켜져 있다\. 리포트가 한 건이라도 올라가면 바로 그 고객에게 보인다\./);
  const 올림 = await 도구.올리기(f.project.id, [f.파일('ai.json', aiSearch())], f.옵(f.admin, { 실행: true }));
  assert.equal(올림.고객에게보임, true); assert.match(도구.글(올림), /지금 그 고객의 방에 「마케팅 성과」 칸이 보인다\./);
  const 목록 = await 도구.목록(f.project.id, f.옵(f.admin));
  assert.equal(목록.끝코드, 0); assert.equal(목록.리포트.length, 1); assert.equal(목록.고객에게보임, true);
  assert.match(도구.글(목록), /올라가 있는 리포트는 1건이다\..*AI 검색 · a1 · 합성 1회차 — 일반 질문에 받은 답 1건 가운데 합성브랜드 언급 1건/s);

  // 고객 쪽: 초대 링크로 방을 열고 같은 리포트를 읽는다.
  const row = f.app.store.get('clientProjects', f.project.id), invite = f.app.clientProjects.invite(f.admin, f.project.id, { revision: row.revision }).invite;
  const opened = await fetch(f.주소 + '/pulse/api/open', { method: 'POST', headers: { Origin: f.app.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ invite }) });
  assert.equal(opened.status, 200, await opened.clone().text());
  const cookie = (opened.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const heads = await (await fetch(f.주소 + '/pulse/api/marketing', { headers: { Cookie: cookie, Origin: f.app.origin } })).json();
  assert.deepEqual(heads.reports.map((h) => [h.kind, h.runId, h.summaryLine]), [['ai-search', 'a1', '일반 질문에 받은 답 1건 가운데 합성브랜드 언급 1건']]);
  const body = await (await fetch(f.주소 + '/pulse/api/marketing/report?kind=ai-search&run=a1', { headers: { Cookie: cookie, Origin: f.app.origin } })).json();
  assert.deepEqual(body.summary.general, { total: 2, answered: 1, mentioned: 1, cited: 0 });
});

test('스스로 로그인했으면 끝에 로그아웃하고, 받아 쓴 세션은 그대로 둔다', async (t) => {
  const f = await fixture(t);
  await 도구.목록(f.project.id, f.옵(f.admin, { 직접: true }));
  // /api/me는 로그인이 없어도 200이고 user가 비어 있다. 닫힌 세션으로는 직원 경로가 401이다.
  assert.equal((await f.세기.마지막.get('/api/me')).user, null, '직접 로그인한 세션은 끝에 닫힌다');
  await assert.rejects(f.세기.마지막.get(`/api/client-projects/${f.project.id}/marketing`), (e) => e.status === 401);
  await 도구.목록(f.project.id, f.옵(f.admin));
  assert.equal((await f.세기.마지막.get('/api/me')).user.email, f.admin.email, '받아 쓴 세션은 닫지 않는다');
});

test('쓰는 법이 틀리면 로그인하지 않고 2로 끝난다', async (t) => {
  const f = await fixture(t);
  const 조용히 = async (argv) => { const 원래 = [console.error, console.log]; const 글 = []; console.error = console.log = (...a) => 글.push(a.join(' ')); try { return [await 도구.main(argv, f.옵(f.admin)), 글.join('\n')]; } finally { [console.error, console.log] = 원래; } };
  for (const argv of [[], ['지우기', f.project.id], ['목록'], ['목록', 'not-an-id'], ['목록', f.project.id, '덤'], ['올리기', f.project.id], ['올리기', f.project.id, 'a.json', '--몰라'],
    ['내리기', f.project.id, 'memo'], ['내리기', f.project.id, 'unknown-kind', 'm1'], ['내리기', f.project.id, 'memo', '틀린 회차'], ['프로젝트', f.project.id]]) {
    const [끝, 글] = await 조용히(argv);
    assert.equal(끝, 2, `${JSON.stringify(argv)} → ${글}`); assert.match(글, /쓰는 법:/);
  }
  // main을 거치지 않고 불러 써도 프로젝트 id의 꼴이 틀리면 로그인하지 않는다.
  for (const 틀린 of ['../../settings', '', undefined, f.project.id + '/x']) {
    for (const 결과 of [await 도구.목록(틀린, f.옵(f.admin)), await 도구.올리기(틀린, [f.파일('memo.json', memo())], f.옵(f.admin, { 실행: true })), await 도구.내리기(틀린, 'memo', 'm1', f.옵(f.admin, { 실행: true }))]) {
      assert.equal(결과.끝코드, 2); assert.match(결과.오류, /프로젝트 id/);
    }
  }
  assert.equal(f.세기.로그인, 0);
  const [끝, 글] = await 조용히(['목록', f.project.id]);
  assert.equal(끝, 0, 글); assert.match(글, /올라가 있는 리포트는 0건이다/);
  const [json끝, json글] = await 조용히(['목록', f.project.id, '--json']);
  assert.equal(json끝, 0); assert.equal(JSON.parse(json글).명령, '목록');
  // main도 --실행과 --덮어쓰기를 그대로 넘긴다.
  const [올림끝] = await 조용히(['올리기', f.project.id, f.파일('memo.json', memo()), '--실행']);
  assert.equal(올림끝, 0); assert.equal(f.저장된().length, 1);
  assert.equal((await 조용히(['올리기', f.project.id, f.파일('memo.json', memo()), '--실행']))[0], 1);
  assert.equal((await 조용히(['올리기', f.project.id, f.파일('memo.json', memo()), '--실행', '--덮어쓰기']))[0], 0);
  assert.equal((await 조용히(['내리기', f.project.id, 'memo', 'm1']))[0], 0); assert.equal(f.저장된().length, 1);
  assert.equal((await 조용히(['내리기', f.project.id, 'memo', 'm1', '--실행']))[0], 0); assert.equal(f.저장된().length, 0);
});
