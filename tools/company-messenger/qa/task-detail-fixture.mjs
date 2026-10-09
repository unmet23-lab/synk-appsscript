// Disposable, loopback-only data for manual CUA inspection. Never uses live data.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createCompanyApp } from '../../../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs';

process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED = '0';
process.env.SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED = '0';
const output = process.env.MESSENGER_QA_OUTPUT ? resolve(process.env.MESSENGER_QA_OUTPUT) : resolve(dirname(fileURLToPath(import.meta.url)), '../qa-output/workday-truth-20261009');
await mkdir(output, { recursive: true });
const directory = await mkdtemp(join(tmpdir(), 'synk-task-detail-fixture-'));
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const blockedFetch = async () => { throw new Error('Fixture blocks external provider calls'); };
const app = createCompanyApp({ dataDir: directory, messengerDataDir: join(directory, 'messenger'), clientIntakeDir: join(directory, 'intake'), host: '127.0.0.1', port, origin: base, schedule: false, workNotificationsEnabled: false, webPushEnabled: false, synkIdentityConfig: null, teachingConfig: null, synkCustomerIdentityConfig: null, computerAIEnv: () => ({}), contentFetch: blockedFetch, creativeResearchFetch: blockedFetch, dailyTrendsFetch: blockedFetch, computerAIFetch: blockedFetch, messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } });
const users = {}, sessions = {}, boot = {}, tasks = [];
const fixtureDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftedDate = offset => new Date(Date.parse(fixtureDate + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
app.store.put('teams', 'qa-team', { id: 'qa-team', name: '합성 제작팀', active: true });
for (const [key, name, role] of [['admin', '검증 요청자', 'admin'], ['worker', '검증 담당자', 'member'], ['reviewer', '검증 검토자', 'member'], ['empty', '할 일 없는 검증자', 'member'], ['later', '남은 업무 검증자', 'member'], ['waiting', '검토 대기 검증자', 'member']]) {
  users[key] = app.store.createUser({ name, email: `${key}@example.test`, role, teamId: 'qa-team' });
  sessions[key] = app.store.mint('session', users[key].id, { csrfToken: `csrf-fixture-${key}` }, 120);
}
const original = app.server.listeners('request');
app.server.removeAllListeners('request');
app.server.on('request', (req, res) => {
  const url = new URL(req.url || '/', base);
  if (req.method === 'GET' && url.pathname === '/qa-entry') {
    const account = url.searchParams.get('account') || 'worker';
    if (!Object.hasOwn(sessions, account)) { res.writeHead(400); res.end('Unknown fixture account'); return; }
    res.writeHead(302, { 'Set-Cookie': `synk_company_session=${sessions[account]}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200`, Location: '/?tab=workroom', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.end(); return;
  }
  for (const listener of original) listener.call(app.server, req, res);
});
async function request(key, path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(base + path, { method, headers: { Origin: base, Cookie: `synk_company_session=${sessions[key]}`, 'X-CSRF-Token': `csrf-fixture-${key}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function fixtureTask({ title, body, creator = 'admin', assignee = 'worker', reviewer = 'reviewer', dueDate = fixtureDate, stage = 'requested' }) {
  const message = (await request(creator, `/messenger/api/channels/${room.id}/messages`, { body })).message;
  let task = (await request(creator, `/messenger/api/messages/${message.id}/task`, { title, assigneeId: boot[assignee].user.id, reviewerId: boot[reviewer].user.id, dueDate })).task;
  for (const next of (stage === 'requested' ? [] : ['accepted', ...(stage === 'accepted' ? [] : ['doing']), ...(['review', 'done'].includes(stage) ? ['review'] : []), ...(stage === 'done' ? ['done'] : [])])) {
    let resultMessageId;
    if (next === 'review') resultMessageId = (await request(assignee, `/messenger/api/channels/${room.id}/messages`, { body: `${title} 시안\n결과물과 실제 화면 확인 내용을 검토해 주세요.\n390px에서 표지와 본문이 잘 읽히는지 확인했습니다.`, replyToId: message.id })).message.id;
    task = (await request(next === 'done' ? reviewer : assignee, `/messenger/api/messages/${message.id}/task`, { revision: task.revision, stage: next, ...(resultMessageId ? { resultMessageId } : {}) }, 'PATCH')).task;
  }
  tasks.push({ title, messageId: message.id, taskId: task.id, stage: task.stage, assignee, reviewer, creator, dueDate });
}
let room;
await app.start();
try {
  for (const key of Object.keys(users)) boot[key] = await request(key, '/messenger/api/bootstrap');
  room = boot.admin.channels.find(channel => channel.systemKey === 'social');
  assert.ok(room);
  await fixtureTask({ title: '캐러셀 제작', stage: 'doing', dueDate: shiftedDate(-1), body: '캐러셀 표지와 3장 본문을 제작해 주세요.\n\n1. 표지: 학생이 실제로 막히는 한국어 표현을 0초 훅으로 제시합니다.\n2. 본문 1: 원래 문장과 자연스러운 수정 문장을 비교합니다.\n3. 본문 2: 카페에서 바로 말할 수 있는 짧은 예문 3개를 넣습니다.\n4. 본문 3: 시청자가 한 문장을 직접 바꿔 보는 연습을 넣습니다.\n5. 390px 휴대폰 화면에서 표지 제목, 본문 문장, 출처가 잘 읽히는지 확인해 주세요.\n\n완료 기준: 원고와 실제 화면 결과물을 채팅에 올리고 검토 요청 단계로 변경해 주세요. 제목이 짧아도 이 원래 요청은 전부 확인할 수 있어야 합니다.\n\n검증용 문자열 <img src=x onerror=alert(1)> 은 HTML로 실행하지 않고 문자로 표시되어야 합니다.' });
  await fixtureTask({ title: '첫 요청 확인', body: '이 요청을 읽고 담당 여부를 확인한 뒤 수락해 주세요.\n수락 후 오늘 마감의 작업 준비를 시작합니다.' });
  await fixtureTask({ title: '표지 검토 대기', body: '표지 1안을 제작하고 검토자에게 결과 메시지를 연결해 주세요.\n검토자의 답변을 기다립니다.', stage: 'review' });
  await fixtureTask({ title: '내가 검토할 결과', body: '검증 담당자는 검토자로서 이 결과물을 확인해 주세요.\n390px 제목 가독성과 문장 의미를 비교한 뒤 승인 또는 수정 요청을 선택합니다.', assignee: 'reviewer', reviewer: 'worker', stage: 'review' });
  await fixtureTask({ title: '내 요청의 진행', body: '요청자인 검증 담당자가 다른 담당자에게 맡긴 자료 정리입니다.\n진행 상황과 실제 담당자의 다음 행동이 구분되어야 합니다.', creator: 'worker', assignee: 'admin', reviewer: 'reviewer', stage: 'doing', dueDate: shiftedDate(2) });
  await fixtureTask({ title: '완료된 업무', body: '최종 승인된 업무입니다.\n승인된 결과물을 열람하되 완료 상태를 확인해 주세요.', stage: 'done' });
  await fixtureTask({ title: '미래 마감 업무', body: '수락한 업무이며 마감은 한국 시간으로 오늘부터 이틀 뒤입니다.\n오늘 해야 할 일과 남은 업무가 분리되어야 합니다.', assignee: 'later', stage: 'accepted', dueDate: shiftedDate(2) });
  await fixtureTask({ title: '기한 없는 진행 업무', body: '담당 업무를 진행 중이며 마감일은 정하지 않았습니다.\n남은 업무에는 표시하되 오늘 마감으로 표시하면 안 됩니다.', assignee: 'later', stage: 'doing', dueDate: null });
  await fixtureTask({ title: '검토자의 답변 대기', body: '결과물을 제출한 담당자이며 검토자의 답변을 기다립니다.\n오늘 당장 할 행동이 없는 검토 대기 업무를 확인합니다.', assignee: 'waiting', stage: 'review' });
  const workdays = Object.fromEntries(await Promise.all(['worker', 'empty', 'later', 'waiting'].map(async key => [key, await request(key, '/messenger/api/workday')])));
  const expected = { worker: { today: 3, remaining: 2 }, empty: { today: 0, remaining: 0 }, later: { today: 0, remaining: 2 }, waiting: { today: 0, remaining: 1 } };
  for (const [key, values] of Object.entries(expected)) { assert.ok(workdays[key].today && workdays[key].remaining, `${key} workday classification must be present`); assert.equal(workdays[key].today.total, values.today, `${key} today`); assert.equal(workdays[key].remaining.total, values.remaining, `${key} remaining`); }
  const report = { scope: 'loopback disposable company data; background jobs disabled; external providers blocked; no browser automation; no production access', date: fixtureDate, url: base + '/qa-entry', origin: base, pid: process.pid, dataDirectory: directory, source: fileURLToPath(import.meta.url), accounts: Object.entries(users).map(([key, user]) => ({ key, name: user.name, role: user.role, entry: `${base}/qa-entry?account=${key}` })), room: { id: room.id, name: room.name }, tasks, expected, workdayCounts: Object.fromEntries(Object.entries(workdays).map(([key, item]) => [key, { legacy: item.counts, today: item.today?.total, remaining: item.remaining?.total, todayCounts: item.today?.counts, remainingCounts: item.remaining?.counts }])) };
  await writeFile(join(output, 'fixture.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) { await app.stop(); throw error; }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.stop(); process.exitCode = 0; });
