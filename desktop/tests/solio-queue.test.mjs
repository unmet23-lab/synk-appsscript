// 솔리오 「한 번에 처리」의 순위 규칙과 할 일 모으기(docs/디자인/솔리오_한번에처리_20261124/README.md 3절 · 4절). 자료는 모두 합성이다.
// 공개 저장소라 이름과 메일은 지어낸 것만 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solioQueue, solioQueueTier, solioQueueMemoPrune, solioTodoItems, solioTodoAiSay, solioTodoEndThen, QUEUE_TIER, QUEUE_LATER_MS, QUEUE_FAILED_MS } from '../renderer/solio-queue.mjs';
import { solioBackupView } from '../renderer/solio-backup-model.mjs';
import { officeState, officeReduce } from '../renderer/office-model.mjs';

const H = 3600e3, D = 24 * H;
const NOW = new Date(2026, 10, 24, 15, 0).getTime(); // 2026-11-24(화) 15:00
const keys = r => r.queue.map(i => i.key);

test('the four tiers (워크스페이스 13절): outside and due today, waiting on me, due today, then the rest', () => {
  assert.equal(solioQueueTier({ outside: true, dueAt: NOW + 8 * H }, NOW), QUEUE_TIER.outsideToday); // 오늘 23:00
  assert.equal(solioQueueTier({ outside: true, dueAt: NOW - 2 * D }, NOW), QUEUE_TIER.outsideToday, '지난 기한도 오늘 기한으로 센다');
  assert.equal(solioQueueTier({ outside: true, dueAt: NOW + 9 * H }, NOW), QUEUE_TIER.waitingOnMe, '내일 0시 기한은 오늘이 아니다');
  assert.equal(solioQueueTier({ outside: true }, NOW), QUEUE_TIER.waitingOnMe, '기한 없는 고객 일은 ②');
  assert.equal(solioQueueTier({ waiting: true, dueAt: NOW + H }, NOW), QUEUE_TIER.waitingOnMe);
  assert.equal(solioQueueTier({ dueAt: NOW + 8 * H }, NOW), QUEUE_TIER.dueToday);
  assert.equal(solioQueueTier({ dueAt: NOW - 3 * D }, NOW), QUEUE_TIER.dueToday);
  assert.equal(solioQueueTier({ dueAt: NOW + 9 * H }, NOW), QUEUE_TIER.rest, '내일 기한은 ④');
  assert.equal(solioQueueTier({}, NOW), QUEUE_TIER.rest);
});

test('inside a tier: the earlier deadline first, then the oldest, then the key; the card says why in Solio words', () => {
  const r = solioQueue([
    { key: 'rest-new', since: NOW - H },
    { key: 'rest-due', dueAt: NOW + 40 * H, since: NOW - 10 * 60e3 },
    { key: 'wait-new', waiting: true, since: NOW - 5 * 60e3 },
    { key: 'rest-old', since: NOW - 3 * D },
    { key: 'today-late', outside: true, dueAt: NOW + 6 * H },
    { key: 'wait-old', waiting: true, since: NOW - 2 * H },
    { key: 'wait-due', waiting: true, dueAt: NOW + 5 * D, since: NOW - 60e3 },
    { key: 'due-late', dueAt: NOW + 2 * H },
    { key: 'due-past', dueAt: NOW - 2 * H },
    { key: 'today-past', outside: true, dueAt: NOW - H },
    { key: 'cust', outside: true, since: NOW - 30 * H },
    { key: 'rest-b' }, { key: 'rest-a' },
  ], NOW);
  assert.deepEqual(keys(r), ['today-past', 'today-late', 'wait-due', 'cust', 'wait-old', 'wait-new', 'due-past', 'due-late', 'rest-due', 'rest-old', 'rest-new', 'rest-a', 'rest-b']);
  const why = Object.fromEntries(r.queue.map(i => [i.key, i.why]));
  assert.deepEqual([why['today-past'], why['today-late'], why.cust, why['wait-old'], why['due-past'], why['due-late'], why['rest-old']],
    ['고객이 기다립니다 · 기한 지남', '고객이 기다립니다 · 오늘까지', '고객이 기다립니다', '내 결정을 기다립니다', '기한이 지났습니다', '오늘까지입니다', '']);
  assert.deepEqual(r.queue.map(i => i.obj).slice(0, 2), ['today-past', 'today-late'], '열쇠 꼴이 아니면 대상은 열쇠 그대로다');
});

test('AI work stays out of the line, later holds an item for three hours, done items never come back, duplicates count once', () => {
  const items = [{ key: 'a', waiting: true, since: NOW - H }, { key: 'ai', ai: true, src: 'office' }, { key: 'b' }, { key: 'c' }, { key: 'a', since: 0 }];
  const r = solioQueue(items, NOW, { later: { b: NOW - H }, done: { c: NOW - D } });
  assert.deepEqual(keys(r), ['a']);
  assert.deepEqual(r.ai.map(i => i.key), ['ai']);
  assert.deepEqual(r.later.map(i => [i.key, i.back]), [['b', NOW - H + QUEUE_LATER_MS]]);
  assert.deepEqual(keys(solioQueue(items, NOW + 2 * H + 1, { later: { b: NOW - H } })), ['a', 'b', 'c'], '세 시간이 지나면 미룬 일이 다시 선다');
  assert.equal(r.queue[0].since, NOW - H, '같은 열쇠는 처음 것만 센다');
});

test('the memo keeps only live later marks and done marks younger than thirty days', () => {
  const m = solioQueueMemoPrune({ later: { a: NOW - H, b: NOW - 4 * H, c: NOW + H, d: 'x' }, done: { e: NOW - 29 * D, f: NOW - 31 * D } }, NOW);
  assert.deepEqual(m, { later: { a: NOW - H }, done: { e: NOW - 29 * D } });
  assert.deepEqual(solioQueueMemoPrune(null, NOW), { later: {}, done: {} });
});

/* 사무실 판(본체 office.snapshot의 꼴). 맡긴 일만 있고 세션은 없다(지금 실제 앱처럼) */
const office = tasks => ({ ok: true, available: true, state: { sessions: {} }, departments: [{ id: 'dq', name: '견적부' }], assignments: {}, tasking: { tasks } });
const task = extra => ({ id: 't' + Math.random().toString(16).slice(2, 8), provider: 'codex', status: 'completed', reason: '', prompt: '견적 문의 정리', createdAt: new Date(NOW - 2 * H).toISOString(), updatedAt: new Date(NOW - H).toISOString(), departmentName: '견적부', ...extra });

test('office tasks: a quote draft is a customer waiting, terminal and paused tasks wait on me, running tasks are AI work', () => {
  const draft = task({ id: 'q1', quoteSource: { parentId: 'p1', subject: '12월 행사 촬영 견적', from: '"한가람" <gaeram@example.com>', date: new Date(NOW - 26 * H).toISOString() }, quoteOutcome: 'draft', answer: '안녕하세요. 견적을 보내 드립니다.' });
  const term = task({ id: 'q2', provider: 'claude', status: 'terminal', canOpenTerminal: true, prompt: '랜딩 페이지 고치기\n둘째 줄', updatedAt: new Date(NOW - 3 * H).toISOString() });
  const paused = task({ id: 'q3', status: 'paused', prompt: '주간 보고 쓰기' });
  const running = task({ id: 'q4', status: 'running' });
  const queued = task({ id: 'q5', status: 'queued' });
  const done = task({ id: 'q6', status: 'completed', answer: '끝났습니다.' });
  const items = solioTodoItems({ office: office([draft, term, paused, running, queued, done]) }, NOW);
  const r = solioQueue(items, NOW);
  assert.deepEqual(keys(r), ['quote:q1', 'task:q2:terminal', 'task:q3:paused'], '고객이 26시간 기다린 초안이 먼저다');
  assert.deepEqual(r.queue.map(i => [i.obj, i.why]), [['task:q1', '고객이 기다립니다'], ['task:q2', '내 결정을 기다립니다'], ['task:q3', '내 결정을 기다립니다']]);
  assert.deepEqual(r.ai.map(i => i.obj), ['task:q4', 'task:q5'], 'AI 일에도 대상이 붙는다(멈춘 일을 다시 시작하면 같은 대상이 AI 쪽으로 간다)');
  assert.deepEqual(r.ai.map(i => i.key), ['task:q4', 'task:q5']);
  const [q, t, p] = r.queue;
  assert.equal(q.say, '한가람님의 견적 문의에 보낼 답장 초안이 있습니다.');
  assert.equal(q.then, '「12월 행사 촬영 견적」 · 초안을 복사해 메일에서 보내 주세요.');
  assert.deepEqual(q.acts.map(a => [a.id, a.kind]), [['copy', 'copy'], ['sent', 'mark'], ['go', 'go']]);
  assert.equal(q.acts[0].run.copy, '안녕하세요. 견적을 보내 드립니다.');
  assert.equal(t.say, '「랜딩 페이지 고치기」 일을 맡은 Claude Code 직원이 공식 터미널에서 확인을 기다립니다.');
  assert.deepEqual(t.acts[0], { id: 'terminal', label: '터미널 열기', kind: 'open', run: { task: { id: 'q2', kind: 'terminal' } } });
  assert.equal(p.say, '「주간 보고 쓰기」 일이 멈춰 있습니다.');
  assert.deepEqual(p.acts[0].run, { task: { id: 'q3', kind: 'resume' } });
  assert.equal(solioTodoAiSay(r.ai), 'AI 직원 둘이 일하고 있습니다.');
});

test('office tasks: Codex terminal results follow the office card split, and paused or stopped quote work stays a customer wait', () => {
  const member = task({ id: 'm1', status: 'interrupted', reason: 'MEMBER_RESULT', viaTerminal: true });
  const manualStop = task({ id: 'm2', status: 'interrupted', reason: 'MANUAL_RESULT', viaTerminal: true });
  const manualTerm = task({ id: 'm3', status: 'terminal', reason: 'MANUAL_RESULT', viaTerminal: true, canOpenTerminal: true });
  const legacy = task({ id: 'm4', status: 'interrupted', reason: 'UNCONFIRMED', viaTerminal: true });
  const quote = { parentId: 'p2', subject: '촬영 견적', from: '<buyer@example.com>', date: new Date(NOW - 5 * H).toISOString() };
  const qPaused = task({ id: 'm5', status: 'paused', quoteSource: quote });
  const qStopped = task({ id: 'm6', status: 'interrupted', reason: 'NO_ANSWER', quoteSource: quote });
  const qCancelled = task({ id: 'm7', status: 'interrupted', reason: 'CANCELLED', quoteSource: quote });
  const r = solioQueue(solioTodoItems({ office: office([member, manualStop, manualTerm, legacy, qPaused, qStopped, qCancelled]) }, NOW), NOW);
  assert.deepEqual(keys(r).sort(), ['quote-paused:m5', 'quote-stopped:m6', 'task:m2:manual', 'task:m3:manual'].sort(), '직원이 끝낸 일과 옛 기록은 할 일이 아니다');
  const by = Object.fromEntries(r.queue.map(i => [i.key, i]));
  assert.equal(by['task:m2:manual'].say, '「견적 문의 정리」 일의 답을 직접 붙여 넣어 보관해야 합니다.', '중단된 수기 보관도 「끝내지 못했습니다」가 아니다');
  assert.deepEqual(by['task:m3:manual'].acts.map(a => a.kind), ['go']);
  assert.equal(by['quote-paused:m5'].say, 'buyer@example.com님의 견적 답장 일이 멈춰 있습니다.');
  assert.deepEqual(by['quote-paused:m5'].acts[0], { id: 'resume', label: '다시 시작', kind: 'do', run: { task: { id: 'm5', kind: 'resume' } } });
  assert.deepEqual([by['quote-paused:m5'].obj, by['quote-stopped:m6'].obj], ['task:m5', 'task:m6']);
  assert.deepEqual(r.queue.filter(i => i.key.startsWith('quote')).map(i => i.why), ['고객이 기다립니다', '고객이 기다립니다']);
  assert.deepEqual(by['quote-stopped:m6'].acts.map(a => a.kind), ['go']);
});

test('office tasks: mailbox choice and search review wait on me and go to the office; only recent failures count; cancelled never', () => {
  const choose = task({ id: 'c1', status: 'failed', reason: 'MAIL_CHOOSE' });
  const review = task({ id: 'c2', status: 'failed', reason: 'MAIL_REVIEW', mailSearch: true });
  const recent = task({ id: 'c3', status: 'failed', reason: 'NO_ANSWER', updatedAt: new Date(NOW - 5 * H).toISOString() });
  const stale = task({ id: 'c4', status: 'interrupted', updatedAt: new Date(NOW - QUEUE_FAILED_MS - H).toISOString() });
  const cancelled = task({ id: 'c5', status: 'failed', reason: 'CANCELLED' });
  const terminalNoOpen = task({ id: 'c6', status: 'terminal', canOpenTerminal: false });
  const r = solioQueue(solioTodoItems({ office: office([choose, review, recent, stale, cancelled, terminalNoOpen]) }, NOW), NOW);
  assert.deepEqual(keys(r).sort(), ['task:c1:choose', 'task:c2:review', 'task:c3:failed', 'task:c6:terminal'].sort());
  const by = k => r.queue.find(i => i.key === k);
  assert.deepEqual(by('task:c1:choose').acts.map(a => [a.kind, a.run]), [['go', { prog: 'office', officeTask: 'c1' }]]);
  assert.equal(by('task:c3:failed').tier, QUEUE_TIER.rest);
  assert.equal(by('task:c1:choose').tier, QUEUE_TIER.waitingOnMe);
  assert.deepEqual(by('task:c6:terminal').acts.map(a => a.id), ['go'], '터미널을 열 수 없으면 사무실로 간다');
});

test('office sessions with hook news: an approval question waits on me, a finished turn is seen in place, a working session is AI work', () => {
  const M = 60e3, hook = (id, event, at, extra = {}) => ({ kind: 'hook', event, sessionId: id, cwd: 'C:\\qa\\shop', tool: 'claude', at, ...extra });
  let st = officeState();
  for (const e of [
    hook('s-ask', 'SessionStart', NOW - 30 * M), hook('s-ask', 'PostToolUse', NOW - 20 * M, { toolName: 'Bash' }), hook('s-ask', 'Notification', NOW - 4 * M, { notificationType: 'permission_prompt' }),
    hook('s-done', 'SessionStart', NOW - 30 * M), hook('s-done', 'PostToolUse', NOW - 25 * M, { toolName: 'Edit' }), hook('s-done', 'Stop', NOW - 2 * M),
    hook('s-work', 'SessionStart', NOW - 10 * M), hook('s-work', 'PostToolUse', NOW - 20e3, { toolName: 'Read' }),
  ]) st = officeReduce(st, e, { departments: [] });
  const snap = { ...office([]), state: st };
  const r = solioQueue(solioTodoItems({ office: snap }, NOW), NOW);
  assert.deepEqual(keys(r), ['ask:s-ask', 'done:s-done']);
  assert.deepEqual(r.ai.map(i => i.key), ['staff:s-work']);
  assert.equal(r.queue[0].say, 'shop 폴더의 Claude Code 직원이 승인을 기다립니다.');
  assert.equal(r.queue[0].since, NOW - 4 * M);
  assert.deepEqual(r.queue[1].acts, [{ id: 'seen', label: '확인했어요', kind: 'do', run: { office: { room: 'solio-office', act: 'row-fold', key: 'lobby' } } }]);
});

test('subscriptions: sign in again, unreadable accounts and a login deadline soon; Gemini and other-PC rows never', () => {
  const row = (id, extra) => ({ id, service: 'claude', source: 'auto', label: 'Claude', kind: 'weekly', state: 'ok', email: id + '@example.com', live: { readAt: NOW - 10 * 60e3 }, ...extra });
  const subs = { rows: [
    row('relog', { state: 'needs-login' }),
    row('broken', { service: 'gpt', label: 'GPT', state: 'error' }),
    row('soon', { loginUntil: NOW + 20 * H }),
    row('today', { loginUntil: NOW + 3 * H }),
    row('past', { loginUntil: NOW - H }),
    row('later', { loginUntil: NOW + 10 * D }),
    row('gem', { service: 'gemini', state: 'needs-login' }),
    row('away', { state: 'elsewhere' }),
    { id: 'manual', source: 'manual', label: 'Midjourney', state: 'needs-login' },
  ] };
  const r = solioQueue(solioTodoItems({ subs }, NOW), NOW);
  // 오늘 끝나거나 지난 기한은 ③, 내일 기한은 ④에서 기한이 있는 일이라 앞에 선다. 같은 때에 읽은 두 계정은 열쇠 차례
  assert.deepEqual(keys(r), ['until:past', 'until:today', 'until:soon', 'login:relog', 'read:broken']);
  assert.deepEqual(r.queue.map(i => [i.tier, i.why]), [[3, '기한이 지났습니다'], [3, '오늘까지입니다'], [4, ''], [4, ''], [4, '']], '지난 기한의 머리 줄이 본문과 어긋나지 않는다(카본 A5)');
  assert.equal(r.queue[0].say, 'Claude past 계정의 로그인 기한이 지났습니다.');
  assert.equal(r.queue[2].say, 'Claude soon 계정의 로그인 기한이 내일 오전 11시에 끝납니다.');
  assert.equal(r.queue[4].say, 'Codex broken 계정의 남은 양을 읽지 못했습니다.');
  assert.equal(r.queue[3].say, 'Claude relog 계정에 다시 로그인해야 합니다.');
  assert.deepEqual(r.queue.map(i => i.obj), ['acct:past', 'acct:today', 'acct:soon', 'acct:relog', 'acct:broken'], '상태가 바뀌어도 대상은 계정 하나다');
  assert.deepEqual(r.queue[3].acts, [{ id: 'go', label: '계정 관리 열기', kind: 'go', run: { aside: 'manage' } }]);
});

test('backup: setup and attention are one-click items that open the engine window; protected and installing are not', () => {
  const base = { ok: true, available: true };
  const setup = { ...base, view: 'no-engine', feed: { state: 'ready' } };
  const items = solioTodoItems({ backup: solioBackupView(setup, NOW), backupRaw: setup }, NOW);
  assert.equal(items.length, 1);
  assert.equal(items[0].key, 'backup:시작 전');
  assert.equal(items[0].say, '이 PC의 업무 파일은 아직 백업하지 않고 있습니다.');
  assert.deepEqual(items[0].acts.map(a => [a.label, a.kind, a.run.backup]), [['보호 시작', 'open', ['backup-start', 'protect']], ['이 PC로 옮겨 오기', 'open', ['backup-start', 'move']]]);
  const paused = { ...base, view: 'status', status: { state: 'paused', writtenAt: new Date(NOW - H).toISOString() } };
  const p = solioTodoItems({ backup: solioBackupView(paused, NOW), backupRaw: paused }, NOW);
  assert.deepEqual(p.map(i => [i.key, i.acts[0].label, i.since]), [['backup:멈춤', '엔진 창에서 다시 켜기', NOW - H]]);
  const safe = { ...base, view: 'status', status: { state: 'safe', folders: 3 } };
  assert.deepEqual(solioTodoItems({ backup: solioBackupView(safe, NOW), backupRaw: safe }, NOW), []);
  const admin = { ...base, view: 'no-engine', install: { phase: 'admin' } };
  const a = solioTodoItems({ backup: solioBackupView(admin, NOW), backupRaw: admin }, NOW);
  assert.deepEqual(a.map(i => [i.key, i.waiting, i.acts.length]), [['backup:admin', true, 0]], '관리자 확인은 사람이 「예」를 눌러야 이어진다');
  const busy = { ...base, view: 'no-engine', install: { phase: 'download', progress: 40 } };
  const b = solioTodoItems({ backup: solioBackupView(busy, NOW), backupRaw: busy }, NOW);
  assert.deepEqual(b.map(i => [i.key, i.ai]), [['backup:busy', true]]);
  assert.equal(solioTodoAiSay(b), '백업 엔진이 설치를 이어 가고 있습니다.');
  assert.equal(solioTodoAiSay([{ src: 'backup', ai: true, install: false }]), '백업 엔진이 일하고 있습니다.', '설치가 아닌 백업 중에는 설치라고 하지 않는다');
});

test('the end sentence counts what is left: skipped, held for later with the time it comes back, and AI work', () => {
  assert.equal(solioTodoEndThen({}, NOW), '');
  assert.equal(solioTodoEndThen({ skipped: 2, later: [{ back: NOW + 3 * H }], ai: [{ src: 'office' }] }, NOW), '건너뛴 일 2개가 남았습니다. 미룬 일 1개는 오늘 저녁 6시에 다시 줄에 섭니다. AI 직원 하나가 일하고 있습니다.');
});
