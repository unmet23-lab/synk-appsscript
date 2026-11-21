// 제품 게임의 순간 맞춤 내용 관문(4-6e-5 — 설계 주인 11-21). 엔진의 막기 자체는 test/flow/content-block.test.mjs가 본다. 이 파일은 제품
// 파일을 불러 보고 훑으므로 esbuild가 드는 build 묶음에 둔다(변형 실행기는 이 묶음을 부르지 않는다).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import {
  EXPERIENCES,
  gameClosure,
  maskStrings,
  nameOf,
  printed,
  SCRIPT_SRC,
} from '../support/game-closure.mjs';
import { Flow } from '../flow/legacy.mjs';

// ── 제품 내용 ──
// 이 시험이 내보내기 전의 관문이다(설계 주인 11-21 — r3 GPT GA2). 판을 열 때 비로소 정의하는 게임이면 엔진의 던짐은 사용자 앞에서 게임이
// 멈추는 일이라, 그 전에 잡는다. 글자를 훑지 않고 모듈을 실제로 불러, 실행된 값을 정의해 본다 — `export { FLOW_X }` 꼴도, 이름으로 넘긴
// 문항 난도(`items: LEVELS`)도 그대로 본다.
// - 불러 볼 파일은 열한 게임 입구에서 import를 따라가 정한다(test/support/game-closure.mjs — 게임 목록은 셸의 게임 표 GAME_BANKS). 폴더 밖
//   공유 모듈도 저절로 든다. 그 가운데 FLOW_를 적고 무엇인가를 내보내는 모듈을 모두 불러, 내보낸 FLOW_ 값 가운데 NOT_CONTENT 밖의 것을
//   정의한다.
// - node에서 불러지지 않는 모듈은 UNLOADABLE에 까닭을 적어야 지나간다. 그 모듈만 아래 글자 맞추기로 대신한다(지금은 없다).
// - 게임이 따라 부르지 않는 experiences/는 불러 보지 않는다 — 명령 줄 도구(atlas-lab/build-share.mjs)가 돌거나 브라우저 전역이 없어
//   멈춘다. 대신 글자 그대로 쓴 문항 난도(items: { levels …)는 experiences/ 전체에서 세어, 모두 위에서 정의한 내용이거나 까닭을 적어 막기
//   밖에 둔 곳인지 본다. 이 맞추기는 글자 그대로 쓴 것만 본다.
// - 아래 둘째 시험은 게임 파일이 코치의 live · declaredFrom에 무엇을 넘기는지 본다(설계 주인 11-21 설계 관문 답).
const ITEM_LITERAL = /\bitems\s*:\s*\{\s*levels\b/g;
const MENTIONS = /\bFLOW_[A-Z_]+/;
// 막기 밖에 두는 곳과 그 까닭. 까닭이 사라지면(새 Flow로 옮기면) 이 시험이 멈춘다 — 그때 내용을 막기에 맞게 고치고 여기서 뺀다.
const EXCLUDED = {
  // atlas-lab의 READING · NUMBERS는 지금 옛 엔진(learning-hub/atlas-learning.js가 싣는 옛 atlas/flow.js)의 Flow로 연다 — 옛 Flow에는
  // 막기가 없다. 둘 다 문항 난도와 내용 · 도움 손잡이를 함께 두어 새 Flow에서는 정의할 때 던진다. 4-9에서 atlas-lab을 새 Flow로 옮기기
  // 전에 고친다(단계 4 계획 §2 4-9 · §25-12의 15).
  'atlas-lab/lab.js': text => /globalThis\.SynkLearning\b/.test(text),
};
// node에서 불러지지 않는 게임 모듈과 그 까닭(지금은 없다). 여기 든 모듈은 글자 맞추기로만 본다.
const UNLOADABLE = {};

// FLOW_로 내보낸 값은 아래 이름만 빼고 모두 내용으로 보고 정의 시험에 넣는다. 꼴로 고르면 손잡이나 id가 깨진 내용이 낱말 표처럼 보여
// 빠진다(4-6e-5 GPT GA4 · r2 GA3 — 설계 주인 11-21). 내용이 아닌 FLOW_ 이름이 새로 생기면 정의 시험에서 멈추니, 까닭과 함께 여기에 더한다.
const NOT_CONTENT = {
  FLOW_WORDS: '손잡이가 움직일 때 학생에게 보이는 한 줄 글의 표다',
  FLOW_SKILLS: '주문 폭주가 순간 맞춤 판을 여는 능력 목록이다',
};

function* sources(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'tests' || entry.name.startsWith('.'))
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(full);
    else if (/\.m?js$/.test(entry.name) && !/\.test\.m?js$/.test(entry.name)) yield full;
  }
}

// 열한 게임 입구에서 따라간 파일 가운데 FLOW_를 적고 내보내는 모듈을 불러 내보낸 FLOW_ 값을 모은다.
async function gameContents() {
  const { games, files } = await gameClosure();
  const found = { games, files, contents: [], skipped: new Set(), unloaded: [] };
  for (const name of files) await loadOne(name, found);
  return found;
}

async function loadOne(name, found) {
  const code = printed(name);
  if (!MENTIONS.test(code) || !/\bexport\b/.test(code)) return;
  if (Object.hasOwn(UNLOADABLE, name)) return;
  let module;
  try {
    module = await import(pathToFileURL(path.join(EXPERIENCES, name)).href);
  } catch (error) {
    found.unloaded.push(`${name}: ${error.message}`);
    return;
  }
  for (const [key, value] of Object.entries(module)) {
    if (!key.startsWith('FLOW_')) continue;
    if (Object.hasOwn(NOT_CONTENT, key)) found.skipped.add(key);
    else found.contents.push({ file: name, key, value });
  }
}

// experiences/ 전체에서 글자 그대로 쓴 문항 난도의 수.
function itemLiterals() {
  const literals = new Map();
  for (const file of sources(EXPERIENCES)) {
    const text = fs.readFileSync(file, 'utf8');
    const count = text.match(ITEM_LITERAL)?.length ?? 0;
    if (count) literals.set(nameOf(file), { count, text });
  }
  return literals;
}

test('제품 내용은 모두 막기를 지나 정의된다 — 셸의 게임 표에 든 게임의 모듈을 실제로 불러 본다', async t => {
  const { games, contents, skipped, unloaded } = await gameContents();
  assert.equal(
    games.length,
    11,
    '셸의 게임 표가 열한 곳이 아니다 — 게임이 늘거나 줄었으면 이 수를 고친다',
  );
  assert.deepEqual(
    unloaded,
    [],
    'node에서 불러지지 않는 게임 모듈 — 까닭과 함께 UNLOADABLE에 적는다',
  );
  assert.ok(Object.values(UNLOADABLE).every(why => why.length > 0));
  assert.deepEqual(
    [...skipped].sort(),
    Object.keys(NOT_CONTENT).sort(),
    '내용이 아니라고 뺀 이름이 게임 모듈에 없다 — NOT_CONTENT에서 지운다',
  );
  t.diagnostic(contents.map(c => `${c.file} ${c.key}`).join(' · '));
  assert.ok(
    contents.some(c => c.value?.items != null),
    '문항 난도를 실은 제품 내용을 찾지 못했다 — 찾는 법이 낡았다',
  );
  for (const { file, key, value } of contents)
    assert.doesNotThrow(() => Flow.defineContent(value), `${file} ${key}`);
  // 글자 그대로 쓴 문항 난도는 모두 위에서 정의한 내용이거나, 까닭을 적어 막기 밖에 둔 곳이다.
  const literals = itemLiterals();
  for (const [file, { count, text }] of literals) {
    if (Object.hasOwn(EXCLUDED, file)) {
      assert.ok(
        EXCLUDED[file](text),
        `${file}: 막기 밖에 둔 까닭(옛 엔진)이 사라졌다 — 내용을 막기에 맞게 고치고 EXCLUDED에서 뺀다`,
      );
      continue;
    }
    const defined = contents.filter(c => c.file === file && c.value?.items != null).length;
    assert.equal(
      defined,
      count,
      `${file}: 게임 모듈이 FLOW_로 내보내지 않은 문항 난도 내용이 있다`,
    );
  }
  assert.ok(
    Object.keys(EXCLUDED).every(file => literals.has(file)),
    '막기 밖에 둔 곳에 문항 난도 내용이 없다 — EXCLUDED에서 뺀다',
  );
});

// ── 게임 파일이 코치에 넘기는 내용(설계 주인 11-21 설계 관문 답) ──
// 일곱 게임은 live를 try/catch로 감싸, 엔진이 정의할 때 던져도 게임은 멈추지 않고 순간 맞춤만 소리 없이 꺼진다. 내보낸 FLOW_ 값만 정의해
// 보면 화면 파일이 바꿔 넘기는 내용(`coach.live({ ...FLOW_RACE, knobs: [...] })`)을 놓친다. 그래서 열한 게임 입구에서 따라간 파일에서 코치
// 호출 `.live(` · `.live?.(` · `.declaredFrom(`을 모두 찾는다. 첫 인자가 불러 본 FLOW_ 내용의 이름이거나 까닭을 적은 넘기기 이름일 때만
// 지나간다. 모르는 꼴(객체 글자 · 펼치기 · 함수 호출 · 표에 없는 이름)이면 멈춘다. live · declaredFrom이 호출이 아닌 꼴(부르지 않고 읽기 ·
// 대괄호 이름 · 풀어 받기)으로 나와도 멈춘다 — 꼭 필요한 자리는 READS에 까닭과 함께 적는다. 글은 esbuild로 주석을 걷고 다시 찍어 보므로
// `.`과 이름과 `(` 사이의 공백 · 줄바꿈은 같은 꼴이다.
// 이 정적 검사가 닫는 꼴(설계 주인 11-21 — 정적 검사의 상한):
//   - 띄어 쓰거나 줄을 바꾼 호출(`coach . live (`), 선택 호출(`.live?.(`)
//   - 첫 인자로 객체 글자 · 펼치기 · 함수 호출 · 표에 없는 이름을 넘기기(바꿔 넘기는 내용)
//   - 불러 본 내용과 같은 이름의 지역 사본(별칭으로 들인 원본을 고쳐 같은 이름으로 짓기 · 다시 선언 · 대입 · 인자 · 풀어 받기)
//   - 부르지 않고 읽기(`const open = coach.live`), 허용한 typeof 옆자리의 읽기, 대괄호 이름(`coach['live']`), 풀어 받기(`{ live } = coach`)
//   - 작은따옴표 · 따옴표 없는 `<script src>`로 싣는 게임 모듈, data-src가 앞에 선 입구(따라가기)
//   - 원문에서 `\u` 꼴로 쓴 이름(다시 찍은 글로 검사할 파일을 고른다)
// 빠짐없음은 이 검사가 아니라 4-6e-2의 실행 시험이 지킨다 — 진입 시험의 가짜 live가 받은 인자를 진짜 defineContent에 넘기고, 순간 맞춤이
// 켜져야 하는 판에서 adaptive를 단정한다. 이 검사에 새 우회 꼴이 나오면 엔진 묶음의 P1이 아니라 4-6e-2 시험 항목으로 넘긴다.
// 남는 한계: 실행 중에 FLOW_ 값을 고치는 꼴은 찾지 못한다. 지금 FLOW_ 값은 FLOW_VOICE 말고는 얼어 있지 않다(4-6e-2가 깊게 얼린다).
const METHOD = /(\??\.)(live|declaredFrom)\b(\?\.)?(\()?/g;
const FIRST = /^\s*(\.\.\.)?([A-Za-z_$][\w$]*)\s*[,)]/;
const BRACKETS = /\[\s*(["'`])(live|declaredFrom)\1\s*\]/g;
const DESTRUCTURES = [
  /\{[^{}]*\b(live|declaredFrom)\b[^{}]*\}\s*=(?![=>])/g,
  /\(\s*\{[^{}]*\b(live|declaredFrom)\b[^{}]*\}\s*\)\s*=>/g,
];
// 넘기기 이름 — 그 파일의 함수 인자로 받고 다시 대입하지 않는 이름. 받은 것을 그대로 코치에 넘긴다.
const PASS = [
  {
    files: /\/atlas-next-play\.mjs$/,
    names: ['content', 'spec'],
    spread: false,
    why: '새 길 겉이 화면 파일에서 받은 내용을 그대로 코치에 넘긴다',
  },
  {
    files: /\/kit\/atlas-next\.mjs$/,
    names: ['args'],
    spread: true,
    why: '키트가 게임 코치 겉으로 받은 인자를 그대로 넘긴다',
  },
];
// 고르는 넘기기 — 그 파일에서 그 이름에 대입하는 값이 모두 null이거나 FLOW_ 내용 가운데 하나다.
const FROM = [
  {
    file: 'order-rush/app.mjs',
    name: 'flowSpec',
    why: '주문 폭주 화면이 판 모드에 따라 FLOW_RUSH · FLOW_PRACTICE 가운데 하나를 고른다',
  },
];
// 호출이 아닌 꼴로 나와도 되는 자리 — 그 파일의 그 꼴만.
const READS = [
  {
    files: [
      'korean-racing/app.js',
      'korean-rhythm/app.mjs',
      'korean-runner/app.mjs',
      'order-rush/app.mjs',
    ],
    form: /typeof coach\.live [!=]== ""/,
    why: '엔진 판에 live가 있는지 typeof로 본다 — 부르지 않는다',
  },
  {
    files: ['story-classroom/atlas-next-play.mjs', 'story-classroom/learning.mjs'],
    form: /!Flow\?\.declaredFrom\b/,
    why: 'Flow에 declaredFrom이 있는지 본다 — 부르지 않는다',
  },
  {
    files: ['korean-racing/personalization.js'],
    form: /\blive = null\b/,
    why: '판 고르기 옵션으로 손잡이 판(coach.live가 낸 값)을 받는 칸이다 — 코치 메서드가 아니다',
  },
];

const around = (code, index) => code.slice(Math.max(0, index - 40), index + 40);
const paramOf = (code, name) =>
  new RegExp(`\\(([^()]*,\\s*)?(\\.\\.\\.)?${name}\\b[^()]*\\)\\s*(=>|\\{)`).test(code);
const assignedIn = (code, name) => new RegExp(`(^|[^\\w$.])${name}\\s*=(?![=>])`).test(code);
const assignments = (code, name) =>
  [...code.matchAll(new RegExp(`(^|[^\\w$.])${name}\\s*=(?![=>])`, 'g'))].length;
const declaredIn = (code, name) =>
  new RegExp(`\\b(const|let|var|function|class)\\s+${name}\\b`).test(code);
const destructuredIn = (code, name) =>
  new RegExp(`\\{[^{}]*\\b${name}\\b[^{}]*\\}\\s*=(?![=>])`).test(code);

// 그 파일이 별칭 없이 들인 이름이면 들인 모듈의 이름(experiences/ 기준), 아니면 null.
function importedFrom(file, raw, name) {
  for (const match of raw.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
    const names = match[1].split(',').map(one => one.trim());
    if (!names.includes(name)) continue;
    const spec = match[2];
    const base = spec.startsWith('/')
      ? spec.slice(1)
      : path.posix.join(path.posix.dirname(file), spec);
    return path.posix.normalize(base);
  }
  return null;
}

// 첫 인자 이름이 불러 본 FLOW_ 내용 그 자체인가 — 그 파일이 맨 위에서 한 번 내보내는 이름이거나, 그 이름을 내보내는 모듈에서 별칭 없이
// 들이고 다시 선언 · 대입 · 인자 · 풀어 받기로 가리지 않은 이름이다(r4 GPT GA3 — 같은 이름의 지역 사본).
function contentOf(file, { raw, masked }, name, owners) {
  const from = owners.get(name);
  if (!from) return false;
  if (from.has(file))
    return (
      /^export const /m.test(raw) &&
      new RegExp(`^export const ${name}\\s*=`, 'm').test(raw) &&
      assignments(masked, name) === 1 &&
      !paramOf(masked, name) &&
      !destructuredIn(masked, name)
    );
  const source = importedFrom(file, raw, name);
  return (
    source != null &&
    from.has(source) &&
    !assignedIn(masked, name) &&
    !declaredIn(masked, name) &&
    !paramOf(masked, name) &&
    !destructuredIn(masked, name)
  );
}

// 호출 하나의 첫 인자가 지나가는가 — 까닭(쓴 표의 자리)이나 null.
function argumentRule(file, code, after, owners) {
  const arg = FIRST.exec(after);
  if (!arg) return null;
  const [, spread, name] = arg;
  if (!spread && contentOf(file, code, name, owners)) return 'content';
  const { masked } = code;
  const pass = PASS.find(one => one.files.test(`/${file}`) && one.names.includes(name));
  if (pass && pass.spread === Boolean(spread) && paramOf(masked, name) && !assignedIn(masked, name))
    return pass;
  const from = FROM.find(one => one.file === file && one.name === name);
  if (from && !spread && pickedFrom(masked, name, owners)) return from;
  return null;
}

// 그 이름에 대입하는 값이 모두 null이거나 내용 이름 · 내용 이름 둘 가운데 고르기인가.
function pickedFrom(code, name, owners) {
  const values = [
    ...code.matchAll(new RegExp(`(?:^|[^\\w$.])${name}\\s*=(?![=>])\\s*([^;,\\n]+)`, 'g')),
  ];
  return (
    values.length > 0 &&
    values.every(([, value]) => {
      const text = value.trim();
      const picked = /^[\w$.]+ ===? "" \? (FLOW_[A-Z_]+) : (FLOW_[A-Z_]+)$/.exec(text);
      return (
        text === 'null' ||
        owners.has(text) ||
        (picked && owners.has(picked[1]) && owners.has(picked[2]))
      );
    })
  );
}

// 부르지 않고 읽은 자리(at)가 READS의 꼴 안의 바로 그 자리인가 — 옆에 있는 다른 읽기는 지나가지 않는다(r4 GPT GA4).
const readAt = (file, masked, at) =>
  READS.find(
    one =>
      one.files.includes(file) &&
      [...masked.matchAll(new RegExp(one.form.source, 'g'))].some(
        match => match.index + match[0].search(/\??\.(live|declaredFrom)\b/) === at,
      ),
  ) ?? null;
// 풀어 받기 하나가 READS의 꼴인가.
const readRule = (file, text) =>
  READS.find(one => one.files.includes(file) && one.form.test(text)) ?? null;

// 한 파일의 글(주석을 걷고 다시 찍은 것)을 본다 — 지나간 규칙은 used에, 모르는 꼴은 stray에.
function scanCode(file, code, owners, found) {
  const { raw, masked } = code;
  for (const match of masked.matchAll(METHOD)) scanMember(file, code, match, owners, found);
  for (const match of raw.matchAll(BRACKETS)) found.stray.push(`${file} 대괄호 이름: ${match[0]}`);
  for (const pattern of DESTRUCTURES)
    for (const match of masked.matchAll(pattern))
      note(found, readRule(file, match[0]), `${file} 풀어 받기: ${match[0].slice(0, 80)}`);
}

// `.live` · `.declaredFrom` 하나 — 부르면 첫 인자를, 부르지 않으면 READS의 그 자리를 본다.
function scanMember(file, code, match, owners, found) {
  const { masked } = code;
  const at = match.index;
  if (match[4]) {
    const after = masked.slice(at + match[0].length);
    note(
      found,
      argumentRule(file, code, after, owners),
      `${file} 모르는 꼴: ${around(masked, at)}`,
    );
  } else {
    note(found, readAt(file, masked, at), `${file} 부르지 않고 읽음: ${around(masked, at)}`);
  }
}

const note = (found, rule, stray) => (rule ? found.used.add(rule) : found.stray.push(stray));

const readCode = code => {
  const raw = esbuild.transformSync(code, { loader: 'js' }).code;
  return { raw, masked: maskStrings(raw) };
};

// 내용 이름 → 그것을 내보내는 파일들.
const ownersOf = contents => {
  const owners = new Map();
  for (const { file, key } of contents) owners.set(key, (owners.get(key) ?? new Set()).add(file));
  return owners;
};

test('게임 파일이 코치 live · declaredFrom에 넘기는 것은 불러 본 FLOW_ 내용이거나 까닭을 적은 넘기기뿐이다 — 모르는 꼴에서 멈춘다', async () => {
  const { files, contents } = await gameContents();
  const owners = ownersOf(contents);
  const found = { used: new Set(), stray: [] };
  for (const file of files) {
    // 고를 때도 다시 찍은 글을 본다 — 원문에서 글자를 유니코드 탈출 꼴로 적은 이름도 다시 찍으면 제 이름이 된다(r5 GPT GA4).
    const code = readCode(fs.readFileSync(path.join(EXPERIENCES, file), 'utf8'));
    if (/\b(live|declaredFrom)\b/.test(code.raw)) scanCode(file, code, owners, found);
  }
  assert.deepEqual(
    found.stray,
    [],
    '표에 없는 꼴 — 내용이면 FLOW_로 내보내고, 넘기기면 까닭과 함께 표에 더한다',
  );
  assert.ok(
    found.used.has('content'),
    '불러 본 FLOW_ 내용을 넘기는 호출을 찾지 못했다 — 찾는 법이 낡았다',
  );
  const stale = [...PASS, ...FROM, ...READS]
    .filter(one => !found.used.has(one))
    .map(one => one.why);
  assert.deepEqual(stale, [], '표의 자리가 제품에서 사라졌다 — 표에서 지운다');
});

test('호출 자리 검사가 닫는 꼴 — 띄어 쓴 호출은 지나가고, 바꿔 넘기는 내용 · 같은 이름의 지역 사본 · 옆자리 읽기 · 풀어 받기 · 대괄호 이름은 멈춘다', () => {
  const owners = ownersOf([{ file: 'korean-racing/personalization.js', key: 'FLOW_RACE' }]);
  const scan = code => {
    const found = { used: new Set(), stray: [] };
    scanCode('korean-racing/app.js', readCode(code), owners, found);
    return found;
  };
  const IMPORT = 'import { FLOW_RACE } from "./personalization.js";\n';
  assert.deepEqual(
    scan(`${IMPORT}coach\n  . live (\n FLOW_RACE, {});`).stray,
    [],
    '띄어 쓴 호출도 같은 꼴이다',
  );
  assert.deepEqual(
    scan(`${IMPORT}if (typeof coach.live === "function") coach.live(FLOW_RACE);`).stray,
    [],
    'READS의 typeof 자리는 지나간다',
  );
  const strays = [
    `${IMPORT}coach.live({ ...FLOW_RACE, knobs: [...FLOW_RACE.knobs, { id: "hint", kind: "support" }] });`,
    `${IMPORT}coach.live(FLOW_OTHER);`,
    `${IMPORT}coach.live(pick(FLOW_RACE));`,
    'coach.live(FLOW_RACE);',
    'import { FLOW_RACE as BASE } from "./personalization.js";\nconst FLOW_RACE = { ...BASE, knobs: [] };\ncoach.live(FLOW_RACE);',
    `${IMPORT}const open = typeof coach.live === "function" ? coach.live : null;\nopen?.(bad);`,
    `${IMPORT}const { live } = coach; live(FLOW_RACE);`,
    `${IMPORT}const open = coach.live; open(FLOW_RACE);`,
    `${IMPORT}coach["live"](FLOW_RACE);`,
    'const spec = { id: "x", items: LEVELS, knobs: [] }; coach.live(spec);',
  ];
  for (const code of strays) assert.ok(scan(code).stray.length > 0, code);
});

test('따라가기의 입구와 검사할 파일 고르기 — 속성 이름이 바로 src인 것만 읽고, 고를 때도 다시 찍은 글을 본다(r5 GPT GA3 · GA4)', () => {
  const srcs = html =>
    [...html.matchAll(SCRIPT_SRC)].map(match => match[1] ?? match[2] ?? match[3]);
  assert.deepEqual(
    srcs(
      '<script type="module" data-src="https://example.invalid/x.mjs" src="./flow.mjs"></script>',
    ),
    ['./flow.mjs'],
  );
  assert.deepEqual(srcs("<script src='./a.mjs'></script><SCRIPT SRC=./b.mjs></SCRIPT>"), [
    './a.mjs',
    './b.mjs',
  ]);
  assert.match(readCode('coach.l\\u0069ve(bad);').raw, /\.live\(/);
});
