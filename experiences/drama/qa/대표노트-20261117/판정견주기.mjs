#!/usr/bin/env node
/**
 * 드라마 코치 판정 두 판 견주기(2026-11-17) — 지금 판(tools/lib/드라마판정.mjs)과 후보 판정 모듈을 같은 말에 넣어 갈린 것을 본다. API를 부르지 않는다.
 *   node experiences/drama/qa/대표노트-20261117/판정견주기.mjs [--후보 <모듈>] [--채점 <결과.json>]
 * 기본 후보는 같은 폴더의 후보_드라마판정_8.mjs, 기본 채점은 공용 작업본 .tmp/대표노트-20261117/합성50-4판/결과.json(11-17 합성 50개 채점)이다.
 * 네 가지를 본다.
 *  ① 대표 노트 합성 50개에서 코치가 놓친 일곱 줄과, 받아 적기처럼 문장 부호를 넣은 판.
 *  ② 옛 대사 칸 명세 검수 회차의 시험 말(공용 작업본 output/topik-review/drama-*, git 밖) — 그 회차의 명세로 두 판을 돌린다.
 *     맞는 말로 쓴 시험 말에 후보만 노트를 주면 새 오노트 후보다. 노트 줄 말로 쓴 시험 말을 후보만 잡으면 새로 잡은 것이다.
 *  ③ 합성 50개 다시 맞대기 — 채점 AI는 코치 노트를 보지 않고 먼저 적으므로 그 답을 그대로 두고 코치 판정만 후보로 바꿔 맞댄다.
 *     코치 노트가 채점과 달라진 줄이 생기면 그 줄은 확인 호출이 필요하다(「확인 필요」로 내고 오노트 합격을 판정하지 않는다).
 *  ④ 지금 대사 은행 줄마다 칸 명세 점검(checkSpec)을 후보로.
 * 새 오노트 후보가 있거나, 다시 맞댄 오노트가 있거나, 칸 명세 문제가 있으면 1로 끝난다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { judgeLine as 지금판정, DRAMA_JUDGE_VERSION as 지금판 } from '../../../../tools/lib/드라마판정.mjs';
import { 은행읽기 } from '../../../../tools/대표노트채점.mjs';
import { 코치결정, 맞대기, 세기, 합격선 } from '../../../../tools/lib/대표노트비교.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '../../../..');
const { 공용작업본 } = createRequire(import.meta.url)(path.join(뿌리, 'tools/lib/공용작업본.js'));
const 공용 = 공용작업본(뿌리);
const 인자 = (이름, 기본) => { const i = process.argv.indexOf(이름); return i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : 기본; };
const 후보경로 = 인자('--후보', path.join(여기, '후보_드라마판정_8.mjs'));
const 채점경로 = 인자('--채점', path.join(공용, '.tmp/대표노트-20261117/합성50-4판/결과.json'));
const { judgeLine: 후보판정, checkSpec: 후보점검, DRAMA_JUDGE_VERSION: 후보판 } = await import(pathToFileURL(후보경로).href);
const 꼴 = (r) => (r.status !== 'ok' ? r.status : r.verdict === 'note' ? `노트:${r.note.kind}` : `통과${r.sure ? '·확실' : ''}`);
let 걸림 = 0;
console.log(`지금 ${지금판} · 후보 ${후보판}(${path.relative(뿌리, 후보경로)})`);

const { 은행 } = await 은행읽기();
const 줄 = new Map(은행.map((l) => [l.id, l]));

// ① 놓친 일곱 줄
console.log('\n① 합성 50개에서 놓친 일곱 줄(받아 적은 글 그대로 → 문장 부호를 넣은 판)');
const 일곱 = [
  ['h19', 's1e01-5', '네 알겠어 감사합니다 교수님', '네, 알겠어. 감사합니다, 교수님.'],
  ['h24', 's1e01-6', '네 맞아요 한참 헤맸어요', '네, 맞아요. 한참 헤맸어요.'],
  ['h27', 's1e01-7', '네 선배님 그런데 혹시 도서관이 어디에 있는지 알아', '네, 선배님! 그런데 혹시 도서관이 어디에 있는지 알아?'],
  ['h35', 's1e01-9', '네 꼭 갈게요', '네, 꼭 갈게요!'],
  ['h40', 's1e01-t2', '이 책 언제까지 반납해야 돼', '이 책 언제까지 반납해야 돼?'],
  ['h44', 's1e01-t4', '복사실 어디야', '복사실 어디야?'],
  ['h49', 's1e01-t8', '교수님 과제 어디에 내', '교수님, 과제 어디에 내?'],
];
for (const [id, 대사, 글, 부호] of 일곱) {
  const spec = 줄.get(대사).spec;
  const 판 = (말) => `${꼴(지금판정(spec, { transcript: 말 }))} → ${꼴(후보판정(spec, { transcript: 말 }))}`;
  console.log(`  ${id} ${대사.padEnd(9)} 「${글}」 ${판(글)} · 부호 넣은 판 ${판(부호)}`);
}

// ② 옛 검수 회차의 시험 말
console.log('\n② 옛 대사 칸 명세 검수 회차의 시험 말');
const 꾸러미 = path.join(공용, 'output/topik-review');
if (!fs.existsSync(꾸러미)) console.log(`  건너뜀 — ${꾸러미}가 없다(공용 작업본에만 있다)`);
else {
  const 본것 = new Set(), 셈 = { 시험말: 0, 맞는말: 0, 노트말: 0 }, 새오노트 = [], 새로잡음 = [], 그밖 = [];
  const 읽기 = (dir, f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : {});
  for (const 이름 of fs.readdirSync(꾸러미).filter((n) => n.startsWith('drama-')).sort()) {
    const dir = path.join(꾸러미, 이름), packet = 읽기(dir, 'packet.json'), merged = 읽기(dir, 'merged.json'), argon = 읽기(dir, 'argon.json');
    for (const [i, raw] of (packet.units || []).entries()) {
      // 앞 회차 꾸러미(r1~r9 무렵)는 명세를 view 안에 두고 모범 대사와 최소 음절을 따로 적었다.
      const v = raw.view || {};
      const spec = raw.spec ?? (v.명세 ? { ...v.명세, line: v.모범_대사, ...(Number.isInteger(v.최소_음절) ? { minSyllables: v.최소_음절 } : {}) } : null);
      if (raw.kind !== 'drama' || !spec?.line) continue;
      const unit = { spec: { id: raw.id, ...spec } };
      const uid = `u${String(i + 1).padStart(3, '0')}`, 목록 = [];
      const 훑기 = (v) => { if (!v || typeof v !== 'object') return; if (Array.isArray(v.probes)) 목록.push(...v.probes); for (const x of Object.values(v)) 훑기(x); };
      훑기(merged[uid]); 훑기(argon.results?.[uid]);
      for (const p of 목록) {
        if (!p?.say || 본것.has(`${unit.spec.id}|${p.say}`)) continue;
        본것.add(`${unit.spec.id}|${p.say}`);
        셈.시험말++; if (p.expect === 'pass') 셈.맞는말++; else 셈.노트말++;
        const a = 지금판정(unit.spec, { transcript: p.say }), b = 후보판정(unit.spec, { transcript: p.say });
        if (꼴(a) === 꼴(b)) continue;
        const 줄글 = `${이름} ${unit.spec.id} 「${p.say}」 기대 ${p.expect === 'pass' ? '맞는 말' : `노트(${p.kind})`} · ${꼴(a)} → ${꼴(b)}`;
        if (p.expect === 'pass' && b.verdict === 'note' && a.verdict !== 'note') 새오노트.push(줄글);
        else if (p.expect !== 'pass' && b.verdict === 'note' && b.note.kind === p.kind) 새로잡음.push(줄글);
        else 그밖.push(줄글);
      }
    }
  }
  console.log(`  시험 말 ${셈.시험말}개(같은 대사의 같은 말은 한 번) · 맞는 말로 쓴 것 ${셈.맞는말} · 노트 줄 말로 쓴 것 ${셈.노트말}`);
  console.log(`  맞는 말에 후보만 노트(새 오노트 후보) ${새오노트.length}개 · 노트 줄 말을 후보만 바르게 잡음 ${새로잡음.length}개 · 그 밖에 갈림 ${그밖.length}개`);
  for (const x of [...새오노트.map((s) => `새 오노트 후보 ${s}`), ...새로잡음.map((s) => `새로 잡음 ${s}`), ...그밖.map((s) => `그 밖 ${s}`)]) console.log(`   - ${x}`);
  걸림 += 새오노트.length;
}

// ③ 합성 50개 다시 맞대기
console.log('\n③ 합성 50개 다시 맞대기(채점 답은 그대로, 코치만 후보)');
if (!fs.existsSync(채점경로)) console.log(`  건너뜀 — ${채점경로}가 없다`);
else {
  const 결과 = JSON.parse(fs.readFileSync(채점경로, 'utf8'));
  const 입력 = new Map(fs.readFileSync(path.join(뿌리, 'tests/fixtures/대표노트_합성50.jsonl'), 'utf8').split('\n').filter(Boolean).map((s) => JSON.parse(s)).filter((h) => h.id).map((h) => [h.id, h]));
  const 줄들 = [], 바뀜 = [];
  for (const 옛 of 결과.줄들) {
    const h = 입력.get(옛.id), spec = 줄.get(옛.줄)?.spec;
    if (!h || !spec || h.받아적은글 !== 옛.받아적은글) { console.log(`  ${옛.id}: 입력이나 대사가 채점 때와 다르다 — 이 줄은 셀 수 없다`); 걸림++; continue; }
    const 코치 = 코치결정(후보판정(spec, { transcript: h.받아적은글, seconds: h.초, speechSeconds: h.말한초 })), 맞댐 = 맞대기(코치, 옛.채점, spec);
    const 그대로 = 맞댐 === 옛.맞댐 && 코치.노트 === 옛.코치노트;
    if (!그대로) 바뀜.push(`${옛.id} 「${h.받아적은글}」 코치 ${옛.코치노트} → ${코치.노트}${코치.끝맺음 ? `(${코치.끝맺음})` : ''} · ${옛.맞댐} → ${맞댐}`);
    줄들.push({ 맞댐, 코치노트: 코치.노트, 확인: 그대로 ? 옛.확인 : 맞댐 === '일치' ? null : '확인 필요', 두채점같음: 옛.두채점같음, 의도: 옛.의도, 채점노트: 옛.채점노트 });
  }
  const 셈 = 세기(줄들), 선 = 합격선(셈);
  console.log(`  채점 때 판 ${결과.판?.판정판} · 대사 판 ${결과.판?.대사판} → 후보 ${후보판}`);
  console.log(`  일치 ${셈.일치}/${셈.센표본} · 코치 노트 ${셈.코치노트수}(틀린 노트 ${셈.오노트} · 애매 ${셈.애매} · 확인 필요 ${셈.확인못함}) · 놓침 ${셈.놓침} · 채점 노트 가운데 코치도 같음 ${셈.노트일치}/${셈.채점노트수}`);
  console.log(`  합격선: 일치 ${선.일치 ? '넘음' : '못 넘음'} · 틀린 노트 ${선.오노트 == null ? '확인 필요 줄이 있어 모름' : 선.오노트 ? '지킴' : '못 지킴'}`);
  for (const b of 바뀜) console.log(`   - ${b}`);
  if (셈.오노트 || 셈.확인못함) 걸림++;
}

// ④ 칸 명세 점검
const 문제 = 은행.map((l) => [l.id, 후보점검(l.spec)]).filter(([, p]) => p.length);
console.log(`\n④ 지금 대사 은행 ${은행.length}줄 칸 명세 점검(후보): 문제 ${문제.length}줄`);
for (const [id, p] of 문제) console.log(`   - ${id}: ${p.join(' · ')}`);
걸림 += 문제.length;

process.exitCode = 걸림 ? 1 : 0;
