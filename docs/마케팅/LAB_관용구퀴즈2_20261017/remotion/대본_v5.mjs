// 관용구 퀴즈 #2 v5(100 BPM, 10-17) 나레이션 대본 → 나레이션_대본.json의 versions.v5a·v5b.
// 유호님 「빨라도 너무 빠르거든? 템포를 20%정도 늦춰도」 → 한 박 0.5초 → 0.6초. v4에서 박에 맞추느라 1.1~1.25배로 돌린 줄을
// 원래 빠르기에 가깝게(1.0~1.05) 되돌리고, 자리가 없어 뺐던 배꼽 문제의 「Ha ha ha!」를 다시 넣었다. 글은 v4와 같아서 새로 사지 않는다.
// 줄 자리(초) = 박 단위 v4 자리 × 1.2를 기준으로, 원래 빠르기에서 잰 말 길이에 맞춰 다듬었다.
//   node 대본_v5.mjs   → 나레이션_대본.json 갱신(다른 판은 그대로) → node 나레이션.cjs --판 v5a,v5b
import fs from 'node:fs';

const FILE = new URL('./나레이션_대본.json', import.meta.url);
const script = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const Q = 9.6; // 문제 하나 = 16박 × 0.6초

const IDIOMS = {
  mouth: { title: '입이 무겁다!', guess: 'A heavy mouth?', literal: 'mouth plus heavy', answer: 'Keeps secrets!', joke: 'Top secret!', jokeAt: 5.97, sayAt: 6.82, say: '입이 무거워요!' },
  ears: { title: '귀가 얇다!', guess: 'Thin ears?', literal: 'ear plus thin', answer: 'They believe anything!', joke: 'Sold!', jokeAt: 6.22, sayAt: 6.84, say: '귀가 얇아요!' },
  navel: { title: '배꼽이 빠지다!', guess: 'Belly button out?', literal: 'belly button plus fall out', answer: 'Laughing so hard!', joke: 'Ha ha ha!', jokeAt: 6.4, sayAt: 7.16, say: '배꼽 빠지겠어요!' },
};

// 말끝 자르기: 말끝_v4.json은 v4 빠르기로 잰 마지막 낱말 끝이다. 원래 길이 = 끝 × v4 빠르기, 새 끝 = 원래 길이 ÷ v5 빠르기.
const ENDS = JSON.parse(fs.readFileSync(new URL('./말끝_v4.json', import.meta.url), 'utf8'));
// v5에서 새로 구운 줄(「A heavy mouth?」·「They believe anything!」 — 원래 빠르기에서 「Happy Mouth」·「Please anything」으로 들려 앞에 짧은 말을 붙임)은 v5 빠르기로 직접 잰 말끝_v5.json.
const ENDS5 = fs.existsSync(new URL('./말끝_v5.json', import.meta.url)) ? JSON.parse(fs.readFileSync(new URL('./말끝_v5.json', import.meta.url), 'utf8')) : {};
const V4_SPEED = { guess: 1.25, answer: 1.1, joke: 1.2, say: 1.1, end_score: 1.1, end_comment: 1.1, end_next: 1.1 };
const NO_CUT = new Set(['Nope!', 'Three!', 'Two!', 'One!']);
const kindOf = (id) => (id.startsWith('end_') ? id : id.split('_').slice(1).join('_'));
const withCut = (l) => {
  if (NO_CUT.has(l.text)) return l;
  if (ENDS5[l.text]) return { ...l, cut: +(ENDS5[l.text] + 0.12).toFixed(2) };
  if (!ENDS[l.text]) return l;
  const raw = ENDS[l.text] * (V4_SPEED[kindOf(l.id)] || 1);
  return { ...l, cut: +(raw / (l.speed || 1) + 0.12).toFixed(2) };
};

const question = (n, key) => {
  const q = IDIOMS[key];
  const o = (n - 1) * Q;
  const at = (t) => +(o + t).toFixed(2);
  return [
    { id: `q${n}_title`, at: at(0.03), lang: 'ko', text: q.title, tempo: 1.05, emotion: 'happy', intensity: 0.8 },
    { id: `q${n}_guess`, at: at(1.2), lang: 'en', text: q.guess, prev: `A fun Korean idiom quiz. The idiom literally reads ${q.literal}.`, next: "Nope! That's not it.", speed: key === 'mouth' ? 1.15 : 1.05 },
    { id: `q${n}_nope`, at: at(2.36), lang: 'en', text: 'Nope!', emotion: 'happy', intensity: 1.3, speed: 1.05 },
    { id: `q${n}_3`, at: at(3.0), lang: 'en', text: 'Three!', emotion: 'toneup', intensity: 1.2, speed: 1.05 },
    { id: `q${n}_2`, at: at(3.6), lang: 'en', text: 'Two!', emotion: 'toneup', intensity: 1.2 },
    { id: `q${n}_1`, at: at(4.2), lang: 'en', text: 'One!', emotion: 'toneup', intensity: 1.2, speed: 1.05 },
    { id: `q${n}_answer`, at: at(5.04), lang: 'en', text: q.answer, emotion: 'happy', intensity: 1.3 },
    { id: `q${n}_joke`, at: at(q.jokeAt), lang: 'en', text: q.joke, emotion: 'happy', intensity: 1.2, speed: key === 'navel' ? 1.15 : 1.05 },
    { id: `q${n}_say`, at: at(q.sayAt), lang: 'ko', text: q.say, tempo: 1.05, emotion: 'happy', intensity: 0.8 },
  ];
};

const END = [
  { id: 'end_score', at: 28.86, lang: 'en', text: 'Okay! How many did you get?', prev: 'That was the last question of a fun Korean idiom quiz.', next: 'Drop your score below!' },
  { id: 'end_comment', at: 31.02, lang: 'en', text: 'Drop your score below!', prev: 'How many did you get?', next: 'See you next round!' },
  { id: 'end_next', at: 32.68, lang: 'en', text: 'See you next round!', prev: 'Drop your score below!', next: 'Fighting!' },
  { id: 'end_fighting', at: 34.42, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];

const version = (order, note) => ({
  _말투: `퀴즈쇼 진행자처럼 신나게(하나), 100 BPM 판이라 v4보다 원래 빠르기에 가깝게. ${note}`,
  defaults: { tempo: 1.15, emotion: 'smart' },
  lines: [...order.flatMap((k, i) => question(i + 1, k)), ...END].map(withCut),
});

script.versions.v5a = version(['mouth', 'ears', 'navel'], '순서 입 → 귀 → 배꼽.');
script.versions.v5b = version(['navel', 'ears', 'mouth'], '순서 배꼽 → 귀 → 입.');
fs.writeFileSync(FILE, JSON.stringify(script, null, 2) + '\n', 'utf8');
console.log('v5a', script.versions.v5a.lines.length, '줄 · v5b', script.versions.v5b.lines.length, '줄');
