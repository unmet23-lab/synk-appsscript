// 지도를 판 폴더로 내는 꼴(설계 §9 「지도는 엔진과 따로」 · 단계 1 계획 §7). 커밋된 생성물(map/*.json)만 읽는다 — 제품 코드를
// 부르지 않으므로 패키지 빌드가 제품 은행에 기대지 않는다. 나가는 파일(공백 없는 JSON, 같은 커밋이면 같은 바이트):
//   map/index.json          전체 색인(서버 접기 · 도구 — 은퇴 문항의 번호 → 열쇠까지)
//   map/items/<은행>.json    은행 조각(제품이 자기 은행만 받는다 — 레이싱 낱말 판 2,090줄을 WORLD가 받지 않게). 쓰는 낱말이
//                           SLICE_WORDS_MAX 이하면 그 낱말 줄도 실린다(words — 낱말 표 없이 이름을 세움)
//   map/items/<이름>.json    이름 붙인 조각(map/slices.json — 은행 하나에서 고른 문항만. 진단의 레이싱 조각, 단계 4 계획 §25-4)
//   map/units.json          문형 · 생활 · 글자 단위
//   map/words.json          낱말 단위 2,000(쓰는 게임만 받는다)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'map');
const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const compact = value => Buffer.from(JSON.stringify(value));

// 조각에 실을 낱말 줄의 상한(11-11 단계 4 요청 — Fable 5.2 단계 4 설계 검토 P2-5 ③). 조각이 쓰는 낱말이 이보다 적으면 그 낱말
// 줄(words.json과 같은 꼴)을 조각에 실어 제품이 낱말 표 없이 이유 문장의 이름을 세운다. 낱말 2,000 거의 전부를 쓰는 은행(레이싱)은
// 싣지 않는다 — 실으면 조각이 41 → 58KB로 상한(48KiB)을 넘고, 그 게임은 낱말 표를 어차피 받는다.
export const SLICE_WORDS_MAX = 400;

// 은행 조각에 함께 싣는 계열 줄(은행 → 함께 실을 틀 줄 은행들 — 단계 4 계획 §26-6). WORLD 홈이 늘 받는 조각(world-life — WORLD
// world-atlas-next.mjs LIFE_BANKS · homeBanksOf)에 한글 단계의 계열 줄을 싣는다. 손님 기기는 판 묶음(RECORD_EDITION)이 바뀐 요약을
// 읽을 때 한 번 다시 접는데, 그때 묶은 색인에 한글 계열 줄이 있어야 옛 한글 답이 글자 단위로 접힌다. 문항 줄은 싣지 않는다(틀 줄만).
// 이름 붙인 조각에는 싣지 않는다. 조각 상한(budget.json map.slice)은 그대로 잰다.
export const RIDE_ALONG = Object.freeze({ 'world-life': Object.freeze(['hangul-stage']) });

function sliceWords(words, units) {
  if (!words) return null;
  const used = new Set(units.filter(unit => unit.startsWith(words.prefix)));
  if (!used.size || used.size > SLICE_WORDS_MAX) return null;
  const rows = words.units.filter(([suffix]) => used.has(`${words.prefix}${suffix}`));
  return { prefix: words.prefix, fields: words.fields, units: rows };
}

// 조각에 드는 문항 줄 — 은행 조각은 그 은행 줄(같은 문항을 함께 쓰는 은행이면 그 줄도)이고, 이름 붙인 조각은 그 가운데 목록의 문항만이다.
// 목록의 문항이 색인의 그 은행에 없으면 던진다(원천 표가 바뀌었는데 slices.json을 다시 짓지 않음 · 은퇴한 문항) — 조각이 조용히 작아지지 않게.
function sliceItems(index, bank, named) {
  const at = name => index.fields.indexOf(name);
  const shared = new Map((index.shared ?? []).map(([n, banks]) => [n, banks]));
  const mine = row => row[at('bank')] === bank || (shared.get(row[at('n')]) ?? []).includes(bank);
  const listed = new Set(named?.keys ?? []);
  const picked = row => !named || listed.has(row[at('itemKey')]);
  const items = index.items.filter(row => mine(row) && picked(row));
  const found = new Set(items.map(row => row[at('itemKey')]));
  const missing = [...listed].filter(key => !found.has(key));
  if (missing.length)
    throw new Error(
      `이름 붙인 조각의 문항이 색인의 은행 ${bank}에 없다: ${missing.slice(0, 3).join(', ')}`,
    );
  return items;
}

// 전체 색인에서 조각 하나: 그 조각의 문항 줄 · 그 줄의 계열 번호만. 은퇴 목록은 싣지 않는다(제품은 은퇴 문항을 내지 않는다 — 번호 풀기는
// 전체 색인을 든 서버의 일). words(낱말 표)를 주면 그 조각이 쓰는 낱말 줄도 싣는다. name이 이름 붙인 조각(slices — namedSlices의 표)이면
// 그 은행에서 목록의 문항만 싣고 틀 줄은 싣지 않는다(틀 줄은 판마다 열쇠가 생겨 목록으로 고를 수 없다). 전체 색인은 그대로이므로 조각은
// 색인의 edition과 hash를 그대로 싣는다 — 지도 판 표지와 제시 사건의 editions가 조각 때문에 바뀌지 않는다.
export function sliceOf(index, name, words = null, slices = committedNamedSlices()) {
  const named = slices.get(name) ?? null;
  const bank = named?.bank ?? name;
  const fields = index.fields;
  const at = field => fields.indexOf(field);
  const items = sliceItems(index, bank, named);
  const tAt = field => index.templateFields.indexOf(field);
  const carried = new Set([bank, ...(Object.hasOwn(RIDE_ALONG, bank) ? RIDE_ALONG[bank] : [])]);
  const templates = named ? [] : index.templates.filter(row => carried.has(row[tAt('bank')]));
  const used = new Set([...items.map(row => row[at('f')]), ...templates.map(row => row[tAt('f')])]);
  const units = [
    ...items.flatMap(row => row[at('units')]),
    ...templates.flatMap(row => row[tAt('units')]),
  ];
  const wordRows = sliceWords(words, units);
  return {
    format: index.format,
    edition: index.edition,
    skillsEdition: index.skillsEdition,
    hash: index.hash,
    bank: name,
    fields,
    items,
    templateFields: index.templateFields,
    templates,
    families: index.families.filter(([n]) => used.has(n)),
    shared: (index.shared ?? []).filter(([n]) => items.some(row => row[at('n')] === n)),
    renames: index.renames,
    ...(wordRows ? { words: wordRows } : {}),
  };
}

// 은행 이름 규칙 — 코치가 주소 `items/<은행>.json`으로 받는다. 경로 · 주소 문자(/ # ? %)나 대문자가 들면 다른 주소를 받거나 Windows
// 나무에서 두 조각이 한 파일로 겹친다(Fable 5.2 설계 검토 11-20 — 6).
export const BANK_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// 빌드가 은행 조각 밖에 늘 내는 지도 파일.
export const MAP_ALWAYS = Object.freeze(['index.json', 'units.json', 'words.json']);

// 조각을 받는 은행 — 문항 줄 · 틀 줄의 bank 칸과, 문항을 함께 쓰는 은행(shared — sliceOf · openMap이 그 은행의 문항으로 친다). 색인의
// 꼴이 틀리거나 은행 이름이 규칙에 맞지 않으면 던진다 — 빌드도 멈추고, 공개 전 확인은 그 까닭을 문제로 알린다(설계 검토 5 · 7).
export function banksOf(index) {
  const table = name => Array.isArray(index?.[name]);
  if (!table('fields') || !table('items') || !table('templateFields') || !table('templates'))
    throw new Error(
      '지도 색인의 꼴이 아니다(fields · items · templateFields · templates가 배열이어야 한다)',
    );
  if (index.shared != null && !Array.isArray(index.shared))
    throw new Error('지도 색인의 shared가 배열이 아니다');
  const at = index.fields.indexOf('bank');
  const tAt = index.templateFields.indexOf('bank');
  if (at < 0 || tAt < 0) throw new Error('지도 색인의 문항 줄 · 틀 줄에 bank 칸이 없다');
  const shared = (index.shared ?? []).flatMap(row => (Array.isArray(row?.[1]) ? row[1] : []));
  const banks = [
    ...new Set([
      ...index.items.map(row => row?.[at]),
      ...index.templates.map(row => row?.[tAt]),
      ...shared,
    ]),
  ];
  const bad = banks.filter(bank => typeof bank !== 'string' || !BANK_NAME.test(bank));
  if (bad.length)
    throw new Error(
      `은행 이름이 규칙(${BANK_NAME.source})에 맞지 않는다: ${bad
        .slice(0, 5)
        .map(bank => JSON.stringify(bank) ?? String(bank))
        .join(', ')}`,
    );
  return banks.sort();
}

// 이름 붙인 조각 표(map/slices.json — 지도 빌드가 원천 표로 짓는다, tools/map-build.mjs): 한 줄이 [조각 이름, 은행, 문항 열쇠]다.
export const SLICES_FORMAT = 'atlas-map-slices/1';
export const SLICE_FIELDS = Object.freeze(['slice', 'bank', 'itemKey']);
const isName = value => typeof value === 'string' && BANK_NAME.test(value);

// 표 → 이름 → { bank, keys }(표의 차례 그대로). 표가 없으면 빈 표다. 꼴이 틀리거나, 이름 · 은행이 은행 이름 규칙에 맞지 않거나, 한 조각이
// 은행 둘에 걸치거나, 같은 문항이 두 번 나오면 던진다.
export function namedSlices(table) {
  const out = new Map();
  if (table == null) return out;
  const shaped =
    table.format === SLICES_FORMAT &&
    JSON.stringify(table.fields) === JSON.stringify(SLICE_FIELDS) &&
    Array.isArray(table.items);
  if (!shaped)
    throw new Error(
      `이름 붙인 조각 표의 꼴이 아니다(${SLICES_FORMAT} · ${SLICE_FIELDS.join(' · ')})`,
    );
  for (const row of table.items) {
    const [name, bank, key] = Array.isArray(row) ? row : [];
    if (!isName(name) || !isName(bank) || typeof key !== 'string' || !key)
      throw new Error(`이름 붙인 조각 표의 줄이 틀렸다(${JSON.stringify(row)})`);
    const slice = out.get(name) ?? { bank, keys: [] };
    if (slice.bank !== bank)
      throw new Error(`이름 붙인 조각 ${name}이 은행 둘(${slice.bank} · ${bank})에 걸친다`);
    if (slice.keys.includes(key)) throw new Error(`이름 붙인 조각 ${name}에 ${key}가 두 번 있다`);
    slice.keys.push(key);
    out.set(name, slice);
  }
  return out;
}

// 지도 폴더의 이름 붙인 조각 표. 표 파일이 없는 폴더(빌드 시험의 가짜 패키지 · 변형 사본)는 빈 표다 — 진짜 패키지에서 표가 빠지면 조각이
// 나가지 않고, check의 용량 줄(budget.json map.slices)이 「빌드에 없다」로 멈춘다.
export function readSlices(dir = MAP_DIR) {
  return namedSlices(
    fs.existsSync(path.join(dir, 'slices.json')) ? read(dir, 'slices.json') : null,
  );
}
// 이 패키지에 커밋된 표 — 색인만 받는 쪽(공개 전 확인 tools/publish.mjs의 mapFileNames · sliceOf)의 기본값이다. 공개 전 확인은 같은 커밋에서
// 낸 빌드 나무를 보므로 나무의 조각은 이 표로 다시 선다. 다른 표로 낸 나무면 조각 바이트가 달라 문제로 걸린다. 모듈을 불러올 때 읽지 않고 처음
// 부를 때 읽는다 — 생성물이 깨져도(쓰다 끊김) 이 모듈을 부르는 map-build --write가 원천 표에서 다시 쓸 수 있게(4-6e 첫 묶음 GB5).
let committedSlices = null;
export const committedNamedSlices = () => (committedSlices ??= readSlices());

// 이름 붙인 조각의 파일 이름 — 그 은행이 색인에 있을 때만 낸다. 은행이 없는 색인(공개 전 확인 시험의 작은 색인)에 패키지의 표를
// 들이밀지 않는다. 조각 이름이 은행 이름과 같으면 두 조각이 한 파일로 겹치므로 던진다.
function namedFileNames(index, slices) {
  const banks = banksOf(index);
  const names = [...slices].filter(([, slice]) => banks.includes(slice.bank)).map(([name]) => name);
  const clash = names.filter(name => banks.includes(name));
  if (clash.length)
    throw new Error(`이름 붙인 조각의 이름이 은행 이름과 같다: ${clash.join(', ')}`);
  return names.map(name => `items/${name}.json`);
}

function bankFileNames(index) {
  return [...MAP_ALWAYS, ...banksOf(index).map(bank => `items/${bank}.json`)];
}

// 빌드가 판 폴더의 map/ 아래로 내는 파일 이름 — 늘 내는 셋, 은행마다 조각, 이름 붙인 조각. 규칙은 여기 한 곳이다: mapFiles가 자기 출력을
// 이것과 견주고, 공개 전 확인(tools/publish.mjs)도 나무의 index.json에 이것을 적용해 기대 집합을 세운다(설계 검토 4).
export function mapFileNames(index, slices = committedNamedSlices()) {
  return [...bankFileNames(index), ...namedFileNames(index, slices)];
}

// 판 폴더의 map/ 아래로 나갈 파일 이름 → 바이트. 지도가 없는 뿌리(빌드 시험의 가짜 패키지)면 null — 진짜 패키지는 map/을
// 커밋해 두므로 늘 있고, check의 용량 줄이 지도 파일이 빠진 빌드를 멈춘다. 이름 붙인 조각 표는 같은 폴더의 slices.json이다.
export function mapFiles(dir = MAP_DIR) {
  if (!fs.existsSync(path.join(dir, 'index.json'))) return null;
  const index = read(dir, 'index.json');
  const slices = readSlices(dir);
  const files = {
    'index.json': compact(index),
    'units.json': compact(read(dir, 'units.json')),
    'words.json': compact(read(dir, 'words.json')),
  };
  const words = read(dir, 'words.json');
  for (const bank of banksOf(index))
    files[`items/${bank}.json`] = compact(sliceOf(index, bank, words, slices));
  for (const [name, slice] of slices)
    if (Object.hasOwn(files, `items/${slice.bank}.json`))
      files[`items/${name}.json`] = compact(sliceOf(index, name, words, slices));
  const made = Object.keys(files).sort();
  const expected = mapFileNames(index, slices).sort();
  if (made.length !== expected.length || made.some((name, i) => name !== expected[i]))
    throw new Error('지도 파일 이름이 mapFileNames와 다르다 — 규칙이 두 곳으로 갈라졌다');
  return { files, edition: index.edition, skillsEdition: index.skillsEdition, hash: index.hash };
}
