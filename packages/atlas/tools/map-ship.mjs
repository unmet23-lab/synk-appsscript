// 지도를 판 폴더로 내는 꼴(설계 §9 「지도는 엔진과 따로」 · 단계 1 계획 §7). 커밋된 생성물(map/*.json)만 읽는다 — 제품 코드를
// 부르지 않으므로 패키지 빌드가 제품 은행에 기대지 않는다. 나가는 파일(공백 없는 JSON, 같은 커밋이면 같은 바이트):
//   map/index.json          전체 색인(서버 접기 · 도구 — 은퇴 문항의 번호 → 열쇠까지)
//   map/items/<은행>.json    은행 조각(제품이 자기 은행만 받는다 — 레이싱 낱말 판 2,090줄을 WORLD가 받지 않게). 쓰는 낱말이
//                           SLICE_WORDS_MAX 이하면 그 낱말 줄도 실린다(words — 낱말 표 없이 이름을 세움)
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

function sliceWords(words, units) {
  if (!words) return null;
  const used = new Set(units.filter(unit => unit.startsWith(words.prefix)));
  if (!used.size || used.size > SLICE_WORDS_MAX) return null;
  const rows = words.units.filter(([suffix]) => used.has(`${words.prefix}${suffix}`));
  return { prefix: words.prefix, fields: words.fields, units: rows };
}

// 전체 색인에서 은행 하나의 조각: 그 은행 줄(같은 문항을 함께 쓰는 은행이면 그 줄도) · 그 줄의 계열 번호만. 은퇴 목록은 싣지 않는다
// (제품은 은퇴 문항을 내지 않는다 — 번호 풀기는 전체 색인을 든 서버의 일). words(낱말 표)를 주면 그 조각이 쓰는 낱말 줄도 싣는다.
export function sliceOf(index, bank, words = null) {
  const fields = index.fields;
  const at = name => fields.indexOf(name);
  const shared = new Map((index.shared ?? []).map(([n, banks]) => [n, banks]));
  const mine = row => row[at('bank')] === bank || (shared.get(row[at('n')]) ?? []).includes(bank);
  const items = index.items.filter(mine);
  const tAt = name => index.templateFields.indexOf(name);
  const templates = index.templates.filter(row => row[tAt('bank')] === bank);
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
    bank,
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

export function banksOf(index) {
  const at = index.fields.indexOf('bank');
  const tAt = index.templateFields.indexOf('bank');
  return [
    ...new Set([...index.items.map(row => row[at]), ...index.templates.map(row => row[tAt])]),
  ].sort();
}

// 판 폴더의 map/ 아래로 나갈 파일 이름 → 바이트. 지도가 없는 뿌리(빌드 시험의 가짜 패키지)면 null — 진짜 패키지는 map/을
// 커밋해 두므로 늘 있고, check의 용량 줄이 지도 파일이 빠진 빌드를 멈춘다.
export function mapFiles(dir = MAP_DIR) {
  if (!fs.existsSync(path.join(dir, 'index.json'))) return null;
  const index = read(dir, 'index.json');
  const files = {
    'index.json': compact(index),
    'units.json': compact(read(dir, 'units.json')),
    'words.json': compact(read(dir, 'words.json')),
  };
  const words = read(dir, 'words.json');
  for (const bank of banksOf(index))
    files[`items/${bank}.json`] = compact(sliceOf(index, bank, words));
  return { files, edition: index.edition, skillsEdition: index.skillsEdition, hash: index.hash };
}
