#!/usr/bin/env node
// 쓰기 채점 일치 시험(README 「시험 ①」) — 제품과 같은 요청 몸통(SYNK-talk lib/world-writing-feedback.js)으로
// 같은 글을 여러 번 · 여러 모델에 따로 보내 범주별 A~F 참고 범위를 모은다. 결과는 --out 폴더의 결과.jsonl(커밋하지 않음).
//
//   git -C ../SYNK-talk show origin/master:lib/world-writing-feedback.js > <talk폴더>/world-writing-feedback.js
//   git -C ../SYNK-talk show origin/master:lib/world-writing-items.js > <talk폴더>/world-writing-items.js
//   SYNK_CLAUDE_KEYS=~/SYNK_보안/클로드_키목록_검수.json node 채점일치.mjs --talk <talk폴더> [--실행]
//
// --실행이 없으면 보낼 요청 수와 어림 비용만 찍는다. 이미 성공한 (채점, 글) 쌍은 건너뛰어 이어 돌릴 수 있다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const talkDir = opt('--talk');
if (!talkDir) { console.error('--talk <SYNK-talk lib 두 파일을 꺼낸 폴더>가 필요하다'); process.exit(2); }
const essaysPath = path.resolve(opt('--essays', path.join(here, 'essays24.mjs')));
const outDir = path.resolve(opt('--out', path.join(here, '결과')));
const runs = opt('--runs', 'S1:claude-sonnet-5-5,S2:claude-sonnet-5-5,O:claude-opus-5-5')
  .split(',').map((pair) => { const [run, model] = pair.split(':'); return { run, model }; });
const parallel = Math.max(1, Number(opt('--동시', '3')));
const go = args.includes('--실행');

const feedback = require(path.resolve(talkDir, 'world-writing-feedback.js'));
const { ITEMS } = require(path.resolve(talkDir, 'world-writing-items.js'));
const 클로드 = require(path.resolve(here, '../../../../tools/lib/클로드키.js'));
const { ESSAYS } = await import(pathToFileURL(essaysPath).href);

const outFile = path.join(outDir, '결과.jsonl');
fs.mkdirSync(outDir, { recursive: true });
const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean)
  .map((line) => JSON.parse(line)).filter((row) => row.ok).map((row) => `${row.run}|${row.essayId}`) : []);

const jobs = [];
for (const { run, model } of runs) {
  if (!feedback.MODELS[model]) throw new Error(`모델 표에 없는 모델: ${model}`);
  for (const essay of ESSAYS) {
    if (done.has(`${run}|${essay.id}`)) continue;
    const item = ITEMS.find((it) => it.id === essay.item);
    if (!item || item.review?.status !== 'passed') throw new Error(`열린 문항이 아니다: ${essay.item}`);
    const answer = feedback.readAnswer(item, essay.text);
    jobs.push({ run, model, essay, item, answer, body: feedback.buildRequest({ item, answer, lang: 'ko', model }) });
  }
}
const guess = jobs.reduce((sum, job) => sum + (job.model.includes('opus') ? 0.027 : 0.0135), 0);
console.log(`지시문 ${feedback.PROMPT_VERSION} · 은행 ${feedback.BANK_HASH} · 글 ${ESSAYS.length} · 채점 ${runs.map((r) => r.run).join('/')} · 남은 요청 ${jobs.length} · 어림 $${guess.toFixed(2)}`);
if (!go) process.exit(0);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function one(job) {
  const base = { run: job.run, model: job.model, essayId: job.essay.id, item: job.item.id, version: job.essay.version, target: job.essay.target,
    prompt: feedback.PROMPT_VERSION, bank: feedback.BANK_HASH };
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { 응답, 키이름 } = await 클로드.보내기(job.body, { 용도: 'score-path-writing-agreement', 시간제한: 180000 });
      const text = feedback.responseText(응답);
      const usage = 응답?.usage ?? null;
      const row = { ...base, attempt, key: 키이름, stop: 응답?.stop_reason ?? null, usage, estUSD: 클로드.추정USD(job.model, usage), raw: text };
      try {
        row.parsed = feedback.readFeedback(job.item, job.answer, text);
        row.ok = true;
        return row;
      } catch (e) {
        last = { ...row, ok: false, error: `${e.code || e.message}` };
        if (attempt < 3) continue;
      }
    } catch (e) {
      last = { ...base, attempt, ok: false, error: `${e.code || ''} ${e.message}`.trim(), http: e.http ?? null };
      if (e.code === '클로드키_모두소진') return last;
      if (e.http === 429 || (e.http >= 500) || e.code === '클로드키_결과모름') { await wait(30000); continue; }
      return last;
    }
  }
  return last;
}

let next = 0, ok = 0, bad = 0, spent = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const row = await one(job);
    row.at = new Date().toISOString();
    fs.appendFileSync(outFile, JSON.stringify(row) + '\n');
    if (row.ok) ok++; else bad++;
    spent += row.estUSD || 0;
    const bands = row.parsed?.categories?.map((c) => `${c.id[0]}:${c.high}${c.low}`).join(' ') || row.error;
    console.log(`${row.run} ${row.essayId} ${row.ok ? 'ok' : '실패'} ${bands} ($${(row.estUSD || 0).toFixed(4)})`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
console.log(`끝 — 성공 ${ok} · 실패 ${bad} · 이번 추정 $${spent.toFixed(3)} → ${outFile}`);
