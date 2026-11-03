#!/usr/bin/env node
/**
 * 게시판 해독 · 작은 시험 채점(2026-11-04) — 시험관 답.md의 마지막 JSON 줄을 원고의 정답과 맞춘다.
 *
 *   node experiences/board-decode/qa/small-test-20261104/채점.mjs
 *
 * 해독 · 안읽고: 칸마다 맞음 / 틀림, 판마다 첫 시도 전부 맞음, 찍기 기준값(모든 칸을 무작위로 골랐을 때).
 * 시험관: 끝까지 · 게임같음 점수와 또 할 판 · 재미없는 판을 판 꼴(A · B · C)로 되돌려 모은다(판 번호는 시험관마다 순서가 달라 그대로 못 견준다).
 * 뜻 짐작(해독의 「뜻」)은 자유 글이라 여기서 채점하지 않고 나란히 찍어 사람이 본다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { 밖, 판들, 시험관들 } from './판.mjs';

const 칸표 = (R) => {
  const 표 = {};
  R.steps.forEach((st, i) => {
    let n = 0;
    const 넣기 = (보기) => { 표[`${i + 1}${'abcdef'[n++]}`] = { 보기, 정답: 보기.flatMap((o, j) => (o.ok ? ['abcdef'[j]] : [])) }; };
    if (st.options) 넣기(st.options);
    for (const sl of st.slots || []) 넣기(sl.options);
  });
  return 표;
};

function 마지막JSON(글) {
  const 줄 = 글.trim().split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
  if (!줄) return null;
  try { return JSON.parse(줄.trim()); } catch { return null; }
}

const 시험관답 = (폴더) => {
  const f = path.join(폴더, '답.md');
  return fs.existsSync(f) ? 마지막JSON(fs.readFileSync(f, 'utf8')) : null;
};

const 기준값 = (R) => Object.values(칸표(R)).reduce((곱, c) => 곱 * (c.정답.length / c.보기.length), 1);

function 채점(종류, 답에서) {
  const 합 = {};
  for (const 이름 of fs.readdirSync(path.join(밖, 종류))) {
    const 답 = 시험관답(path.join(밖, 종류, 이름));
    if (!답) { console.log(`  ${이름}: 답 없음 또는 JSON 못 읽음`); continue; }
    for (const R of 판들) {
      const 표 = 칸표(R);
      const 고름 = 답에서(답, R) || {};
      const 칸결과 = Object.entries(표).map(([k, c]) => [k, c.정답.includes(String(고름[k] ?? '').trim().toLowerCase().slice(0, 1))]);
      const 맞음 = 칸결과.filter(([, ok]) => ok).length;
      합[R.id] ||= { 전부: 0, 사람: 0, 칸맞음: 0, 칸: 0 };
      합[R.id].사람++; 합[R.id].칸맞음 += 맞음; 합[R.id].칸 += 칸결과.length;
      if (맞음 === 칸결과.length) 합[R.id].전부++;
      console.log(`  ${이름} ${R.id}: ${맞음}/${칸결과.length}${칸결과.filter(([, ok]) => !ok).length ? ` · 틀린 칸 ${칸결과.filter(([, ok]) => !ok).map(([k]) => `${k}(${고름[k] ?? '없음'})`).join(' ')}` : ''}`);
    }
  }
  for (const R of 판들) {
    const h = 합[R.id];
    if (h) console.log(`  → 판 ${R.id}: 첫 시도 전부 맞음 ${h.전부}/${h.사람} · 칸 ${h.칸맞음}/${h.칸} · 찍기 기준값 ${(기준값(R) * 100).toFixed(1)}%`);
  }
}

console.log('① 해독 시험(모르는 말을 가리고 맥락으로 풀기)');
채점('해독', (답, R) => 답[R.id]?.답);
console.log('  뜻 짐작:');
for (const R of 판들) {
  const 말들 = Object.keys(R.words);
  말들.forEach((w, i) => {
    const 표지 = '①②③④⑤⑥'[i];
    const 답들 = fs.readdirSync(path.join(밖, '해독')).map((이름) => 시험관답(path.join(밖, '해독', 이름))?.[R.id]?.뜻?.[표지] ?? '—');
    const 정답카드 = R.cards.find((c) => c.id === R.words[w].card).text;
    console.log(`  ${R.id} ${표지} ${w} = 「${정답카드}」 ← ${답들.map((a) => `「${a}」`).join(' ')}`);
  });
}

console.log('\n② 안 읽고 풀기(게시물 한글을 모두 가림)');
채점('안읽고', (답, R) => 답[R.id]);

console.log('\n③ 재미 시험관(판 번호를 판 꼴로 되돌림)');
const 모음 = Object.fromEntries(판들.map((R) => [R.id, { 끝까지: [], 게임같음: [] }]));
const 또 = {}; const 싫 = {}; const 수첩 = {};
for (const [이름, 사람] of Object.entries(시험관들)) {
  const 답 = 시험관답(path.join(밖, '시험관', 이름));
  if (!답) { console.log(`  ${이름}: 답 없음 또는 JSON 못 읽음`); continue; }
  사람.순서.forEach((id, i) => {
    모음[id].끝까지.push(답.끝까지?.[`판${i + 1}`]);
    모음[id].게임같음.push(답.게임같음?.[`판${i + 1}`]);
  });
  const 꼴로 = (s) => 사람.순서[Number(String(s).replace(/\D/g, '')) - 1] || '?';
  또[꼴로(답.또할판)] = (또[꼴로(답.또할판)] || 0) + 1;
  싫[꼴로(답.재미없는판)] = (싫[꼴로(답.재미없는판)] || 0) + 1;
  수첩[답.수첩] = (수첩[답.수첩] || 0) + 1;
}
const 평균 = (a) => { const b = a.filter((x) => Number.isFinite(x)); return b.length ? (b.reduce((p, c) => p + c, 0) / b.length).toFixed(1) : '—'; };
for (const R of 판들) console.log(`  판 ${R.id} ${R.kind}: 끝까지 평균 ${평균(모음[R.id].끝까지)} ${JSON.stringify(모음[R.id].끝까지)} · 게임같음 평균 ${평균(모음[R.id].게임같음)} ${JSON.stringify(모음[R.id].게임같음)}`);
console.log('  또 할 판:', 또, '· 재미없는 판:', 싫, '· 수첩:', 수첩);

console.log('\n④ 판마다 게시물 글 양(한글 음절)');
for (const R of 판들) {
  const 글 = R.notices.flatMap((N) => [N.head, N.title, N.foot || '', ...N.lines.map((L) => (typeof L === 'string' ? L : L.li || L.note || L.big || ''))]).join(' ').replace(/\{h:[\w-]+\|/g, '').replace(/[{}[\]]/g, '');
  console.log(`  판 ${R.id}: ${(글.match(/[가-힣]/g) || []).length}음절 · 게시물 ${R.notices.length}장 · 모르는 말 ${Object.keys(R.words).length}개 · 뜻 카드 ${R.cards.length}장`);
}
