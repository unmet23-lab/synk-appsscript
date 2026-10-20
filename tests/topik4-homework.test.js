'use strict';
// WORLD 「이번 주 과제」 자료(experiences/synk-world-app/topik4-homework*.json)가 수업 자료 문서(docs/온라인반_TOPIK4급)와 같은지.
// 1) 변환기(tools/build-topik4-homework.mjs)를 지금 문서로 다시 돌린 결과가 커밋된 JSON과 같다(손으로 고친 JSON·문서만 고친 커밋을 잡는다).
// 2) 변환기를 믿지 않고 문서 원문과 직접 대조한다: 정답·보기·지문·지시문·예시답·분량, 「(같은 지문)」 문항의 지문 다시 싣기.
// 3) 학생이 먼저 받는 JSON에는 정답·근거·예시답·가상 학생 초안이 없다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const docs = path.join(root, 'docs', '온라인반_TOPIK4급');
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const homeworkFile = path.join(root, 'experiences/synk-world-app/topik4-homework.json');
const keyFile = path.join(root, 'experiences/synk-world-app/topik4-homework-key.json');
const homework = JSON.parse(read(homeworkFile));
const key = JSON.parse(read(keyFile));
const CIRCLED = ['①', '②', '③', '④'];
const plain = segments => (Array.isArray(segments) ? segments : [segments]).map(s => typeof s === 'string' ? s : s.b ?? s.u).join('');
// 블록(문단·표·목록·제목·보기 상자)을 문서에서 찾을 수 있는 글 조각들로 편다.
function pieces(blocks) {
  const out = [];
  for (const block of blocks || []) {
    if (block.p) for (const line of block.p) out.push(plain(line));
    if (block.list) for (const item of block.list) out.push(plain(item));
    if (block.h) out.push(block.h);
    if (block.box) out.push(plain(block.box));
    if (block.table) for (const row of [block.table.head, ...block.table.rows]) for (const cell of row) out.push(plain(cell));
  }
  return out;
}
// 문서의 꾸밈(**, <u>, 인용 >, 표 |)을 벗긴 글: 조각이 그 안에 그대로 있어야 한다.
const bare = text => text.replace(/\*\*/g, '').replace(/<\/?u>/g, '').replace(/^> ?/gm, '');
function section(md, anchor) {
  const start = md.indexOf(`<a id="${anchor}"></a>`);
  assert.ok(start >= 0, `${anchor} 자리표가 없다`);
  const next = md.slice(start + 1).search(/\n<a id="[wr]\d(?:-\d)?"><\/a>\n/);
  return md.slice(start, next < 0 ? md.length : start + 1 + next);
}
const homeworkLengthOf = text => [...text.replace(/\r\n?/g, '\n').normalize('NFC').replace(/\n/g, '')].length;

test('변환기를 지금 문서로 다시 돌린 결과가 커밋된 JSON 두 개와 같다', async () => {
  const tool = await import('../tools/build-topik4-homework.mjs');
  const built = tool.buildHomework(tool.readSources(root));
  assert.equal(tool.homeworkJson(built.homework), read(homeworkFile), 'topik4-homework.json이 문서와 다르다 — node tools/build-topik4-homework.mjs');
  assert.equal(tool.homeworkJson(built.key), read(keyFile), 'topik4-homework-key.json이 문서와 다르다 — node tools/build-topik4-homework.mjs');
  assert.equal(homework.version, key.version);
  assert.match(homework.version, /^v1-[0-9a-f]{12}$/);
  // 글자 수 규칙은 문서 검산(tests/online-class-topik4.test.js)과 같다.
  for (const sample of ['가나다\n라', 'é', '  ,.\r\n']) assert.equal(tool.homeworkLength(sample), homeworkLengthOf(sample));
});

test('8주마다 쓰기 W와 읽기 R이 그 주 번호로 하나씩 있고, 차시표의 수업·문법·듣기 칸과 같다', () => {
  const readme = read(path.join(docs, 'README.md'));
  assert.equal(homework.weeks.length, 8);
  assert.deepEqual(homework.schedule, { weeks: 8, dueWeekday: 3, dueTime: '23:00', timeZone: 'Asia/Seoul', utcOffset: '+09:00' });
  const guide = read(path.join(docs, '첨삭기준.md'));
  assert.match(guide, /\| 수요일 23:00 \| 학생 \| 과제 마감\./, '마감(수요일 23:00)이 첨삭 기준의 한 주 흐름과 같다');
  homework.weeks.forEach((week, i) => {
    assert.equal(week.week, i + 1);
    assert.equal(week.writing.id, `W${i + 1}`);
    assert.equal(week.reading.id, `R${i + 1}`);
    const row = readme.split('\n').find(line => line.startsWith(`| ${i + 1} | `));
    assert.ok(row, `차시표 ${i + 1}주 줄`);
    const cells = row.slice(1, -1).split('|').map(c => c.trim());
    assert.deepEqual([week.lesson, week.grammar, week.listening], cells.slice(1, 4), `${i + 1}주 차시표`);
    assert.ok(cells[4].includes(`R${i + 1} `) && cells[5].includes(`W${i + 1} `));
  });
});

test('읽기 40문항: 지시문·지문·보기·정답·근거·오답 이유가 문서 원문과 같다', () => {
  const md = read(path.join(docs, '읽기연습.md'));
  const items = homework.weeks.flatMap(w => w.reading.items.map(item => ({ ...item, week: w.week })));
  assert.equal(items.length, 40);
  assert.equal(new Set(items.map(i => i.id)).size, 40);
  for (const item of items) {
    assert.match(item.id, new RegExp(`^R${item.week}-[1-5]$`));
    const part = section(md, item.id.toLowerCase()), text = bare(part);
    assert.ok(part.includes(`### ${item.id} · ${item.label}\n`), `${item.id} 머리`);
    assert.ok(text.includes(`\n${item.instruction}\n`), `${item.id} 지시문`);
    assert.equal(item.options.length, 4);
    // 보기: 문서의 보기 줄(한 줄에 넷 또는 넷 줄)을 원문 그대로 다시 짜 맞춘다.
    const optionLines = part.slice(0, part.indexOf('**정답:**')).split('\n').filter(l => /^[①②③④]/.test(l));
    const joined = optionLines.length === 1 ? optionLines[0] : optionLines.join('\n');
    const rebuilt = optionLines.length === 1 ? item.options.map((o, n) => `${CIRCLED[n]} ${o}`).join('　') : item.options.map((o, n) => `${CIRCLED[n]} ${o}`).join('\n');
    assert.equal(rebuilt, joined, `${item.id} 보기`);
    const k = key.reading[item.id];
    assert.ok(k, `${item.id} 정답 자료`);
    assert.ok(part.includes(`**정답:** ${CIRCLED[k.answer - 1]}\n`), `${item.id} 정답`);
    assert.ok(part.includes(`**근거:** ${k.reason}\n`), `${item.id} 근거`);
    const wrong = Object.entries(k.wrong).map(([n, t]) => `${CIRCLED[n - 1]} ${t}`).join(' · ');
    assert.ok(part.includes(`**오답:** ${wrong}`), `${item.id} 오답`);
    assert.deepEqual(Object.keys(k.wrong).map(Number), [1, 2, 3, 4].filter(n => n !== k.answer), `${item.id} 오답 번호`);
    // 지문: 같은 지문 문항은 원래 문항의 지문을 그대로 다시 싣는다.
    const same = part.match(/^\((R\d-\d)과 같은 지문\)$/m);
    if (same) {
      assert.equal(item.samePassageAs, same[1], `${item.id} 같은 지문 표시`);
      const source = items.find(i => i.id === same[1]);
      assert.deepEqual(item.passage, source.passage, `${item.id} 지문 다시 싣기`);
      assert.ok(item.passage.length > 0);
    } else {
      assert.equal(item.samePassageAs, undefined);
      for (const piece of pieces(item.passage)) assert.ok(text.includes(piece), `${item.id} 지문 조각 「${piece.slice(0, 20)}」`);
    }
    for (const piece of pieces(item.notes)) assert.ok(text.includes(piece), `${item.id} 지문 앞 글 「${piece}」`);
    // 밑줄은 밑줄대로 옮긴다.
    const underlined = [...part.matchAll(/<u>([^<]+)<\/u>/g)].map(m => m[1]);
    const kept = JSON.stringify(item.passage).match(/\{"u":"([^"]+)"\}/g) || [];
    if (!same) assert.equal(kept.length, underlined.length, `${item.id} 밑줄 수`);
  }
  // R8-2·R8-4·R8-5는 README 남은 일에 적힌 「(같은 지문)」 문항이다.
  assert.deepEqual(items.filter(i => i.samePassageAs).map(i => `${i.id}=${i.samePassageAs}`), ['R8-2=R8-1', 'R8-4=R8-3', 'R8-5=R8-3']);
});

test('쓰기 14문제: 지시문·자료·쓸 칸·분량·예시답이 문서 원문과 같다', () => {
  const md = read(path.join(docs, '쓰기과제.md'));
  const parts = homework.weeks.flatMap(w => w.writing.parts.map(p => ({ ...p, week: w.week })));
  assert.deepEqual(parts.map(p => p.key), ['W1-1', 'W1-2', 'W2-1', 'W2-2', 'W2-3', 'W3-1', 'W4-1', 'W5-1', 'W6-1', 'W7-1', 'W7-2', 'W7-3', 'W7-4', 'W8-1']);
  for (const p of parts) {
    const part = section(md, `w${p.week}`), text = bare(part);
    assert.ok(text.includes(plain(p.instruction)), `${p.key} 지시문`);
    for (const piece of pieces(p.blocks)) assert.ok(text.includes(piece), `${p.key} 자료 조각 「${piece.slice(0, 20)}」`);
    const ids = p.fields.map(f => f.id);
    assert.deepEqual(ids, p.fields.map((_, i) => `${p.key}.${i + 1}`), `${p.key} 칸 번호`);
    for (const field of p.fields) {
      assert.ok(['line', 'text', 'grid'].includes(field.kind), `${p.key} 칸 꼴`);
      if (field.kind === 'text') assert.ok(plain(p.instruction).includes(`${field.min}~${field.max}자`), `${p.key} 분량 ${field.min}~${field.max}`);
    }
    // 빈칸 문제: 지문의 ( ㉠ ) 수만큼 한 줄 칸이 있다.
    const blanks = pieces(p.blocks).join('\n').match(/\( [㉠-㉣] \)/g) || [];
    const lines = p.fields.filter(f => f.kind === 'line' && /^[㉠-㉣]$/.test(f.label));
    assert.equal(lines.length, blanks.length, `${p.key} 빈칸 칸 수`);
    // 예시답은 문서에 그대로 있고(문단 사이는 빈 줄), 글이면 분량 안이다.
    const k = key.writing[p.key];
    assert.ok(k, `${p.key} 예시답 자료`);
    for (const [id, model] of Object.entries(k.model || {})) {
      const field = p.fields.find(f => f.id === id);
      assert.ok(field, `${p.key} 예시답 칸 ${id}`);
      if (field.kind === 'grid') { for (const row of model) for (const cell of row) assert.ok(text.includes(cell), `${id} 개요 예시 「${cell}」`); continue; }
      for (const paragraph of model.split('\n\n')) assert.ok(text.includes(paragraph), `${id} 예시답`);
      if (field.kind === 'text') {
        const n = homeworkLengthOf(model.replace(/\n\n/g, '\n'));
        assert.ok(n >= field.min && n <= field.max, `${id} 예시답 ${n}자`);
        assert.ok(part.includes(`예시답 — 본문 ${n}자**`), `${id} 문서에 적은 글자 수 ${n}자`);
      }
    }
    for (const name of ['accept', 'criteria', 'mistakes', 'check']) if (k[name]) assert.ok(text.includes(k[name].split(' ')[0]), `${p.key} ${name}`);
  }
  // 칸 꼴: 51·52는 빈칸 두 줄, 53은 200~300자, 54는 600~700자(5주는 개요 + 서론 100~150자), 8주는 고쳐 쓴 글 + 오류 목록 셋.
  const shape = Object.fromEntries(parts.map(p => [p.key, p.fields.map(f => f.kind === 'text' ? `${f.min}~${f.max}` : f.kind === 'grid' ? `${f.rows.length}x${f.columns.length}` : f.label.length === 1 ? f.label : 'line').join(' ')]));
  assert.deepEqual(shape, {
    'W1-1': '㉠ ㉡', 'W1-2': '㉠ ㉡', 'W2-1': '㉠ ㉡', 'W2-2': '㉠ ㉡', 'W2-3': 'line line line line line', 'W3-1': '200~300', 'W4-1': '200~300',
    'W5-1': '5x2 100~150', 'W6-1': '600~700', 'W7-1': '㉠ ㉡', 'W7-2': '㉠ ㉡', 'W7-3': '200~300', 'W7-4': '600~700', 'W8-1': '600~700 3x3',
  });
  assert.deepEqual(parts.map(p => p.number ?? null), [51, 51, 52, 52, null, 53, 53, 54, 54, 51, 52, 53, 54, null]);
});

test('학생이 먼저 받는 JSON에는 정답·근거·예시답·가상 학생 초안이 없다', () => {
  const student = read(homeworkFile);
  assert.doesNotMatch(student, /"(answer|reason|wrong|model|accept|criteria|mistakes)"\s*:/);
  for (const k of Object.values(key.reading)) assert.ok(!student.includes(k.reason), '근거가 새어 나갔다');
  for (const k of Object.values(key.writing)) for (const model of Object.values(k.model || {})) {
    for (const piece of (typeof model === 'string' ? model.split('\n\n') : model.flat())) assert.ok(!student.includes(JSON.stringify(piece).slice(1, -1)), `예시답이 새어 나갔다: ${piece.slice(0, 20)}`);
  }
  const md = read(path.join(docs, '쓰기과제.md'));
  const drafts = [...md.matchAll(/\*\*(?:가상 학생 초안[^*]*|고쳐 쓰기 시범[^*]*|고쳐 쓴 앞부분\(예\))\*\*\n\n((?:> .*\n)+)/g)].map(m => m[1].replace(/^> /gm, '').trim());
  assert.equal(drafts.length, 4);
  for (const draft of drafts) {
    assert.ok(!student.includes(draft.slice(0, 30)), '가상 학생 초안이 학생 JSON에 있다');
    assert.ok(!read(keyFile).includes(draft.slice(0, 30)), '가상 학생 초안이 정답 JSON에 있다');
  }
  // 8주 오류 목록의 예는 칸의 꼴을 보여 주는 예라 학생 JSON에 있어도 된다(답이 아니다).
  assert.deepEqual(homework.weeks[7].writing.parts[0].fields[1].example[0], ['글에서 「-아요」 쓰기', '사용해요', '사용한다']);
});

test('문서 꼴이 바뀌면 조용히 넘기지 않고 멈춘다', async () => {
  const tool = await import('../tools/build-topik4-homework.mjs');
  // 윈도 작업본은 문서를 CRLF로 꺼낸다(core.autocrlf). 고침 문자열이 닿게 LF로 맞춘다.
  const sources = Object.fromEntries(Object.entries(tool.readSources(root)).map(([name, text]) => [name, text.replace(/\r\n/g, '\n')]));
  const broken = [
    ['reading', s => s.replace('**정답:** ③\n**근거:** 「아무리」', '**정답:** ⑤\n**근거:** 「아무리」'), /정답 꼴/],
    ['reading', s => s.replace('① 바쁘거나　② 바쁘니까　③ 바쁘더라도　④ 바쁘다가', '① 바쁘거나　② 바쁘니까　③ 바쁘더라도'), /보기 번호/],
    ['reading', s => s.replace('(R8-1과 같은 지문)', '(R8-9과 같은 지문)'), /같은 지문의 원래 문항이 없다/],
    ['writing', s => s.replace('**예시답 — 본문 281자**', '**예시답 — 본문 280자**'), /글자 수 280자로 적었는데 281자/],
    ['writing', s => s.replace('이 내용을 200~300자의 글로', '이 내용을 글로'), /분량/],
    ['writing', s => s.replace('그런데 갑자기 ( ㉠ ).', '그런데 갑자기 ㉠.').replace('교수님께서 ( ㉡ ).', '교수님께서 ㉡.'), /빈칸/],
    ['schedule', s => s.replace('| 3 | 53번 ① 조사 결과 비교 |', '| 3 | [53번](x.md) |'), /꾸밈|링크/],
  ];
  for (const [name, edit, pattern] of broken) {
    const changed = { ...sources, [name]: edit(sources[name]) };
    assert.notEqual(changed[name], sources[name], `${pattern} 시험의 고침이 문서에 닿지 않았다`);
    assert.throws(() => tool.buildHomework(changed), pattern);
  }
});
