// 나라별 채널판(10-18) 검문 파일 만들기: locales.ts의 화면 글을 한국어 원문과 번호를 맞춰 「한국어 / --- / 번역」 파일로 쓴다.
//   node 현지어_검문파일.mjs   → ../게시/03-나라별/검문/<언어>.txt  →  node tools/현지어대조.js --언어 <이름> --파일 <그 파일>
// 해요체 읽는 법(say)은 한국어 발음 표기라 빼고, 게시 문안(문안.json)이 있으면 뒤에 붙인다. Node 24는 .ts를 그대로 읽는다(타입만 걷음).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from './src/kids/locales.ts';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '..', '게시', '03-나라별', '검문');
fs.mkdirSync(OUT, { recursive: true });
const 문안파일 = path.join(ROOT, '..', '게시', '03-나라별', '문안.json');
const 문안 = fs.existsSync(문안파일) ? JSON.parse(fs.readFileSync(문안파일, 'utf8')) : {};

const UI_KO = {
  guess3: '3초 안에 맞혀 봐!', nope: '땡! (틀렸어!)', question: '진짜 뜻은 뭘까?', sayIt: '따라 말해 봐', clearHud: '클리어!',
  level: '1단계!', finish: '끝!', stageClear: '스테이지 클리어!', howMany: '몇 개 맞혔어?', comment: '점수를 댓글로 남겨 줘 ↓',
  gotThis: '다음 판에서 만나!', quiz: '관용구 퀴즈 #2', next: '다음 ▶', scoreNext: '점수 ▶', yourTurn: '네 차례',
};
const Q_KO = [
  ['입', '무겁다', '무거운 입? (일부러 글자 그대로 옮긴 오답)', '많이 먹는다', '비밀을 지킨다', '천천히 말한다', '지우는 네 비밀을 절대 아무에게도 말하지 않아.', '비밀을 지킨다'],
  ['귀', '얇다', '얇은 귀? (일부러 글자 그대로 옮긴 오답)', '잘 듣는다', '귀가 작다', '뭐든 믿는다', '아빠는 광고에서 본 건 다 사.', '뭐든 믿는다'],
  ['배꼽', '빠지다', '배꼽이 빠진다? (일부러 글자 그대로 옮긴 오답)', '엄청 웃는다', '배가 아프다', '너무 많이 먹는다', '너무 웃겨서 엄청 웃었어! (그 언어의 웃음 관용 표현으로)', '엄청 웃는다'],
];

for (const [code, loc] of Object.entries(LOCALES)) {
  const ko = [];
  const tr = [];
  const add = (k, t) => { const n = ko.length + 1; ko.push(`${n}. ${k}`); tr.push(`${n}. ${t}`); };
  for (const [key, k] of Object.entries(UI_KO)) add(k, key === 'level' ? loc.ui.level.replace('{n}', '1') : loc.ui[key]);
  loc.q.forEach((q, i) => {
    const [p0, p1, g, o0, o1, o2, gl, rc] = Q_KO[i];
    add(p0, q.parts[0]); add(p1, q.parts[1]); add(g, q.guess);
    add(o0, q.options[0]); add(o1, q.options[1]); add(o2, q.options[2]);
    add(gl, q.gloss); add(`(끝 화면 복습) ${rc}`, q.recap);
  });
  const c = 문안[code];
  if (c) { add(`(게시 제목) ${문안._ko.title}`, c.title); add(`(게시 설명) ${문안._ko.description.replace(/\n+/g, ' / ')}`, c.description.replace(/\n+/g, ' / ')); }
  fs.writeFileSync(path.join(OUT, `${code}.txt`), `${ko.join('\n')}\n---\n${tr.join('\n')}\n`, 'utf8');
}
console.log(Object.keys(LOCALES).length, '개 언어 →', OUT);
