// 관용구 퀴즈 #5(10-21, 100 BPM) 나레이션 → 나레이션_대본.json의 versions.q5en(영어판)·q5ko(몽골어판 등 한국어로만). 퀴즈 #4 대본_q4.mjs를 복사해 관용구 표만 바꿨다.
// 영어판은 퀴즈 #2 v5b(대본_v5.mjs), 한국어판은 퀴즈 #3(대본_q3.mjs)과 같은 말투·자리. 하나 목소리.
// 같은 요청은 다시 사지 않는다: Nope·Three·Two·One·끝 영어 세 줄·화이팅(퀴즈 #2), 땡·셋 둘 하나·딩동댕·따라 해 보세요·끝 한국어 네 줄(퀴즈 #2 몽골어판)은 캐시 그대로.
// 관용구 제목·해요체는 두 판이 같은 요청이라 한 번만 산다. 새로 사는 것은 제목 셋·해요체 셋·영어 오답·정답·한마디 아홉 줄뿐.
// 자리는 100 BPM 박(0.6초) 기준: 도장 1.8초, 카운트 3.0·3.6·4.2, 정답 4.8, SAY IT 알약 6.6, YOUR TURN 7.8부터 따라 말할 틈.
//   node 대본_q5.mjs   → node 나레이션.cjs --판 q5en,q5ko
import fs from 'node:fs';

const FILE = new URL('./나레이션_대본.json', import.meta.url);
const script = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const Q = 9.6; // 문제 하나 = 16박 × 0.6초

// 100 BPM 구간(겹침 점검용). 옛 값은 120 BPM(8초 문제) 기준이었다.
script.limits = [{ from: 0, to: 9.5 }, { from: 9.6, to: 19.1 }, { from: 19.2, to: 28.7 }, { from: 28.8, to: 33.25 }]; // 끝 4.5초(10-20 마감 점검)

// 영어판 자리·빠르기·자르기(en)는 첫 굽기 소리 에너지로 잰 말끝(최고점 −32dB)에 맞췄다 — 다음 줄 시작 전에 끝나게(10-20).
//   cut = 말끝 × (잰 빠르기 ÷ 새 빠르기) + 0.06초. 「A bean-sized liver?」는 1.4초라 도장(1.8초)·Nope(2.36초) 사이에 안 들어가 「Liver shrinks?」로 줄였다.
const IDIOMS = {
  // 첫 굽기(10-21)에서 오답 줄이 Nope(2.36초)·한마디가 SAY IT(7.25초)과 겹쳐 오답·한마디를 짧은 글로 다시 사고, 정답·한마디는 빠르기로 맞췄다.
  flies: {
    title: '파리 날리다!', say: '파리만 날려요!', sayAt: 6.84,
    en: { guess: 'Flying flies?', literal: 'fly plus let fly, like flying a kite', guessAt: 1.15, guessSpeed: 1.35, answer: 'No customers!', answerSpeed: 1.1, joke: 'So quiet!', jokeAt: 6.2, jokeSpeed: 1.3, sayAt: 7.25 },
  },
  frog: {
    title: '우물 안 개구리!', titleSpeed: 1.25, say: '우물 안 개구리였어요!', sayAt: 6.84,
    en: { guess: 'Frog in a well?', literal: 'inside a well plus frog', guessAt: 1.16, guessSpeed: 1.35, answer: 'Tiny world view!', answerSpeed: 1.2, joke: 'Well, well!', jokeAt: 6.2, jokeSpeed: 1.3, /* 「Ribbit!」은 받아쓰기가 줄만 들어도 「Rabbit!」 — 우물(well) 말장난으로 */ sayAt: 7.25 },
  },
  cat: {
    title: '고양이 세수하듯!', say: '고양이 세수만 했어요!', sayAt: 6.84,
    en: { guess: 'Cat face wash?', literal: 'cat plus like washing its face', guessAt: 1.18, guessSpeed: 1.2, answer: 'A quick splash!', answerSpeed: 1.25, joke: 'Lazy!', jokeAt: 6.2, jokeSpeed: 1.1, sayAt: 7.25 },
  },
};

// 퀴즈 #2 v5b의 말끝 자르기(끝 영어 줄은 같은 요청 → 같은 자리에서 자른다)
const ENDS = JSON.parse(fs.readFileSync(new URL('./말끝_v4.json', import.meta.url), 'utf8'));
const V4_SPEED = { end_score: 1.1, end_comment: 1.1, end_next: 1.1 };
const withCut = (l) => {
  if (!l.id.startsWith('end_') || !ENDS[l.text]) return l;
  const raw = ENDS[l.text] * (V4_SPEED[l.id] || 1);
  return { ...l, cut: +(raw / (l.speed || 1) + 0.12).toFixed(2) };
};

const titleLine = (n, q, at) => ({ id: `q${n}_title`, at: at(0.03), lang: 'ko', text: q.title, tempo: 1.05, emotion: 'happy', intensity: 0.8, ...(q.titleSpeed ? { speed: q.titleSpeed } : {}) });
const sayLine = (n, q, at, sayAt) => ({ id: `q${n}_say`, at: at(sayAt), lang: 'ko', text: q.say, tempo: 1.05, emotion: 'happy', intensity: 0.8, ...(q.saySpeed ? { speed: q.saySpeed } : {}) });

const enQuestion = (n, key) => {
  const q = IDIOMS[key];
  const e = q.en;
  const at = (t) => +((n - 1) * Q + t).toFixed(2);
  const opt = (speed, cut) => ({ ...(speed ? { speed } : {}), ...(cut ? { cut } : {}) });
  return [
    titleLine(n, q, at),
    { id: `q${n}_guess`, at: at(e.guessAt), lang: 'en', text: e.guess, prev: `A fun Korean idiom quiz. The idiom literally reads ${e.literal}.`, next: "Nope! That's not it.", ...opt(e.guessSpeed, e.guessCut) },
    { id: `q${n}_nope`, at: at(2.36), lang: 'en', text: 'Nope!', emotion: 'happy', intensity: 1.3, speed: 1.05 },
    { id: `q${n}_3`, at: at(3.0), lang: 'en', text: 'Three!', emotion: 'toneup', intensity: 1.2, speed: 1.05 },
    { id: `q${n}_2`, at: at(3.6), lang: 'en', text: 'Two!', emotion: 'toneup', intensity: 1.2 },
    { id: `q${n}_1`, at: at(4.2), lang: 'en', text: 'One!', emotion: 'toneup', intensity: 1.2, speed: 1.05 },
    { id: `q${n}_answer`, at: at(5.04), lang: 'en', text: e.answer, emotion: 'happy', intensity: 1.3, ...opt(e.answerSpeed, e.answerCut) },
    { id: `q${n}_joke`, at: at(e.jokeAt), lang: 'en', text: e.joke, emotion: 'happy', intensity: 1.2, ...opt(e.jokeSpeed, e.jokeCut) },
    { ...sayLine(n, q, at, e.sayAt), ...opt(e.saySpeed) },
  ];
};

const koQuestion = (n, key) => {
  const q = IDIOMS[key];
  const at = (t) => +((n - 1) * Q + t).toFixed(2);
  return [
    titleLine(n, q, at),
    { id: `q${n}_nope`, at: at(1.86), lang: 'ko', text: '땡!', emotion: 'happy' },
    { id: `q${n}_3`, at: at(3.0), lang: 'ko', text: '셋!', emotion: 'toneup' },
    { id: `q${n}_2`, at: at(3.6), lang: 'ko', text: '둘!', emotion: 'toneup' },
    { id: `q${n}_1`, at: at(4.2), lang: 'ko', text: '하나!', emotion: 'toneup' },
    { id: `q${n}_answer`, at: at(4.86), lang: 'ko', text: '딩동댕!', emotion: 'happy' },
    { id: `q${n}_sayit`, at: at(5.8), lang: 'ko', text: '따라 해 보세요!', emotion: 'happy', speed: 1.1 },
    sayLine(n, q, at, q.sayAt),
  ];
};

// 끝 4.5초(10-20 마감 점검): 점수 묻기 → 댓글 부탁 → 화이팅. 「See you next round!」·「다음 판에서 만나요!」 줄은 뺐다(화면 글은 화이팅 카드에 남음).
const END_EN = [
  { id: 'end_score', at: 28.86, lang: 'en', text: 'Okay! How many did you get?', prev: 'That was the last question of a fun Korean idiom quiz.', next: 'Drop your score below!' },
  { id: 'end_comment', at: 30.8, lang: 'en', text: 'Drop your score below!', prev: 'How many did you get?', next: 'See you next round!' },
  { id: 'end_fighting', at: 32.42, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];
const END_KO = [
  { id: 'end_score', at: 28.86, lang: 'ko', text: '몇 개 맞혔어요?', emotion: 'happy' },
  { id: 'end_comment', at: 30.2, lang: 'ko', text: '댓글로 알려 주세요!', emotion: 'happy' },
  { id: 'end_fighting', at: 32.42, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];

const DEFAULTS = { tempo: 1.15, emotion: 'smart' }; // 퀴즈 #2 v5b·v5b_mn과 같다(같은 요청 → 캐시)
script.versions.q5en = {
  _말투: '관용구 퀴즈 #5 영어판(v5b 틀). 퀴즈쇼 진행자처럼 신나게(하나). 순서 파리 → 개구리 → 고양이.',
  defaults: DEFAULTS,
  lines: [...['flies', 'frog', 'cat'].flatMap((k, i) => enQuestion(i + 1, k)), ...END_EN].map(withCut),
};
script.versions.q5ko = {
  _말투: '관용구 퀴즈 #5 한국어로만(몽골어판 등). 관용구 제목·해요체 + 한국 퀴즈쇼 말. 순서 파리 → 고양이 → 개구리.',
  defaults: DEFAULTS,
  lines: [...['flies', 'cat', 'frog'].flatMap((k, i) => koQuestion(i + 1, k)), ...END_KO],
};
delete script.versions.q4en; delete script.versions.q4ko; // #4 대본은 퀴즈 #4 폴더에 남아 있다
fs.writeFileSync(FILE, JSON.stringify(script, null, 2) + '\n', 'utf8');
console.log('q5en', script.versions.q5en.lines.length, '줄 · q5ko', script.versions.q5ko.lines.length, '줄');
