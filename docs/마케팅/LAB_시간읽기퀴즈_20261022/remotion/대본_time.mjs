// LAB 「한국어로 시간 읽기」(10-22, 100 BPM) 나레이션 계획 → 나레이션_계획.json(versions.ten 영어판 · tko 몽골어판 등 한국어로만).
// 굽기는 공용 도구: node ../../../../tools/나레이션굽기.mjs 나레이션_계획.json(미리보기) → --굽기. 결과 public/vo/<판>/ + src/film/vo.generated.ts.
// 관용구 퀴즈 #5 대본_q5.mjs의 자리·말투를 따른다(하나 목소리, 퀴즈쇼 진행자). 문제 하나 = 16박 × 0.6초 = 9.6초.
// 자리: 도장 1.8초, Nope 2.36, 카운트 3.0·3.6·4.2, 정답 4.8, SAY IT 알약 6.6, YOUR TURN 7.8부터 따라 말할 틈.
// 영어판: 첫 문제는 0초 약속을 목소리로(「Two number systems? One rule!」) 하고 틀린 읽기는 화면 딱지로만 둔다. 둘째·셋째는 틀린 읽기를 한국어로 읽는다(딱지가 뜨는 1.2초).
// 정답 박(5.04)은 영어 한마디(왜 그 답인지), SAY IT 박(7.25)은 한국어 읽기.
//   node 대본_time.mjs
import fs from 'node:fs';

const FILE = new URL('./나레이션_계획.json', import.meta.url);
const Q = 9.6;

// q1 한마디: 「Native for hours!」는 받아쓰기에서 「Native, four hours」(네 시간), 「Native numbers for hours!」는 「filmmakers」로 들려 「Native Korean for hours!」(두 모델 모두 맞게 들림, Fable 최종 검수 P3 · 10-22).
const TIMES = [
  { title: 'Two number systems? One rule!', titleSpeed: 1.3, guess: null, answer: '세 시 삼십 분!', tip: 'Native Korean for hours!', ko: { title: '몇 시예요?', guess: '삼 시 삼십 분?' } },
  { title: 'And this one?', guess: '일 시 열 분?', answer: '한 시 십 분!', tip: 'Hana becomes han!', ko: { title: '이건요?', guess: '일 시 열 분?' } },
  { title: 'Last one!', titleSpeed: 1.3, guess: '이 시 삼십 분?', answer: '두 시 반!', tip: 'Ban means half!', ko: { title: '마지막!', guess: '이 시 삼십 분?' } },
];

const ko = (o) => ({ lang: 'ko', emotion: 'happy', intensity: 0.8, tempo: 1.05, ...o });

const enQuestion = (n, t) => {
  const at = (s) => +((n - 1) * Q + s).toFixed(2);
  return [
    { id: `q${n}_title`, at: at(0.03), lang: 'en', text: t.title, emotion: 'happy', intensity: 1.2, ...(t.titleSpeed ? { speed: t.titleSpeed } : {}) },
    ...(t.guess ? [ko({ id: `q${n}_guess`, at: at(1.2), text: t.guess, emotion: 'normal', intensity: 1, speed: 1.15 })] : []),
    { id: `q${n}_nope`, at: at(2.36), lang: 'en', text: 'Nope!', emotion: 'happy', intensity: 1.3, speed: 1.05, cut: 0.6 },
    { id: `q${n}_3`, at: at(3.0), lang: 'en', text: 'Three!', emotion: 'toneup', intensity: 1.2, speed: 1.05, cut: 0.58 },
    { id: `q${n}_2`, at: at(3.6), lang: 'en', text: 'Two!', emotion: 'toneup', intensity: 1.2 },
    { id: `q${n}_1`, at: at(4.2), lang: 'en', text: 'One!', emotion: 'toneup', intensity: 1.2, speed: 1.05 },
    // 정답 단추에 한국어 읽기가 이미 떠 있으므로 정답 박에는 「왜」를 영어로 한 줄, 한국어 읽기는 SAY IT 박에 한 번(10-22 첫 굽기에서 같은 한국어 줄이 두 번 나와 영어 한마디와 겹쳤다)
    { id: `q${n}_answer`, at: at(5.04), lang: 'en', text: t.tip, emotion: 'happy', intensity: 1.2, speed: 1.2 },
    ko({ id: `q${n}_say`, at: at(7.25), text: t.answer }),
  ];
};

const koQuestion = (n, t) => {
  const at = (s) => +((n - 1) * Q + s).toFixed(2);
  return [
    ko({ id: `q${n}_title`, at: at(0.03), text: t.ko.title }),
    ko({ id: `q${n}_guess`, at: at(0.95), text: t.ko.guess, emotion: 'normal', intensity: 1, speed: 1.15 }),
    { id: `q${n}_nope`, at: at(2.2), lang: 'ko', text: '땡!', emotion: 'happy' },
    { id: `q${n}_3`, at: at(3.0), lang: 'ko', text: '셋!', emotion: 'toneup' },
    { id: `q${n}_2`, at: at(3.6), lang: 'ko', text: '둘!', emotion: 'toneup' },
    { id: `q${n}_1`, at: at(4.2), lang: 'ko', text: '하나!', emotion: 'toneup' },
    { id: `q${n}_answer`, at: at(4.86), lang: 'ko', text: '딩동댕!', emotion: 'happy' },
    { id: `q${n}_sayit`, at: at(5.8), lang: 'ko', text: '따라 해 보세요!', emotion: 'happy', speed: 1.1 },
    ko({ id: `q${n}_say`, at: at(6.84), text: t.answer }),
  ];
};

// 끝 4.5초: 점수 묻기(별 셋) → 규칙 카드 위에 댓글 부탁(역할 육성 — 내 시각을 한국어로 댓글) → 화이팅.
const END_EN = [
  // 관용구 퀴즈의 말끝 자르기(cut 1.66)를 그대로 가져왔다가 새 굽기에서 「did you get?」이 잘렸다(10-22 받아쓰기) — 자르기 없이 빠르기만
  { id: 'end_score', at: 28.86, lang: 'en', text: 'Okay! How many did you get?', prev: 'That was the last question of a fun Korean time quiz.', next: 'Comment your time in Korean!', speed: 1.1 },
  { id: 'end_comment', at: 30.7, lang: 'en', text: 'Comment your time in Korean!', emotion: 'happy', intensity: 1.2, speed: 1.1 },
  { id: 'end_fighting', at: 32.42, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];
const END_KO = [
  { id: 'end_score', at: 28.86, lang: 'ko', text: '몇 개 맞혔어요?', emotion: 'happy' },
  ko({ id: 'end_comment', at: 30.3, text: '지금 몇 시예요? 댓글로!', speed: 1.1 }),
  { id: 'end_fighting', at: 32.42, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];

const plan = {
  _설명: 'LAB 「한국어로 시간 읽기」(10-22) 나레이션 — 하나 목소리 하나(LAB 낱말 기준, 관용구 퀴즈 연재와 같은 요청은 캐시). ten = 영어판(영어 진행 + 한국어 읽기), tko = 몽골어판(한국어로만). 대본_time.mjs가 만든다.',
  voice: { id: 'tc_61659cc118732016a95fe7c6', name: '하나' },
  defaults: { model: 'ssfm-v30', tempo: 1.15, emotion: 'smart' },
  out: 'public/vo',
  srcBase: 'public',
  ts: 'src/film/vo.generated.ts',
  trim: 'both',
  limits: [{ from: 0, to: 9.5 }, { from: 9.6, to: 19.1 }, { from: 19.2, to: 28.7 }, { from: 28.8, to: 33.25 }],
  versions: {
    ten: { lines: [...TIMES.flatMap((t, i) => enQuestion(i + 1, t)), ...END_EN] },
    tko: { lines: [...TIMES.flatMap((t, i) => koQuestion(i + 1, t)), ...END_KO] },
  },
};
fs.writeFileSync(FILE, JSON.stringify(plan, null, 1) + '\n', 'utf8');
console.log('ten', plan.versions.ten.lines.length, '줄 · tko', plan.versions.tko.lines.length, '줄');
