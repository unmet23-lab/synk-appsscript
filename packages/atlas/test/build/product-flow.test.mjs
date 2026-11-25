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
  htmlTraps,
  inlineModules,
  NOT_GAME_PAGES,
  notGamePageProblems,
  scriptSrcs,
  urlText,
} from '../support/game-closure.mjs';
import { Flow } from '../flow/legacy.mjs';

// ── 제품 내용 ──
// 이 시험이 내보내기 전의 관문이다(설계 주인 11-21 — r3 GPT GA2). 판을 열 때 비로소 정의하는 게임이면 엔진의 던짐은 사용자 앞에서 게임이
// 멈추는 일이라, 그 전에 잡는다. 글자를 훑지 않고 모듈을 실제로 불러, 실행된 값을 정의해 본다 — `export { FLOW_X }` 꼴도, 이름으로 넘긴
// 문항 난도(`items: LEVELS`)도 그대로 본다.
// - 불러 볼 파일은 셸의 게임 표에 든 게임의 입구에서 import를 따라가 정한다(test/support/game-closure.mjs — 게임 목록은 셸의 게임 표 GAME_BANKS). 폴더 밖
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

// 게임 입구에서 따라간 파일 가운데 FLOW_를 적고 내보내는 모듈을 불러 내보낸 FLOW_ 값을 모은다.
async function gameContents() {
  const { games, files } = await gameClosure();
  const found = { games, files, contents: [], values: [], skipped: new Set(), unloaded: [] };
  for (const name of files) await loadOne(name, found);
  return found;
}

// 손잡이 배열 · 값 목록 · items까지 모두 얼었는가.
const deepFrozen = value =>
  value === null ||
  typeof value !== 'object' ||
  (Object.isFrozen(value) && Object.values(value).every(deepFrozen));

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
    found.values.push({ file: name, key, value });
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
  const { games, contents, values, skipped, unloaded } = await gameContents();
  assert.equal(
    games.length,
    12,
    '셸의 게임 표가 열두 곳이 아니다(4-7에 한글 만나기를 더함) — 게임이 늘거나 줄었으면 이 수를 고친다',
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
  // 실행 중에 고쳐 넘기지 못하게 FLOW_ 값은 모두 모듈에서 깊게 얼린다(4-6e-2 — 위 정의와 아래 호출 자리 검사가 보는 값이 실행 때의 값이다).
  const loose = values
    .filter(({ value }) => !deepFrozen(value))
    .map(({ file, key }) => `${file} ${key}`);
  assert.deepEqual(
    loose,
    [],
    '깊게 얼리지 않은 FLOW_ 값 — 게임 모듈에서 손잡이 · 값 목록까지 얼린다',
  );
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

// 게임 폴더의 게임이 아닌 화면(4-7 — 한글 만나기를 게임 표에 더하며, 단계 4 계획 §26-12). 입구로 따라가지 않되, 싣는 것이 적어 둔 꼴과 같고
// 게임 입구가 따라간 파일 안일 때만 지나간다 — 그래서 빼도 따라간 파일이 같다. 게임 화면의 인라인 스크립트는 그대로 함정이다(아래 htmlTraps 시험).
test('게임이 아닌 화면은 입구로 따라가지 않고, 싣는 것이 적어 둔 꼴과 같고 게임 입구가 따라간 파일 안일 때만 지나간다(4-7 §26-12)', async () => {
  const { files } = await gameClosure();
  const reached = new Set(files);
  for (const [name, page] of Object.entries(NOT_GAME_PAGES)) {
    assert.ok(page.why.length > 0, name);
    const html = fs.readFileSync(path.join(EXPERIENCES, name), 'utf8');
    assert.deepEqual(await notGamePageProblems(name, html, reached), [], name);
  }
  const name = 'hangul-stage/voice-check.html';
  const html = fs.readFileSync(path.join(EXPERIENCES, name), 'utf8');
  const problems = async (text, given = reached) =>
    (await notGamePageProblems(name, text, given)).length;
  // 아래 호출 자리 검사는 게임 파일만 본다. 이 화면의 인라인 글은 같은 검사로 따로 보아 코치의 live · declaredFrom을 부르지도 읽지도 않게
  // 한다(4-7 엔진 검수 GA1 — src · import가 같아도 옛 엔진 전역으로 코치를 열 수 있다).
  const coachUse = text =>
    inlineModules(text).flatMap(code => {
      const found = { used: new Set(), stray: [] };
      scanCode(name, readCode(code), new Map(), found);
      return found.stray;
    });
  for (const page of Object.keys(NOT_GAME_PAGES))
    assert.deepEqual(coachUse(fs.readFileSync(path.join(EXPERIENCES, page), 'utf8')), [], page);
  for (const extra of [
    'window.SynkLearning.createCoach().live({ items: {} });',
    "const open = window.SynkLearning.createCoach()['live'];",
    'const { live } = window.SynkLearning.createCoach();',
  ])
    assert.ok(coachUse(html.replace('const pack', `${extra}\nconst pack`)).length > 0, extra);
  const head = "import { createPack } from './pack.mjs';";
  assert.ok(
    html.includes(head),
    '소리 듣기 확인 화면의 인라인 module 첫 줄이 바뀌었다 — 이 시험의 장면을 고친다',
  );
  // 게임 입구가 따라간 파일이라도 import를 하나 더 들이면 멈춘다 — 코치를 부를 수 있다.
  assert.equal(
    await problems(html.replace(head, `${head}\nimport { createCoach } from './learning.mjs';`)),
    1,
  );
  // 인라인 module 말고 도는 코드(고전 인라인 스크립트 · 이벤트 속성)가 생기면 멈춘다.
  assert.equal(await problems(html.replace('</body>', '<script>window.x = 1;</script></body>')), 1);
  assert.equal(await problems(html.replace('<main>', '<main onclick="go()">')), 1);
  // 실은 파일을 게임 입구가 따라가지 않으면 멈춘다.
  assert.equal(await problems(html, new Set()), 1);
  // 적지 않은 화면은 게임 화면이다.
  assert.equal((await notGamePageProblems('hangul-stage/index.html', html, reached)).length, 1);
});

// ── 게임 파일이 코치에 넘기는 내용(설계 주인 11-21 설계 관문 답) ──
// 일곱 게임은 live를 try/catch로 감싸, 엔진이 정의할 때 던져도 게임은 멈추지 않고 순간 맞춤만 소리 없이 꺼진다. 내보낸 FLOW_ 값만 정의해
// 보면 화면 파일이 바꿔 넘기는 내용(`coach.live({ ...FLOW_RACE, knobs: [...] })`)을 놓친다. 그래서 게임 입구에서 따라간 파일에서 코치
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
// 지나가는 꼴: 같은 파일 맨 위의 `export const X = …`, 맨 위의 `const X = …`를 별칭 없이 `export { X }`로 내보낸 것(r5 GA2 — 4-6e-2),
// 그 이름을 내보내는 모듈에서 별칭 없이 들인 것. 별칭으로만 내보낸 이름 · `let` · 다시 대입 · 인자 · 풀어 받기로 가린 이름은 멈춘다.
// 빠짐없음은 이 검사가 아니라 4-6e-2의 실행 시험이 지킨다 — 게임 폴더마다 「순간 맞춤 진입」 시험이 게임의 원문 토막을 문을 거쳐 돌리고,
// 가짜 live가 받은 인자를 진짜 엔진 코치의 live(안에서 defineContent)에 넘겨, 순간 맞춤이 켜져야 하는 판에서 adaptive를 단정한다. 이
// 검사에 새 우회 꼴이 나오면 엔진 묶음의 P1이 아니라 4-6e-2 시험 항목으로 넘긴다.
// 실행 중에 FLOW_ 값을 고치는 꼴은 이 검사가 찾지 않는다 — 게임 모듈이 FLOW_ 값을 깊게 얼리고, 첫 시험이 불러 본 FLOW_ 값이 모두 깊게
// 얼어 있는지 본다(4-6e-2).
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

// 그 파일이 맨 위에서 제 이름 그대로 내보내는 선언인가 — `export const X =`이거나, 맨 위의 `const X =`를 별칭 없이 `export { X }`로
// 내보낸 것(r5 GA2). 다시 찍은 글에서 맨 위 선언은 줄 첫머리에 있다(안쪽 선언은 들여 쓰고, 같은 이름이면 esbuild가 이름을 바꾼다).
// `export { X } from '…'`(다시 내보내기)는 지역 이름을 만들지 않아 같은 파일의 지역 `const X`를 내보낸 것이 아니다 — 세지 않는다.
const exportedHere = (raw, name) =>
  new RegExp(`^export const ${name}\\s*=`, 'm').test(raw) ||
  (new RegExp(`^const ${name}\\s*=`, 'm').test(raw) &&
    [...raw.matchAll(/^export\s*\{([^}]*)\}(?!\s*from\b)/gm)].some(match =>
      match[1].split(',').some(one => one.trim() === name),
    ));

// 첫 인자 이름이 불러 본 FLOW_ 내용 그 자체인가 — 그 파일이 맨 위에서 한 번 내보내는 이름이거나, 그 이름을 내보내는 모듈에서 별칭 없이
// 들이고 다시 선언 · 대입 · 인자 · 풀어 받기로 가리지 않은 이름이다(r4 GA3 — 같은 이름의 지역 사본).
function contentOf(file, { raw, masked }, name, owners) {
  const from = owners.get(name);
  if (!from) return false;
  const untouched = !paramOf(masked, name) && !destructuredIn(masked, name);
  if (from.has(file) && exportedHere(raw, name))
    return assignments(masked, name) === 1 && untouched;
  const source = importedFrom(file, raw, name);
  return (
    source != null &&
    from.has(source) &&
    !assignedIn(masked, name) &&
    !declaredIn(masked, name) &&
    untouched
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

test('호출 자리 검사 — 같은 파일 맨 위의 const를 별칭 없이 export { X }로 내보내 넘기는 꼴은 지나가고, 별칭 · let · 다시 대입 · 인자로 가린 이름은 멈춘다(r5 GA2)', () => {
  const FILE = 'korean-racing/app.js';
  const owners = ownersOf([
    { file: FILE, key: 'FLOW_RACE' },
    { file: FILE, key: 'FLOW_OTHER' },
  ]);
  const scan = code => {
    const found = { used: new Set(), stray: [] };
    scanCode(FILE, readCode(code), owners, found);
    return found;
  };
  const SPEC =
    '{ id: "korean-racing.race", knobs: [{ id: "cruise", kind: "pace", values: [1, 2] }] }';
  for (const code of [
    `const FLOW_RACE = ${SPEC};\nexport { FLOW_RACE };\ncoach.live(FLOW_RACE, {});`,
    `const FLOW_OTHER = ${SPEC};\nconst FLOW_RACE = ${SPEC};\nexport {\n  FLOW_OTHER,\n  FLOW_RACE\n};\ncoach . live (FLOW_RACE, {});`,
    `export const FLOW_RACE = ${SPEC};\ncoach.live(FLOW_RACE, {});`,
  ]) {
    const found = scan(code);
    assert.deepEqual(found.stray, [], code);
    assert.ok(found.used.has('content'), code);
  }
  const strays = [
    // 별칭으로만 내보낸 지역 이름 — 넘기는 이름은 불러 본 내용의 이름이 아니다.
    `const BASE = ${SPEC};\nexport { BASE as FLOW_RACE };\ncoach.live(BASE, {});`,
    // 맨 위의 let은 다시 대입할 수 있다.
    `let FLOW_RACE = ${SPEC};\nexport { FLOW_RACE };\nFLOW_RACE = { ...FLOW_RACE, items: { levels: [1, 2] } };\ncoach.live(FLOW_RACE, {});`,
    `let FLOW_RACE = ${SPEC};\nexport { FLOW_RACE };\ncoach.live(FLOW_RACE, {});`,
    // 내보낸 이름을 인자로 가린 함수 안의 호출.
    `const FLOW_RACE = ${SPEC};\nexport { FLOW_RACE };\nfunction open(FLOW_RACE) { return coach.live(FLOW_RACE, {}); }`,
    // 별칭 내보내기는 그 이름을 제 이름으로 내보낸 것이 아니다.
    `const FLOW_RACE = ${SPEC};\nexport { FLOW_RACE as FLOW_OTHER };\ncoach.live(FLOW_RACE, {});`,
    // 다시 내보내기는 지역 const를 내보낸 것이 아니다 — 불러 본 값은 다른 모듈의 것이고 넘기는 것은 지역 사본이다.
    `const FLOW_RACE = { ...${SPEC}, items: { levels: [1, 2] } };\nexport { FLOW_RACE } from './learning.mjs';\ncoach.live(FLOW_RACE, {});`,
  ];
  for (const code of strays) assert.ok(scan(code).stray.length > 0, code);
});

test('따라가기의 입구와 검사할 파일 고르기 — 속성 이름이 바로 src인 것만 읽고, 고를 때도 다시 찍은 글을 본다(r5 GPT GA3 · GA4)', () => {
  const srcs = scriptSrcs;
  assert.deepEqual(
    srcs(
      '<script type="module" data-src="https://example.invalid/x.mjs" src="./flow.mjs"></script>',
    ),
    ['./flow.mjs'],
  );
  // 주석 안의 <script와 짝 없는 따옴표가 뒤의 진짜 스크립트를 삼키지 않는다(다시 검수 GA2). 주석 안의 스크립트는 싣지 않는다.
  assert.deepEqual(
    srcs(
      "<!-- <script data-note=\" -->\n<script type=module src='./app.mjs' data-note='\" src=https://example.invalid/x.mjs'></script>",
    ),
    ['./app.mjs'],
  );
  assert.deepEqual(
    srcs('<!-- <script src="./old.mjs"></script> --><script src="./new.mjs"></script>'),
    ['./new.mjs'],
  );
  // 따옴표 안의 <!--는 주석이 아니고, --!>도 주석을 닫는다(r3 GA1 · GA2 — HTML5 파서와 같다).
  assert.deepEqual(srcs('<script data-note="<!--" type="module" src="./app.mjs"></script>'), [
    './app.mjs',
  ]);
  assert.deepEqual(
    srcs("<!-- <script data-note=\" --!>\n<script type=module src='./app.mjs'></script>"),
    ['./app.mjs'],
  );
  // 곧 닫히는 주석(<!--> · <!--->)과 닫히지 않은 주석 · template · noscript 안의 스크립트, 원문 글 안의 <script는 싣지 않는다.
  assert.deepEqual(
    srcs('<!--><script src="./a.mjs"></script><!---><script src="./b.mjs"></script>'),
    ['./a.mjs', './b.mjs'],
  );
  assert.deepEqual(srcs('<script src="./a.mjs"></script><!-- <script src="./b.mjs"></script>'), [
    './a.mjs',
  ]);
  assert.deepEqual(
    srcs('<template><script src="./t.mjs"></script></template><script src="./a.mjs"></script>'),
    ['./a.mjs'],
  );
  assert.deepEqual(srcs('<noscript><script src="./n.mjs"></script></noscript>'), []);
  assert.deepEqual(
    srcs('<script>const s = \'<script src="./x.mjs">\';</script><script src="./a.mjs"></script>'),
    ['./a.mjs'],
  );
  // 같은 이름의 속성은 첫째 · 앞뒤 공백은 뺀다 · 빈 값은 싣지 않는다.
  assert.deepEqual(
    srcs(
      '<script src="./a.mjs" src="./b.mjs"></script><script src="  ./c.mjs "></script><script src=""></script>',
    ),
    ['./a.mjs', './c.mjs'],
  );
  // 입구를 조용히 빠뜨리는 꼴은 함정으로 잡는다(설계 검토 11-23 조건) — 게임 HTML에 있으면 따라가기(entriesOf)가 실패한다.
  const trap = html => htmlTraps(html).length;
  assert.equal(
    trap('<script type="module">import "./flow.mjs";</script>'),
    1,
    'src 없는 module 스크립트',
  );
  assert.equal(trap('<script>import("./flow.mjs")</script>'), 1, 'type 없는 스크립트');
  assert.equal(
    trap('<script type=" Text/JavaScript ">x()</script>'),
    1,
    'JavaScript MIME 이름은 대소문자 · 공백 무시',
  );
  assert.equal(trap('<base href="../other/"><script src="./a.mjs"></script>'), 1, '<base href>');
  assert.equal(trap('<svg><script href="./a.mjs"></script></svg>'), 1, 'SVG script');
  assert.equal(
    trap('<div><template shadowrootmode="open"><script src="./a.mjs"></script></template></div>'),
    1,
    '선언형 섀도 루트',
  );
  // 빈 인라인 · src가 있는 스크립트 · 주소를 바꾸지 않는 importmap(앞뒤 ASCII 공백은 뺀다) · 섀도 루트가 아닌 template · href 없는 base는
  // 함정이 아니다.
  assert.equal(trap('<script type="importmap">{"imports":{"three":"/three.mjs"}}</script>'), 0);
  assert.equal(trap('<script type=" ImportMap ">{"imports":{"three":"/three.mjs"}}</script>'), 0);
  assert.equal(trap('<script>  </script><script src="./a.mjs">ignored()</script>'), 0);
  assert.equal(trap('<template><script>x()</script></template><base target="_blank">'), 0);
  // 중첩 문서 · 속성으로 도는 코드 · 주소를 바꾸는 importmap도 함정이다(r4 GA1).
  assert.equal(
    trap("<iframe srcdoc=\"<script type='module' src='./frame.mjs'></script>\"></iframe>"),
    1,
    'iframe srcdoc',
  );
  for (const tag of [
    '<iframe src="./f.html"></iframe>',
    '<object data="./o.html"></object>',
    '<embed src="./e.html">',
  ])
    assert.equal(trap(tag), 1, tag);
  assert.equal(trap('<body onload="import(\'./x.mjs\')"></body>'), 1, '인라인 이벤트 속성');
  assert.equal(
    trap('<a href=" java\nscript:import(1)">a</a>'),
    1,
    'javascript: 주소(URL 파서처럼 공백 · 줄바꿈을 지운다)',
  );
  assert.equal(
    trap('<script type="importmap">{"imports":{"./learning.mjs":"./other.mjs"}}</script>'),
    1,
    '주소 키',
  );
  assert.equal(
    trap('<script type="importmap">{"imports":{},"scopes":{"/":{}}}</script>'),
    1,
    'scopes',
  );
  assert.equal(trap('<script type="importmap">{not json</script>'), 1, '읽지 못하는 표');
  assert.equal(trap('<math><script>x()</script></math>'), 1, 'MathML script');
  // src 없이 글이 있는 script는 importmap 말고는 type을 가리지 않고 막는다 — 도는지 흉내 내지 않는다(r5 GA1 · 설계 주인 잣대 ㄷ). 실제 재료에
  // 없는 데이터 스크립트 · 공백뿐인 type도 실패하는 것은 한계다(잣대 ㄴ, r4 GA3의 장면).
  for (const html of [
    '<script type="\u3000text/javascript">import("./lesson.mjs")</script>',
    '<script type="\u00a0module">x()</script>',
    '<script type="\u3000importmap">{"imports":{}}</script>',
    '<script type=" ">placeholder()</script>',
    '<script type="text/javascript; charset=utf-8">x()</script>',
    '<script type="application/ld+json">{}</script>',
    '<script language="vbscript">x()</script>',
    '<script language="javascript">x()</script>',
    '<script type="">x()</script>',
    '<script type=" Module ">x()</script>',
  ])
    assert.equal(trap(html), 1, html);
  // 모든 속성의 javascript: 값을 막는다 — 입력칸 value 같은 글도 실패하는 한계(잣대 ㄴ, r5 GA2).
  assert.equal(trap('<input value="javascript: text example">'), 1);
  // 주소는 URL 파서처럼 앞뒤 C0 · 공백만 뺀다 — U+00A0은 이름의 일부다(r4 GA2).
  assert.equal(urlText(' \t./a.mjs\n'), './a.mjs');
  assert.equal(urlText('\u00a0app.mjs'), '\u00a0app.mjs');
  assert.deepEqual(srcs('<script src="\u00a0app.mjs"></script>'), ['\u00a0app.mjs']);
  assert.deepEqual(srcs('<script src="./a\n.mjs"></script>'), ['./a.mjs'], '안의 줄바꿈은 지운다');
  // 따옴표 안의 >는 태그 끝이 아니다 — 뒤의 진짜 src를 읽는다.
  assert.deepEqual(srcs('<script data-title="3 > 2" type="module" src="./app.mjs"></script>'), [
    './app.mjs',
  ]);
  assert.deepEqual(srcs("<script data-note='a > b' src=./c.mjs></script>"), ['./c.mjs']);
  assert.deepEqual(srcs("<script src='./a.mjs'></script><SCRIPT SRC=./b.mjs></SCRIPT>"), [
    './a.mjs',
    './b.mjs',
  ]);
  assert.match(readCode('coach.l\\u0069ve(bad);').raw, /\.live\(/);
});
