// 관용구 퀴즈 #2 몽골어판(v5b, 100 BPM, 10-18) 나레이션 → 나레이션_대본.json의 versions.v5b_mn.
// 유호님 「웅 몽골어판 v5b로 만들자」. Typecast는 몽골어를 못 읽어(10-13 LANGUAGE_NOT_SUPPORTED) 첫 편 몽골어판처럼 한국어로만 말한다 —
// 관용구 제목·해요체는 v5 녹음 그대로(같은 요청이라 새로 사지 않음), 땡·셋 둘 하나·딩동댕·따라 해 보세요 같은 한국 퀴즈쇼 말을 더한다(배울거리).
// 순서는 v5b(배꼽 → 귀 → 입), 자리는 100 BPM 박(0.6초) 기준: 도장 1.8초 → 땡 1.86, 카운트 3.0·3.6·4.2, 정답 4.8 → 딩동댕 4.86,
// SAY IT 알약 6.6 → 해요체 6.84, YOUR TURN 7.8부터 따라 말할 틈.
//   node 대본_v5mn.mjs   → node 나레이션.cjs --판 v5b_mn
import fs from 'node:fs';

const FILE = new URL('./나레이션_대본.json', import.meta.url);
const script = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const Q = 9.6;

const IDIOMS = {
  navel: { title: '배꼽이 빠지다!', say: '배꼽 빠지겠어요!' },
  ears: { title: '귀가 얇다!', say: '귀가 얇아요!' },
  mouth: { title: '입이 무겁다!', say: '입이 무거워요!' },
};

// 제목·해요체 말끝 자르기: 말끝_v4.json(해요체는 v4 1.1배에서 잼) → 원래 길이로 되돌린다. 새 퀴즈쇼 말은 짧아 자르지 않는다.
const ENDS = JSON.parse(fs.readFileSync(new URL('./말끝_v4.json', import.meta.url), 'utf8'));
const withCut = (l) => {
  if (!ENDS[l.text]) return l;
  const raw = ENDS[l.text] * (l.id.endsWith('_say') ? 1.1 : 1);
  return { ...l, cut: +(raw / (l.speed || 1) + 0.12).toFixed(2) };
};

const question = (n, key) => {
  const q = IDIOMS[key];
  const o = (n - 1) * Q;
  const at = (t) => +(o + t).toFixed(2);
  return [
    { id: `q${n}_title`, at: at(0.03), lang: 'ko', text: q.title, tempo: 1.05, emotion: 'happy', intensity: 0.8 },
    { id: `q${n}_nope`, at: at(1.86), lang: 'ko', text: '땡!', emotion: 'happy' },
    { id: `q${n}_3`, at: at(3.0), lang: 'ko', text: '셋!', emotion: 'toneup' },
    { id: `q${n}_2`, at: at(3.6), lang: 'ko', text: '둘!', emotion: 'toneup' },
    { id: `q${n}_1`, at: at(4.2), lang: 'ko', text: '하나!', emotion: 'toneup' },
    { id: `q${n}_answer`, at: at(4.86), lang: 'ko', text: '딩동댕!', emotion: 'happy' },
    { id: `q${n}_sayit`, at: at(5.8), lang: 'ko', text: '따라 해 보세요!', emotion: 'happy', speed: 1.1 },
    { id: `q${n}_say`, at: at(6.84), lang: 'ko', text: q.say, tempo: 1.05, emotion: 'happy', intensity: 0.8 },
  ];
};

const END = [
  { id: 'end_score', at: 28.86, lang: 'ko', text: '몇 개 맞혔어요?', emotion: 'happy' },
  { id: 'end_comment', at: 31.02, lang: 'ko', text: '댓글로 알려 주세요!', emotion: 'happy' },
  { id: 'end_next', at: 32.68, lang: 'ko', text: '다음 판에서 만나요!', emotion: 'happy' },
  { id: 'end_fighting', at: 34.42, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];

script.versions.v5b_mn = {
  _말투: '몽골어 화면판(v5b). 한국어로만 — 관용구·해요체는 v5 녹음, 한국 퀴즈쇼 말(땡·셋 둘 하나·딩동댕·따라 해 보세요)을 더한다. 하나 목소리.',
  defaults: { tempo: 1.15, emotion: 'smart' },
  lines: [...['navel', 'ears', 'mouth'].flatMap((k, i) => question(i + 1, k)), ...END].map(withCut),
};
fs.writeFileSync(FILE, JSON.stringify(script, null, 2) + '\n', 'utf8');
console.log('v5b_mn', script.versions.v5b_mn.lines.length, '줄');
