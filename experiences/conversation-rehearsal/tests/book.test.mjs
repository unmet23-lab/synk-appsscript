import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, appendTurn, retryTurn, getTurn, MAX_SESSIONS, keepSessions, setPlan, setRealDate, recordOutcome } from '../domain.mjs';
import { bookContent, bookData, createBook, BOOK_STYLES, BOOK_FILENAME, BOOK_MIME, MAX_BOOK_BYTES } from '../book.mjs';

const complete = (id='session-1', at='2026-10-05T00:00:00.000Z', focus='pressure') => {
  let session=createSession({scenario:'refusal',counterpart:'동료',goal:'마음을 존중하며 내 범위 말하기',id,at});
  for(let i=0;i<3;i++) session=appendTurn(session,{answer:`처음 적은 말 ${i}\n줄바꿈도 보관해요.`,review:i===0?'stuck':'easy',focus});
  session=retryTurn(session,0,'다시 적은 말\n제가 할 수 있는 범위는 여기까지예요.','unsure');
  session.firstSentence='부탁하신 마음은 이해해요.';
  session.takeaway='내 범위를 분명하게 말하기';
  return session;
};

test('book preserves authored branch, original and latest retry, declared feelings and exact session time',()=>{
  const s=complete(), snapshot=structuredClone(s), html=bookContent([s]);
  for(const value of [s.turns[0].answer,s.turns[0].retry,s.firstSentence,s.takeaway,s.counterpart,s.goal,s.at]) assert.ok(html.includes(value),value);
  for(let index=0;index<3;index++) assert.ok(html.includes(getTurn(s,index).prompt));
  assert.match(html,/딱 이번 한 번만 안 될까요\? 다른 부탁은 안 할게요\./);
  assert.match(html,/내가 고른 느낌: 말이 막혔어요/);
  assert.match(html,/다시 말한 뒤 내가 고른 느낌: 조금 망설였어요/);
  assert.match(html,/실제 대화 성과나 실력 평가를 뜻하지 않아요/);
  assert.deepEqual(s,snapshot);
});

test('book orders completed sessions by time without mutating saved order, with no invented empty results',()=>{
  const recent=complete('recent','2026-10-06T01:02:03.000Z');recent.goal='최근 목표';
  const old=complete('old','2026-10-01T01:02:03.000Z');old.goal='첫 목표';
  const entries=[recent,old],html=bookContent(entries);
  assert.ok(html.indexOf('첫 목표')<html.indexOf('최근 목표'));
  assert.equal(entries[0].id,'recent');
  assert.throws(()=>bookContent([]),/한 번 끝내면/);
  assert.throws(()=>createBook([createSession({scenario:'refusal',counterpart:'지인',goal:'연습',id:'unfinished'})]));
  assert.throws(()=>bookContent(Array.from({length:MAX_SESSIONS+1},(_,i)=>complete(`id-${i}`))));
});

test('download is self-contained HTML with escaped personal text, no scripts or remote resources, retained font license',()=>{
  const s=complete();
  s.counterpart='<img src=x onerror=alert(1)>';
  s.turns[0].answer='<script>alert("문장")</script>\n& 따옴표 \'를 그대로';
  s.firstSentence='</style><iframe src="https://evil.example/">';
  const html=createBook([s]);
  assert.match(html,/&lt;script&gt;alert\(&quot;문장&quot;\)&lt;\/script&gt;/);
  assert.match(html,/&lt;\/style&gt;&lt;iframe src=&quot;https:\/\/evil.example\/&quot;&gt;/);
  assert.ok(!/<(?:script|iframe|img|link)\b/i.test(html));
  assert.ok(!/<[^>]*\b(?:href|src)\s*=/i.test(html));
  assert.ok(!/url\((?:['"])?(?:https?:|\/\/)/i.test(html));
  assert.match(html,/default-src 'none'; script-src 'none'/);
  assert.match(html,/font-src data:/);
  assert.match(html,/data:font\/woff2;base64,/);
  assert.match(html,/SIL OPEN FONT LICENSE/);
  assert.equal(BOOK_FILENAME,'synk-rehearsal-book.html');assert.equal(BOOK_MIME,'text/html');
});

test('maximal stored text (30-session cap trimmed to the 500000-byte export) including escape expansion fits 3MiB and pagination allows long answers to flow',()=>{
  for(const char of ['가','"']){
    const sessions=Array.from({length:MAX_SESSIONS},(_,i)=>{
      const s=complete(`max-${i}`);s.counterpart=char.repeat(80);s.goal=char.repeat(240);s.firstSentence=char.repeat(600);s.takeaway=char.repeat(600);
      s.turns=s.turns.map(turn=>({...turn,answer:char.repeat(2000),retry:char.repeat(2000),retryReview:'easy',mode:'voice',seconds:600,retryMode:'voice',retrySeconds:600}));
      s.plan={ifThey:char.repeat(200),iWill:char.repeat(200)};s.realAt='2026-10-20';s.outcome={did:'yes',usedFirst:true,reaction:'mixed',note:char.repeat(600),at:'2026-10-21T00:00:00.000Z'};return s;
    });
    const kept=keepSessions(sessions);
    assert.ok(kept.length>=10&&kept.length<MAX_SESSIONS,String(kept.length));
    assert.ok(Buffer.byteLength(createBook(kept),'utf8')<MAX_BOOK_BYTES);
    assert.throws(()=>createBook(sessions));
  }
  assert.match(BOOK_STYLES,/@page\{size:A4/);
  assert.match(BOOK_STYLES,/\.book-session\{break-before:page/);
  assert.match(BOOK_STYLES,/\.book-text\{break-inside:auto/);
  assert.ok(!/[{;]\s*height:\s*\d/.test(BOOK_STYLES));
  assert.match(BOOK_STYLES,/white-space:pre-wrap/);
});

test('book carries schema 2 plan, real date, reflection, strength and spoken time; schema 1 records show none of them', () => {
  let s = createSession({ scenario: 'apology', practice: { counterpart: 'family', goal: 'hurt' }, intensity: 'tough', counterpart: '동생', goal: '그때 한 말 사과하기', id: 'v2', at: '2026-10-14T01:00:00.000Z' });
  s = appendTurn(s, { answer: '그때 내가 한 말 때문에 속상했을 것 같아. 미안해.', review: 'unsure', focus: 'pressure', mode: 'voice', seconds: 65 });
  s = appendTurn(s, { answer: '앞으로는 화가 나도 그런 말은 안 할게.', review: 'stuck', mode: 'text' });
  s = appendTurn(s, { answer: '기다릴게. 고마워.', review: 'easy', mode: 'voice', seconds: 8 });
  s = retryTurn(s, 1, '다음부터는 말하기 전에 한 번 쉬어 갈게.', 'easy', { mode: 'voice', seconds: 12 });
  s = setPlan(s, { ifThey: '말로만 미안하다고 하면 뭐가 달라지냐고 하면', iWill: '앞으로 달라질 행동 하나를 말한다' });
  s = setRealDate(s, '2026-10-18');
  s = recordOutcome(s, { did: 'yes', usedFirst: false, reaction: 'hard', note: '<b>처음엔 굳어 있었지만</b> 끝까지 들어 줬다.', at: '2026-10-18T13:00:00.000Z' });
  const data = bookData([s]), entry = data.sessions[0];
  assert.deepEqual([data.count, data.max, entry.intensity, entry.intensityLabel, entry.spokenSeconds, entry.realAt], [1, MAX_SESSIONS, 'tough', '세게', 65 + 12 + 8, '2026-10-18']);
  assert.deepEqual(entry.turns.map(t => [t.mode, t.seconds, t.retryMode, t.retrySeconds]), [['voice', 65, null, null], ['text', null, 'voice', 12], ['voice', 8, null, null]]);
  assert.equal(entry.turns[1].prompt, getTurn(s, 1).prompt);
  assert.deepEqual([entry.outcome.didLabel, entry.outcome.reactionLabel, entry.outcome.usedFirst], ['대화했어요', '어려웠어요', false]);
  const html = bookContent([s]);
  for (const text of ['상대 반응 세기', '세게', '말한 시간', '모두 1분 25초', '실제 대화 날짜', '2026년 10월 18일', '내가 고른 느낌: 조금 망설였어요 · 말로 답함 · 1분 05초', '다시 말한 뒤 내가 고른 느낌: 말할 수 있었어요 · 말로 답함 · 12초', '만약 상대가 이렇게 나오면', s.plan.ifThey, '나는 이렇게 할게요', s.plan.iWill, '실제 대화 뒤 돌아보기', '준비한 첫 문장을 쓰지 못했어요', '상대 반응: 어려웠어요', '다음에 기억할 것']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('&lt;b&gt;처음엔 굳어 있었지만&lt;/b&gt;'));
  assert.ok(!html.includes('<b>'));
  assert.ok(createBook([s]).includes('녹음은 기기 안에서만'));
  // schema 1 기록: 강도·말한 시간·계획·돌아보기 칸을 만들어 넣지 않는다.
  const legacy = complete('legacy'); for (const key of ['intensity', 'plan', 'realAt', 'outcome']) delete legacy[key];
  legacy.turns = legacy.turns.map(({ id, answer, review, retry, retryReview }) => ({ id, answer, review, retry, retryReview }));
  const old = bookData([legacy]).sessions[0];
  assert.deepEqual([old.intensity, old.plan, old.realAt, old.outcome, old.spokenSeconds], [null, null, null, null, 0]);
  const oldHtml = bookContent([legacy]);
  for (const text of ['상대 반응 세기', '말한 시간', '실제 대화 뒤 돌아보기', '만약 상대가 이렇게 나오면', '말로 답함']) assert.ok(!oldHtml.includes(text), text);
});
