// 관용구 퀴즈 #3(10-19, 100 BPM) 나레이션 → 나레이션_대본.json의 versions.q3. 모든 판(몽골어·간체·버마어·영어 화면판)에 같은 소리를 쓴다.
// 퀴즈 #2 몽골어판(대본_v5mn.mjs)과 같은 말투·자리: 한국어로만, 하나 목소리. 땡·셋 둘 하나·딩동댕·따라 해 보세요와 끝 네 줄은
// 퀴즈 #2와 요청이 똑같아 원본 캐시를 그대로 쓰고(새로 사지 않음), 관용구 제목·해요체 여섯 줄만 새로 굽는다.
// 자리는 100 BPM 박(0.6초) 기준: 도장 1.8초 → 땡 1.86, 카운트 3.0·3.6·4.2, 정답 4.8 → 딩동댕 4.86, SAY IT 알약 6.6 → 해요체 6.84, YOUR TURN 7.8부터 따라 말할 틈.
//   node 대본_q3.mjs   → node 나레이션.cjs --판 q3
import fs from 'node:fs';

const FILE = new URL('./나레이션_대본.json', import.meta.url);
const script = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const Q = 9.6;

const IDIOMS = [
  { title: '미역국을 먹다!', say: '미역국 먹었어요!' },
  { title: '식은 죽 먹기!', say: '식은 죽 먹기예요!' },
  { title: '김칫국부터 마시다!', say: '김칫국 마시지 마요!', sayTempo: 1.25 },
];

const question = (n, q) => {
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
    { id: `q${n}_say`, at: at(6.84), lang: 'ko', text: q.say, tempo: q.sayTempo ?? 1.05, emotion: 'happy', intensity: 0.8 },
  ];
};

const END = [
  { id: 'end_score', at: 28.86, lang: 'ko', text: '몇 개 맞혔어요?', emotion: 'happy' },
  { id: 'end_comment', at: 31.02, lang: 'ko', text: '댓글로 알려 주세요!', emotion: 'happy' },
  { id: 'end_next', at: 32.68, lang: 'ko', text: '다음 판에서 만나요!', emotion: 'happy' },
  { id: 'end_fighting', at: 34.42, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];

script.versions.q3 = {
  _말투: '관용구 퀴즈 #3(v5b 틀). 한국어로만 — 관용구 제목·해요체 + 한국 퀴즈쇼 말(땡·셋 둘 하나·딩동댕·따라 해 보세요). 하나 목소리. 퀴즈 #2 몽골어판(v5b_mn)과 같은 설정.',
  defaults: script.versions.v5b_mn.defaults,
  lines: [...IDIOMS.flatMap((q, i) => question(i + 1, q)), ...END],
};
fs.writeFileSync(FILE, JSON.stringify(script, null, 2) + '\n', 'utf8');
console.log('q3', script.versions.q3.lines.length, '줄');
