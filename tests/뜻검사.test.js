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
  assert.match(M.넷판단({ 언어: 'en', 틀: '퀴즈', 기록: [...기록, 통과('en', '퀴즈')] }).까닭.join(), /문자 체계\(라틴\) 첫 3편 — 이 편 앞에 통과한 편 1/);
  // 첫 3편은 판본 기록 수가 아니라 편(원본) 수다(11-11 P2-7): 첫 원본의 라틴 판본이 스무 개 통과했어도 둘째 원본은 「이 편 앞에 1편」이라 시험관 넷
  const 판본들 = (편, 언어들) => 언어들.map((언어, i) => ({ 편, 판본: `K${i}`, 언어, 틀: '이야기', 결과: '통과', 시각: '2026-11-10' }));
  const 첫원본 = 판본들('LAB_첫', ['en', 'en', 'en', 'es', 'es', 'pt-BR', 'ms', 'fil', 'vi', 'uz', 'id']);
  const 둘째 = M.넷판단({ 언어: 'en', 틀: '이야기', 편: 'LAB_둘째', 기록: 첫원본 });
  assert.equal(둘째.넷, true);
  assert.match(둘째.까닭.join(), /문자 체계\(라틴\) 첫 3편 — 이 편 앞에 통과한 편 1/);
  // 그 편 자신의 다른 판본 통과는 「앞에 통과한 편」으로 세지 않는다
  assert.match(M.넷판단({ 언어: 'en', 틀: '이야기', 편: 'LAB_둘째', 기록: [...첫원본, ...판본들('LAB_둘째', ['en', 'es'])] }).까닭.join(), /이 편 앞에 통과한 편 1/);
  // 앞에 세 편이 통과했으면 넷째 편부터 시험관 둘
  const 세편 = [...첫원본, ...판본들('LAB_둘째', ['en']), ...판본들('LAB_셋째', ['es'])];
  assert.deepEqual(M.넷판단({ 언어: 'en', 틀: '이야기', 편: 'LAB_넷째', 기록: 세편 }), { 넷: false, 까닭: [] });
  assert.equal(M.넷판단({ 언어: 'en', 틀: '이야기', 편: 'LAB_셋째', 기록: 세편 }).넷, true, '셋째 편 자신은 아직 첫 3편 안이다');
  assert.match(M.넷판단({ 언어: 'th', 틀: '이야기', 기록 }).까닭.join(), /새 틀/);
  assert.match(M.넷판단({ 언어: 'th', 틀: '퀴즈', 문화소재: true, 기록 }).까닭.join(), /문화 소재/);
  const 다시 = [...기록, { 편: '최근', 판본: 'TH', 언어: 'th', 틀: '퀴즈', 결과: '고칠 것', 다음은넷: true, 시각: '2026-11-09' }];
  assert.match(M.넷판단({ 언어: 'th', 틀: '퀴즈', 기록: 다시 }).까닭.join(), /같은 실수가 다시/);
});

test('재료 — 판본 글 맨 위 「문화소재」(true 또는 까닭 한 줄)가 있으면 시험관 넷 · 받은 때의 셈도 넷, 없으면 앞뒤 그대로 둘(11-13 「사층F」)', () => {
  // 앞에 같은 언어 · 같은 틀 · 같은 문자 체계 편이 셋 통과했고 관용구 딱지 경고도 없는 판 — 문화 소재 말고는 시험관 넷일 까닭이 없다
  const 통과 = (편) => ({ 편, 판본: 'TH', 언어: 'th', 틀: '퀴즈', 결과: '통과', 시각: '2026-11-01T09:00:00+09:00' });
  const 기록 = [통과('LAB_가'), 통과('LAB_나'), 통과('LAB_다')];
  const 퀴즈 = [{ 문제: 1, 보기: ['o1', 'o2', 'o3'], 정답: 1, 딱지: 'tag' }];
  const 둘 = 판본글만들기(fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-')), { 퀴즈 });
  const r2 = M.재료만들기(둘.글파일, { 편: 둘.편, 밖: path.join(둘.편, '뜻'), 기록 });
  assert.deepEqual(r2.시험관, ['sonnet', 'haiku']);
  assert.deepEqual(r2.시험관넷, { 넷: false, 까닭: [] });
  assert.equal(r2.시험관셈.넷, false);
  for (const 표시 of ['한국의 숫자 4 기피(사 = 죽음)', true]) {
    const 넷 = 판본글만들기(fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-')), { 퀴즈, 문화소재: 표시 });
    const 밖 = path.join(넷.편, '뜻');
    const r4 = M.재료만들기(넷.글파일, { 편: 넷.편, 밖, 기록 });
    assert.deepEqual(r4.시험관, ['sonnet', 'haiku', 'opus', 'gpt'], String(표시));
    assert.deepEqual(r4.시험관넷.까닭, ['문화 소재(판본 글 「문화소재」)']);
    // 관문(시험관모자람)이 읽는 받은 때의 셈도 넷이다 — 둘로 받은 기록은 돌림에 못 든다
    assert.equal(r4.시험관셈.넷, true);
    assert.deepEqual(판본글.readJson(path.join(밖, '재료.json')).시험관셈.까닭, ['문화 소재(판본 글 「문화소재」)']);
    assert.ok(M.시험관모자람({ 시험관: ['sonnet', 'haiku'], 시험관셈: r4.시험관셈 }, {}), '문화 소재 판을 시험관 둘로 받은 기록은 모자람');
    assert.equal(M.시험관모자람({ 시험관: r4.시험관, 시험관셈: r4.시험관셈 }, {}), null);
  }
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
  // 사람 판정은 까닭이 있어야 받는다 — 흔적 없이 「다름」이 「같음」으로 바뀌지 않게(11-11 Fable 검수)
  assert.throws(() => M.채점하기(밖, { 사람판정: { haiku: { 요약: '같음', 웃음: '같음' } } }), /haiku\.요약에 까닭이 없다/);
  assert.throws(() => M.채점하기(밖, { 사람판정: { haiku: { 요약: '같음', 요약까닭: '곰 인형이 웃겨서 배꼽이 빠진다는 장면을 줄여 말했다', 웃음: '같음' } } }), /haiku\.웃음에 까닭이 없다/);
  assert.throws(() => M.채점하기(밖, { 사람판정: { haiku: { 요약: '맞음', 요약까닭: 'x' } } }), /같음 · 다름 가운데 하나다/);
  assert.throws(() => M.채점하기(밖, { 사람판정: { haiko: { 요약: '같음', 요약까닭: 'x' } } }), /시험관 「haiko」 답이 없다/);
  const 판정 = { haiku: { 요약: '같음', 요약까닭: '곰 인형이 웃겨서 배꼽이 빠진다는 장면을 줄여 말했다', 웃음: '같음', 웃음까닭: '답 까닭 칸에 반전 자리를 적었다' }, sonnet: { 요약: '같음', 요약까닭: '도구도 같음 — 바꾼 것이 아니다' } };
  r = M.채점하기(밖, { 사람판정: 판정 }).채점;
  assert.equal(r.결과, '통과', JSON.stringify(r.찾음));
  assert.deepEqual(r.사람판정, [
    { 시험관: 'haiku', 칸: '요약', 앞: '다름', 뒤: '같음', 까닭: '곰 인형이 웃겨서 배꼽이 빠진다는 장면을 줄여 말했다' },
    { 시험관: 'haiku', 칸: '웃음', 앞: '안 웃김', 뒤: '같음', 까닭: '답 까닭 칸에 반전 자리를 적었다' },
  ], '도구 판정을 바꾼 것만 남는다(sonnet은 도구도 같음)');
  // --기록이면 준비.json 검수.뜻에도 남는다
  const 판정파일 = path.join(방, '판정.json');
  fs.writeFileSync(판정파일, JSON.stringify(판정));
  재료.편폴더 = 편; 재료.판본 = 'TH';
  fs.writeFileSync(path.join(밖, '재료.json'), JSON.stringify(재료));
  assert.equal(조용히(() => M.main(['채점', 밖, '--판정', 판정파일, '--기록'])), 0);
  const 기록 = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')).돌림.판본.TH.검수.뜻;
  assert.equal(기록.결과, '통과');
  assert.deepEqual(기록.사람판정.map((x) => `${x.시험관} ${x.칸} ${x.앞}→${x.뒤}`), ['haiku 요약 다름→같음', 'haiku 웃음 안 웃김→같음']);
  assert.ok(기록.사람판정.every((x) => x.까닭));
  // 까닭 없는 판정 파일은 CLI도 거절한다(종료 2 · 기록하지 않는다)
  fs.writeFileSync(판정파일, JSON.stringify({ haiku: { 요약: '같음' } }));
  assert.throws(() => 조용히(() => M.main(['채점', 밖, '--판정', 판정파일, '--기록'])), /까닭이 없다/);
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

test('채점 --판정 「줄」 갈래 「틀」 · 여럿 — 인사 카드 · 끝 카드 박자처럼 판본 틀이 붙이는 장면은 「틀」로, 까닭이 갈래마다 다르면 목록으로 내리고 기록은 「전제 · 틀」 한 글(11-14 「사층F」 고침 다시 검수 P2)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-'));
  const { 편 } = 판본글만들기(방);
  const 밖 = path.join(방, '밖');
  조용히(() => M.main(['판본', 편, 'TH', '--밖', 밖]));
  const 재료 = JSON.parse(fs.readFileSync(path.join(밖, '재료.json'), 'utf8'));
  재료.딱지경고 = [];
  fs.writeFileSync(path.join(밖, '재료.json'), JSON.stringify(재료));
  const 좋은 = { 요약: '배꼽이 빠지다는 너무 웃긴다는 뜻', 풀기: [{ 문제: 1, 고름: 'A' }], 유일: [{ 문제: 1, 또있음: null }], 웃음: { 웃김: true, 줄: [3] } };
  const 줄1 = 재료.줄.find((z) => z.번호 === 1).id;
  for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답({ ...좋은, 모름줄: [{ 줄: 1, 까닭: '1초 남짓이라 못 읽었다' }] }));
  const 채점 = (갈래) => M.채점하기(밖, { 사람판정: { 줄: { [줄1]: { 갈래, 까닭: '인사 카드 길이는 판본 틀 · 인사 카드 정본이 정한다' } } } }).채점;
  // 셋째 갈래 「틀」 — 확인할 것으로 내리고 판정줄 · 찾음에 그대로 남는다
  const 틀 = 채점('틀');
  assert.equal(틀.결과, '확인할 것');
  assert.deepEqual(틀.판정줄.map((x) => [x.줄, x.갈래]), [[줄1, '틀']]);
  assert.equal(틀.찾음.find((f) => f.줄 === 줄1).판정, '틀');
  // 갈래 하나는 앞과 같은 글로 남는다(옛 판정 파일 · 기록 그대로)
  assert.deepEqual(채점('원본').판정줄.map((x) => x.갈래), ['원본']);
  assert.deepEqual(채점(['원본']).판정줄.map((x) => x.갈래), ['원본']);
  // 여럿 — 적은 차례대로 「 · 」로 이은 한 글
  const 여럿 = 채점(['전제', '틀']);
  assert.equal(여럿.결과, '확인할 것');
  assert.deepEqual(여럿.판정줄.map((x) => x.갈래), ['전제 · 틀']);
  assert.match(여럿.찾음.find((f) => f.줄 === 줄1).말, /판정 「전제 · 틀」/);
  // 빈 목록 · 겹침 · 셋 밖의 갈래가 하나라도 섞이면 · 글이 아니면 내리지 않는다(고칠 것 그대로)
  for (const 나쁜 of [[], ['틀', '틀'], ['전제', '취향'], [1], '전제 · 틀', null, { 갈래: '틀' }]) {
    const c = 채점(나쁜);
    assert.equal(c.결과, '고칠 것', JSON.stringify(나쁜));
    assert.equal(c.판정줄, undefined, JSON.stringify(나쁜));
  }
  // 기록도 같은 글 — 눈확인을 거쳐 통과
  const 판정 = path.join(방, '판정.json');
  fs.writeFileSync(판정, JSON.stringify({ 줄: { [줄1]: { 갈래: ['전제', '틀'], 까닭: '한글을 못 읽음 + 인사 카드 길이' } } }));
  assert.equal(조용히(() => M.main(['채점', 밖, '--판정', 판정, '--기록', '--눈확인', '틀 · 전제 지적 — 판본 글로 못 고친다'])), 0);
  const 검수 = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')).돌림.판본.TH.검수.뜻;
  assert.equal(검수.결과, '통과');
  assert.deepEqual(검수.판정줄.map((x) => [x.줄, x.갈래, x.짚은수]), [[줄1, '전제 · 틀', 재료.시험관.length]]);
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

test('시험관 수 관문은 기록에 얼린 「시험관셈」(받은 때의 셈)만 읽는다 — 앞 편 기록이 다시 적히는 사이 뒤 편의 정당한 시험관 둘 통과가 뒤집히지 않는다(P1-시1)', () => {
  const 둘 = ['sonnet', 'haiku'];
  const 통과줄 = (편, 시각, 결과 = '통과') => ({ 편, 판본: 'MX', 언어: 'es', 틀: '이야기', 결과, 시각 });
  // 넷째 편(LAB_라)의 파라과이판 — 받을 때 앞에 통과한 라틴 편이 셋이라 시험관 둘이 맞았다(시험관셈.넷 false)
  const 얼린 = { 결과: '통과', 시험관: 둘, 시각: '2026-11-20T10:00:00+09:00', 언어: 'es', 틀: '이야기', 시험관셈: { 넷: false, 까닭: [], 센때: '2026-11-20T09:50:00+09:00' } };
  const 앞셋 = [통과줄('LAB_가', '2026-11-10T10:00:00+09:00'), 통과줄('LAB_나', '2026-11-11T10:00:00+09:00'), 통과줄('LAB_다', '2026-11-12T10:00:00+09:00')];
  assert.equal(M.시험관모자람(얼린, { 편: 'LAB_라', 판본: 'PY', 기록: 앞셋 }), null);
  // 앞 편(LAB_다)을 다시 받는 중 — 첫 걸음 --기록이 「확인할 것」으로 적혔다: 지금 기록으로 되짚으면 앞에 통과한 편이 둘이지만 얼린 셈은 그대로다
  const 받는중 = [앞셋[0], 앞셋[1], 통과줄('LAB_다', '2026-11-21T10:00:00+09:00', '확인할 것')];
  assert.equal(M.시험관모자람(얼린, { 편: 'LAB_라', 판본: 'PY', 기록: 받는중 }), null, '앞 편이 다시 받는 중이어도 뒤집히지 않는다');
  // 두 걸음 끝 — 앞 편이 통과로 다시 적혔지만 처음통과가 다시 받은 때다(뒤 기록보다 나중): 그래도 그대로다
  const 두걸음 = [앞셋[0], 앞셋[1], { ...통과줄('LAB_다', '2026-11-21T10:10:00+09:00'), 처음통과: '2026-11-21T10:10:00+09:00' }];
  assert.equal(M.시험관모자람(얼린, { 편: 'LAB_라', 판본: 'PY', 기록: 두걸음 }), null);
  // 앞 편 폴더를 치워도 그대로다
  assert.equal(M.시험관모자람(얼린, { 편: 'LAB_라', 판본: 'PY', 기록: [앞셋[0], 앞셋[1]] }), null);
  // 거꾸로 — 받을 때 넷이어야 했던 기록(시험관셈.넷 true)은 뒤에 다른 편이 더 통과해도 넉넉해지지 않고, 얼린 까닭을 보인다
  const 모자란 = { ...얼린, 시험관셈: { 넷: true, 까닭: ['문자 체계(라틴) 첫 3편 — 이 편 앞에 통과한 편 1'], 센때: '2026-11-20T09:50:00+09:00' } };
  const lack = M.시험관모자람(모자란, { 편: 'LAB_라', 판본: 'PY', 기록: [...앞셋, 통과줄('LAB_마', '2026-11-13T10:00:00+09:00')] });
  assert.deepEqual([lack.수, lack.까닭.join(' ')], [2, '문자 체계(라틴) 첫 3편 — 이 편 앞에 통과한 편 1']);
  // 넷이 답한 기록은 셈이 무엇이든 묻지 않는다 · 시험관셈이 없는 옛 기록은 전처럼 지금 기록으로 되짚는다
  assert.equal(M.시험관모자람({ ...모자란, 시험관: ['sonnet', 'haiku', 'opus', 'gpt'] }, { 편: 'LAB_라', 판본: 'PY', 기록: [] }), null);
  const { 시험관셈: _셈, ...옛 } = 얼린;
  assert.match(M.시험관모자람(옛, { 편: 'LAB_라', 판본: 'PY', 기록: 받는중 }).까닭.join(' '), /이 편 앞에 통과한 편 2/);
});

test('받은 때의 셈 — 시험지를 만든 때까지 통과해 있던 다른 편으로 센다: 채점 --기록이 「시험관셈」으로 적는다(P1-시1)', () => {
  const 통과줄 = (편, 시각, 덧 = {}) => ({ 편, 판본: 'MX', 언어: 'es', 틀: '이야기', 결과: '통과', 시각, ...덧 });
  const 재료 = { 편: 'LAB_라', 판본: 'PY', 언어: 'es', 틀: '이야기', 시각: '2026-11-20T09:50:00+09:00', 딱지경고: [], 시험관넷: { 넷: false, 까닭: [] } };
  const 앞셋 = [통과줄('LAB_가', '2026-11-10T10:00:00+09:00'), 통과줄('LAB_나', '2026-11-11T10:00:00+09:00'), 통과줄('LAB_다', '2026-11-12T10:00:00+09:00')];
  assert.deepEqual(M.받은때셈(재료, { 기록: 앞셋 }), { 넷: false, 까닭: [], 센때: 재료.시각 });
  // 시험지를 만든 뒤에 통과한 편은 세지 않는다 — 시험관 둘의 옛 답을 뒤에 다시 적어도 넉넉해지지 않는다
  const 뒤에통과 = [앞셋[0], 앞셋[1], 통과줄('LAB_다', '2026-11-21T10:00:00+09:00')];
  const 셈 = M.받은때셈(재료, { 기록: 뒤에통과 });
  assert.equal(셈.넷, true);
  assert.match(셈.까닭.join(' '), /이 편 앞에 통과한 편 2/);
  // 처음통과를 이어받은 기록은 먼저 통과한 편이다 · 자기 기록은 세지 않는다 · 재료가 적어 둔 문화 소재는 그대로 넷이다
  assert.equal(M.받은때셈(재료, { 기록: [앞셋[0], 앞셋[1], 통과줄('LAB_다', '2026-11-21T10:00:00+09:00', { 처음통과: '2026-11-12T10:00:00+09:00' })] }).넷, false);
  assert.equal(M.받은때셈(재료, { 기록: [...앞셋.slice(0, 2), { ...통과줄('LAB_라', '2026-11-01T10:00:00+09:00'), 판본: 'PY' }] }).넷, true, '자기 기록은 앞 편이 아니다');
  assert.equal(M.받은때셈({ ...재료, 시험관넷: { 넷: true, 까닭: ['문화 소재(판본 글 「문화소재」)'] } }, { 기록: 앞셋 }).넷, true);
});

test('채점 --기록 — 뜻 기록에 받은 때의 셈(시험관셈)을 얼려 적는다(P1-시1)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-셈-'));
  const 앞 = process.env.SYNK_MARKETING_DIR;
  process.env.SYNK_MARKETING_DIR = path.join(방, '빈마당'); // 다른 편 기록이 하나도 없는 마당 — 이 저장소의 실제 기록에 기대지 않는다
  try {
    const { 편 } = 판본글만들기(방);
    const 밖 = path.join(방, '밖');
    조용히(() => M.main(['판본', 편, 'TH', '--밖', 밖]));
    const 재료 = JSON.parse(fs.readFileSync(path.join(밖, '재료.json'), 'utf8'));
    const 좋은 = { 요약: '배꼽이 빠지다는 너무 웃긴다는 뜻', 풀기: [{ 문제: 1, 고름: 'A' }], 유일: [{ 문제: 1, 또있음: null }], 웃음: { 웃김: true, 줄: [3] } };
    for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답(좋은));
    조용히(() => M.main(['채점', 밖, '--기록']));
    const 기록 = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')).돌림.판본.TH.검수.뜻;
    assert.equal(기록.시험관셈.넷, true);
    assert.match(기록.시험관셈.까닭.join(' '), /새 언어/);
    assert.equal(기록.시험관셈.센때, 재료.시각);
  } finally {
    if (앞 === undefined) delete process.env.SYNK_MARKETING_DIR; else process.env.SYNK_MARKETING_DIR = 앞;
    fs.rmSync(방, { recursive: true, force: true });
  }
});

test('받은 때의 셈은 재료를 만든 때 한 번 세어 재료에 적고 채점 --기록은 옮겨 적기만 한다 — 재료를 만든 뒤 이웃 편이 두 걸음으로 다시 받아져도 뒤집히지 않는다(다시 검수 3 P1-셈1)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '뜻검사-셈재료-'));
  const 앞 = process.env.SYNK_MARKETING_DIR;
  const 마당 = path.join(방, '마당');
  process.env.SYNK_MARKETING_DIR = 마당;
  try {
    // 이웃 세 편 — 같은 언어 · 같은 틀로 이미 통과(문자 체계 첫 3편이 찼다)
    const 이웃준비 = (name) => path.join(마당, name, '게시', '준비.json');
    const 이웃쓰기 = (name, 뜻) => {
      fs.mkdirSync(path.dirname(이웃준비(name)), { recursive: true });
      fs.writeFileSync(이웃준비(name), JSON.stringify({ 브랜드: 'LAB', 돌림: { 형식: '퀴즈', 판본: { TH: { 언어: 'th', 검수: { 뜻 } } } } }));
    };
    const 통과뜻 = (시각, 덧 = {}) => ({ 결과: '통과', 언어: 'th', 틀: '퀴즈', 시각, 시험관: ['sonnet', 'haiku', 'opus', 'gpt'], ...덧 });
    이웃쓰기('LAB_이웃가', 통과뜻('2026-11-01T10:00:00+09:00'));
    이웃쓰기('LAB_이웃나', 통과뜻('2026-11-02T10:00:00+09:00'));
    이웃쓰기('LAB_이웃다', 통과뜻('2026-11-03T10:00:00+09:00'));
    const { 편 } = 판본글만들기(방);
    const 밖 = path.join(방, '밖');
    조용히(() => M.main(['판본', 편, 'TH', '--밖', 밖]));
    const 재료파일 = path.join(밖, '재료.json');
    const 재료 = JSON.parse(fs.readFileSync(재료파일, 'utf8'));
    const 좋은 = { 요약: '배꼽이 빠지다는 너무 웃긴다는 뜻', 풀기: [{ 문제: 1, 고름: 'A' }], 유일: [{ 문제: 1, 또있음: null }], 웃음: { 웃김: true, 줄: [3] } };
    for (const s of 재료.시험관) fs.writeFileSync(path.join(밖, `답_${s}.md`), 답(좋은));
    // 재료를 만든 뒤 — 이웃 「다」가 두 걸음으로 다시 받아졌다(확인할 것 → 눈확인 통과: 처음통과가 새 시각이 된다)
    const 나중 = '2099-01-01T10:10:00+09:00';
    이웃쓰기('LAB_이웃다', 통과뜻(나중, { 처음통과: 나중 }));
    const 첫3편 = (셈) => 셈.까닭.some((x) => /첫 3편/.test(x));
    assert.equal(첫3편(M.받은때셈(재료)), true, '지금의 이웃 기록으로 다시 세면 「앞에 통과한 편」이 둘로 준다');
    const 뜻기록 = () => JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')).돌림.판본.TH.검수.뜻;
    조용히(() => M.main(['채점', 밖, '--기록']));
    // 고치기 전: 채점할 때의 이웃 기록으로 다시 세어 「첫 3편 — 이 편 앞에 통과한 편 2」가 얼었다
    assert.equal(첫3편(뜻기록().시험관셈), false, '채점은 재료를 만든 때의 셈을 옮겨 적는다');
    assert.deepEqual(뜻기록().시험관셈, 재료.시험관셈);
    assert.equal(재료.시험관셈.센때, 재료.시각);
    // 같은 재료로 다시 적어도 같다(--눈확인 두 걸음 · 다시 채점)
    조용히(() => M.main(['채점', 밖, '--기록']));
    assert.deepEqual(뜻기록().시험관셈, 재료.시험관셈);
    // 셈 칸이 없는 옛 재료 — 같은 재료로 앞서 적은 기록(센때 = 재료 시각)이 있으면 그 값을 물려받는다
    const { 시험관셈: _셈, ...옛재료 } = 재료;
    fs.writeFileSync(재료파일, JSON.stringify(옛재료, null, 2));
    조용히(() => M.main(['채점', 밖, '--기록']));
    assert.deepEqual(뜻기록().시험관셈, 재료.시험관셈, '앞 기록의 셈을 물려받는다');
    // 물려받을 기록도 없으면 전처럼 지금 기록으로 센다(옛 재료의 동작 그대로)
    const 준비파일 = path.join(편, '게시', '준비.json');
    const p = JSON.parse(fs.readFileSync(준비파일, 'utf8'));
    delete p.돌림.판본.TH.검수.뜻;
    fs.writeFileSync(준비파일, JSON.stringify(p, null, 2));
    조용히(() => M.main(['채점', 밖, '--기록']));
    assert.equal(첫3편(뜻기록().시험관셈), true);
  } finally {
    if (앞 === undefined) delete process.env.SYNK_MARKETING_DIR; else process.env.SYNK_MARKETING_DIR = 앞;
    fs.rmSync(방, { recursive: true, force: true });
  }
});
