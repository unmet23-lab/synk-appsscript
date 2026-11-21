// 제품이 코치의 exclude를 부르는 곳(4-6e-5 r2 GPT GA2 · r3 GA1 · r4 GA5 — 설계 주인 11-21). 답의 전달(delivered)은 답의 저장이 끝난 뒤
// 기록부에 든 사건으로 정한다(evidence). 그러나 셸은 판이 닫힐 때 그 판에서 센 첫 답을 판 기록에 한 줄로 쌓는다(곁 기록 — §25-3). 그 뒤에
// 답이나 소리 전달을 제외하면 판 기록은 다시 세지 않아 접기와 어긋난다. 제품은 답 · 소리 전달을 제외하지 않는다. 이 시험이 그 전제를
// 지킨다. experiences/에서 `exclude`라는 글자가 든 파일을 esbuild로 주석을 걷고 다시 찍어, exclude가 나오는 자리를 모두 아래 표와 견준다.
// 새 자리가 생기면 멈춘다 — 무엇을 제외하는지 보고 까닭과 함께 표에 더한다(답이나 소리 전달이면 판 기록의 셈을 다시 설계한다).
// 이 정적 검사가 닫는 꼴: 띄어 쓰거나 줄을 바꾼 호출, 받는 쪽의 선택 연결(`coach?.exclude(…)`), 메서드의 선택 호출(`coach.exclude?.(…)`),
// 부르지 않고 읽기(`const ex = coach.exclude`), 대괄호 이름(`coach['exclude']`), 풀어 받기(`{ exclude } = coach`), 허용한 호출의 앞 조건이
// 없는 호출. `exclude`라는 글자를 쪼개 짓는 꼴은 찾지 못한다. 빠짐없음은 4-6e-2의 실행 시험이 지킨다 — 새 우회 꼴이 나오면 엔진 묶음의
// P1이 아니라 4-6e-2 시험 항목으로 넘긴다(설계 주인 11-21).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as esbuild from 'esbuild';
import { EXPERIENCES, maskStrings, nameOf } from '../support/game-closure.mjs';

const MEMBER = /(\??\.)exclude\b(\?\.)?(\()?/g;
const RECEIVER = /([A-Za-z_$][\w$]*(?:\(\))?(?:\??\.[A-Za-z_$][\w$]*(?:\(\))?)*)$/;
const BRACKETS = /\[\s*(["'`])exclude\1\s*\]/g;
const DESTRUCTURES = [
  /\{[^{}]*\bexclude\b[^{}]*\}\s*=(?![=>])/g,
  /\(\s*\{[^{}]*\bexclude\b[^{}]*\}\s*\)\s*=>/g,
];

// 받는 쪽 · 인자 · 그 호출이 있어도 되는 파일 · 까닭. guard가 있으면 그 호출 바로 앞의 글이 그 꼴이어야 한다(호출마다 본다).
const ALLOWED = [
  {
    call: 'current().session.exclude(eventId)',
    files: file =>
      file.endsWith('/atlas-learning.js') ||
      file === 'synk-world-app/world-account.bundle.mjs' ||
      file === 'brand-opening/content/life-standalone.mjs',
    why: '옛 엔진 사본(atlas-learning.js와 그것을 싣는 묶음)이 제 판의 사건을 뺀다 — 새 코치가 아니다',
  },
  {
    call: 'game().exclude(id)',
    files: file => file === 'drama/pilot/atlas-learning.js',
    why: '드라마 시범 묶음의 옛 엔진이 제 게임 코치의 응답을 뺀다 — 새 코치가 아니다',
  },
  {
    call: 'row.from.exclude(id)',
    files: file =>
      file === 'synk-world-app/world-learning-ui.mjs' ||
      file === 'brand-opening/content/life-standalone.mjs',
    why: '「내가 남긴 응답」 목록에서 옛 엔진 코치의 줄을 뺀다. 새 길 줄(row.next)은 excludeResponse로 간다',
    guard: /if\s*\(\s*row\.next\s*\)\s*row\.from\.excludeResponse\(id\);\s*else\s*$/,
  },
];

// 풀어 받기로 나와도 되는 자리 — 그 파일의 그 꼴만. 코치 메서드가 아닌 같은 이름의 옵션이다.
const DESTRUCTURE_ALLOWED = [
  {
    file: 'hangul-stage/core.mjs',
    form: /\bexclude = null\b/,
    why: '한글 무대가 문항 유형을 고를 때 이미 낸 유형의 모음을 받는 옵션이다 — 코치 메서드가 아니다',
  },
];

function* sources(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'tests' || entry.name.startsWith('.'))
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(full);
    else if (/\.m?js$/.test(entry.name) && !/\.test\.m?js$/.test(entry.name)) yield full;
  }
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// 주석을 걷고 다시 찍은 글(raw)과 글자 안을 비운 글(masked). 다시 찍지 못하면 null.
function readCode(text) {
  try {
    const raw = esbuild.transformSync(text, { loader: 'js' }).code;
    return { raw, masked: maskStrings(raw) };
  } catch {
    return null;
  }
}

// exclude 자리 하나 — 부르면 받는 쪽 · 인자를 표와, 부르지 않으면 멈춘다.
function checkMember(file, masked, match, found) {
  const at = match.index;
  const where = `${file}:${lineOf(masked, at)}`;
  if (!match[3]) {
    found.stray.push(`${where} 부르지 않고 읽음`);
    return;
  }
  const receiver = RECEIVER.exec(masked.slice(0, at))?.[1] ?? '';
  const after = masked.slice(at + match[0].length);
  const call = `${receiver}${match[1]}exclude${match[2] ?? ''}(${after.slice(0, after.indexOf(')')).trim()})`;
  const rule = ALLOWED.find(one => one.call === call && one.files(file));
  const before = masked.slice(Math.max(0, at - receiver.length - 120), at - receiver.length);
  if (!rule) found.stray.push(`${where} ${call}`);
  else if (rule.guard && !rule.guard.test(before))
    found.stray.push(`${where} ${call}(새 길 줄을 거르는 앞 조건이 없다)`);
  else found.used.add(rule.call);
}

// 한 파일을 표와 견준다 — 표 밖이면 stray에, 표 안이면 used에.
function checkFile(file, text, found) {
  if (!/exclude/.test(text)) return;
  const code = readCode(text);
  if (!code) {
    found.stray.push(`${file} 다시 찍지 못함`);
    return;
  }
  const { raw, masked } = code;
  for (const match of masked.matchAll(MEMBER)) checkMember(file, masked, match, found);
  for (const match of raw.matchAll(BRACKETS))
    found.stray.push(`${file}:${lineOf(raw, match.index)} ['exclude'] 꼴`);
  for (const pattern of DESTRUCTURES)
    for (const match of masked.matchAll(pattern)) {
      const rule = DESTRUCTURE_ALLOWED.find(one => one.file === file && one.form.test(match[0]));
      if (rule) found.used.add(rule);
      else found.stray.push(`${file}:${lineOf(masked, match.index)} 풀어 받기`);
    }
}

test('제품이 exclude를 부르는 곳은 표에 적은 곳뿐이다 — 새 코치로 답이나 소리 전달을 빼는 곳이 없다', () => {
  const found = { used: new Set(), stray: [] };
  for (const full of sources(EXPERIENCES))
    checkFile(nameOf(full), fs.readFileSync(full, 'utf8'), found);
  assert.deepEqual(
    found.stray,
    [],
    '표에 없는 exclude 자리 — 무엇을 빼는지 보고 까닭과 함께 표에 더한다',
  );
  assert.deepEqual(
    [
      ...ALLOWED.filter(one => !found.used.has(one.call)).map(one => one.call),
      ...DESTRUCTURE_ALLOWED.filter(one => !found.used.has(one)).map(one => one.why),
    ],
    [],
    '표의 자리가 제품에서 사라졌다 — 표에서 지운다',
  );
  assert.ok([...ALLOWED, ...DESTRUCTURE_ALLOWED].every(one => one.why.length > 0));
});

test('찾는 꼴 — 선택 연결 · 메서드의 선택 호출 · 부르지 않고 읽기 · 대괄호 · 풀어 받기 · 조건 밖 호출을 놓치지 않는다(r3 GA1 · r4 GA5)', () => {
  const strayOf = (file, text) => {
    const found = { used: new Set(), stray: [] };
    checkFile(file, text, found);
    return found;
  };
  const GAME = 'korean-racing/atlas-next-play.mjs';
  for (const text of [
    'coach?.exclude(heard.id);',
    'coach.exclude?.(heard.id);',
    'coach\n  . exclude (heard.id);',
    "coach['exclude'](id);",
    'const ex = coach.exclude; ex(id);',
    'const { exclude } = coach; exclude(id);',
  ])
    assert.ok(strayOf(GAME, text).stray.length > 0, text);
  const UI = 'synk-world-app/world-learning-ui.mjs';
  const guarded = strayOf(
    UI,
    'if(row.next)row.from.excludeResponse(id);else row.from.exclude(id);',
  );
  assert.deepEqual(guarded.stray, [], '조건 안의 호출은 표 안이다');
  assert.deepEqual([...guarded.used], ['row.from.exclude(id)']);
  assert.ok(
    strayOf(
      UI,
      'if(row.next)row.from.excludeResponse(id);else row.from.exclude(id);\nrow.from.exclude(id);',
    ).stray.length > 0,
    '조건 밖 호출',
  );
});
