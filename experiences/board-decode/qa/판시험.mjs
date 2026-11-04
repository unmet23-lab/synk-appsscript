#!/usr/bin/env node
/**
 * 게시판 해독 — 최종 원고 시험(설계 10절: 안 읽고 풀기 · 해독). 시험관 묶음을 만들고 답을 채점한다. 화면 없이 글로 본다.
 *   node experiences/board-decode/qa/판시험.mjs 만들기 [폴더]
 *   node experiences/board-decode/qa/판시험.mjs 채점 [폴더]
 * 폴더 기본값은 워크트리 .tmp/board-decode-20261104/v3(하위 에이전트가 답을 쓸 수 있는 자리).
 * 시험관마다 조합 · 보기 순서를 다르게 준다(2회차에는 보기 순서가 고정이라 전부 a를 찍는 일이 있었다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUNDS, WORDS } from '../content.mjs';
import { combosOf, makeRng, shuffle, noticeLines, patchOf, isRight, sayOf } from '../core.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..');
const 밖 = path.resolve(process.argv[3] || path.join(뿌리, '.tmp', 'board-decode-20261104', 'v3'));
const 시험관 = ['안읽고_1', '안읽고_2', '안읽고_3', '해독_1', '해독_2', '해독_3'];
const 글자가림 = (s) => s.replace(/[가-힣]/g, '▢');

function 공지글(round, fork, patch, 가림, 표) {
  const 말 = (t) => t.replace(/\[\[([^\]]+)\]\]/g, (_, w) => (표[w] ? `〔${표[w]}〕` : w));
  const 줄 = (t) => (가림 === '전부' ? 글자가림(말(t)) : 말(t));
  return round.notices.map((n) => {
    const rows = noticeLines(round, fork, n).map((l) => {
      if (typeof l === 'string') return 줄(l);
      if (l.big) return 줄(l.big);
      if (patch && l.key === patch.after) return `[정정 쪽지] ${줄(patch.line)}`;
      return 줄(l.text);
    });
    return `[${줄(n.org)}] ${줄(n.title)}\n${rows.join('\n')}`;
  }).join('\n\n');
}

function 판(round, fork, rng, 가림) {
  const patch = patchOf(round, fork);
  const words = [...new Set([...round.slots.flatMap((s) => s.keys.map((k) => fork[k] || k)), patch.key])];
  const 표 = Object.fromEntries(words.map((w, i) => [w, '①②③④⑤⑥'[i]]));
  const 칸 = [];
  const 정답 = {};
  round.slots.forEach((s, i) => {
    const opts = shuffle(s.opts, rng);
    칸.push(`칸 ${i + 1} — 태오: 「${sayOf(s, fork)}」\n${opts.map((o, j) => `  ${'abc'[j]}) ${o.t}`).join('\n')}`);
    정답[i + 1] = 'abc'[opts.findIndex((o) => isRight(s, fork, o))];
  });
  const opts = shuffle(patch.opts, rng);
  const n = round.slots.length + 1;
  const 정정칸 = `칸 ${n}(정정 쪽지가 붙은 뒤) — 태오: 「${patch.say}」\n${opts.map((o, j) => `  ${'abc'[j]}) ${o.t}`).join('\n')}`;
  정답[n] = 'abc'[opts.findIndex((o) => o.ok)];
  const 단서 = words.map((w) => `〔${표[w]}〕이 또 나온 곳: ${WORDS[w].clues.map((c) => c.replace(/\[\[[^\]]+\]\]/g, `〔${표[w]}〕`)).join(' / ')}`).join('\n');
  return { 공지: 공지글(round, fork, null, 가림, 표), 정정공지: 공지글(round, fork, patch, 가림, 표), 칸, 정정칸, 단서, 정답, 표 };
}

function 만들기() {
  const 변형 = {};
  시험관.forEach((이름, t) => {
    const rng = makeRng(t * 17 + 3), 곳 = path.join(밖, 이름);
    if (fs.existsSync(path.join(곳, '답.md'))) throw new Error(`답이 있다: ${곳}`);
    fs.mkdirSync(곳, { recursive: true });
    const 안읽고 = 이름.startsWith('안읽고');
    const 묶음 = [];
    변형[이름] = {};
    for (const round of ROUNDS) {
      const combos = combosOf(round), fork = combos[t % combos.length];
      const p = 판(round, fork, rng, 안읽고 ? '전부' : '말');
      변형[이름][round.id] = { fork, 정답: p.정답, 표: p.표 };
      묶음.push(`## 판 ${round.id}\n\n태오의 첫 메시지: ${round.open.first}\n\n게시물:\n\`\`\`\n${p.공지}\n\`\`\`\n\n${p.칸.join('\n\n')}\n\n정정 쪽지가 붙은 뒤 게시물:\n\`\`\`\n${p.정정공지}\n\`\`\`\n\n${p.정정칸}${안읽고 ? '' : `\n\n### 단서 카드(2단계에서만 본다)\n${p.단서}`}`);
    }
    const 머리 = 안읽고
      ? `너는 게임의 허점을 찾는 시험관이다. 아래 게시물은 한글을 모두 ▢로 가렸다(숫자 · 기호는 그대로, 열쇠 말 자리는 〔①〕로 표시). 게시물을 읽지 않고, 숫자 · 글 길이 · 태오의 말 · 보기의 말투 · 상식만으로 답을 찍어 맞혀 본다. 모르면 가장 그럴듯한 것을 고른다(빈칸 없이). 첫 줄부터 차례로 찍지 말고 칸마다 근거를 대고 고른다.\n\n끝에 「읽지 않고 풀리는 허점」을 셋까지 쓴다.\n마지막 줄에 JSON 한 줄(판 id → 칸 번호 → 기호): {"laundry":{"1":"a","2":"b","3":"c"},"festival":{...},"season":{...}}`
      : `너는 TOPIK 3급인 몽골 유학생이다(20살, 어학당 1년 뒤 대학 1학년). 아래 게시물에서 〔①〕〔②〕처럼 가린 말을 모른다. 두 단계로 답한다.\n1단계: 단서 카드를 보지 말고 게시물만으로 답을 고른다. 칸마다 확신 1~5.\n2단계: 단서 카드를 보고 〔①〕〔②〕… 각각의 뜻을 쉬운 한국어 한 줄로 짐작한 뒤 답을 다시 고른다.\n가린 말의 원래 낱말을 맞히려 하지 말고 이 사람의 눈으로 짐작한다.\n\n마지막 줄에 JSON 한 줄: {"laundry":{"처음":{"1":"a","2":"b","3":"c"},"단서뒤":{"1":"a","2":"b","3":"c"},"뜻":{"①":"…"}},"festival":{...},"season":{...}}`;
    fs.writeFileSync(path.join(곳, '질문.md'), `${머리}\n\n${묶음.join('\n\n---\n\n')}\n`);
  });
  fs.writeFileSync(path.join(밖, '변형표.json'), JSON.stringify(변형, null, 1));
  console.log('묶음 →', 밖);
}

function 마지막JSON(글) {
  for (const 줄 of 글.trim().split(/\r?\n/).reverse()) { const s = 줄.trim(); if (s.startsWith('{')) { try { return JSON.parse(s); } catch { /* 다음 줄 */ } } }
  return null;
}

function 채점() {
  const 변형 = JSON.parse(fs.readFileSync(path.join(밖, '변형표.json'), 'utf8'));
  const 칸수 = (o) => Object.keys(o).length;
  const 합 = { 안읽고: [0, 0], 처음: [0, 0], 단서뒤: [0, 0] };
  for (const 이름 of 시험관) {
    const f = path.join(밖, 이름, '답.md');
    const 답 = fs.existsSync(f) ? 마지막JSON(fs.readFileSync(f, 'utf8')) : null;
    if (!답) { console.log(`${이름}: 답 없음`); continue; }
    for (const [id, v] of Object.entries(변형[이름])) {
      const 잼 = (고름) => Object.entries(v.정답).filter(([k, a]) => String(고름?.[k] ?? '').trim().toLowerCase().slice(0, 1) === a).length;
      if (이름.startsWith('안읽고')) { const n = 잼(답[id]); 합.안읽고[0] += n; 합.안읽고[1] += 칸수(v.정답); console.log(`${이름} ${id} ${Object.values(v.fork).join('·')}: ${n}/${칸수(v.정답)}`); } else {
        const a = 잼(답[id]?.처음), b = 잼(답[id]?.단서뒤); 합.처음[0] += a; 합.처음[1] += 칸수(v.정답); 합.단서뒤[0] += b; 합.단서뒤[1] += 칸수(v.정답);
        const 뜻 = Object.entries(v.표).map(([w, m]) => `${w}=「${답[id]?.뜻?.[m] ?? '—'}」`).join(' ');
        console.log(`${이름} ${id}: 처음 ${a} → 단서 뒤 ${b}/${칸수(v.정답)} · ${뜻}`);
      }
    }
  }
  console.log(`안 읽고 풀기 칸 정답 ${합.안읽고.join('/')} (찍기 기준 33%) · 단서 없이 ${합.처음.join('/')} · 단서 뒤 ${합.단서뒤.join('/')}`);
}

if (process.argv[2] === '채점') 채점(); else 만들기();
