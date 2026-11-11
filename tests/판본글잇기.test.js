'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

// 뜻검사의 지난 기록은 빈 폴더에서 읽게(저장소 기록이 쌓여도 시험이 흔들리지 않게)
process.env.SYNK_MARKETING_DIR = fs.mkdtempSync(path.join(os.tmpdir(), '판본잇기-빈-'));
const 잇기 = require('../tools/lib/판본잇기.js');
const 판본글 = require('../tools/lib/판본글.js');
const 뜻 = require('../tools/뜻검사.js');

const REPO = path.resolve(__dirname, '..');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const 원장 = { accounts: {
  'lab-us-youtube': { brand: 'LAB', platform: 'youtube', language: 'en', countryCode: 'US', dailyFormats: ['이야기', '퀴즈'] },
  'lab-mx-youtube': { brand: 'LAB', platform: 'youtube', language: 'es', countryCode: 'MX', dailyFormats: ['이야기', '퀴즈'] },
  'lab-mx-tiktok': { brand: 'LAB', platform: 'tiktok', language: 'es', countryCode: 'MX', dailyFormats: ['이야기', '퀴즈'] },
  'lab-mx-telegram': { brand: 'LAB', platform: 'telegram', language: 'es', countryCode: 'MX', dailyFormats: ['퀴즈'] },
  'lab-youtube': { brand: 'LAB', platform: 'youtube', language: 'en', rotationVersion: 'EN', dailyFormats: ['이야기', '퀴즈'] },
  'brief-youtube': { brand: 'synkbrief', platform: 'youtube', language: 'ko', countryCode: 'US' },
} };

const 틀 = (lang, 덧 = {}) => ({
  _설명: { hook: '첫 2초 카드', endCard: '(선택) 끝 카드' }, _한도: { hook: { 폭px: 788 } },
  lang, font: "'Inter Tight', 'SUIT', sans-serif", lineH: 1.15, hook: '', hookSize: 66, reads: ['', ''], means: ['', ''], meanSize: 54,
  endCard: '', endSize: 60, ask: '', askSize: 46, coverAt: 1, ...덧,
});
const 지도 = () => ({
  꼴: '판본지도/1', 틀: '이야기', 판본폴더: 'remotion/src/m99/판본',
  기준: { 한문장: "'-지 마'는 하지 마라는 뜻이다", 핵심: [['지마', '하지마'], ['떠나', '가지마']], 웃음: "첫 잔소리 '먹지 마'가 끝에서 '먹어'로 뒤집힌다" },
  기본값: { reads: ['meok-ji ma', 'meo-geo'] },
  원고기본: { '*': { alteredContent: false }, youtube: { madeForKids: false } },
  줄: [
    { id: 'hook', 칸: '머리', 값: 'hook', 크기: 'hookSize', 원문: '그 사람은 늘 이렇게 말했다…', 초: [0, 1.6], 장면: '케이크로 다가가는 몽글',
      상자: { 폭: 788, 굵기: 800, 줄높이: 1.18, 판본줄높이: true, 최대줄: 2, 가운데: true, x: 96, y: 324 } },
    { id: 'ko.1', 칸: '한국어', 글: '먹지 마!', 초: [1.6, 3.7] },
    { id: 'reads.1', 칸: '읽기', 값: 'reads.0', 초: [1.6, 3.7], 상자: { 폭: 510, 글자크기: 46, 최대줄: 1, 줄바꿈: 'nowrap', 글꼴: "'Inter Tight', sans-serif" } },
    { id: 'means.1', 칸: '뜻', 값: 'means.0', 크기: 'meanSize', 원문: '먹지 마!', 초: [1.6, 3.7], 상자: { 폭: 580, 줄높이: 1.2, 판본줄높이: true, 최대줄: 1, 줄바꿈: 'nowrap' } },
    { id: 'ko.2', 칸: '한국어', 글: '먹어.', 초: [15.6, 17.7] },
    { id: 'reads.2', 칸: '읽기', 값: 'reads.1', 초: [15.6, 17.7] },
    { id: 'means.2', 칸: '뜻', 값: 'means.1', 크기: 'meanSize', 원문: '먹어.', 초: [15.6, 17.7] },
    { id: 'endCard', 칸: '상황', 값: 'endCard', 선택: true, 크기: 'endSize', 초: [18, 20.6], 상자: { 폭: 784, 줄높이: 1.2, 판본줄높이: true, 최대줄: 2 } },
    { id: 'ask', 칸: '끝질문', 값: 'ask', 선택: true, 크기: 'askSize', 초: [18, 20.6] },
  ],
});

function 편만들기(키들 = { US: 'en', MX: 'es', EN: 'en' }) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), '판본잇기-'));
  const 편 = path.join(방, 'LAB_시험이야기_20261110');
  const 판본폴더 = path.join(편, 'remotion', 'src', 'm99', '판본');
  fs.mkdirSync(판본폴더, { recursive: true });
  fs.mkdirSync(path.join(편, '게시'), { recursive: true });
  fs.writeFileSync(path.join(편, 잇기.지도이름), JSON.stringify(지도(), null, 2));
  for (const [k, lang] of Object.entries(키들)) fs.writeFileSync(path.join(판본폴더, `${k}.json`), JSON.stringify(틀(lang), null, 2) + '\n');
  fs.writeFileSync(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 상태: '올릴 준비', 판: [{ 계정: 'lab-instagram', 파일: 'x.mp4' }] }, null, 2) + '\n');
  return { 방, 편, 판본폴더 };
}
const 미국글 = {
  US: { hook: 'He only ever told me\nthree things…', means: ["Don't eat that!", 'Eat.'], endCard: 'Last slice of pizza? 먹지 마!', ask: 'Who says this to you?',
    _원문: { hook: '그는 나에게 딱 세 마디만 했다…', endCard: '마지막 피자 한 조각? 먹지 마!', ask: '누가 너에게 이 말을 해?' },
    // 본문 첫 줄은 125자를 넘긴다 — 첫 125자 안의 해시태그는 게시글 규칙의 고칠 것이고, 고칠 것이 있는 원고의 판본은 돌림에 안 든다(11-11)
    원고: { youtube: { title: '먹지 마 = "Don\'t eat" #learnkorean', caption: 'Add -지 마 to a verb and you get a short, blunt way to tell a close friend not to do something. Friends only, never with your boss.\n\n먹지 마 = don\'t eat\n\nSYNK LAB\n#learnkorean #korean', pinnedComment: 'Who says 먹지 마 to you?',
      _원문: { title: '먹지 마 = "먹지 마"', caption: '동사에 -지 마를 붙인다.\n\n먹지 마 = 먹지 마\n\nSYNK LAB\n#learnkorean #korean', pinnedComment: '누가 너에게 먹지 마라고 해?' } } } },
};

test('지도 검증 — 꼴 · 틀 · 모르는 칸 · 값과 글 둘 다 · 상자 크기', () => {
  assert.deepEqual(잇기.지도검증(지도()), []);
  const 나쁜 = 지도();
  나쁜.꼴 = '판본지도/0'; 나쁜.줄[0].칸 = '제목'; 나쁜.줄[1].값 = 'x'; 나쁜.줄[2].상자 = { 폭: 510 }; 나쁜.줄.push({ id: 'hook', 칸: '머리', 값: 'hook' });
  const 문제 = 잇기.지도검증(나쁜).join('\n');
  for (const 말 of ['판본지도/1', '모르는 칸 「제목」', '하나만 적는다', '글자크기', 'id가 겹친다']) assert.ok(문제.includes(말), `${말} ← ${문제}`);
});

test('채우기 — 틀의 안내 칸은 그대로, 없는 칸은 기본값, 틀에 없는 칸 · 다른 꼴은 거절, 원고 파일은 기본 칸 위에', () => {
  const { 편, 판본폴더 } = 편만들기();
  const 결과 = 잇기.채우기(편, 미국글);
  assert.equal(결과.length, 1);
  const 팩 = 판본글.readJson(path.join(판본폴더, 'US.json'));
  assert.equal(팩.hook, 미국글.US.hook);
  assert.deepEqual(팩.reads, ['meok-ji ma', 'meo-geo'], '입력에 없는 reads는 지도 기본값');
  assert.equal(팩._설명.hook, '첫 2초 카드');
  assert.equal(팩._한도.hook.폭px, 788);
  assert.equal(팩._원문.ask, '누가 너에게 이 말을 해?');
  const 원고 = 판본글.readJson(path.join(편, '게시', '판본', 'US', '원고_youtube.json'));
  assert.equal(원고.platform, 'youtube');
  assert.equal(원고.language, 'en');
  assert.equal(원고.audioLanguage, 'en', '동영상 언어 기본은 그 판 말(설계 게시경로 2-1)');
  assert.equal(원고.alteredContent, false);
  assert.equal(원고.madeForKids, false);
  assert.equal(원고.pinnedComment, 'Who says 먹지 마 to you?');
  // 이미 찬 칸은 기본값이 덮지 않는다(몽골판의 키릴 읽는 법)
  잇기.채우기(편, { US: { reads: ['мөгжи ма', 'мөгө'] } });
  잇기.채우기(편, { US: { ask: 'Who says this to you?' } });
  assert.deepEqual(판본글.readJson(path.join(판본폴더, 'US.json')).reads, ['мөгжи ма', 'мөгө']);
  assert.throws(() => 잇기.채우기(편, { US: { title: '없는 칸' } }), /틀에 없는 칸/);
  assert.throws(() => 잇기.채우기(편, { US: { means: ['하나뿐'] } }), /꼴이 다르다/);
  assert.throws(() => 잇기.채우기(편, { US: { hookSize: '66' } }), /꼴이 다르다/);
  assert.throws(() => 잇기.채우기(편, { US: { 원고: { blog: { caption: 'x' } } } }), /모르는 플랫폼/);
});

test('뽑기 — 판본글/1 꼴, 칸 · 원문 · 상자(글자크기 · 줄높이 · 글꼴), 선택 빈 칸은 빠짐, 게시글 줄(해시태그 · 서명 빼고 · 같은 줄 한 번)', () => {
  const { 편 } = 편만들기();
  잇기.채우기(편, 미국글);
  const r = 잇기.뽑기(편, 'US', { 원장 });
  assert.deepEqual(판본글.검증(r.자료), []);
  assert.equal(r.자료.편, 'LAB_시험이야기_20261110');
  assert.equal(r.자료.판본, 'US');
  assert.equal(r.자료.언어, 'en');
  assert.deepEqual(r.자료.나라, ['US']);
  assert.equal(r.자료.틀, '이야기');
  assert.equal(r.자료.기준.한문장, "'-지 마'는 하지 마라는 뜻이다");
  const 줄 = (id) => r.자료.줄.find((z) => z.id === id);
  assert.equal(줄('hook').칸, '머리');
  assert.equal(줄('hook').원문, '그는 나에게 딱 세 마디만 했다…', '판본 글 _원문이 지도 원문보다 먼저');
  assert.deepEqual(줄('hook').상자, { 폭: 788, 굵기: 800, 줄높이: 1.18, 최대줄: 2, 가운데: true, x: 96, y: 324, 글자크기: 66, 글꼴: "'Inter Tight', 'SUIT', sans-serif" });
  assert.equal(줄('means.1').원문, '먹지 마!', '_원문이 없는 칸은 지도 원문');
  assert.equal(줄('means.1').상자.글자크기, 54);
  assert.equal(줄('reads.1').상자.글꼴, "'Inter Tight', sans-serif", '지도가 글꼴을 정한 칸은 그대로');
  assert.equal(줄('ko.1').글, '먹지 마!');
  assert.equal(줄('endCard').칸, '상황');
  assert.equal(줄('ask').칸, '끝질문');
  const 게시글 = r.자료.줄.filter((z) => z.칸 === '게시글');
  assert.deepEqual(게시글.map((z) => z.id), ['게시글.youtube.제목.1', '게시글.youtube.본문.1', '게시글.youtube.본문.3', '게시글.youtube.고정댓글.1']);
  assert.equal(게시글[1].원문, '동사에 -지 마를 붙인다.');
  assert.equal(게시글[2].원문, '먹지 마 = 먹지 마');
  assert.deepEqual(r.경고, []);

  // 줄높이가 큰 문자 — 판본 글 lineH가 지도 줄높이보다 크면 그 값
  잇기.채우기(편, { US: { lineH: 1.45 } });
  assert.equal(잇기.뽑기(편, 'US', { 원장 }).자료.줄.find((z) => z.id === 'hook').상자.줄높이, 1.45);
  // 선택 칸을 비우면 줄이 빠진다, 필수 칸이 비면 던진다
  잇기.채우기(편, { US: { endCard: '', ask: '' } });
  assert.equal(잇기.뽑기(편, 'US', { 원장 }).자료.줄.some((z) => z.id === 'endCard' || z.id === 'ask'), false);
  assert.throws(() => 잇기.뽑기(편, 'MX', { 원장 }), /글이 아직 비었다\(hook · reads\.0 · means\.0 · reads\.1 · means\.1\)/);
  assert.throws(() => 잇기.뽑기(편, 'us', { 원장 }), /판본 키가 아니다/);
});

test('뽑기 — 전 세계 판(나라 없는 계정)은 나라가 비고, 원문 줄 수가 다르면 알린다, 플랫폼 둘의 같은 줄은 한 번만', () => {
  const { 편 } = 편만들기();
  잇기.채우기(편, { EN: { ...미국글.US, 원고: undefined } });
  assert.deepEqual(잇기.뽑기(편, 'EN', { 원장 }).자료.나라, []);
  잇기.채우기(편, { MX: { hook: 'Siempre me decía…', means: ['¡No comas!', 'Come.'],
    // 결합 글자가 든 해시태그 줄(태국어 · 싱할라어)도 해시태그 줄이다 — 뺀다
    원고: { youtube: { title: 'T', caption: 'Línea uno\nLínea dos', _원문: { caption: '한 줄뿐' } }, tiktok: { caption: 'Línea uno\nSolo TikTok\n#เรียนภาษาเกาหลี #කොරියන් #learnkorean' } } } });
  const r = 잇기.뽑기(편, 'MX', { 원장 });
  assert.ok(r.경고.some((w) => /줄 수가 달라/.test(w)), r.경고.join('|'));
  assert.deepEqual(r.자료.줄.filter((z) => z.칸 === '게시글').map((z) => `${z.id}=${z.글}`),
    ['게시글.tiktok.본문.1=Línea uno', '게시글.tiktok.본문.2=Solo TikTok', '게시글.youtube.제목.1=T', '게시글.youtube.본문.2=Línea dos']);
  assert.deepEqual(r.원고, { tiktok: '게시/판본/MX/원고_tiktok.json', youtube: '게시/판본/MX/원고_youtube.json' });
});

test('뽑기 — 원고 _칸으로 게시글 줄을 예문 칸으로, 지도 핵심덧으로 그 판본의 낱말을 채점 핵심에', () => {
  const { 편 } = 편만들기();
  const 지도파일 = path.join(편, 잇기.지도이름);
  const 지 = 판본글.readJson(지도파일);
  지.기준.핵심덧 = [{ 묶음: 0, 값: 'means.0' }];
  판본글.writeJson(지도파일, 지);
  const 글 = JSON.parse(JSON.stringify(미국글));
  글.US.원고.youtube._칸 = { caption: { 3: '예문' } };
  잇기.채우기(편, 글);
  const r = 잇기.뽑기(편, 'US', { 원장 });
  assert.equal(r.자료.줄.find((z) => z.id === '게시글.youtube.본문.3').칸, '예문');
  assert.equal(r.자료.줄.find((z) => z.id === '게시글.youtube.본문.1').칸, '게시글');
  assert.deepEqual(r.자료.기준.핵심, [['지마', '하지마', "Don't eat that!"], ['떠나', '가지마']]);
  assert.equal(r.자료.기준.핵심덧, undefined, '핵심덧은 글.json에 남기지 않는다');
  // 모르는 칸은 줄을 빼고 알린다
  글.US.원고.youtube._칸 = { caption: { 3: '보기글' } };
  잇기.채우기(편, 글);
  const r2 = 잇기.뽑기(편, 'US', { 원장 });
  assert.ok(r2.경고.some((w) => /모르는 칸 「보기글」/.test(w)));
  assert.equal(r2.자료.줄.some((z) => z.id === '게시글.youtube.본문.3'), false);
});

test('맞추기 — 같은 원천이면 같은 바이트(다시 쓰지 않는다), 판본 글 · 원고 · 지도를 고치면 지문이 바뀐다', () => {
  const { 편, 판본폴더 } = 편만들기();
  잇기.채우기(편, 미국글);
  const 첫 = 잇기.맞추기(편, 'US', { 원장 });
  assert.equal(첫.새로, true);
  assert.equal(첫.바뀜, true);
  assert.equal(path.relative(편, 첫.글파일).split(path.sep).join('/'), '게시/판본/US/글.json');
  assert.ok(!fs.readFileSync(첫.글파일, 'utf8').includes('\r'), '줄끝은 LF(지문이 체크아웃마다 같게 — .gitattributes도 LF로 고정)');
  const 시각 = fs.statSync(첫.글파일).mtimeMs;
  const 둘 = 잇기.맞추기(편, 'US', { 원장 });
  assert.equal(둘.바뀜, false);
  assert.equal(둘.지문, 첫.지문);
  assert.equal(fs.statSync(첫.글파일).mtimeMs, 시각, '같으면 파일을 건드리지 않는다');
  assert.equal(잇기.낡았나(편, 'US', { 원장 }), false);

  // 판본 글을 고치면 낡는다 → 맞추면 지문이 바뀐다
  잇기.채우기(편, { US: { hook: 'He always said this…' } });
  assert.equal(잇기.낡았나(편, 'US', { 원장 }), true);
  const 셋 = 잇기.맞추기(편, 'US', { 원장 });
  assert.equal(셋.바뀜, true);
  assert.notEqual(셋.지문, 첫.지문);
  // 안내 칸(_설명)만 고치면 그대로다
  const 팩파일 = path.join(판본폴더, 'US.json');
  const 팩 = 판본글.readJson(팩파일);
  팩._설명.hook = '고친 안내';
  판본글.writeJson(팩파일, 팩);
  assert.equal(잇기.낡았나(편, 'US', { 원장 }), false);
  // 원고(게시글)를 고쳐도 지문이 바뀐다
  const 원고파일 = path.join(편, '게시', '판본', 'US', '원고_youtube.json');
  const 원고 = 판본글.readJson(원고파일);
  원고.pinnedComment = 'Who do YOU say 가지 마 to?';
  판본글.writeJson(원고파일, 원고);
  assert.notEqual(잇기.맞추기(편, 'US', { 원장 }).지문, 셋.지문);
});

test('준비에넣기 — 「돌림」을 만들고 판본을 넣는다, 검수와 다른 칸은 그대로', () => {
  const { 편 } = 편만들기();
  잇기.채우기(편, 미국글);
  잇기.맞추기(편, 'US', { 원장 });
  const r = 잇기.준비에넣기(편, ['US'], { 쓸날: '2026-11-12' });
  assert.equal(r.바뀜, true);
  let prep = 판본글.readJson(판본글.준비경로(편));
  assert.equal(prep.돌림.형식, '이야기');
  assert.equal(prep.돌림.쓸날, '2026-11-12');
  assert.deepEqual(prep.돌림.판본.US, { 언어: 'en', 파일: '게시/판본/US/video.mp4', 표지: '게시/판본/US/cover.png', 글: '게시/판본/US/글.json', 원고: { youtube: '게시/판본/US/원고_youtube.json' } });
  assert.deepEqual(prep.판, [{ 계정: 'lab-instagram', 파일: 'x.mp4' }], '판은 건드리지 않는다');
  // 검수 · 멈춤이 있는 준비.json에 다시 넣어도 그대로
  판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: 'abc' });
  prep = 판본글.readJson(판본글.준비경로(편));
  prep.돌림.멈춤 = { 날: '2026-11-11', 까닭: '시험' };
  prep.돌림.판본.US.메모 = '남길 칸';
  판본글.writeJson(판본글.준비경로(편), prep);
  assert.equal(잇기.준비에넣기(편, ['US']).바뀜, false);
  prep = 판본글.readJson(판본글.준비경로(편));
  assert.deepEqual(prep.돌림.판본.US.검수, { 뜻: { 결과: '통과', 지문: 'abc' } });
  assert.equal(prep.돌림.판본.US.메모, '남길 칸');
  assert.equal(prep.돌림.멈춤.까닭, '시험');
  assert.equal(prep.돌림.쓸날, '2026-11-12');
});

// 영상 · 렌더 기록을 흉내 낸다(판본렌더.mjs가 남기는 꼴)
function 가짜렌더(편, 판본폴더, 키, 내용 = '영상', 자산 = true) {
  const 폴더 = path.join(편, '게시', '판본', 키);
  fs.mkdirSync(폴더, { recursive: true });
  fs.writeFileSync(path.join(폴더, 'video.mp4'), 내용);
  fs.writeFileSync(path.join(폴더, 'cover.png'), '표지');
  // 자산sha256 — 판본렌더.mjs가 번들 때 잰 원본 그림 · 소리 · 틀의 지문(11-11). 「자산」을 false로 주면 옛 렌더 기록(지문 없음) 꼴
  const 기록 = { 판본: 키, 글sha256: sha(path.join(판본폴더, `${키}.json`)), 영상sha256: sha(path.join(폴더, 'video.mp4')) };
  if (자산 !== false) 기록.자산sha256 = 잇기.자산지문(편).지문;
  fs.writeFileSync(path.join(폴더, '렌더.json'), JSON.stringify(기록));
  return path.join(폴더, 'video.mp4');
}

test('확인 — 사슬이 다 맞으면 문제 없음, 글 · 영상 · 원고 · 검수 지문이 어긋나면 짚는다', () => {
  const { 편, 판본폴더 } = 편만들기();
  잇기.채우기(편, 미국글);
  assert.ok(잇기.확인(편, 'US', { 원장 }).문제.some((m) => /글\.json이 없다/.test(m)));
  잇기.맞추기(편, 'US', { 원장 });
  const 영상 = 가짜렌더(편, 판본폴더, 'US');
  잇기.준비에넣기(편, ['US']);
  let 문제 = 잇기.확인(편, 'US', { 원장 }).문제;
  assert.deepEqual(문제, ['뜻 검수 전', '글자 검수 전']);
  const 글파일 = path.join(편, '게시', '판본', 'US', '글.json');
  판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: sha(글파일) });
  판본글.검수쓰기(편, 'US', '글자', { 결과: '통과', 지문: sha(영상), 글지문: sha(글파일) });
  assert.deepEqual(잇기.확인(편, 'US', { 원장 }), { 키: 'US', 문제: [], 알림: [] });

  // 판본 글을 고치고 아무것도 안 했다 → 글.json 낡음 + 영상이 지금 글로 구운 것이 아님
  잇기.채우기(편, { US: { hook: 'He always said this…' } });
  문제 = 잇기.확인(편, 'US', { 원장 }).문제.join('\n');
  assert.match(문제, /글\.json이 판본 글 · 지도 · 원고보다 낡았다/);
  assert.match(문제, /영상이 지금 판본 글로 구운 것이 아니다/);
  // 글.json만 다시 뽑고 뜻 검사만 다시 받았다(렌더를 빠뜨림) → 영상 낡음 + 글자 검수 뒤 글이 바뀜
  잇기.맞추기(편, 'US', { 원장 });
  문제 = 잇기.확인(편, 'US', { 원장 }).문제.join('\n');
  assert.match(문제, /뜻 검수 뒤 글이 바뀜/);
  판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: sha(글파일) });
  const 둘째 = 잇기.확인(편, 'US', { 원장 });
  assert.match(둘째.문제.join('\n'), /영상이 지금 판본 글로 구운 것이 아니다/);
  assert.ok(둘째.알림.some((m) => /글자 검사 뒤 글\.json이 바뀌었다/.test(m)), '글자 검사 뒤 글.json만 바뀐 것은 알림(문제는 렌더 기록이 가른다)');
  // 다시 렌더했다 → 글자 검수 뒤 영상이 바뀜
  가짜렌더(편, 판본폴더, 'US', '새 영상');
  문제 = 잇기.확인(편, 'US', { 원장 }).문제.join('\n');
  assert.match(문제, /글자 검수 뒤 영상이 바뀜/);
  assert.doesNotMatch(문제, /영상이 지금 판본 글로/);

  // 원고가 없는 플랫폼 — 멕시코는 유튜브 · 틱톡(텔레그램은 퀴즈만이라 이야기 원고가 필요 없다)
  잇기.채우기(편, { MX: { hook: 'Siempre me decía…', means: ['¡No comas!', 'Come.'], 원고: { youtube: { title: 'T', caption: 'C' } } } });
  잇기.맞추기(편, 'MX', { 원장 });
  문제 = 잇기.확인(편, 'MX', { 원장 }).문제.join('\n');
  assert.match(문제, /원고가 없는 플랫폼: tiktok\(/);
  assert.match(문제, /영상이 없다/);
  assert.match(문제, /「돌림」\.판본에 MX가 없다/);
  // 글이 빈 판본
  assert.match(잇기.확인(편, 'EN', { 원장 }).문제[0], /글이 아직 비었다/);
});

test('지문 조건 — 판본 글을 고쳐 다시 뽑으면 돌림표가 뜻 검수를 무효로 본다(tools/돌림표.js versionState)', () => {
  const { 편, 판본폴더 } = 편만들기();
  잇기.채우기(편, 미국글);
  잇기.맞추기(편, 'US', { 원장 });
  const 영상 = 가짜렌더(편, 판본폴더, 'US');
  잇기.준비에넣기(편, ['US']);
  const 글파일 = path.join(편, '게시', '판본', 'US', '글.json');
  판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: sha(글파일) });
  판본글.검수쓰기(편, 'US', '글자', { 결과: '통과', 지문: sha(영상) });
  const 캐시 = fs.mkdtempSync(path.join(os.tmpdir(), '판본잇기-지문-'));
  // 키를 주면(돌림표 · 올리기 전 검사가 부르는 꼴) 글.json이 원천과 같은지 · 원고의 게시글 고칠 것까지 본다
  const 상태 = (키 = null) => {
    const 코드 = `process.env.SYNK_ROTATION_DIR=${JSON.stringify(캐시)};const d=require(${JSON.stringify(path.join(REPO, 'tools', '돌림표.js'))});const p=require(${JSON.stringify(path.join(REPO, 'tools', 'lib', '판본글.js'))});`
      + `const v=p.readJson(${JSON.stringify(판본글.준비경로(편))}).돌림.판본.US;console.log(JSON.stringify(d.versionState(${JSON.stringify(편)},v,['뜻','글자']${키 ? `,${JSON.stringify(키)},{accounts:${JSON.stringify(원장.accounts)}}` : ''})));`;
    const r = spawnSync(process.execPath, ['-e', 코드], { encoding: 'utf8', windowsHide: true });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout.trim().split('\n').pop());
  };
  const 뜻통과 = () => 판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: sha(글파일) });
  assert.equal(상태().ready, true);
  assert.equal(상태('US').ready, true);
  잇기.채우기(편, { US: { ask: 'Who says this to YOU?' } });
  assert.equal(상태().ready, true, '키 없이 부르면 영상 · 글.json 한 쌍만 본다');
  const 낡음 = 상태('US');
  assert.equal(낡음.ready, false, '원천을 고치고 다시 뽑지 않은 판본은 돌림에 안 든다(11-11 — 고친 글이 뜻 검수 통과를 달고 나가지 않게)');
  assert.match(낡음.why, /다시 뽑지 않음/);
  잇기.맞추기(편, 'US', { 원장 });
  const 뒤 = 상태('US');
  assert.equal(뒤.ready, false);
  assert.match(뒤.why, /뜻 검수 뒤 글이 바뀜/);
  뜻통과();
  // 화면 글(판본 글)을 고쳤으니 뜻 검사만 다시 받아서는 안 든다 — 영상이 옛 글이다(11-11 P1-3). 다시 구워야 든다
  assert.match(상태('US').why, /영상이 지금 판본 글로 구운 것이 아니다/);
  가짜렌더(편, 판본폴더, 'US');
  assert.equal(상태('US').ready, true);

  // 원고(게시글)만 고친 것도 같다 — 뽑기 전에는 「다시 뽑지 않음」, 뽑은 뒤에는 「뜻 검수 뒤 글이 바뀜」
  const 원고파일 = path.join(편, '게시', '판본', 'US', '원고_youtube.json');
  const 원고 = 판본글.readJson(원고파일);
  원고.pinnedComment = 'Who says 먹지 마 to you the most?';
  판본글.writeJson(원고파일, 원고);
  assert.match(상태('US').why, /다시 뽑지 않음/);
  잇기.맞추기(편, 'US', { 원장 });
  assert.match(상태('US').why, /뜻 검수 뒤 글이 바뀜/);
  뜻통과();
  assert.equal(상태('US').ready, true);

  // 원고의 게시글 고칠 것(상대 날짜) — 뜻 검수를 다시 받아도 돌림에 안 든다(이 원고가 판이 되면 올리기 전 검사가 편 전체를 막는다)
  원고.pinnedComment = 'Which one did you say this week?';
  판본글.writeJson(원고파일, 원고);
  잇기.맞추기(편, 'US', { 원장 });
  뜻통과();
  const 글 = 상태('US');
  assert.equal(글.ready, false);
  assert.match(글.why, /원고 고칠 것 — youtube 고정 댓글: 상대 날짜 「this week」/);
  assert.ok(잇기.확인(편, 'US', { 원장 }).문제.some((m) => /원고 고칠 것 — youtube 고정 댓글: 상대 날짜/.test(m)), '확인도 같은 것을 문제로 짚는다');
  assert.deepEqual(잇기.원고고칠것(편, { 원고: { tiktok: '게시/판본/US/원고_tiktok.json' } }), ['tiktok: 원고 파일이 없다(게시/판본/US/원고_tiktok.json)']);
  // 유튜브 동영상 언어 칸이 그 판 말이 아니면(옛 기본값 ko) 그 판본도 돌림에 안 든다 — 글.json에는 안 드는 칸이라 뜻 검사는 그대로다
  원고.pinnedComment = 'Who says 먹지 마 to you the most?';
  원고.audioLanguage = 'ko';
  판본글.writeJson(원고파일, 원고);
  잇기.맞추기(편, 'US', { 원장 });
  뜻통과();
  assert.match(상태('US').why, /원고 고칠 것 — youtube 동영상 언어: 원고 audioLanguage\(ko\)가 그 판 말\(en\)이 아니다/);
  원고.audioLanguage = 'en-US';
  판본글.writeJson(원고파일, 원고);
  assert.equal(잇기.낡았나(편, 'US', { 원장 }), false, '동영상 언어 칸은 글.json에 안 든다');
  assert.equal(상태('US').ready, true, '앞 토막이 같으면 같은 말(en-US · en)');
  // 지도가 있는데 「글」이 지도의 글.json이 아니면 견줄 원천이 없다 — 낡은 것으로 본다(닫는 쪽, 11-11 밤 P1-렌1). 지도가 없는 편은 볼 것이 없다(null)
  assert.equal(잇기.글낡음(편, 'US', { 글: 'remotion/src/m99/판본/US.json' }), true);
  fs.rmSync(path.join(편, 잇기.지도이름));
  assert.equal(잇기.글낡음(편, 'US', { 글: '게시/판본/US/글.json' }), null);
});

test('판본 「글」의 철자 — 같은 글.json을 다르게 적어도 글 · 렌더 관문이 그대로 서고, 지도의 글.json이 아닌 「글」은 돌림에 못 든다(11-11 밤 P1-렌1)', () => {
  const { 편, 판본폴더 } = 편만들기();
  잇기.채우기(편, 미국글);
  const 리모션 = path.join(편, 'remotion');
  fs.mkdirSync(path.join(리모션, 'public', 'img'), { recursive: true });
  const 그림 = path.join(리모션, 'public', 'img', 'dusk.jpg');
  fs.writeFileSync(그림, Buffer.from([0xff, 0xd8, 0x00, 0x01]));
  잇기.맞추기(편, 'US', { 원장 });
  const 영상 = 가짜렌더(편, 판본폴더, 'US');
  잇기.준비에넣기(편, ['US']);
  const 글파일 = path.join(편, '게시', '판본', 'US', '글.json');
  판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: sha(글파일) });
  판본글.검수쓰기(편, 'US', '글자', { 결과: '통과', 지문: sha(영상), 글지문: sha(글파일) });
  const 캐시 = fs.mkdtempSync(path.join(os.tmpdir(), '판본잇기-철자-'));
  // 준비.json 판본의 「글」을 그 철자로 바꿔 적고 돌림표가 보는 상태를 읽는다
  const 상태 = (글) => {
    const prep = 판본글.readJson(판본글.준비경로(편));
    prep.돌림.판본.US.글 = 글;
    판본글.writeJson(판본글.준비경로(편), prep);
    const 코드 = `process.env.SYNK_ROTATION_DIR=${JSON.stringify(캐시)};const d=require(${JSON.stringify(path.join(REPO, 'tools', '돌림표.js'))});const p=require(${JSON.stringify(path.join(REPO, 'tools', 'lib', '판본글.js'))});`
      + `const v=p.readJson(${JSON.stringify(판본글.준비경로(편))}).돌림.판본.US;console.log(JSON.stringify(d.versionState(${JSON.stringify(편)},v,['뜻','글자'],'US',{accounts:${JSON.stringify(원장.accounts)}})));`;
    const r = spawnSync(process.execPath, ['-e', 코드], { encoding: 'utf8', windowsHide: true });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout.trim().split('\n').pop());
  };
  const 바른 = '게시/판본/US/글.json';
  // 같은 파일을 가리키는 철자들 — 글자 그대로 견주던 동안에는 이 꼴들이 「지도와 안 이어진 판본」이 되어 두 관문이 꺼졌다
  // (역빗금 철자는 윈도우에서만 — 그 밖에서는 역빗금이 든 파일 이름이라 돌림표가 그 글 파일을 못 찾아 먼저 닫는다)
  const 철자들 = [바른, './게시/판본/US/글.json', '게시//판본/US/글.json', '게시/판본/../판본/US/글.json', path.join(편, '게시', '판본', 'US', '글.json'),
    ...(process.platform === 'win32' ? ['게시\\판본\\US\\글.json'] : [])];
  for (const 글 of 철자들) assert.equal(상태(글).ready, true, `멀쩡한 판본은 철자가 달라도 든다: ${글}`);
  // 원본 그림을 고친 뒤 다시 굽지 않음 — 어느 철자로 적어도 렌더 관문이 닫는다(고치기 전: 바른 철자만 닫고 나머지는 든다)
  fs.writeFileSync(그림, Buffer.from([0xff, 0xd8, 0x00, 0x02]));
  for (const 글 of 철자들) {
    const s = 상태(글);
    assert.equal(s.ready, false, `렌더 뒤 그림이 바뀐 판본: ${글}`);
    assert.match(s.why, /렌더 뒤 원본 그림 · 소리 · 틀/, 글);
    assert.match(잇기.렌더낡음(편, 'US', { 글 }), /렌더 뒤 원본 그림 · 소리 · 틀/);
  }
  가짜렌더(편, 판본폴더, 'US');
  for (const 글 of 철자들) {
    assert.equal(잇기.이음문제(편, 'US', { 글 }), false, `이어진 글: ${글}`);
    assert.equal(잇기.검사전(편, 'US', { 글 }).이음, true, 글);
  }
  // 원고를 고치고 다시 뽑지 않음 — 글 낡음 관문도 어느 철자로든 닫는다
  const 원고파일 = path.join(편, '게시', '판본', 'US', '원고_youtube.json');
  const 원고 = 판본글.readJson(원고파일);
  판본글.writeJson(원고파일, { ...원고, pinnedComment: 'Who says 먹지 마 to you the most?' });
  for (const 글 of 철자들) {
    assert.match(상태(글).why, /다시 뽑지 않음/, 글);
    assert.equal(잇기.글낡음(편, 'US', { 글 }, { 원장 }), true, 글);
  }
  판본글.writeJson(원고파일, 원고);
  assert.equal(상태(바른).ready, true);
  // 지도의 글.json이 아닌 「글」 — 판본렌더.mjs가 렌더.json 「돌림판본.글」에 적어 주던 꼴(판본 글 원천)을 옮겨 적은 판본, 다른 키의 글.json, 빈 칸
  for (const 글 of ['remotion/src/m99/판본/US.json', '게시/판본/MX/글.json', '']) {
    assert.match(잇기.이음문제(편, 'US', { 글 }), /이 판본 지도가 뽑는 글\(게시\/판본\/US\/글\.json\)이 아니다 — 글 · 렌더 관문이 이 판본을 볼 수 없다/, 글);
    assert.equal(잇기.글낡음(편, 'US', { 글 }), true, `낡은 것으로 본다: ${글}`);
    assert.match(잇기.렌더낡음(편, 'US', { 글 }), /판본 지도가 뽑는 글/, 글);
  }
  // 그 꼴이 준비.json에 들면: 뜻 검수 지문을 그 파일로 맞춰 적어도(판본 글 원천의 지문) 돌림에 못 든다 — 고치기 전에는 ready:true였다
  const 팩 = 'remotion/src/m99/판본/US.json';
  판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: sha(path.join(편, 팩)) });
  const 끊김 = 상태(팩);
  assert.equal(끊김.ready, false);
  assert.match(끊김.why, /준비\.json 판본 US의 「글」\(remotion\/src\/m99\/판본\/US\.json\)이 판본 지도가 뽑는 글\(게시\/판본\/US\/글\.json\)이 아니다/);
  // 윈도우는 대소문자를 가리지 않는 파일 체계 — 폴더 대소문자만 다른 철자는 같은 파일이다. 그 밖에서는 다른 파일(없는 파일)이라 닫힌다
  const 소문자 = '게시/판본/us/글.json';
  if (process.platform === 'win32') assert.equal(잇기.이음문제(편, 'US', { 글: 소문자 }), false);
  else assert.match(잇기.이음문제(편, 'US', { 글: 소문자 }), /판본 지도가 뽑는 글/);
  // 판본 지도가 없는 편은 볼 것이 없다
  fs.rmSync(path.join(편, 잇기.지도이름));
  assert.equal(잇기.이음문제(편, 'US', { 글: 팩 }), null);
  assert.equal(잇기.렌더낡음(편, 'US', { 글: 팩 }), null);
});

test('판본렌더.mjs가 렌더.json 「돌림판본」에 적는 꼴은 지도가 뽑는 글.json이다 — 그 꼴을 준비.json에 옮겨도 관문과 이어진다(11-11 밤 P1-렌1)', () => {
  const { 편 } = 편만들기();
  잇기.채우기(편, 미국글);
  잇기.맞추기(편, 'US', { 원장 });
  // 판본렌더.mjs는 지도가 있으면 판본잇기 돌림판본을 그대로 적는다 — 그 꼴은 이어진 글이다
  const 옮길꼴 = 잇기.돌림판본(편, 'US');
  assert.equal(옮길꼴.글, '게시/판본/US/글.json');
  assert.equal(잇기.이음문제(편, 'US', 옮길꼴), false);
  // 저장소의 판본렌더.mjs(다섯 편이 같은 몸통)가 판본 글 원천을 「글」로 적는 옛 줄을 되살리지 않았는가
  const 마케팅 = path.join(REPO, 'docs', '마케팅');
  const 렌더들 = fs.readdirSync(마케팅, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(마케팅, d.name, '판본렌더.mjs')).filter((f) => fs.existsSync(f));
  assert.ok(렌더들.length >= 2, '판본렌더.mjs가 있는 편(지마 · 화날때)');
  for (const f of 렌더들) {
    const src = fs.readFileSync(f, 'utf8');
    const 줄 = src.split(/\r?\n/).filter((l) => /^\s*돌림판본:/.test(l));
    assert.equal(줄.length, 1, `${path.basename(path.dirname(f))}: 「돌림판본」을 적는 줄은 하나`);
    assert.ok(줄[0].includes('잇기.돌림판본(여기, k)'), `${path.basename(path.dirname(f))}: 지도가 있으면 판본잇기 돌림판본으로 적는다`);
    assert.ok(!/글:\s*`\$\{편\.판본폴더\}/.test(줄[0]), `${path.basename(path.dirname(f))}: 판본 글 원천(<판본폴더>/<키>.json)을 「글」로 적지 않는다`);
    assert.ok(줄[0].includes('글: `게시/판본/${k}/글.json`'), `${path.basename(path.dirname(f))}: 지도가 없는 편도 글.json 꼴`);
  }
});

test('렌더 자산 지문 — 원본 그림 · 소리 · 틀이 바뀌면 달라지고, 줄끝 · 판본 글 · 숨김 파일 · node_modules는 세지 않는다(11-11)', () => {
  const { 편, 판본폴더 } = 편만들기();
  잇기.채우기(편, 미국글);
  const 리모션 = path.join(편, 'remotion');
  fs.mkdirSync(path.join(리모션, 'public', 'img'), { recursive: true });
  fs.mkdirSync(path.join(리모션, 'node_modules', 'x'), { recursive: true });
  const 그림 = path.join(리모션, 'public', 'img', 'dusk.jpg');
  const 틀파일 = path.join(리모션, 'src', 'm99', 'Film.tsx');
  fs.writeFileSync(그림, Buffer.from([0xff, 0xd8, 0x00, 0x0d, 0x0a, 0x01])); // 바이너리(NUL) — 안의 CR LF는 그대로 센다
  fs.writeFileSync(틀파일, 'export const a = 1;\nexport const b = 2;\n');
  fs.writeFileSync(path.join(리모션, 'node_modules', 'x', 'index.js'), 'x');
  const 지도 = 잇기.지도읽기(편).지도;
  assert.deepEqual(잇기.자산자리(지도), ['remotion/public', 'remotion/src']);
  assert.deepEqual(잇기.자산파일들(편, 지도).map((f) => f.이름), ['remotion/public/img/dusk.jpg', 'remotion/src/m99/Film.tsx'], '판본 글(US · MX · EN.json) · node_modules는 뺀다');
  const 처음 = 잇기.자산지문(편).지문;
  // 줄끝만 CRLF로(올리기 · 따라가기가 작업본 글 파일을 다시 쓴다) → 같은 지문
  fs.writeFileSync(틀파일, 'export const a = 1;\r\nexport const b = 2;\r\n');
  assert.equal(잇기.자산지문(편).지문, 처음, '글 파일의 줄끝은 세지 않는다');
  // 판본 글을 고쳐도 자산 지문은 그대로(글sha256이 따로 지킨다), 숨김 파일도 안 센다
  잇기.채우기(편, { US: { hook: 'He always said this…' } });
  fs.writeFileSync(path.join(리모션, 'public', '.DS_Store'), 'x');
  assert.equal(잇기.자산지문(편).지문, 처음);
  // 틀 글자 하나 · 그림 바이트 하나 · 새 파일은 다른 지문
  fs.writeFileSync(틀파일, 'export const a = 1;\r\nexport const b = 3;\r\n');
  const 틀바뀜 = 잇기.자산지문(편).지문;
  assert.notEqual(틀바뀜, 처음);
  fs.writeFileSync(그림, Buffer.from([0xff, 0xd8, 0x00, 0x0a, 0x01, 0x02]));
  const 그림바뀜 = 잇기.자산지문(편).지문;
  assert.notEqual(그림바뀜, 틀바뀜);
  fs.writeFileSync(path.join(리모션, 'public', 'img', 'new.jpg'), Buffer.from([0, 1]));
  assert.notEqual(잇기.자산지문(편).지문, 그림바뀜);
  // 지도 「자산」으로 자리를 정하면 그 자리만 센다
  assert.deepEqual(잇기.자산파일들(편, { ...지도, 자산: ['remotion/public/img/dusk.jpg'] }).map((f) => f.이름), ['remotion/public/img/dusk.jpg']);
});

test('렌더 관문 — 렌더 기록이 없거나, 화면 글 · 원본 그림을 고친 뒤 다시 굽지 않은 판본은 돌림에 못 든다(11-11 P1-3: 지마 일곱 판본)', () => {
  const { 편, 판본폴더 } = 편만들기();
  잇기.채우기(편, 미국글);
  const 리모션 = path.join(편, 'remotion');
  fs.mkdirSync(path.join(리모션, 'public', 'img'), { recursive: true });
  const 그림 = path.join(리모션, 'public', 'img', 'dusk.jpg');
  fs.writeFileSync(그림, Buffer.from([0xff, 0xd8, 0x00, 0x01]));
  잇기.맞추기(편, 'US', { 원장 });
  const 영상 = 가짜렌더(편, 판본폴더, 'US');
  잇기.준비에넣기(편, ['US']);
  const 글파일 = path.join(편, '게시', '판본', 'US', '글.json');
  const 검수 = () => {
    판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: sha(글파일) });
    판본글.검수쓰기(편, 'US', '글자', { 결과: '통과', 지문: sha(영상), 글지문: sha(글파일) });
  };
  검수();
  const 캐시 = fs.mkdtempSync(path.join(os.tmpdir(), '판본잇기-렌더-'));
  const 상태 = () => {
    const 코드 = `process.env.SYNK_ROTATION_DIR=${JSON.stringify(캐시)};const d=require(${JSON.stringify(path.join(REPO, 'tools', '돌림표.js'))});const p=require(${JSON.stringify(path.join(REPO, 'tools', 'lib', '판본글.js'))});`
      + `const v=p.readJson(${JSON.stringify(판본글.준비경로(편))}).돌림.판본.US;console.log(JSON.stringify(d.versionState(${JSON.stringify(편)},v,['뜻','글자'],'US',{accounts:${JSON.stringify(원장.accounts)}})));`;
    const r = spawnSync(process.execPath, ['-e', 코드], { encoding: 'utf8', windowsHide: true });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout.trim().split('\n').pop());
  };
  const 문제들 = () => 잇기.확인(편, 'US', { 원장 }).문제.join('\n');
  assert.equal(상태().ready, true);
  assert.equal(잇기.렌더낡음(편, 'US', { 글: '게시/판본/US/글.json' }), false);

  // ⓐ 화면 글을 고침 → 뽑기 → 뜻 검사만 다시(렌더 · 글자 검사는 안 함): 뜻 · 글자 지문은 다 맞지만 영상은 옛 글이다
  잇기.채우기(편, { US: { hook: 'He always said this…' } });
  잇기.맞추기(편, 'US', { 원장 });
  판본글.검수쓰기(편, 'US', '뜻', { 결과: '통과', 지문: sha(글파일) });
  let s = 상태();
  assert.equal(s.ready, false, '새 글로 뜻 통과를 달고 옛 글 영상이 나가지 않는다');
  assert.match(s.why, /영상이 지금 판본 글로 구운 것이 아니다/);
  assert.match(잇기.검사전(편, 'US').렌더문제, /영상이 지금 판본 글로 구운 것이 아니다/);
  가짜렌더(편, 판본폴더, 'US');
  assert.equal(상태().ready, true, '다시 구우면(같은 영상 바이트 — 글자 지문 그대로) 든다');

  // ⓑ 원본 그림을 고친 뒤 다시 굽지 않음: 영상 지문 · 글자 검수는 그대로인데 영상은 옛 그림이다
  fs.writeFileSync(그림, Buffer.from([0xff, 0xd8, 0x00, 0x02]));
  s = 상태();
  assert.equal(s.ready, false);
  assert.match(s.why, /렌더 뒤 원본 그림 · 소리 · 틀\(remotion\/public · remotion\/src\)이 바뀌었다 — node 판본렌더\.mjs US → 글자 검사 다시/);
  assert.match(문제들(), /렌더 뒤 원본 그림 · 소리 · 틀/);
  가짜렌더(편, 판본폴더, 'US');
  assert.equal(상태().ready, true);

  // ⓒ 자산 지문이 없는 옛 렌더 기록 · 렌더 기록이 없는 영상 · 다른 영상의 기록
  가짜렌더(편, 판본폴더, 'US', '영상', false);
  assert.match(상태().why, /렌더 기록에 자산 지문이 없다/);
  fs.rmSync(path.join(편, '게시', '판본', 'US', '렌더.json'));
  s = 상태();
  assert.equal(s.ready, false);
  assert.match(s.why, /렌더 기록\(렌더\.json\)이 없다/);
  assert.match(문제들(), /렌더 기록\(렌더\.json\)이 없다/, '확인도 알림이 아니라 문제로 짚는다');
  가짜렌더(편, 판본폴더, 'US');
  fs.writeFileSync(영상, '손으로 바꾼 영상');
  판본글.검수쓰기(편, 'US', '글자', { 결과: '통과', 지문: sha(영상), 글지문: sha(글파일) });
  assert.match(상태().why, /영상이 렌더 기록\(렌더\.json\)과 다르다/);
  // 표지만 뜬 기록(글 · 영상 지문 없음)
  fs.writeFileSync(path.join(편, '게시', '판본', 'US', '렌더.json'), JSON.stringify({ 판본: 'US', 표지만: '렌더 기록 없이 표지만 떴다' }));
  assert.match(상태().why, /렌더 기록에 글 · 영상 지문이 없다/);
  // 지도의 글.json이 아닌 「글」은 볼 것이 없는 것(null)이 아니라 닫히는 까닭이다(11-11 밤 P1-렌1 — 위 「판본 「글」의 철자」 시험)
  assert.match(잇기.렌더낡음(편, 'US', { 글: 'remotion/src/m99/판본/US.json' }), /판본 지도가 뽑는 글\(게시\/판본\/US\/글\.json\)이 아니다/);
});

test('검사전 — 지도가 없는 편은 null, 「글」이 지도의 글.json이 아니면 이음 아님, 맞으면 맞추고 영상 낡음을 본다', () => {
  const { 편, 판본폴더 } = 편만들기();
  잇기.채우기(편, 미국글);
  잇기.맞추기(편, 'US', { 원장 });
  가짜렌더(편, 판본폴더, 'US');
  잇기.준비에넣기(편, ['US']);
  assert.deepEqual(잇기.검사전(편, 'US'), { 이음: true, 바뀜: false, 경고: [], 영상낡음: false, 렌더문제: null, 바른글: '게시/판본/US/글.json' });
  // 11-10 화날때: 올리기 · 따라가기가 원천의 줄끝만 CRLF로 바꿔도 「렌더 뒤 글이 바뀜」이 아니다(글이 한 자라도 다르면 그때는 낡음)
  const 원천 = 잇기.팩경로(편, 잇기.지도읽기(편).지도, 'US');
  const 원래 = fs.readFileSync(원천, 'utf8');
  fs.writeFileSync(원천, 원래.replace(/\r?\n/g, '\r\n'));
  assert.equal(잇기.검사전(편, 'US').영상낡음, false, '줄끝만 CRLF로 바뀐 원천');
  assert.equal(잇기.확인(편, 'US', { 원장 }).문제.some((x) => /렌더 뒤 글이 바뀜/.test(x)), false);
  assert.equal(잇기.같은글(crypto.createHash('sha256').update(원래).digest('hex'), 원천), true);
  assert.equal(잇기.같은글(crypto.createHash('sha256').update(`${원래} `).digest('hex'), 원천), false, '글이 한 자라도 다르면 다른 글');
  fs.writeFileSync(원천, 원래);
  잇기.채우기(편, { US: { hook: 'He always said this…' } });
  const r = 잇기.검사전(편, 'US');
  assert.equal(r.바뀜, true, '검사 전에 글.json을 다시 뽑는다');
  assert.equal(r.영상낡음, true);
  assert.equal(잇기.낡았나(편, 'US'), false);
  assert.equal(잇기.검사전(편, 'US', { 글: 'remotion/src/m99/판본/US.json' }).이음, false);
  fs.rmSync(path.join(편, 잇기.지도이름));
  assert.equal(잇기.검사전(편, 'US'), null);
});

test('뜻검사 — 판본 명령이 글.json을 맞춘 뒤 재료를 만들고, 채점 기록은 그사이 원천이 바뀌면 거절한다. 이야기 틀은 마음이 움직이는 자리도 묻는다', () => {
  const { 편 } = 편만들기();
  잇기.채우기(편, 미국글);
  잇기.맞추기(편, 'US');
  잇기.준비에넣기(편, ['US']);
  잇기.채우기(편, { US: { ask: 'Who says this to YOU?' } }); // 뽑기를 잊었다
  const 밖 = path.join(편, '뜻');
  const 조용히 = (f) => { const [log, err] = [console.log, console.error]; console.log = () => {}; console.error = () => {}; try { return f(); } finally { console.log = log; console.error = err; } };
  assert.equal(조용히(() => 뜻.main(['판본', 편, 'US', '--밖', 밖])), 0);
  const 질문 = fs.readFileSync(path.join(밖, '질문.md'), 'utf8');
  assert.ok(질문.includes('Who says this to YOU?'), '낡은 글이 아니라 고친 글로 재료를 만든다');
  assert.ok(질문.includes('마음이 움직이는'), '이야기 틀의 웃음 물음');
  const 재료 = 판본글.readJson(path.join(밖, '재료.json'));
  assert.equal(재료.기준.한문장, "'-지 마'는 하지 마라는 뜻이다");
  for (const s of 재료.시험관) {
    fs.writeFileSync(path.join(밖, `답_${s}.md`), JSON.stringify({ 요약: "'-지 마'는 하지 마라는 뜻이고 떠나는 사람에게 가지 마라고 한다", 웃음: { 웃김: true, 줄: [], 까닭: "처음 '먹지 마'가 끝에서 '먹어'로 뒤집혀 뭉클하다" }, 모름줄: [], 불편: [], 결함: [] }));
  }
  // 채점 전에 원천을 또 고쳤다 → 기록 거절
  잇기.채우기(편, { US: { ask: 'Who nags you the most?' } });
  assert.equal(조용히(() => 뜻.main(['채점', 밖, '--기록'])), 2);
  assert.equal(판본글.readJson(판본글.준비경로(편)).돌림.판본.US.검수, undefined);
  // 되돌리면 기록된다
  잇기.채우기(편, { US: { ask: 'Who says this to YOU?' } });
  assert.equal(조용히(() => 뜻.main(['채점', 밖, '--기록'])), 0);
  const 검수 = 판본글.readJson(판본글.준비경로(편)).돌림.판본.US.검수.뜻;
  assert.equal(검수.결과, '통과');
  assert.equal(검수.지문, sha(path.join(편, '게시', '판본', 'US', '글.json')));
});

test('CLI — 뽑기 · 돌림 · 확인(빈 판본은 건너뛰고 종료 1)', () => {
  const { 편 } = 편만들기();
  잇기.채우기(편, 미국글);
  const 돌려 = (...args) => spawnSync(process.execPath, [path.join(REPO, 'tools', '판본글잇기.js'), ...args], { encoding: 'utf8', windowsHide: true });
  let r = 돌려('돌림', 편, 'US', '--쓸날', '2026-11-12');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /US: 새로 뽑음/);
  assert.equal(판본글.readJson(판본글.준비경로(편)).돌림.판본.US.글, '게시/판본/US/글.json');
  r = 돌려('뽑기', 편, '전부');
  assert.equal(r.status, 1, '글이 빈 판본이 있으면 종료 1');
  assert.match(r.stdout, /US: 그대로/);
  assert.match(r.stdout, /MX: 건너뜀 — 판본 MX의 글이 아직 비었다/);
  r = 돌려('확인', 편, 'US', '--json');
  assert.equal(r.status, 1);
  assert.ok(JSON.parse(r.stdout)[0].문제.some((m) => /영상이 없다/.test(m)));
  assert.equal(돌려('돌림', 편, 'US', '--쓸날', '11-12').status, 2);
  assert.equal(돌려('뽑기').status, 2);
});

test('저장소의 판본 지도는 꼴이 맞고, 글이 찬 판본은 판본글/1로 뽑힌다', () => {
  const 마케팅 = path.join(REPO, 'docs', '마케팅');
  const 편들 = fs.readdirSync(마케팅, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(마케팅, d.name, 잇기.지도이름))).map((d) => path.join(마케팅, d.name));
  for (const 편 of 편들) {
    const { 지도 } = 잇기.지도읽기(편);
    for (const 키 of 잇기.키들(편, 지도)) {
      let r;
      try { r = 잇기.뽑기(편, 키, { 지도 }); } catch (e) { assert.match(e.message, /글이 아직 비었다/, `${path.basename(편)} ${키}: ${e.message}`); continue; }
      assert.deepEqual(판본글.검증(r.자료), [], `${path.basename(편)} ${키}`);
    }
  }
});
