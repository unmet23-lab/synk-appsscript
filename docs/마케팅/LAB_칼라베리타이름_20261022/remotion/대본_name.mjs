// LAB 「칼라베리타에 내 이름을 한글로」(10-22, 100 BPM) 나레이션 계획 → 나레이션_계획.json(versions.nko — 한국어로만, 스페인어판).
// 굽기는 공용 도구: node ../../../../tools/나레이션굽기.mjs 나레이션_계획.json(미리보기) → --굽기. 결과 public/vo/nko/ + src/film/vo.generated.ts.
// 관용구 퀴즈 몽골어판(한국어로만)의 자리·말투를 따른다(하나 목소리, 퀴즈쇼 진행자). 문제 하나 = 16박 × 0.6초 = 9.6초.
// 자리: 오답 딱지 1.2초 · 도장 1.8 · 카운트 3.0·3.6·4.2 · 정답 4.8 · 이름이 띠에 써지는 4.9~5.4 · DILO 알약 6.6 · ¡AHORA TÚ! 7.8.
// 「따라 해 보세요」 자리(5.8)에 정답 이름을 한 번 더 또렷하게 — 스페인어 화면이라 한국어 지시말보다 이름 소리가 쓸모 있다.
//   node 대본_name.mjs
import fs from 'node:fs';

const FILE = new URL('./나레이션_계획.json', import.meta.url);
const Q = 9.6;

const NAMES = [
  { title: '이름 퀴즈!', guess: '주안?', name: '후안!', say: '후안이에요.' },
  { title: '다음 이름!', guess: '레지나?', name: '레히나!', say: '레히나예요.' },
  { title: '마지막!', guess: '구일레르모?', name: '기예르모!', nameSpeed: 1.2, say: '기예르모예요.' },
];

const ko = (o) => ({ lang: 'ko', emotion: 'happy', intensity: 0.8, tempo: 1.05, ...o });

const koQuestion = (n, t) => {
  const at = (s) => +((n - 1) * Q + s).toFixed(2);
  return [
    ko({ id: `q${n}_title`, at: at(0.03), text: t.title }),
    ko({ id: `q${n}_guess`, at: at(1.0), text: t.guess, emotion: 'normal', intensity: 1, speed: 1.1 }),
    { id: `q${n}_nope`, at: at(2.2), lang: 'ko', text: '땡!', emotion: 'happy' },
    { id: `q${n}_3`, at: at(3.0), lang: 'ko', text: '셋!', emotion: 'toneup' },
    { id: `q${n}_2`, at: at(3.6), lang: 'ko', text: '둘!', emotion: 'toneup' },
    { id: `q${n}_1`, at: at(4.2), lang: 'ko', text: '하나!', emotion: 'toneup' },
    { id: `q${n}_answer`, at: at(4.86), lang: 'ko', text: '딩동댕!', emotion: 'happy' },
    // 이름 두 줄은 또박또박(normal · 0.95): 첫 굽기의 happy 0.8 · 1.05는 「레히나」의 ㅎ이 약해져 받아쓰기가 오답 보기 「레이나」로 적었다(10-22 줄만 따로 들어도 같음)
    { id: `q${n}_name`, at: at(5.75), lang: 'ko', text: t.name, emotion: 'normal', intensity: 1, tempo: 0.95, ...(t.nameSpeed ? { speed: t.nameSpeed } : {}) },
    { id: `q${n}_say`, at: at(6.84), lang: 'ko', text: t.say, emotion: 'normal', intensity: 1, tempo: 0.95 },
  ];
};

// 끝 4.5초(역할 전환): 별 셋 → 「¿Y TU nombre?」 카드에 맞춰 「여러분 이름은요?」 → 「한국어로 써 보세요!」 → 화이팅.
const END_KO = [
  ko({ id: 'end_ask', at: 29.7, text: '여러분 이름은요?' }), // 「¿Y TU nombre?」 카드(29.93초)에 맞춤(Fable 콘티 검수 P3)
  ko({ id: 'end_try', at: 30.88, text: '한국어로 써 보세요!', speed: 1.05 }),
  { id: 'end_fighting', at: 32.42, lang: 'ko', text: '화이팅!', tempo: 1.05, emotion: 'happy', intensity: 1.2 },
];

const plan = {
  _설명: 'LAB 「칼라베리타에 내 이름을 한글로」(10-22) 나레이션 — 하나 목소리 하나, 한국어로만(스페인어판 화면 글은 스페인어). 대본_name.mjs가 만든다.',
  voice: { id: 'tc_61659cc118732016a95fe7c6', name: '하나' },
  defaults: { model: 'ssfm-v30', tempo: 1.15, emotion: 'smart' },
  out: 'public/vo',
  srcBase: 'public',
  ts: 'src/film/vo.generated.ts',
  trim: 'both',
  limits: [{ from: 0, to: 9.5 }, { from: 9.6, to: 19.1 }, { from: 19.2, to: 28.7 }, { from: 28.8, to: 33.25 }],
  versions: { nko: { lines: [...NAMES.flatMap((t, i) => koQuestion(i + 1, t)), ...END_KO] } },
};
fs.writeFileSync(FILE, JSON.stringify(plan, null, 1) + '\n', 'utf8');
console.log('nko', plan.versions.nko.lines.length, '줄');
