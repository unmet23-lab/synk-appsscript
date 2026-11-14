'use strict';
// 최종 확인(컷 전수) 통과 기록 — 작업실 등록의 관문(11-13).
// 왜: 11-09 유호님 「전부 제대로 되는지 체크해서 완성되면 보내줘. 하나라도 미흡하면 계속 다시 만들어」로 SNS 두 브랜드 편은 게시 전에 최종 확인 세션이
//   컷 전수를 본다. 그런데 그 확인은 세션 하나에 기대고 있어, 11-13 그 세션이 멈춘 사이 14시 회차가 검수 없이 여섯 편을 승인 · 예약했다
//   (메일비서는 미흡이라 19시에 네 판을 모두 내림). 11-13 유호님 「응, 고쳐」 — 통과 기록이 없거나 그 뒤 영상이 바뀐 편은 작업실에 등록하지 않는다.
// 누구에게: 브랜드 synkbrief · yuhobuilds 가운데 슬롯이 FINAL_FROM 뒤인 편. 기록은 편 폴더 게시/최종확인.json(최종 확인 세션이 tools/최종확인.js로 쓴다).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const 묶음 = require('./게시묶음.js');

const FINAL_FROM = '2026-11-14';
const BRANDS = new Set(['synkbrief', 'yuhobuilds']);
const FILE = '최종확인.json';
// 등록을 여는 결과 둘(11-15 유호님 「작은 흠은 올리기」). 「작은 흠」은 시청자가 평소 속도로 한 번 봐서는 알아채기 어려운 흠만 남은 편이다.
// 그날 올리고, 남은 흠은 메모에 적어 다음 편의 검사 항목으로 넘긴다. 큰 흠과 작은 흠의 뜻은 제작절차.md 「미흡하면 다시」에 있다.
// 11-13~14에는 통과와 미흡 둘뿐이라 넥타이 매듭 같은 흠이 6초 멈춘 화면과 같은 무게로 편을 막았고, 아홉 편 가운데 둘만 올라갔다.
const OPEN = new Set(['통과', '작은 흠']);
// 흠의 갈래 — 미흡과 작은 흠을 쓸 때 꼭 고른다(11-15 유호님 「그 실수와 작업내용을 기억해서 다음번에는 같은 실수 안하도록 시스템화」).
// 메모 글만으로는 같은 실수가 몇 편에서 되풀이됐는지 셀 수 없어서 갈래를 정해 둔다. tools/흠장부.js가 편마다의 이력을 모아 센다.
const KINDS = ['멈춘화면', '끝약함', '사람굳음', '인물튐', '소품튐', '점프컷', '같은구도반복', '글자표', '숫자불일치', '사실', '이해안됨', '소리', '화면작음어두움', '기타'];
const HISTORY = '최종확인_이력.jsonl';
function historyFile(bundle) { return path.join(bundle.dir, '게시', HISTORY); }

// 슬롯이나 판 시각 가운데 하나라도 FINAL_FROM 뒤면 관문에 든다(슬롯은 그대로 두고 판 시각만 옮긴 편도 — Fable 검수 12)
function required(prep) {
  if (!BRANDS.has(prep?.브랜드)) return false;
  if (String(prep.슬롯 || '') >= FINAL_FROM) return true;
  return [].concat(prep.판 || []).some((p) => p && String(p.시각 || '').slice(0, 10) >= FINAL_FROM);
}

function recordFile(bundle) { return path.join(bundle.dir, '게시', FILE); }

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// 이 편이 올릴 영상 — 판이 쓰는 영상과 「최종본」(같은 파일은 한 번)
function videos(bundle) {
  const out = new Map();
  for (const plate of 묶음.plates(bundle)) {
    if (plate.video?.exists && plate.video.path) out.set(묶음.rel(bundle, plate.video.path), plate.video.path);
  }
  // 「최종본」 · 돌림 판본 영상(나라 판본 — 지금 두 브랜드엔 없지만 쓰게 되면 함께 지문을 남긴다, Fable 검수 11). 그림 · 글은 뺀다
  const more = [...[].concat(bundle.prep?.최종본 || []), ...Object.values(bundle.prep?.돌림?.판본 || {}).map((v) => v && v.파일)];
  for (const v of more) {
    const f = typeof v === 'string' && v.trim() ? 묶음.resolve(bundle, v) : null;
    if (f && 묶음.VIDEO.test(f) && fs.existsSync(f)) out.set(묶음.rel(bundle, f), f);
  }
  return out;
}

function read(bundle) {
  try { return JSON.parse(fs.readFileSync(recordFile(bundle), 'utf8')); } catch { return null; }
}

// 등록을 막을 까닭(글) — 막지 않으면 null
function problem(bundle) {
  if (!required(bundle.prep)) return null;
  const how = `최종 확인 세션이 컷 전수를 본 뒤 node tools/최종확인.js "${bundle.dir}" 통과 --메모 "…"`;
  const r = read(bundle);
  if (!r) return `최종 확인(컷 전수) 통과 기록이 없다 — ${how}`;
  if (!OPEN.has(r.결과)) return `최종 확인이 「${r.결과 || '모름'}」이다${r.메모 ? `(${r.메모})` : ''} — 고친 판을 다시 컷 전수한 뒤 ${how}`;
  if (!String(r.독립검수 || '').trim()) return `최종 확인 ${r.결과} 기록에 맥락 없는 독립 검수가 없다 — 측정 묶음만으로는 11-13 여섯 편 가운데 둘만 잡혔다. ${how} --독립검수 "누가 · 판정"`;
  const rows = new Map((r.파일 || []).map((f) => [f.경로, f]));
  for (const [rel, file] of videos(bundle)) {
    const row = rows.get(rel);
    if (!row) return `최종 확인 뒤 새 영상이 판에 들어왔다(${path.basename(file)}) — 다시 컷 전수`;
    const size = fs.statSync(file).size;
    if (row.바이트 !== size || row.sha256 !== sha256(file)) return `최종 확인 뒤 영상이 바뀌었다(${path.basename(file)}) — 다시 컷 전수`;
  }
  return null;
}

// 결과: '통과' | '작은 흠' | '미흡' · 메모: 무엇을 봤나 / 무엇이 걸렸나 · 독립검수: 맥락 없는 눈(Fable 5.2 등)의 판정 한 줄 — 통과에는 꼭
// (11-13 최종 확인 여섯 편: 측정 묶음은 둘만 잡았고 끝 3초 · 멈춘 카드 · 숫자 불일치는 맥락 없는 Fable 5.2 독립 검수가 찾았다)
function write(bundle, 결과, 메모, { 검수 = '', 독립검수 = '', 갈래 = [] } = {}) {
  const 갈래들 = [...new Set([].concat(갈래 || []).flatMap((g) => String(g).split(/[,\s]+/)).filter(Boolean))];
  const 모르는 = 갈래들.filter((g) => !KINDS.includes(g));
  if (모르는.length) throw new Error(`모르는 갈래: ${모르는.join(', ')} — ${KINDS.join(' · ')} 가운데서 고른다`);
  if (결과 !== '통과' && ['통과', '작은 흠', '미흡'].includes(결과) && !갈래들.length) throw new Error(`${결과}에는 --갈래가 있어야 한다(쉼표로 여럿) — ${KINDS.join(' · ')}`);
  if (!['통과', '작은 흠', '미흡'].includes(결과)) throw new Error(`결과는 「통과」, 「작은 흠」, 「미흡」 가운데 하나다: ${결과}`);
  if (OPEN.has(결과) && !String(독립검수 || '').trim()) throw new Error(`${결과}에는 --독립검수 "누가 · 판정"(맥락 없는 독립 검수)이 있어야 한다`);
  if (결과 === '작은 흠' && String(메모 || '').trim().length < 10) throw new Error('작은 흠에는 남은 흠을 메모에 적는다 — 다음 편의 검사 항목으로 넘긴다');
  const files = [...videos(bundle)].map(([rel, file]) => ({ 경로: rel, 바이트: fs.statSync(file).size, sha256: sha256(file) }));
  if (!files.length) throw new Error('이 편에 올릴 영상이 없다 — 준비.json 판 · 「최종본」을 본다');
  const record = { 도구: 'tools/최종확인.js', 결과, 시각: new Date().toISOString(), 메모: String(메모 || ''), ...(검수 ? { 검수 } : {}),
    ...(String(독립검수 || '').trim() ? { 독립검수: String(독립검수).trim() } : {}), ...(갈래들.length ? { 갈래: 갈래들 } : {}), 파일: files };
  fs.mkdirSync(path.dirname(recordFile(bundle)), { recursive: true });
  // 이력: 최종확인.json은 마지막 판정으로 덮이므로 판정마다 한 줄을 따로 쌓는다(영상 지문은 빼고). 흠 장부가 이 줄을 센다.
  fs.appendFileSync(historyFile(bundle), JSON.stringify({ 결과, 시각: record.시각, 갈래: 갈래들, 메모: record.메모 }) + '\n');
  fs.writeFileSync(recordFile(bundle), JSON.stringify(record, null, 2) + '\n');
  return record;
}

module.exports = { required, problem, write, read, videos, recordFile, FINAL_FROM, BRANDS, FILE, OPEN, KINDS, HISTORY, historyFile };
