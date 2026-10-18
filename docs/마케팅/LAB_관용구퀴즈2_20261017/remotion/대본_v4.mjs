// 관용구 퀴즈 #2 v4 나레이션 대본(10-17)을 나레이션_대본.json의 versions.v4a·v4b로 쓴다.
// v4a = 입 → 귀 → 배꼽, v4b = 배꼽 → 귀 → 입(4번: 가장 웃긴 그림을 첫 문제로). 같은 글은 한 번만 사서 두 판이 나눠 쓴다(요청에 시각이 안 들어감).
// 2번(따라 말하기 자리): 첫 편은 7.0초에 해요체를 말하고 7.75초에 장면이 넘어가 따라 말할 틈이 없었다 →
// 영어 「Say it!」 줄을 빼고 해요체를 SAY IT 알약과 같은 5.5초에 말한다. 6.5초부터 화면은 YOUR TURN.
//   node 대본_v4.mjs   → 나레이션_대본.json 갱신(다른 판은 그대로)
import fs from 'node:fs';

const FILE = new URL('./나레이션_대본.json', import.meta.url);
const script = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const IDIOMS = {
  mouth: { title: '입이 무겁다!', guess: 'Heavy mouth?', literal: 'mouth plus heavy', answer: 'Keeps secrets!', joke: 'Top secret!', jokeAt: 4.95, say: '입이 무거워요!' },
  ears: { title: '귀가 얇다!', guess: 'Thin ears?', literal: 'ear plus thin', answer: 'Believes anything!', joke: 'Sold!', jokeAt: 5.06, say: '귀가 얇아요!' },
  navel: { title: '배꼽이 빠지다!', guess: 'Belly button out?', literal: 'belly button plus fall out', answer: 'Laughing so hard!', joke: null, jokeAt: 0, say: '배꼽 빠지겠어요!' },
};
// 실제 말 길이(받아쓰기 낱말 끝)에 맞춘 자리: 제목 0.03 → 오답 1.0(1.25배) → Nope 1.9 → 3·2·1 → 정답 4.05(1.1배) → 한마디(1.2배) → 해요체 5.55(1.1배, 6.5초 전에 끝남)
// 10-17 첫 굽기 받아쓰기: 「Laughs hard!」가 「Really? Hard!」·「Whoey! Hard!」로 뭉개져 「Laughing so hard!」로, 「Paper-thin ears?」는 1.26초라 「Thin ears?」로 바꿨다.
// 3번(배꼽)은 정답 줄이 1.1초라 한마디(Ha ha ha!)를 넣을 자리가 없어 뺐다 — 정답 줄이 웃음이다.
const SAY_AT = 5.65; // SAY IT 알약은 sayAt 165프레임 = 5.5초(앞 한마디 꼬리와 안 겹치게 0.15초 뒤)
// 말끝_v4.json: 줄마다 마지막 낱말 끝(받아쓰기 small, 지금 speed 적용 뒤). 끝 + 0.12초에서 자른다. 한 낱말 외침은 받아쓰기 시각이 짧게 나와 자르지 않는다.
const ENDS = fs.existsSync(new URL('./말끝_v4.json', import.meta.url)) ? JSON.parse(fs.readFileSync(new URL('./말끝_v4.json', import.meta.url), 'utf8')) : {};
const NO_CUT = new Set(['Nope!', 'Three!', 'Two!', 'One!']);
const withCut = (l) => (ENDS[l.text] && !NO_CUT.has(l.text) ? { ...l, cut: +(ENDS[l.text] + 0.12).toFixed(2) } : l);

const question = (n, key) => {
  const q = IDIOMS[key];
  const o = (n - 1) * 8;
  const at = (t) => +(o + t).toFixed(2);
  return [
    { id: `q${n}_title`, at: at(0.03), lang: 'ko', text: q.title, tempo: 1.05, emotion: 'happy', intensity: 0.8 },
    { id: `q${n}_guess`, at: at(1.0), lang: 'en', text: q.guess, prev: `A fun Korean idiom quiz. The idiom literally reads ${q.literal}.`, next: "Nope! That's not it.", speed: 1.25 },
    { id: `q${n}_nope`, at: at(1.9), lang: 'en', text: 'Nope!', emotion: 'happy', intensity: 1.3, speed: 1.15 },
    { id: `q${n}_3`, at: at(2.5), lang: 'en', text: 'Three!', emotion: 'toneup', intensity: 1.2, speed: 1.15 },
    { id: `q${n}_2`, at: at(3), lang: 'en', text: 'Two!', emotion: 'toneup', intensity: 1.2 },
    { id: `q${n}_1`, at: at(3.5), lang: 'en', text: 'One!', emotion: 'toneup', intensity: 1.2, speed: 1.15 },
    { id: `q${n}_answer`, at: at(4.2), lang: 'en', text: q.answer, emotion: 'happy', intensity: 1.3, speed: 1.1 },
    ...(q.joke ? [{ id: `q${n}_joke`, at: at(q.jokeAt), lang: 'en', text: q.joke, emotion: 'happy', intensity: 1.2, speed: 1.2 }] : []),
    { id: `q${n}_say`, at: at(SAY_AT), lang: 'ko', text: q.say, tempo: 1.05, emotion: 'happy', intensity: 0.8, speed: 1.1 },
  ];
};

const END = [
  { id: 'end_score', at: 24.05, lang: 'en', text: 'Okay! How many did you get?', prev: 'That was the last question of a fun Korean idiom quiz.', next: 'Drop your score below!', speed: 1.1 },
  { id: 'end_comment', at: 25.85, lang: 'en', text: 'Drop your score below!', prev: 'How many did you get?', next: 'See you next round!', speed: 1.1 },
  { id: 'end_next', at: 27.23, lang: 'en', text: 'See you next round!', prev: 'Drop your score below!', next: 'Fighting!', speed: 1.1 },
  { id: 'end_fighting', at: 28.68, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];

const version = (order, note) => ({
  _말투: `퀴즈쇼 진행자처럼 신나게(첫 편 재밌는 판과 같은 하나 목소리). ${note}`,
  defaults: { tempo: 1.15, emotion: 'smart' },
  lines: [...order.flatMap((k, i) => question(i + 1, k)), ...END].map(withCut),
});

script.versions.v4a = version(['mouth', 'ears', 'navel'], '순서 입 → 귀 → 배꼽.');
script.versions.v4b = version(['navel', 'ears', 'mouth'], '순서 배꼽 → 귀 → 입(4번).');
fs.writeFileSync(FILE, JSON.stringify(script, null, 2) + '\n', 'utf8');
console.log('v4a', script.versions.v4a.lines.length, '줄 · v4b', script.versions.v4b.lines.length, '줄');
