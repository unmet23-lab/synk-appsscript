'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 판본글 = require('../tools/lib/판본글.js');

// 지난 기록은 빈 폴더에서 읽게(저장소 기록이 쌓여도 시험이 흔들리지 않게)
const 빈마케팅 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-빈-'));
process.env.SYNK_MARKETING_DIR = 빈마케팅;
const M = require('../tools/뜻검사.js');

function 판본글만들기(방, 덧 = {}) {
  const 편 = path.join(방, 'LAB_시험퀴즈_20261110');
  fs.mkdirSync(path.join(편, '게시'), { recursive: true });
  fs.writeFileSync(path.join(편, '기획.md'), '| 칸 | 내용 |\n|---|---|\n| 재미가 나는 초와 장면 | 배꼽이 빠져 굴러가는 곰 — 글자 그대로 그린 엉뚱함 |\n| **한 문장** | **배꼽이 빠지다는 너무 웃긴다는 뜻이다** |\n');
  const 글 = {
    꼴: '판본글/1', 편: 'LAB_시험퀴즈_20261110', 판본: 'TH', 언어: 'th', 나라: ['TH'], 틀: '퀴즈',
    줄: [
      { id: 'hud', 칸: '진행', 글: 'ทายสำนวน #2', 원문: '관용구 퀴즈 #2', 초: [0, 9] },
      { id: 'ko', 칸: '한국어', 글: '배꼽이 빠지다', 초: [0, 9] },
      { id: 'tag', 칸: '딱지', 글: 'สะดือหลุด?', 원문: '배꼽이 빠진다?', 초: [0.3, 1.8], 장면: '배꼽이 떨어져 굴러가는 곰' },
      { id: 'o1', 칸: '보기', 글: 'ขำท้องแข็ง', 원문: '엄청 웃는다', 초: [2.6, 5] },
      { id: 'o2', 칸: '보기', 글: 'ปวดท้อง', 원문: '배가 아프다', 초: [2.8, 5] },
      { id: 'o3', 칸: '보기', 글: 'กินมากไป', 원문: '너무 많이 먹는다', 초: [3, 5] },
      { id: 'gloss', 칸: '예문', 글: 'ตลกมาก ขำจนท้องแข็งเลย!', 원문: '너무 웃겨서 배꼽 빠지겠어요!', 초: [6, 9] },
      { id: 'say', 칸: '읽기', 글: 'แพกโกบ ปาจีเกซอโย', 초: [7, 9] },
      { id: 'cap', 칸: '게시글', 글: 'คอมเมนต์คะแนน', 원문: '점수 댓글' },
    ],
    퀴즈: [{ 문제: 1, 관용구: '배꼽이 빠지다', 보기: ['o1', 'o2', 'o3'], 정답: 1, 딱지: 'tag' }],
    ...덧,
  };
  const 글파일 = path.join(편, '글_TH.json');
  fs.writeFileSync(글파일, JSON.stringify(글, null, 2));
  fs.writeFileSync(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 돌림: { 형식: '퀴즈', 판본: { TH: { 언어: 'th', 파일: 'th.mp4', 글: '글_TH.json' } } } }, null, 2));
  return { 편, 글파일 };
}

const 답 = (o) => JSON.stringify({ 요약: '', 풀기: [], 유일: [], 웃음: { 웃김: true, 줄: [], 까닭: '' }, 모름줄: [], 불편: [], 결함: [], ...o });
const 조용히 = (fn) => { const a = console.log, b = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = a; console.error = b; } };

test('재료 — 원문 · 한국어 · 게시글은 안 주고 현지어 글을 화면 순서로, 퀴즈 보기는 A · B · C로, 그림은 그 줄 끝에', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const { 편, 글파일 } = 판본글만들기(방);
  const 밖 = path.join(방, '밖');
  const 재료 = M.재료만들기(글파일, { 편, 밖, 기록: [] });
  const q = fs.readFileSync(path.join(밖, '질문.md'), 'utf8');
  assert.match(q, /너는 태국 사람이고 태국어로 생각한다/);
  assert.match(q, /สะดือหลุด\?\s+\[그림: 배꼽이 떨어져 굴러가는 곰\]/);
  assert.match(q, /- 문제 1: A\(줄 4\) · B\(줄 5\) · C\(줄 6\)/);
  for (const 숨김 of ['엄청 웃는다', '배꼽이 빠지다', 'แพกโกบ', 'คอมเมนต์คะแนน', '너무 웃겨서']) assert.ok(!q.includes(숨김), `질문에 「${숨김}」가 들었다`);
  assert.match(q, /\[한국어 글 · 소리 — 너는 아직 뜻을 모른다\]/);
  assert.equal(재료.기준.한문장, '배꼽이 빠지다는 너무 웃긴다는 뜻이다');
  assert.equal(재료.지문, 판본글.sha256(글파일));
  assert.equal(재료.퀴즈[0].정답원문, '엄청 웃는다');
  // 새 언어 · 문자 체계 첫 3편 · 새 틀이라 시험관 넷
  assert.equal(재료.시험관넷.넷, true);
  assert.deepEqual(재료.시험관, M.넷시험관);
  assert.ok(재료.딱지경고.some((w) => w.수준 === '확인할 것'));
});

test('재료 — 현지어 줄에 섞인 한국어는 그 한국어 줄과 같은 딱지로 보인다(뜻은 숨기고 같은 글자인 것만), 이야기 틀은 마음이 움직이는 자리도 묻는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const 줄 = [
    { id: 'ko.1', 칸: '한국어', 글: '먹지 마!', 초: [1.6, 3.7] },
    { id: 'means.1', 칸: '뜻', 글: "Don't eat that!", 원문: '먹지 마!', 초: [1.6, 3.7] },
    { id: 'ko.4', 칸: '한국어', 글: '가지 마…', 초: [10.6, 12.8] },
    { id: 'means.4', 칸: '뜻', 글: "Don't go…", 원문: '가지 마…', 초: [10.6, 12.8] },
    { id: 'ko.6', 칸: '한국어', 글: '먹어.', 초: [15.6, 17.7] },
    { id: 'means.6', 칸: '뜻', 글: 'Eat up.', 원문: '먹어.', 초: [15.6, 17.7] },
    { id: 'endCard', 칸: '상황', 글: 'Blizzard out there?\n가지 마!', 원문: '밖에 눈보라가 쳐? 가지 마!', 초: [18, 20.6] },
    { id: 'ask', 칸: '끝질문', 글: 'Who says 먹지 마 at yours?', 원문: '너희 집에서는 누가 먹지 마라고 해?', 초: [18, 20.6] },
  ];
  const { 편, 글파일 } = 판본글만들기(방, { 판본: 'CA', 언어: 'en', 나라: ['CA'], 틀: '이야기', 줄, 퀴즈: [] });
  const 밖 = path.join(방, '밖');
  M.재료만들기(글파일, { 편, 밖, 기록: [] });
  const q = fs.readFileSync(path.join(밖, '질문.md'), 'utf8');
  assert.match(q, /1\. \(1\.6초\) \[한국어 글 ㉮ · 소리 — 너는 아직 뜻을 모른다\]/, q);
  assert.match(q, /3\. \(10\.6초\) \[한국어 글 ㉯ · 소리 — 너는 아직 뜻을 모른다\]/);
  assert.match(q, /5\. \(15\.6초\) \[한국어 글 · 소리 — 너는 아직 뜻을 모른다\]/, '다른 줄에 안 나오는 한국어는 딱지가 없다');
  assert.match(q, /Blizzard out there\? \/ 〔한국어 글 ㉯〕!/);
  assert.match(q, /Who says 〔한국어 글 ㉮〕 at yours\?/);
  for (const 숨김 of ['먹지 마', '가지 마', '먹어']) assert.ok(!q.includes(숨김), `질문에 「${숨김}」가 들었다`);
  assert.match(q, /딱지가 붙은 것은 앞에 나온 같은 딱지의 한국어 글이/);
  assert.match(q, /마음이 움직이는/);
  // 팻말 「-지 마 =」(기호로 끝남)가 있어도 끝 카드 「먹지 마 = …」는 더 긴 「먹지 마」 딱지로 보이고, 게시글에서 뽑은 「예문」 줄은 화면 줄이 아니라 뺀다
  const 방3 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const 줄3 = [
    { id: 'ko.1', 칸: '한국어', 글: '먹지 마!', 초: [1.6, 3.7] },
    { id: 'means.1', 칸: '뜻', 글: "Don't eat that!", 원문: '먹지 마!', 초: [1.6, 3.7] },
    { id: 'ko.rule', 칸: '한국어', 글: '-지 마 =', 초: [7.7, 9.3] },
    { id: 'rule', 칸: '뜻', 글: "don't", 원문: '~하지 마', 초: [7.7, 9.3] },
    { id: 'endCard', 칸: '끝', 글: "먹지 마 = Don't eat that", 원문: '먹지 마 = 그거 먹지 마', 초: [18, 20.6] },
    { id: '게시글.youtube.본문.2', 칸: '예문', 글: 'Last slice of pizza? 먹지 마!', 원문: '마지막 피자 한 조각? 먹지 마!' },
  ];
  const 셋 = 판본글만들기(방3, { 판본: 'US', 언어: 'en', 나라: ['US'], 틀: '이야기', 줄: 줄3, 퀴즈: [] });
  const 밖3 = path.join(방3, '밖');
  M.재료만들기(셋.글파일, { 편: 셋.편, 밖: 밖3, 기록: [] });
  const q3 = fs.readFileSync(path.join(밖3, '질문.md'), 'utf8');
  assert.match(q3, /〔한국어 글 ㉮〕 = Don't eat that/, q3);
  assert.ok(!q3.includes('먹〔'), '끝 카드의 한국어가 쪼개져 보였다');
  assert.ok(!q3.includes('pizza'), '게시글 예문 줄이 화면 줄로 들어갔다');
  // 섞인 한국어가 없으면 예전 그대로(딱지 안내도 없다)
  const 밖2 = path.join(방, '밖2');
  const 둘 = 판본글만들기(fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-')));
  M.재료만들기(둘.글파일, { 편: 둘.편, 밖: 밖2, 기록: [] });
  const q2 = fs.readFileSync(path.join(밖2, '질문.md'), 'utf8');
  assert.ok(!q2.includes('㉮') && !q2.includes('딱지가 붙은') && !q2.includes('마음이 움직이는'));
});

test('시험관 넷 판단 — 새 언어 · 문자 체계 첫 3편 · 새 틀 · 문화 소재 · 같은 실수 다시', () => {
  const 통과 = (언어, 틀, 시각 = '2026-11-01') => ({ 편: `편${시각}${언어}`, 판본: 'X', 언어, 틀, 결과: '통과', 시각 });
  const 기록 = [통과('th', '퀴즈'), 통과('my', '퀴즈'), 통과('km', '퀴즈')];
  assert.deepEqual(M.넷판단({ 언어: 'th', 틀: '퀴즈', 기록 }), { 넷: false, 까닭: [] });
  assert.match(M.넷판단({ 언어: 'si', 틀: '퀴즈', 기록 }).까닭.join(), /새 언어/);
  assert.match(M.넷판단({ 언어: 'en', 틀: '퀴즈', 기록: [...기록, 통과('en', '퀴즈')] }).까닭.join(), /문자 체계\(라틴\) 첫 3편 — 지금까지 1편/);
  assert.match(M.넷판단({ 언어: 'th', 틀: '이야기', 기록 }).까닭.join(), /새 틀/);
  assert.match(M.넷판단({ 언어: 'th', 틀: '퀴즈', 문화소재: true, 기록 }).까닭.join(), /문화 소재/);
  const 다시 = [...기록, { 편: '최근', 판본: 'TH', 언어: 'th', 틀: '퀴즈', 결과: '고칠 것', 다음은넷: true, 시각: '2026-11-09' }];
  assert.match(M.넷판단({ 언어: 'th', 틀: '퀴즈', 기록: 다시 }).까닭.join(), /같은 실수가 다시/);
});

test('요약 견주기 — 핵심 낱말 묶음을 얼마나 짚었나(0.6 같음 · 0.3 아래 다름)', () => {
  const 재료 = { 기준: { 핵심: [['약속', '바람맞'], ['어렵', '어려'], ['절대', '없을']] }, 퀴즈: [] };
  assert.equal(M.요약견주기('약속한 사람이 안 오고, 별 따기는 아주 어렵고, 해가 서쪽에서 뜨는 건 절대 없는 일이라는 퀴즈', 재료).판정, '같음');
  assert.equal(M.요약견주기('하늘 관용구 퀴즈인데 약속에 바람맞았다는 뜻도 있다', 재료).판정, '모호');
  assert.equal(M.요약견주기('곰이 춤추는 귀여운 영상', 재료).판정, '다름');
  // 핵심이 없으면 퀴즈 정답 원문(진짜 뜻)에서 뽑는다 — 관용구 이름만 댄 요약은 같음이 아니다
  const 퀴즈재료 = { 기준: {}, 퀴즈: [{ 정답원문: '엄청 웃는다', 관용구: '배꼽이 빠지다' }] };
  assert.equal(M.요약견주기('너무 웃겨서 배가 아플 만큼 웃는다는 뜻을 맞히는 퀴즈', 퀴즈재료).판정, '같음');
  assert.equal(M.요약견주기('배꼽 빠지게 웃기다는 뜻이라는 걸 알려 주는 영상', 퀴즈재료).판정, '같음'); // 11-10 실측 sonnet 답
  assert.equal(M.요약견주기('배가 아플 때 먹는 약 이야기', 퀴즈재료).판정, '다름');
  assert.equal(M.요약견주기('배꼽이 빠지다를 알려 주는 영상', 퀴즈재료).판정, '다름');
  assert.equal(M.줄기('약속에'), '약속');
  assert.equal(M.줄기('바람맞았다'), '바람맞았');
  assert.equal(M.줄기('웃다'), '웃다'); // 두 글자 아래로는 떼지 않는다
});

test('답 읽기 — 코드 울타리 · 앞뒤 말이 있어도 JSON 하나를 꺼낸다', () => {
  assert.deepEqual(M.답읽기('여기 답입니다\n```json\n{"요약": "가"}\n```\n끝'), { 요약: '가' });
  assert.deepEqual(M.답읽기('{"요약": "나", "풀기": []}'), { 요약: '나', 풀기: [] });
  assert.throws(() => M.답읽기('JSON 없음'));
});

test('채점 — 정답 오류 · 정답이 하나가 아님 · 화면 결함은 한 시험관이 짚어도 고칠 것, 한국어 줄 「모름」은 세지 않는다, 같이 짚은 줄은 고칠 것', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const { 편, 글파일 } = 판본글만들기(방);
  const 밖 = path.join(방, '밖');
  const 재료 = M.재료만들기(글파일, { 편, 밖, 기록: [] });
  재료.시험관 = ['sonnet', 'haiku'];
  fs.writeFileSync(path.join(밖, '재료.json'), JSON.stringify(재료));
  const 요약 = '배꼽이 빠지다는 너무 웃긴다는 뜻을 맞히는 퀴즈';
  fs.writeFileSync(path.join(밖, '답_sonnet.md'), 답({ 요약, 풀기: [{ 문제: 1, 고름: 'B', 까닭: '줄 5' }], 유일: [{ 문제: 1, 또있음: null }], 웃음: { 웃김: true, 줄: [3], 까닭: '글자 그대로' }, 모름줄: [{ 줄: 2, 까닭: '한국어라 모름' }, { 줄: 7, 까닭: '뜻이 흐림' }] }));
  fs.writeFileSync(path.join(밖, '답_haiku.md'), '```json\n' + 답({ 요약, 풀기: [{ 문제: 1, 고름: 'A' }], 유일: [{ 문제: 1, 또있음: 'B', 까닭: '웃다가 배가 아플 수도 있다' }], 웃음: { 웃김: true, 줄: [3], 까닭: '엉뚱' }, 모름줄: [{ 줄: 2, 까닭: '한국어' }, { 줄: 7, 까닭: '어색' }], 결함: [{ 줄: 4, 까닭: '네모 글자' }, { 줄: 8, 까닭: '한국어 소리' }] }) + '\n```');
  const { 채점 } = M.채점하기(밖);
  const 코드 = 채점.찾음.map((f) => `${f.수준}:${f.코드}`);
  assert.equal(채점.결과, '고칠 것');
  assert.ok(코드.includes('고칠 것:정답오류'), 코드.join());
  assert.ok(코드.includes('고칠 것:유일성'));
  assert.ok(코드.includes('고칠 것:화면결함'));
  assert.ok(코드.includes('고칠 것:같이짚음')); // 줄 7(gloss)을 둘 다
  assert.ok(!채점.찾음.some((f) => f.줄 === 'ko'), '한국어 줄 「모름」 · 「결함」은 세지 않는다');
  assert.ok(!채점.찾음.some((f) => f.줄 === 'say'), '읽기 줄 결함은 세지 않는다');
  assert.equal(채점.시험관별.sonnet.요약.판정, '같음');
  assert.equal(채점.시험관별.haiku.웃음.판정, '같음');
  assert.ok(채점.걸린것.includes('정답오류'));
});

test('채점 — 요약 · 웃음은 한 시험관만 다르면 확인할 것, --판정으로 사람이 정하면 그대로', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const { 편, 글파일 } = 판본글만들기(방);
  const 밖 = path.join(방, '밖');
  const 재료 = M.재료만들기(글파일, { 편, 밖, 기록: [] });
  재료.시험관 = ['sonnet', 'haiku'];
  재료.딱지경고 = [];
  fs.writeFileSync(path.join(밖, '재료.json'), JSON.stringify(재료));
  const 좋은 = { 요약: '너무 웃겨서 배꼽이 빠지겠다는 뜻을 맞히는 퀴즈', 풀기: [{ 문제: 1, 고름: 'A' }], 유일: [{ 문제: 1, 또있음: null }], 웃음: { 웃김: true, 줄: [3] } };
  fs.writeFileSync(path.join(밖, '답_sonnet.md'), 답(좋은));
  fs.writeFileSync(path.join(밖, '답_haiku.md'), 답({ ...좋은, 요약: '곰 인형 영상', 웃음: { 웃김: false, 까닭: '모르겠다' } }));
  let r = M.채점하기(밖).채점;
  assert.equal(r.결과, '확인할 것');
  assert.ok(r.찾음.some((f) => f.코드 === '요약다름' && f.수준 === '확인할 것'));
  assert.ok(r.찾음.some((f) => f.코드 === '웃음안됨' && f.수준 === '확인할 것'));
  r = M.채점하기(밖, { 사람판정: { haiku: { 요약: '같음', 웃음: '같음' } } }).채점;
  assert.equal(r.결과, '통과', JSON.stringify(r.찾음));
});

test('채점 --기록 — 준비.json 돌림.판본[키].검수.뜻에 판본 글 지문을 적고, 재료 뒤 글이 바뀌면 적지 않는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const { 편, 글파일 } = 판본글만들기(방);
  const 밖 = path.join(방, '밖');
  조용히(() => M.main(['판본', 편, 'TH', '--밖', 밖]));
  const 재료 = JSON.parse(fs.readFileSync(path.join(밖, '재료.json'), 'utf8'));
  assert.equal(재료.판본, 'TH');
  const 좋은 = { 요약: '배꼽이 빠지다는 너무 웃긴다는 뜻', 풀기: [{ 문제: 1, 고름: 'A' }], 유일: [{ 문제: 1, 또있음: null }], 웃음: { 웃김: true, 줄: [3] } };
  for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답(좋은));
  const code = 조용히(() => M.main(['채점', 밖, '--기록']));
  const prep = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8'));
  const 기록 = prep.돌림.판본.TH.검수.뜻;
  assert.equal(기록.지문, 판본글.sha256(글파일));
  assert.equal(기록.도구, 'tools/뜻검사.js');
  assert.equal(기록.시험관넷, true);
  assert.equal(기록.언어, 'th');
  assert.equal(기록.결과, code === 0 ? '통과' : code === 3 ? '확인할 것' : '고칠 것');
  // 글을 고치면 지문이 달라 기록하지 않는다
  fs.appendFileSync(글파일, '\n');
  assert.equal(조용히(() => M.main(['채점', 밖, '--기록'])), 2);
});

test('채점 --눈확인 — 한 시험관만 짚은 확인할 것은 본 메모와 함께 통과로, 고칠 것 · 모호 · 빠진 답은 못 넘긴다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const { 편, 글파일 } = 판본글만들기(방);
  const 밖 = path.join(방, '밖');
  조용히(() => M.main(['판본', 편, 'TH', '--밖', 밖]));
  const 재료 = JSON.parse(fs.readFileSync(path.join(밖, '재료.json'), 'utf8'));
  재료.딱지경고 = [];
  fs.writeFileSync(path.join(밖, '재료.json'), JSON.stringify(재료));
  const 좋은 = { 요약: '배꼽이 빠지다는 너무 웃긴다는 뜻', 풀기: [{ 문제: 1, 고름: 'A' }], 유일: [{ 문제: 1, 또있음: null }], 웃음: { 웃김: true, 줄: [3] } };
  const 검수 = () => JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')).돌림.판본.TH.검수?.뜻;
  // 시험관 하나가 한 줄을 짚었다 → 확인할 것. 메모 없이는 확인할 것으로, 메모와 함께면 통과로 적는다
  for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답(s === 'haiku' ? { ...좋은, 모름줄: [{ 줄: 1, 까닭: '너무 빨리 지나간다' }] } : 좋은));
  assert.equal(조용히(() => M.main(['채점', 밖, '--기록'])), 3);
  assert.equal(검수().결과, '확인할 것');
  assert.equal(조용히(() => M.main(['채점', 밖, '--기록', '--눈확인', '진행 줄이 빠르다는 지적 하나 — 원본 박자라 그대로 둔다'])), 0);
  assert.equal(검수().결과, '통과');
  assert.equal(검수().눈확인, '진행 줄이 빠르다는 지적 하나 — 원본 박자라 그대로 둔다');
  assert.equal(검수().확인할것, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(밖, '채점.json'), 'utf8')).눈확인, '진행 줄이 빠르다는 지적 하나 — 원본 박자라 그대로 둔다');
  // 둘이 같은 줄을 짚으면 고칠 것 — 메모로 못 넘긴다
  for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답({ ...좋은, 모름줄: [{ 줄: 1, 까닭: '모르겠다' }] }));
  assert.equal(조용히(() => M.main(['채점', 밖, '--기록', '--눈확인', '봤다'])), 1);
  assert.equal(검수().결과, '고칠 것');
  // 요약 모호 · 빠진 답은 메모로 못 넘긴다(--판정 · 답 채우기가 먼저)
  for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답(좋은));
  fs.rmSync(path.join(밖, `답_${재료.시험관[0]}.md`));
  assert.equal(조용히(() => M.main(['채점', 밖, '--기록', '--눈확인', '봤다'])), 3);
  assert.equal(검수().결과, '확인할 것');
});

test('채점 --판정 「줄」 — 둘이 같이 짚은 모름줄을 원본 · 전제로 판정하면 확인할 것으로 내리고(눈확인이 있어야 통과) 판정줄로 남긴다, 불편 · 결함 · 까닭 없는 판정은 못 내린다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const { 편, 글파일 } = 판본글만들기(방);
  const 밖 = path.join(방, '밖');
  조용히(() => M.main(['판본', 편, 'TH', '--밖', 밖]));
  const 재료 = JSON.parse(fs.readFileSync(path.join(밖, '재료.json'), 'utf8'));
  재료.딱지경고 = [];
  fs.writeFileSync(path.join(밖, '재료.json'), JSON.stringify(재료));
  const 좋은 = { 요약: '배꼽이 빠지다는 너무 웃긴다는 뜻', 풀기: [{ 문제: 1, 고름: 'A' }], 유일: [{ 문제: 1, 또있음: null }], 웃음: { 웃김: true, 줄: [3] } };
  const 줄1 = 재료.줄.find((z) => z.번호 === 1).id;
  for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답({ ...좋은, 모름줄: [{ 줄: 1, 까닭: '너무 빨리 지나간다' }] }));
  const 판정 = path.join(방, '판정.json');
  // 까닭이 없거나 갈래가 다르면 그대로 고칠 것
  fs.writeFileSync(판정, JSON.stringify({ 줄: { [줄1]: { 갈래: '원본' } } }));
  assert.equal(M.채점하기(밖, { 사람판정: JSON.parse(fs.readFileSync(판정, 'utf8')) }).채점.결과, '고칠 것');
  fs.writeFileSync(판정, JSON.stringify({ 줄: { [줄1]: { 갈래: '취향', 까닭: '괜찮다' } } }));
  assert.equal(M.채점하기(밖, { 사람판정: JSON.parse(fs.readFileSync(판정, 'utf8')) }).채점.결과, '고칠 것');
  // 원본 판정 → 확인할 것, 눈확인 없이는 통과가 아니다
  fs.writeFileSync(판정, JSON.stringify({ 줄: { [줄1]: { 갈래: '원본', 까닭: '첫 카드 1.6초는 동결된 원본 박자' } } }));
  assert.equal(조용히(() => M.main(['채점', 밖, '--판정', 판정, '--기록'])), 3);
  const 검수 = () => JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')).돌림.판본.TH.검수.뜻;
  assert.equal(검수().결과, '확인할 것');
  assert.deepEqual(검수().판정줄.map((x) => [x.줄, x.갈래, x.짚은수]), [[줄1, '원본', 재료.시험관.length]]);
  assert.equal(조용히(() => M.main(['채점', 밖, '--판정', 판정, '--기록', '--눈확인', '원본 박자 지적 — 그대로 둔다'])), 0);
  assert.equal(검수().결과, '통과');
  assert.ok(검수().판정줄);
  // 불편 · 결함은 판정으로 못 내린다
  for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답({ ...좋은, 불편: [{ 줄: 1, 까닭: '거슬린다' }] }));
  assert.equal(M.채점하기(밖, { 사람판정: JSON.parse(fs.readFileSync(판정, 'utf8')) }).채점.결과, '고칠 것');
  for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답(s === 'haiku' ? { ...좋은, 결함: [{ 줄: 1, 까닭: '네모 글자' }] } : 좋은));
  assert.equal(M.채점하기(밖, { 사람판정: JSON.parse(fs.readFileSync(판정, 'utf8')) }).채점.결과, '고칠 것');
});

test('재료 — 글에 줄 바꿈이 있으면 「 / 」가 줄 바꿈 자리라고 알린다(빗금을 화면 결함으로 짚지 않게)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const 줄 = [
    { id: 'hook', 칸: '머리', 글: '“Huwag!” ang lagi\nniyang sabi…', 원문: '「하지 마!」가 늘 그의 말이었다…', 초: [0, 1.6] },
    { id: 'ko.1', 칸: '한국어', 글: '먹지 마!', 초: [1.6, 3.7] },
    { id: 'means.1', 칸: '뜻', 글: 'Huwag mong kainin!', 원문: '먹지 마!', 초: [1.6, 3.7] },
  ];
  const { 편, 글파일 } = 판본글만들기(방, { 판본: 'PH', 언어: 'fil', 나라: ['PH'], 틀: '이야기', 줄, 퀴즈: [] });
  const 밖 = path.join(방, '밖');
  M.재료만들기(글파일, { 편, 밖, 기록: [] });
  const q = fs.readFileSync(path.join(밖, '질문.md'), 'utf8');
  assert.match(q, /ang lagi \/ niyang sabi/);
  assert.match(q, /「 \/ 」는 화면에서 줄이 바뀌는 자리다/);
  const 둘 = 판본글만들기(fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-')));
  M.재료만들기(둘.글파일, { 편: 둘.편, 밖: path.join(방, '밖2'), 기록: [] });
  assert.ok(!fs.readFileSync(path.join(방, '밖2', '질문.md'), 'utf8').includes('줄이 바뀌는 자리'));
});
