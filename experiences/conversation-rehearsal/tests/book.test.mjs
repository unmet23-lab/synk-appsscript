import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, appendTurn, retryTurn, getTurn, MAX_SESSIONS } from '../domain.mjs';
import { bookContent, createBook, BOOK_STYLES, BOOK_FILENAME, BOOK_MIME, MAX_BOOK_BYTES } from '../book.mjs';

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
  assert.match(html,/실제 대화 성과나 실력 평가를 뜻하지 않습니다/);
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

test('maximal original/retry text including escape expansion fits 2MiB and pagination allows long answers to flow',()=>{
  for(const char of ['가','"']){
    const sessions=Array.from({length:MAX_SESSIONS},(_,i)=>{
      const s=complete(`max-${i}`);s.counterpart=char.repeat(80);s.goal=char.repeat(240);s.firstSentence=char.repeat(600);s.takeaway=char.repeat(600);
      s.turns=s.turns.map(turn=>({...turn,answer:char.repeat(2000),retry:char.repeat(2000),retryReview:'easy'}));return s;
    });
    assert.ok(Buffer.byteLength(createBook(sessions),'utf8')<MAX_BOOK_BYTES);
  }
  assert.match(BOOK_STYLES,/@page\{size:A4/);
  assert.match(BOOK_STYLES,/\.book-session\{break-before:page/);
  assert.match(BOOK_STYLES,/\.book-text\{break-inside:auto/);
  assert.ok(!/[{;]\s*height:\s*\d/.test(BOOK_STYLES));
  assert.match(BOOK_STYLES,/white-space:pre-wrap/);
});
