import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SCENARIOS, MAX_SESSIONS, MAX_IMPORT_BYTES, createSession, appendTurn, getTurn, retryTurn, stuckTurn, followupQuestion, archive, parseArchive, validateArchive, firstSentenceFrom } from '../domain.mjs';
const require = createRequire(import.meta.url);
const Ask = require('../../../atlas/ask.js');
const fresh = (scenario='interview', id='session-1') => createSession({ scenario, counterpart:'직장 동료', goal:'필요한 도움을 분명히 전하기', id, at:'2026-10-05T00:00:00.000Z' });
const complete = (scenario='interview', focus='specific', id='session-1') => {
  let session=fresh(scenario,id);
  for(let i=0;i<3;i++) session=appendTurn(session,{answer:`내가 작성한 답변 ${i}`,review:i===1?'stuck':'easy',focus});
  return session;
};

test('each scenario runs three authored turns and selected branch changes actual second prompt',()=>{
  for(const scenario of Object.keys(SCENARIOS)){
    const variants=['specific','concise','pressure'].map(focus=>complete(scenario,focus));
    assert.equal(new Set(variants.map(s=>SCENARIOS[scenario].turns[s.turns[1].id].prompt)).size,3);
    for(const s of variants){assert.deepEqual(s.turns.map(t=>t.id),['opening',s.focus,'close']);assert.throws(()=>appendTurn(s,{answer:'더',review:'easy'}));assert.doesNotThrow(()=>validateArchive(archive([s])));}
  }
});
test('canonical Core asks a question only when its choices change the next authored branch',()=>{
  for(const review of ['easy','unsure','stuck']){
    const chosen=followupQuestion(Ask,fresh(),review);
    assert.equal(chosen.status,'ask');assert.equal(chosen.question.id,'focus');
    assert.equal(chosen.ranked.find(q=>q.id==='pace').skippable,true);
    assert.equal(new Set(Object.values(chosen.ranked[0].outcomes).map(outcome=>outcome.content)).size,3);
  }
});
test('focus is locked after turn one so a session cannot export a mismatched branch',()=>{
  const first=appendTurn(fresh(),{answer:'답변',review:'stuck',focus:'concise'});
  assert.throws(()=>appendTurn(first,{answer:'다른 말',review:'easy',focus:'pressure'}),/중간에 바꿀/);
  const second=appendTurn(first,{answer:'짧은 말',review:'easy'});
  assert.equal(second.turns[1].id,'concise');
  assert.equal(getTurn(second).id,'close');
});
test('retry preserves original and recommendation follows declared post-retry feeling',()=>{
  const original=complete();
  assert.equal(stuckTurn(original),1);
  const retry=retryTurn(original,1,'더 분명하게 말한 문장','easy');
  assert.equal(retry.turns[1].answer,original.turns[1].answer);
  assert.equal(original.turns[1].retry,'');
  assert.equal(stuckTurn(retry),-1);
  assert.throws(()=>retryTurn(original,-1,'답변','easy'));
  assert.throws(()=>retryTurn(original,1,'','stuck'));
});
test('archive roundtrips unicode, XSS-looking text as plain data, and bounded worst case',()=>{
  const list=Array.from({length:MAX_SESSIONS},(_,i)=>{
    const s=complete('request','specific',`item-${i}`);
    s.counterpart='가'.repeat(80);s.goal='가'.repeat(240);s.firstSentence='가'.repeat(600);s.takeaway='가'.repeat(600);
    s.turns=s.turns.map(turn=>({...turn,answer:'가'.repeat(2000),retry:'가'.repeat(2000),retryReview:'easy'}));return s;
  });
  // 2026-10-14: 30회 한도에서 최악 분량은 다 담지 못한다. 최근 기록부터 내보내기 500000 bytes 안에 드는 만큼만 남긴다.
  const text=JSON.stringify(archive(list),null,2);
  assert.ok(Buffer.byteLength(text)<=MAX_IMPORT_BYTES);
  const kept=parseArchive(text).sessions;
  assert.ok(kept.length>=10&&kept.length<MAX_SESSIONS,String(kept.length));
  assert.deepEqual(kept.map(s=>s.id),list.slice(0,kept.length).map(s=>s.id));
  const xss=complete();xss.firstSentence='<img src=x onerror=alert(1)>';
  assert.equal(parseArchive(JSON.stringify(archive([xss]))).sessions[0].firstSentence,xss.firstSentence);
  xss.firstSentence=firstSentenceFrom('가'.repeat(599)+'😀');
  assert.equal(xss.firstSentence,'가'.repeat(599));
  assert.doesNotThrow(()=>archive([xss]));
});
test('imports reject invalid schema, unknown/prototype fields, oversized data and foreign scenario branches',()=>{
  const good=archive([complete()]);
  for(const mutate of [a=>a.schema=3,a=>a.schema="2",a=>a.unknown=true,a=>a.sessions[0].scenario='unknown',a=>a.sessions[0].turns[1].id='pressure',a=>a.sessions[0].turns[0].review='AI:99',a=>a.sessions[0].turns[0].answer='\u0000',a=>a.sessions[0].turns[0].answer='\ud800',a=>a.sessions[0].turns[0].extra=true,a=>a.sessions.push(a.sessions[0])]){
    const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateArchive(bad));
  }
  assert.throws(()=>parseArchive(JSON.stringify(good).replace('"schema":2','"schema":2,"__proto__":{}')));
  assert.throws(()=>parseArchive('{broken'));
  assert.throws(()=>parseArchive('x'.repeat(MAX_IMPORT_BYTES+1)));
});

// ── schema 2 (2026-10-14): 강도·만약-그러면 계획·실제 대화 날짜·돌아보기·말한 시간 ──────────────
import { SCHEMA, keepSessions, setPlan, setRealDate, recordOutcome, pendingFollowups, continueFrom, MAX_SPOKEN_SECONDS } from '../domain.mjs';
import { validatePersonalState } from '../../synk-account/src/personal-data.mjs';
import { analyzeAnswer } from '../coach.mjs';

const SCHEMA1_SESSION_KEYS = ['id','at','scenario','counterpart','goal','practice','focus','turns','firstSentence','takeaway'];
const SCHEMA1_TURN_KEYS = ['id','answer','review','retry','retryReview'];
const asSchema1 = session => {
  const out = Object.fromEntries(Object.entries(session).filter(([key]) => SCHEMA1_SESSION_KEYS.includes(key)));
  out.turns = session.turns.map(turn => Object.fromEntries(Object.entries(turn).filter(([key]) => SCHEMA1_TURN_KEYS.includes(key))));
  return out;
};
function rich(id = 'rich', scenario = 'request') {
  let s = createSession({ scenario, practice: scenario === 'request' ? { counterpart: 'manager', goal: 'deadline' } : undefined, intensity: 'tough', counterpart: '팀장님', goal: '마감 하루 미루기', id, at: '2026-10-14T01:00:00.000Z' });
  s = appendTurn(s, { answer: '표 정리까지 끝났고 금요일 오전까지 조정을 상의드리고 싶어요.', review: 'unsure', focus: 'pressure', mode: 'voice', seconds: 42 });
  s = appendTurn(s, { answer: '마감이 고정이라면 범위를 줄이는 방법이 있어요.', review: 'stuck', mode: 'text' });
  s = appendTurn(s, { answer: '그럼 목요일에 중간본을 먼저 드릴게요.', review: 'easy', mode: 'voice', seconds: 18 });
  s = retryTurn(s, 1, '마감이 고정이라면 핵심 표 두 개만 먼저 드려도 될까요?', 'easy', { mode: 'voice', seconds: 25 });
  s = setPlan(s, { ifThey: ' 마감은 못 바꾼다고 하면 ', iWill: '범위를 줄이는 안을 바로 꺼낸다' });
  s = setRealDate(s, '2026-10-20');
  return recordOutcome(s, { did: 'yes', usedFirst: true, reaction: 'mixed', note: '기한을 먼저 말하니 대화가 빨라졌다.', at: '2026-10-20T09:00:00.000Z' });
}

test('schema 1 archives are read exactly as stored and still replay; schema 1 cannot carry new fields', () => {
  const legacy = asSchema1(complete('refusal', 'pressure', 'legacy-1'));
  const stored = { schema: 1, savedAt: '2026-10-08T00:00:00.000Z', sessions: [legacy] };
  assert.deepEqual(validateArchive(stored), stored);
  assert.deepEqual(parseArchive(JSON.stringify(stored, null, 2)), stored);
  assert.equal(getTurn(legacy, 1).prompt, SCENARIOS.refusal.turns.pressure.prompt);
  const upgraded = archive([legacy]);
  assert.equal(upgraded.schema, SCHEMA); assert.equal(SCHEMA, 2);
  assert.deepEqual(upgraded.sessions[0], legacy);
  assert.deepEqual(validatePersonalState('rehearsal', stored), stored);
  for (const mutate of [s => s.intensity = 'normal', s => s.plan = null, s => s.turns[0].mode = 'text', s => s.turns[0].seconds = null]) {
    const bad = structuredClone(stored); mutate(bad.sessions[0]); assert.throws(() => validateArchive(bad));
  }
});

test('schema 2 strength, plan, real date, reflection and spoken seconds survive JSON, device and account validation', () => {
  const s = rich();
  assert.deepEqual(s.plan, { ifThey: '마감은 못 바꾼다고 하면', iWill: '범위를 줄이는 안을 바로 꺼낸다' });
  assert.deepEqual(s.turns.map(t => [t.mode, t.seconds, t.retryMode, t.retrySeconds]), [['voice', 42, null, null], ['text', null, 'voice', 25], ['voice', 18, null, null]]);
  const data = archive([s, asSchema1(complete('interview', 'specific', 'legacy-in-v2'))]);
  const restored = parseArchive(JSON.stringify(data, null, 2));
  assert.deepEqual(restored, data);
  assert.deepEqual(validatePersonalState('rehearsal', data), data);
  assert.equal(restored.sessions[0].outcome.reaction, 'mixed');
  for (const turn of restored.sessions[0].turns) assert.ok(!Object.keys(turn).some(key => /audio|blob|record|sound/i.test(key)));
});

test('invalid schema 2 values are rejected by the shared validator (device, file and account alike)', () => {
  const good = archive([rich()]);
  const outcome = good.sessions[0].outcome;
  const mutations = [
    s => s.intensity = 'hard', s => s.intensity = null,
    s => s.plan = { ifThey: '만약' }, s => s.plan = { ifThey: '만약', iWill: '나는', extra: 1 }, s => s.plan = { ifThey: '', iWill: '  ' }, s => s.plan = { ifThey: '가'.repeat(201), iWill: '' }, s => s.plan = '계획', s => s.plan = { ifThey: '\u0000', iWill: '나는' },
    s => s.realAt = '2026-02-30', s => s.realAt = '2026/10/14', s => s.realAt = '2026-10-14T00:00:00Z', s => s.realAt = '',
    s => s.outcome = { ...outcome, did: 'maybe' }, s => s.outcome = { ...outcome, did: 'no' }, s => s.outcome = { ...outcome, did: 'later', reaction: null },
    s => s.outcome = { ...outcome, usedFirst: 'yes' }, s => s.outcome = { ...outcome, reaction: 'angry' }, s => s.outcome = { ...outcome, note: '가'.repeat(601) }, s => s.outcome = { ...outcome, at: 'never' },
    s => s.outcome = { ...outcome, score: 3 }, s => { delete s.outcome.note; },
    s => s.turns[0].mode = 'audio', s => s.turns[0].mode = null, s => s.turns[0].seconds = MAX_SPOKEN_SECONDS + 1, s => s.turns[0].seconds = 1.5, s => s.turns[0].seconds = -1, s => s.turns[0].seconds = '30',
    s => s.turns[1].seconds = 30, s => { s.turns[2].retryMode = 'voice'; }, s => { s.turns[1].retryMode = 'audio'; }, s => { s.turns[2].retrySeconds = 10; s.turns[2].retryMode = null; }, s => { s.turns[1].retrySeconds = 10; s.turns[1].retryMode = 'text'; },
    s => s.turns[0].audio = 'blob:local',
  ];
  for (const [index, mutate] of mutations.entries()) {
    const bad = structuredClone(good); mutate(bad.sessions[0]);
    assert.throws(() => validateArchive(bad), undefined, `mutation ${index}`);
    assert.throws(() => validatePersonalState('rehearsal', bad), undefined, `account mutation ${index}`);
  }
  // did 'later'·'no'는 첫 문장·반응 없이도 맞는 기록이다.
  const later = structuredClone(good); later.sessions[0].outcome = { did: 'later', usedFirst: null, reaction: null, note: '', at: '2026-10-21T00:00:00.000Z' };
  assert.doesNotThrow(() => validateArchive(later));
});

test('session helpers trim input and refuse impossible plan, date or reflection combinations without mutating', () => {
  const base = complete('apology', 'pressure', 'helpers');
  const snapshot = structuredClone(base);
  assert.equal(setPlan(base, { ifThey: '', iWill: '' }).plan, null);
  assert.equal(setPlan(base, null).plan, null);
  assert.deepEqual(setPlan(base, { iWill: ' 방법 하나를 말한다 ' }).plan, { ifThey: '', iWill: '방법 하나를 말한다' });
  for (const plan of [{ ifThey: '가'.repeat(201) }, { other: '값' }, [], '계획', { ifThey: 1 }]) assert.throws(() => setPlan(base, plan));
  assert.equal(setRealDate(base, '2026-10-20').realAt, '2026-10-20');
  for (const empty of ['', null, undefined]) assert.equal(setRealDate(base, empty).realAt, null);
  for (const date of ['2026-13-01', '20261020', '2026-10-20T00:00', 20261020]) assert.throws(() => setRealDate(base, date));
  const at = '2026-10-21T00:00:00.000Z';
  assert.deepEqual(recordOutcome(base, { did: 'yes', usedFirst: false, reaction: 'hard', note: ' 다음엔 방법부터 ', at }).outcome, { did: 'yes', usedFirst: false, reaction: 'hard', note: '다음엔 방법부터', at });
  assert.deepEqual(recordOutcome(base, { did: 'later', at }).outcome, { did: 'later', usedFirst: null, reaction: null, note: '', at });
  for (const input of [{ did: 'no', reaction: 'good', at }, { did: 'no', usedFirst: true, at }, { did: 'yes', usedFirst: 'true', at }, { did: 'yes', reaction: 'great', at }, { did: 'perhaps', at }, { did: 'yes', note: '가'.repeat(601), at }, { did: 'yes', at: 'never' }]) assert.throws(() => recordOutcome(base, input), undefined, JSON.stringify(input));
  assert.throws(() => recordOutcome(fresh('apology'), { did: 'yes', at }));
  assert.deepEqual(base, snapshot);
});

test('turns keep spoken time only for voice answers; recordings themselves are never part of a turn', () => {
  const start = fresh('feedback', 'voice');
  const turn = appendTurn(start, { answer: '지난주 회의에서 봤어요.', review: 'easy', focus: 'concise', mode: 'voice', seconds: 42 }).turns[0];
  assert.deepEqual(Object.keys(turn), ['id', 'answer', 'review', 'retry', 'retryReview', 'mode', 'seconds', 'retryMode', 'retrySeconds']);
  assert.deepEqual([turn.mode, turn.seconds], ['voice', 42]);
  const typed = appendTurn(start, { answer: '글로 답해요.', review: 'easy', focus: 'concise' }).turns[0];
  assert.deepEqual([typed.mode, typed.seconds], ['text', null]);
  for (const extra of [{ mode: 'text', seconds: 10 }, { mode: 'audio' }, { mode: 'voice', seconds: MAX_SPOKEN_SECONDS + 1 }, { mode: 'voice', seconds: 2.5 }, { mode: 'voice', seconds: -3 }]) assert.throws(() => appendTurn(start, { answer: '답', review: 'easy', focus: 'concise', ...extra }), undefined, JSON.stringify(extra));
  let done = start; for (let i = 0; i < 3; i++) done = appendTurn(done, { answer: `답 ${i}`, review: 'stuck', focus: 'concise', mode: 'voice', seconds: 10 + i });
  const retried = retryTurn(done, 2, '다시 말한 답', 'easy', { mode: 'voice', seconds: 9 });
  assert.deepEqual([retried.turns[2].mode, retried.turns[2].seconds, retried.turns[2].retryMode, retried.turns[2].retrySeconds], ['voice', 12, 'voice', 9]);
  const typedRetry = retryTurn(done, 0, '글로 다시', 'easy').turns[0];
  assert.deepEqual([typedRetry.retryMode, typedRetry.retrySeconds], ['text', null]);
  assert.throws(() => retryTurn(done, 0, '다시', 'easy', { mode: 'text', seconds: 3 }));
});

test('pendingFollowups lists past real-conversation dates still waiting for a reflection, oldest first', () => {
  const at = '2026-10-01T00:00:00.000Z';
  const make = (id, realAt, outcome) => { let s = complete('request', 'pressure', id); if (realAt) s = setRealDate(s, realAt); if (outcome) s = recordOutcome(s, outcome); return s; };
  const sessions = [
    make('A', '2026-10-10'), make('B', '2026-10-14'), make('C', '2026-10-12', { did: 'yes', at }), make('D', '2026-10-09'), make('E', null),
    make('F', '2026-10-11', { did: 'later', at: '2026-10-12T03:00:00.000Z' }),
    setRealDate(make('G', '2026-10-08', { did: 'later', at: '2026-10-09T01:00:00.000Z' }), '2026-10-13'),
    setRealDate(fresh('request', 'unfinished'), '2026-10-01'),
  ];
  assert.deepEqual(pendingFollowups(sessions, '2026-10-14').map(s => s.id), ['D', 'A', 'G']);
  assert.deepEqual(pendingFollowups(sessions, '2026-10-09').map(s => s.id), []);
  for (const today of ['2026-10-32', 'today', undefined]) assert.throws(() => pendingFollowups(sessions, today));
});

test('continueFrom extends stuckTurn with real-conversation reflections and optional structure checks', () => {
  const older = { ...complete('request', 'pressure', 'older'), at: '2026-10-01T00:00:00.000Z' };
  let newer = complete('request', 'pressure', 'newer'); newer = { ...newer, at: '2026-10-05T00:00:00.000Z', turns: newer.turns.map(t => ({ ...t, review: 'easy' })) };
  const other = { ...complete('refusal', 'pressure', 'other'), at: '2026-10-09T00:00:00.000Z' };
  const stuck = continueFrom([newer, older, other], 'request');
  assert.deepEqual([stuck.sessionId, stuck.index, stuck.turnId, stuck.reason], ['older', 1, 'pressure', 'stuck']);
  assert.equal(stuck.prompt, getTurn(older, 1).prompt); assert.equal(stuck.answer, older.turns[1].answer);
  const hard = recordOutcome(newer, { did: 'yes', usedFirst: true, reaction: 'hard', at: '2026-10-06T00:00:00.000Z' });
  const fromHard = continueFrom([hard, older], 'request');
  assert.deepEqual([fromHard.sessionId, fromHard.reason, fromHard.focus, fromHard.intensity, fromHard.index], ['newer', 'outcome', 'pressure', 'tough', 1]);
  const unused = continueFrom([recordOutcome(newer, { did: 'yes', usedFirst: false, reaction: 'good', at: '2026-10-06T00:00:00.000Z' })], 'request');
  assert.deepEqual([unused.index, unused.reason], [0, 'outcome']);
  assert.equal(continueFrom([newer], 'request'), null);
  const missing = continueFrom([newer], 'request', { analyze: analyzeAnswer });
  assert.equal(missing.reason, 'missing'); assert.ok(missing.missing.length && missing.missing.every(m => m.id && m.label));
  const allRetried = { ...newer, turns: newer.turns.map(t => ({ ...t, retry: '목요일 3시까지 이 표를 봐 주실 수 있을까요?', retryReview: 'easy', retryMode: 'text' })) };
  assert.equal(continueFrom([allRetried], 'request', { analyze: analyzeAnswer }), null);
  assert.equal(continueFrom([other], 'request'), null);
  assert.throws(() => continueFrom([], 'unknown'));
});

test('keepSessions keeps the newest sessions that fit the export budget; typical 30 sessions all fit', () => {
  const typical = Array.from({ length: MAX_SESSIONS + 2 }, (_, i) => rich(`t-${i}`));
  assert.equal(keepSessions(typical).length, MAX_SESSIONS);
  assert.ok(Buffer.byteLength(JSON.stringify(archive(typical), null, 2)) < MAX_IMPORT_BYTES / 2);
  const huge = Array.from({ length: MAX_SESSIONS }, (_, i) => { const s = rich(`h-${i}`); s.turns = s.turns.map(t => ({ ...t, answer: '가'.repeat(2000), retry: '가'.repeat(2000), retryReview: 'easy' })); return s; });
  const kept = keepSessions(huge);
  assert.deepEqual(kept.map(s => s.id), huge.slice(0, kept.length).map(s => s.id));
  assert.ok(kept.length >= 10 && kept.length < MAX_SESSIONS, String(kept.length));
  assert.ok(Buffer.byteLength(JSON.stringify({ schema: SCHEMA, savedAt: new Date().toISOString(), sessions: kept }, null, 2)) <= MAX_IMPORT_BYTES);
  // 크기 한도를 넘는 목록은 직접 넣어도 검증에서 거부된다.
  assert.throws(() => validateArchive({ schema: SCHEMA, savedAt: '2026-10-14T00:00:00.000Z', sessions: huge }));
});
