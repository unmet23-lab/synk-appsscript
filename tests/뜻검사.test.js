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
