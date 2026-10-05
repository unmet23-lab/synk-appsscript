#!/usr/bin/env node
'use strict';
// 교원 검수 시트 하나. 교원이 확인할 것을 원본에서 그대로 뽑아 한 표로 만든다:
// 게임 문항과 게임 글(여덟 게임), 상황 예문(Strata 예문 층), 게임↔상황 초안, 문형→능력 초안.
// 표는 여기서만 만들고, 고친 것은 원본(게임 문항 파일, strata/)에 반영한다. 표를 직접 원본으로 삼지 않는다.
//
//   node tools/교원검수시트.js                       docs/교원검수/교원검수시트.csv 를 다시 만든다
//   node tools/교원검수시트.js --읽기 <검수한.csv>    검수 결과를 읽어 갈래별로 센다(고침·빼기·새 문항·원본이 바뀐 줄)
//   node tools/교원검수시트.js --읽기 <검수한.csv> --적용
//                                                    「맞음」으로 확인된 상황 예문의 id를 예문 원천의 review.reviewed 에 적는다
//
// 교원이 채우는 칸은 「확인」(맞음 · 고침 · 빼기), 「고친 내용」, 「메모」, 「검수자」, 「날짜」다. 새 문항은 「번호」를 비우고
// 「갈래」와 「내용」을 적은 새 줄로 넣는다.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const SHEET = 'docs/교원검수/교원검수시트.csv';
const EXAMPLES = 'strata/topik-i.situation-examples.json';
const COLUMNS = ['번호', '갈래', '자리', '내용', '정답·보기', '풀이', '읽힌 문형', '확인', '고친 내용', '메모', '검수자', '날짜'];
const KINDS = ['게임 문항', '게임 글', '상황 예문', '게임↔상황', '문형→능력'];
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const one = value => String(value ?? '').replace(/\s*\r?\n\s*/g, ' ').trim();

// Names the story's scene shows for its ids (experiences/story-classroom/stage.mjs).
const STORY_NAMES = { narrator: '이야기', marin: '마린', kkamong: '까몽', teacher: '선생님', snacks: '과자', paper: '종이', cake: '케이크', ribbon: '리본',
  flowers: '꽃', letter: '편지', box: '상자', drawer: '서랍', table: '책상', bin: '쓰레기통', shelf: '선반', board: '칠판', floor: '바닥' };

async function buildRows() {
  const { createMap } = require('../strata');
  const { topikMap } = require('../strata/topik-i');
  const { situationExamples } = require('../strata/topik-i-examples');
  const { grammarIn, grammarOf } = require('../strata/topik-i-forms');
  const grammar = require('../strata/topik-i.grammar.json');
  const skills = require('../strata/topik-i.skills.json');
  const situations = require('../strata/topik-i.situations.json');
  const map = createMap(topikMap({ includeWords: false }));
  const pointLabel = new Map(grammar.points.map(([id, label]) => [id, label]));
  const skillLabel = new Map(skills.skills.map(([id, , label]) => [id, label]));
  const read = text => grammarIn(text).map(id => pointLabel.get(id)).join(' · ');
  const rows = [];
  const add = (id, kind, place, content, answer = '', why = '', forms = '') => rows.push({ 번호: id, 갈래: kind, 자리: one(place), 내용: one(content), '정답·보기': one(answer), 풀이: one(why), '읽힌 문형': one(forms) });

  // 빈칸 베기
  {
    const { ITEMS, PRACTICE, KIND_LABEL, SKILL_LABEL } = await load('experiences/blank-slice/content.mjs');
    for (const item of [PRACTICE, ...ITEMS]) {
      const filled = item.text.replace('{}', item.answer);
      // The point of the blank itself (as the game links it), then what the whole sentence shows.
      const blank = item.skill === 'ko.reading.grammar' ? grammarOf(item.answer, { after: item.text.slice(item.text.indexOf('{}') + 2) }) : null;
      const forms = [...new Set([blank, ...grammarIn(filled)].filter(Boolean))].map(id => pointLabel.get(id)).join(' · ');
      add(`문항/blank-slice/${item.id}`, '게임 문항', `빈칸 베기 · ${KIND_LABEL[item.kind] || item.kind} · ${SKILL_LABEL[item.skill] || item.skill}${item === PRACTICE ? ' · 연습 문장' : ''}`,
        item.text.replace('{}', `[${item.answer}]`), `정답 ${item.answer} · 보기 ${item.options.join(' / ')}`, item.why, forms);
    }
  }
  // 입장 검사
  {
    const { VENUES, CAST, ITEMS } = await load('experiences/entry-check/content.mjs');
    for (const venue of VENUES) {
      const rule = (r, memo) => add(`문항/entry-check/${venue.id}.${memo ? 'memo.' : ''}${r.id}`, '게임 문항', `입장 검사 · ${venue.name} ${memo ? `알림(${memo})` : '안내문'} · ${skillLabel.get(r.skill) || r.skill}`,
        r.text, `짧은 이름 ${r.short}`, '', read(r.text));
      for (const r of venue.notice.rules) rule(r);
      if (venue.memo) rule(venue.memo.rule, venue.memo.title);
      const short = new Map([...venue.notice.rules, ...(venue.memo ? [venue.memo.rule] : [])].map(r => [r.id, r.short]));
      for (const c of venue.cases) {
        const who = CAST[c.who];
        add(`문항/entry-check/${c.id}`, '게임 문항', `입장 검사 · ${venue.name} · 손님 ${who.name}(${who.age}살) · ${skillLabel.get(c.skill) || c.skill}`,
          `말: “${c.line}” · ${c.doc ? `${c.doc.title}: ${c.doc.rows.map(([k, v]) => `${k} ${v}`).join(', ')}` : '보여 주는 표·카드 없음'} · 짐: ${(c.items || []).map(id => ITEMS[id] || id).join(', ') || '없음'} · 시각 ${c.at}`,
          c.answer === 'pass' ? '통과' : `거절 — ${short.get(c.answer) || c.answer}`, `${c.why} / 손님 대답: ${c.reply || ''}${c.oops ? ` / 잘못 들여보냈을 때: ${c.oops}` : ''}`, read(c.line));
      }
    }
  }
  // 선생님이 돌아왔다(이야기 교실)
  {
    const { EPISODE } = await load('experiences/story-classroom/story.mjs');
    const name = id => STORY_NAMES[id] || id;
    const mission = (m, place) => add(`문항/story-classroom/${m.id}`, '게임 문항', `선생님이 돌아왔다 · ${place} · ${m.skill}`, m.text,
      `움직이는 친구 ${name(m.actor)} · 옮길 것 ${name(m.object)} · 갈 곳 ${name(m.destination)}`, m.explanation, read(m.text));
    const lines = (list, part, place) => (list || []).forEach((line, i) => add(`글/story-classroom/${part}-${i + 1}`, '게임 글', `선생님이 돌아왔다 · ${place}`, `${name(line.speaker)}: ${line.text}`, '', '', read(line.text)));
    lines(EPISODE.opening, 'opening', '여는 글');
    for (const act of EPISODE.acts) {
      lines(act.intro, `${act.id}-intro`, `${act.title} 앞 글`);
      for (const m of act.missions) mission(m, act.title);
      lines(act.outro, `${act.id}-outro`, `${act.title} 뒤 글`);
    }
    for (const m of EPISODE.review || []) mission(m, '새 글로 마지막 정리');
    lines(EPISODE.ending, 'ending', '맺는 글');
  }
  // 주문 폭주
  {
    const { ORDERS, REVIEW, describeCup } = await load('experiences/order-rush/core.mjs');
    for (const [list, place] of [[ORDERS, '주문'], [REVIEW, '새 문장 주문']]) for (const o of list) {
      add(`문항/order-rush/${o.id}`, '게임 문항', `주문 폭주 · ${place} · ${o.skill}`, o.text, o.cups.map(describeCup).join(' + '), '', read(o.text));
    }
  }
  // 바람길
  {
    const { INSTRUCTIONS, actionLabel } = await load('experiences/korean-runner/instructions.mjs');
    const { LISTENING_CHECKS } = await load('experiences/korean-runner/listening-check.mjs');
    for (const i of INSTRUCTIONS) add(`문항/korean-runner/${i.id}`, '게임 문항', `바람길 · 달리며 듣는 지시 · ${i.skill}`, i.text, i.steps.map(actionLabel).join(' → '), i.explanation, read(i.text));
    for (const c of LISTENING_CHECKS) add(`문항/korean-runner/${c.id}`, '게임 문항', `바람길 · 듣기 확인 · ${c.skill}`, c.text,
      `정답 ${c.choices[c.correct]} · 보기 ${c.choices.join(' / ')}`, c.explanation, read(c.text));
  }
  // 한국어 리듬
  {
    const { TRACKS } = await load('experiences/korean-rhythm/core.mjs');
    for (const track of TRACKS) track.questions.forEach((q, i) => {
      add(`문항/korean-rhythm/t${track.id}q${i}`, '게임 문항', `한국어 리듬 · ${track.title} · ${q.category}`, q.prompt,
        q.claims.map(c => `${c.question} → ${c.answer}`).join(' · '), q.explanation, read(q.prompt));
      if (q.recall) add(`문항/korean-rhythm/t${track.id}q${i}.recall`, '게임 문항', `한국어 리듬 · ${track.title} · ${q.category} · 다시 확인`, q.recall.prompt,
        `${q.recall.question} → ${q.recall.answer}`, '', read(q.recall.prompt));
    });
  }
  // 한국어 레이싱: 주제 단계의 낱말(나머지 단계는 낱말 목록의 순서 그대로다)
  {
    const { STAGES, WORDS } = await load('experiences/korean-racing/curriculum.js');
    const word = new Map(WORDS.map(w => [w.id, w.word]));
    for (const s of STAGES.filter(stage => stage.band === 'theme')) add(`문항/korean-racing/${s.id}`, '게임 문항', `한국어 레이싱 · ${s.number}단계 「${s.title}」 · ${s.mode === 'picture' ? '그림 보고 고르기' : '듣고 고르기'}`,
      s.words.map(id => word.get(id)).join(' · '), '주제에 맞는 낱말 다섯 개');
  }
  // 말 랠리
  {
    const { ITEMS, PRACTICE, KIND_LABEL, SKILL_LABEL } = await load('experiences/talk-rally/content.mjs');
    for (const item of [PRACTICE, ...ITEMS]) add(`문항/talk-rally/${item.id}`, '게임 문항', `말 랠리 · ${KIND_LABEL[item.kind] || item.kind} · ${SKILL_LABEL[item.skill] || item.skill}${item === PRACTICE ? ' · 연습 공' : ''}`,
      item.line, `정답 ${item.answer} · 보기 ${item.options.join(' / ')}`, item.why, read(item.line));
  }

  const { REASON_WORDS, WORLD_GAMES } = await load('experiences/synk-account/src/atlas-words.mjs');
  const situation = new Map(situations.situations.map(([id, reason, label, when]) => [id, { reason, label, when }]));
  // 상황 예문
  for (const { situation: id, examples } of situationExamples(map, { grammarIn }).all()) {
    const s = situation.get(id);
    for (const e of examples) add(`예문/${e.id}`, '상황 예문', `${REASON_WORDS[s.reason] || s.reason} · ${s.label} — ${s.when} 쓰는 말`, e.ko,
      e.from ? `게임 문항 글 그대로(${e.from})` : '새로 쓴 초안', e.reviewed ? '교원 확인을 마친 문장' : '', e.grammar.map(point => pointLabel.get(point)).join(' · '));
  }
  // 게임↔상황 초안: 그 게임의 연습이 곧 그 상황인가
  {
    const sample = prefix => rows.filter(r => r.번호.startsWith(prefix) && r.갈래 === '게임 문항').slice(0, 3).map(r => r.내용).join(' / ');
    for (const game of WORLD_GAMES) {
      if (!game.situations.length) { add(`게임상황/${game.path}/없음`, '게임↔상황', game.label, `${game.label}: 한 상황으로 묶지 않는다(여러 일상 주제를 고루 다룬다).`, '이 게임에 맞는 상황이 있으면 메모에 적어 주세요', '', ''); continue; }
      for (const id of game.situations) {
        const s = situation.get(id);
        add(`게임상황/${game.path}/${id}`, '게임↔상황', game.label, `${game.label}의 연습 = 「${s.label}」 — ${s.when} 쓰는 말 (${REASON_WORDS[s.reason] || s.reason})`, `이 게임의 문장: ${sample(`문항/${game.path}/`)}`, '', '');
      }
    }
  }
  // 문형→능력 초안
  for (const [id, label, forms, step, pointSkills, basis] of grammar.points) {
    add(`문형능력/${id}`, '문형→능력', `${step}단계 · ${basis === undefined ? '문법 은행 순서' : '표준 교육과정 등급'}`, `${label} → ${pointSkills.map(skill => skillLabel.get(skill) || skill).join(' · ')}`,
      `형태 ${forms.join(', ')}`, '', '');
  }
  const ids = new Set();
  for (const row of rows) { if (!row.내용 || ids.has(row.번호) || !KINDS.includes(row.갈래)) throw new Error(`교원 검수 시트: 잘못된 줄 ${row.번호}`); ids.add(row.번호); }
  return rows;
}

// RFC 4180, every field quoted. Excel reads the BOM as UTF-8.
const cell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
function toCsv(rows) {
  return '﻿' + [COLUMNS, ...rows.map(row => COLUMNS.map(column => row[column] ?? ''))].map(line => line.map(cell).join(',')).join('\r\n') + '\r\n';
}
function parseCsv(text) {
  const source = String(text).replace(/^﻿/, ''), table = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') { if (source[i + 1] === '"') { field += '"'; i += 1; } else quoted = false; } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && source[i + 1] === '\n') i += 1; row.push(field); field = ''; table.push(row); row = []; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); table.push(row); }
  const [head, ...body] = table.filter(line => line.some(value => value.trim() !== ''));
  if (!head || !['번호', '갈래', '내용', '확인'].every(column => head.includes(column))) throw new Error('교원 검수 시트: 머리 줄에 번호·갈래·내용·확인 칸이 있어야 한다');
  return body.map(line => Object.fromEntries(head.map((column, i) => [column.trim(), (line[i] ?? '').trim()])));
}

const VERDICT = new Map([['맞음', 'ok'], ['확인', 'ok'], ['o', 'ok'], ['ㅇ', 'ok'], ['ok', 'ok'], ['고침', 'fix'], ['수정', 'fix'], ['빼기', 'drop'], ['삭제', 'drop'], ['', 'open']]);
// What a reviewed sheet says, against the sources as they are now. A row whose source changed after
// the sheet was made is not counted as reviewed: its verdict was given to other words.
function review(reviewedRows, currentRows) {
  const current = new Map(currentRows.map(row => [row.번호, row]));
  const report = { counts: {}, fixes: [], drops: [], added: [], changed: [], unknown: [], unclear: [], confirmedExamples: [] };
  for (const kind of KINDS) report.counts[kind] = { 모두: currentRows.filter(row => row.갈래 === kind).length, 맞음: 0, 고침: 0, 빼기: 0, 아직: 0 };
  const seen = new Set();
  for (const row of reviewedRows) {
    if (!row.번호) { if (row.내용) report.added.push({ 갈래: row.갈래 || '', 자리: row.자리 || '', 내용: row.내용, '정답·보기': row['정답·보기'] || '', 메모: row.메모 || '' }); continue; }
    const now = current.get(row.번호);
    if (!now || seen.has(row.번호)) { report.unknown.push(row.번호); continue; }
    seen.add(row.번호);
    const verdict = VERDICT.get((row.확인 || '').trim().toLowerCase());
    if (verdict === undefined) { report.unclear.push({ 번호: row.번호, 확인: row.확인 }); continue; }
    if (verdict !== 'open' && one(row.내용) !== now.내용) { report.changed.push({ 번호: row.번호, 시트: row.내용, 지금: now.내용, 확인: row.확인 }); continue; }
    const count = report.counts[now.갈래];
    if (verdict === 'ok') { count.맞음 += 1; if (now.갈래 === '상황 예문') report.confirmedExamples.push(row.번호.slice('예문/'.length)); }
    else if (verdict === 'fix') { count.고침 += 1; report.fixes.push({ 번호: row.번호, 지금: now.내용, 고친: row['고친 내용'] || '', 메모: row.메모 || '' }); }
    else if (verdict === 'drop') { count.빼기 += 1; report.drops.push({ 번호: row.번호, 지금: now.내용, 메모: row.메모 || '' }); }
  }
  for (const kind of KINDS) { const c = report.counts[kind]; c.아직 = c.모두 - c.맞음 - c.고침 - c.빼기; }
  return report;
}

// Writes the confirmed example ids into the example layer's review.reviewed, in the source's order,
// without reflowing the hand-formatted file.
function applyConfirmedExamples(ids, file = path.join(root, EXAMPLES)) {
  const text = fs.readFileSync(file, 'utf8'), data = JSON.parse(text);
  const order = Object.values(data.examples).flat().map(([id]) => id);
  const next = order.filter(id => data.review.reviewed.includes(id) || ids.includes(id));
  const strangers = ids.filter(id => !order.includes(id));
  if (strangers.length) throw new Error(`교원 검수 시트: 예문이 아닌 번호 ${strangers.join(', ')}`);
  const pattern = /"reviewed":\s*\[[^\]]*\]/;
  if (!pattern.test(text)) throw new Error('교원 검수 시트: 예문 원천에서 review.reviewed 를 찾지 못했다');
  const updated = text.replace(pattern, () => `"reviewed": [${next.map(id => JSON.stringify(id)).join(', ')}]`);
  if (updated !== text) { const temporary = `${file}.tmp-${process.pid}`; fs.writeFileSync(temporary, updated); fs.renameSync(temporary, file); }
  return { reviewed: next.length, added: next.length - data.review.reviewed.length };
}

async function main() {
  const args = process.argv.slice(2), readAt = args.indexOf('--읽기');
  if (args.some((a, i) => !['--읽기', '--적용'].includes(a) && !(readAt >= 0 && i === readAt + 1)) || (args.includes('--적용') && readAt < 0)) throw new Error('쓰는 법: node tools/교원검수시트.js [--읽기 <검수한.csv> [--적용]]');
  const rows = await buildRows();
  if (readAt < 0) {
    const target = path.join(root, SHEET), csv = toCsv(rows);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') === csv.replace(/\r\n/g, '\n');
    if (!same) { const temporary = `${target}.tmp-${process.pid}`; fs.writeFileSync(temporary, csv); fs.renameSync(temporary, target); }
    console.log(`${same ? '그대로' : '다시 만듦'} ${SHEET} · ${rows.length}줄 (${KINDS.map(kind => `${kind} ${rows.filter(row => row.갈래 === kind).length}`).join(' · ')})`);
    return;
  }
  const file = args[readAt + 1];
  if (!file) throw new Error('--읽기 뒤에 검수한 CSV 파일을 적는다');
  const report = review(parseCsv(fs.readFileSync(path.resolve(file), 'utf8')), rows);
  for (const kind of KINDS) { const c = report.counts[kind]; console.log(`${kind}: 모두 ${c.모두} · 맞음 ${c.맞음} · 고침 ${c.고침} · 빼기 ${c.빼기} · 아직 ${c.아직}`); }
  const list = (title, items, show) => { if (items.length) { console.log(`\n${title} ${items.length}`); for (const item of items) console.log(`  ${show(item)}`); } };
  list('고침', report.fixes, f => `${f.번호}: 「${f.지금}」 → 「${f.고친}」${f.메모 ? ` (${f.메모})` : ''}`);
  list('빼기', report.drops, d => `${d.번호}: 「${d.지금}」${d.메모 ? ` (${d.메모})` : ''}`);
  list('새 문항', report.added, a => `[${a.갈래}] ${a.자리 ? `${a.자리} · ` : ''}${a.내용}${a['정답·보기'] ? ` · ${a['정답·보기']}` : ''}`);
  list('시트를 만든 뒤 원본이 바뀐 줄(다시 확인)', report.changed, c => `${c.번호}: 시트 「${c.시트}」 · 지금 「${c.지금}」`);
  list('「확인」 칸을 읽지 못한 줄', report.unclear, u => `${u.번호}: ${u.확인}`);
  list('모르는 번호', report.unknown, u => u);
  if (args.includes('--적용')) { const result = applyConfirmedExamples(report.confirmedExamples); console.log(`\n예문 원천에 반영: 확인된 문장 ${result.reviewed}개(이번에 ${result.added}개). 고침·빼기·새 문항은 위 목록을 보고 원본에서 고친다.`); }
  else if (report.confirmedExamples.length) console.log(`\n「맞음」인 상황 예문 ${report.confirmedExamples.length}개 — --적용 을 붙이면 예문 원천에 적는다.`);
}

module.exports = { buildRows, toCsv, parseCsv, review, applyConfirmedExamples, COLUMNS, KINDS, SHEET };
if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });
