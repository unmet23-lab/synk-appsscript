'use strict';
// 최종 확인(컷 전수) 통과 기록 — 작업실 등록의 관문(11-13).
// 왜: 11-09 유호님 「전부 제대로 되는지 체크해서 완성되면 보내줘. 하나라도 미흡하면 계속 다시 만들어」로 SNS 두 브랜드 편은 게시 전에 최종 확인 세션이
//   컷 전수를 본다. 그런데 그 확인은 세션 하나에 기대고 있어, 11-13 그 세션이 멈춘 사이 14시 회차가 검수 없이 여섯 편을 승인 · 예약했다
//   (메일비서는 미흡이라 19시에 네 판을 모두 내림). 11-13 유호님 「응, 고쳐」 — 통과 기록이 없거나 그 뒤 영상이 바뀐 편은 작업실에 등록하지 않는다.
// 누구에게: 브랜드 synkbrief · yuhobuilds 가운데 슬롯이 FINAL_FROM 뒤인 편. 기록은 편 폴더 게시/최종확인.json(최종 확인 세션이 tools/최종확인.js로 쓴다).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
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
  const why = changed(bundle, r);
  return why ? `${why} — 다시 컷 전수` : null;
}

// 기록 뒤에 판의 영상이 바뀌었으면 그 까닭(글), 그대로면 null
function changed(bundle, r) {
  const rows = new Map((r?.파일 || []).map((f) => [f.경로, f]));
  for (const [rel, file] of videos(bundle)) {
    const row = rows.get(rel);
    if (!row) return `최종 확인 뒤 새 영상이 판에 들어왔다(${path.basename(file)})`;
    const size = fs.statSync(file).size;
    if (row.바이트 !== size || row.sha256 !== sha256(file)) return `최종 확인 뒤 영상이 바뀌었다(${path.basename(file)})`;
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
  fs.writeFileSync(recordFile(bundle), JSON.stringify(record, null, 2) + '\n');
  // 이력: 최종확인.json은 마지막 판정으로 덮이므로 판정마다 한 줄을 따로 쌓는다(영상 지문은 빼고). 흠 장부가 이 줄을 센다.
  // 기록을 먼저 쓴다 — 기록 쓰기가 실패한 뒤 다시 쓸 때 이력이 두 줄이 되지 않게(11-15 Fable 검수 P3).
  fs.appendFileSync(historyFile(bundle), JSON.stringify({ 결과, 시각: record.시각, 갈래: 갈래들, 메모: record.메모 }) + '\n');
  // 맡음은 여기서 풀지 않는다 — 기록이 아직 이 워크트리에만 있어, 올리기 전에 풀면 다른 회차가 같은 편을 또 맡는다(11-15 Fable 검수 P1).
  // 올린 뒤 finish()(명령 「놓기」)가 「판정 끝」 표시로 바꾼다.
  return record;
}

// ── 다시 볼 편 찾기 · 맡기(11-15 유호님 「예약으로 바꿔」) ──
// 왜: 최종 확인은 긴 세션 하나가 뒤에서 도는 감시 스크립트로 「완성」 편을 기다렸다. 11-14 17시 반쯤 그 세션이 다시 시작되며 감시가 꺼졌고,
//   그 뒤 19시간 동안 제작 회차가 고쳐 둔 여덟 편을 아무도 다시 보지 않아 11-15 칸 두 편이 막혔다. 이제 예약 작업(synk-sns-final-check)이
//   3시간마다 scan()으로 다시 볼 편을 찾고, 제작 회차는 needsFix()로 고칠 편을 찾는다. 회차가 겹쳐도 같은 편을 둘이 보지 않게 맡음 표시를 둔다.
const LIVE_DONE = new Set(['게시됨', '예약됨']);
// 한 편은 한 시간쯤이면 끝난다. 회차는 단계마다 같은 이름으로 다시 맡아 시각을 새로 찍는다. 죽은 회차의 편은 2시간 뒤 다음 회차가 잇는다(11-15 Fable 검수 P2).
const LOCK_HOURS = 2;
const FIX_LOOKBACK_DAYS = 3;

// 제작이 끝났다고 적은 편 — 준비.json 상태가 「완성」이나 「올릴 준비」로 시작하고 올리기 전 검사가 「고칠 것」이 아니다
function ready(prep) {
  return /^(완성|올릴 준비)/.test(String(prep?.상태 || '').trim()) && String(prep?.검사?.결과 || '') !== '고칠 것';
}

function resultRows(bundle) {
  try { return [].concat(묶음.readJson(path.join(bundle.dir, '게시', '게시결과.json')).판 || []).filter(Boolean); } catch { return null; }
}

// 판마다 이미 걸렸나 — 게시결과.json에 그 계정의 상태(기본 「게시됨」 · 「예약됨」)가 있으면 걸린 판이다
function allBooked(bundle, states = LIVE_DONE) {
  const rows = resultRows(bundle);
  if (!rows) return false;
  const done = new Set(rows.filter((p) => states.has(p.상태)).map((p) => p.계정));
  const accounts = [].concat(bundle.prep?.판 || []).map((p) => p && p.계정).filter(Boolean);
  return accounts.length > 0 && accounts.every((a) => done.has(a));
}

// 판이 쓰는 영상들의 지문 하나 — 맡음의 「판정 끝」 표시가 같은 영상을 가리키는지 본다
function fingerprint(bundle) {
  const rows = [...videos(bundle)].sort(([a], [b]) => a.localeCompare(b)).map(([rel, file]) => `${rel}:${fs.statSync(file).size}:${sha256(file)}`);
  return crypto.createHash('sha256').update(rows.join('\n')).digest('hex');
}

// 통과 · 작은 흠인데 그 판정보다 먼저 걸린 「자동 등록 중지」 표식(미흡으로 작업실 예약을 거둘 때 생김) 때문에 예약큐가 등록하지 않는 편.
// 판정 뒤에 걸린 표식(통과한 편을 사람이 일부러 내린 것)은 건드리지 않는다. 이미 승인 대기 · 예약됨 · 게시됨인 판이 있으면 등록된 것이다.
// 11-15: 최종 확인 세션이 새벽에 작은 흠으로 판정한 오늘 칸 두 편이 이 표식에 걸려 등록되지 않을 뻔했다(Fable 검수 P1-2의 다른 얼굴).
const REGISTERED = new Set(['승인 대기', '예약됨', '게시됨']);
function registrationBlocked(bundle, r) {
  let m;
  try { m = 묶음.readJson(path.join(bundle.dir, '게시', '작업실_자동등록중지.json')); } catch { return false; }
  if (!m || !m.중지 || !(Date.parse(m.시각) < Date.parse(r.시각))) return false;
  const rows = resultRows(bundle) || [];
  return !rows.some((p) => REGISTERED.has(p.상태));
}

// 한 편의 차례: 관문 밖 · 이미 나감(모든 판 게시됨) · 이미 걸림(기록 없이 모든 판이 걸린 편 — 관문 앞에 나간 편) · 제작 중 ·
// 다시 볼 차례 · 고칠 차례(미흡 뒤 새 판 없음) · 등록 기다림(통과했는데 옛 중지 표식에 막힘) · 열림
function stage(bundle) {
  if (!required(bundle.prep)) return { 차례: '관문 밖' };
  if (allBooked(bundle, new Set(['게시됨']))) return { 차례: '이미 나감' };
  const r = read(bundle);
  if (!r && allBooked(bundle)) return { 차례: '이미 걸림' };
  if (r) {
    const why = changed(bundle, r);
    if (!why) {
      if (!OPEN.has(r.결과)) return { 차례: '고칠 차례', 기록: r };
      if (registrationBlocked(bundle, r)) return { 차례: '등록 기다림', 까닭: '통과 · 작은 흠인데 앞서 미흡으로 거둘 때 걸린 자동 등록 중지 표식 때문에 예약큐가 등록하지 않는다 — 명시 등록', 기록: r };
      return { 차례: '열림', 기록: r };
    }
    return ready(bundle.prep) ? { 차례: '다시 볼 차례', 까닭: why, 기록: r } : { 차례: '제작 중', 기록: r };
  }
  return ready(bundle.prep) ? { 차례: '다시 볼 차례', 까닭: '최종 확인 기록이 없다' } : { 차례: '제작 중' };
}

// 볼 영상 — 판이 실제로 올리는 영상(화질을 낮춘 사본이 아닌 것)이 먼저다. 「최종본」만 옛 파일로 남은 편에서 옛 판을 보지 않게(11-15 Fable 검수 P3)
function mainVideo(bundle) {
  const plates = 묶음.plates(bundle).filter((p) => p.video?.exists && p.video.path);
  const full = plates.find((p) => !p.video.reduced);
  if (full) return full.video.path;
  const 최종본 = [].concat(bundle.prep?.최종본 || []).map((v) => (typeof v === 'string' && v.trim() ? 묶음.resolve(bundle, v) : null))
    .find((f) => f && 묶음.VIDEO.test(f) && fs.existsSync(f));
  return 최종본 || plates[0]?.video.path || null;
}

// 두 브랜드 편 폴더를 모두 보고 편마다 차례를 매긴다(슬롯 순). 읽지 못한 폴더는 「못 읽음」으로 낸다.
// 맡음에 같은 영상의 「판정 끝」이 있으면(다른 회차가 판정해 올렸는데 이 작업본이 아직 못 따라온 편) 「판정 끝」으로 본다.
function scan(root) {
  const out = [];
  for (const name of fs.readdirSync(root).sort()) {
    if (![...BRANDS].some((b) => name.startsWith(`${b}_`))) continue;
    const dir = path.join(root, name);
    if (!fs.existsSync(path.join(dir, '게시', '준비.json'))) continue;
    let bundle;
    try { bundle = 묶음.load(dir); } catch (error) { out.push({ 편: name, 폴더: dir, 슬롯: '', 차례: '못 읽음', 까닭: error.message }); continue; }
    let s;
    try { s = stage(bundle); } catch (error) { s = { 차례: '못 읽음', 까닭: error.message }; }
    if (s.차례 === '관문 밖') continue;
    const l = readLock(bundle);
    if (s.차례 === '다시 볼 차례' && l?.끝남 && l.지문 === fingerprint(bundle)) s = { 차례: '판정 끝', 까닭: `${l.누가}가 「${l.끝남}」으로 판정해 올렸다(이 작업본은 아직 못 따라옴)` };
    let vids = [], 볼영상 = null;
    try { vids = [...videos(bundle).values()]; 볼영상 = mainVideo(bundle); } catch { /* 위 차례에 이미 까닭이 있다 */ }
    out.push({ 편: name, 폴더: dir, 브랜드: bundle.prep.브랜드, 슬롯: String(bundle.prep.슬롯 || ''), 상태: String(bundle.prep.상태 || ''), ...s,
      영상: vids, 볼영상, 맡음: lockOf(bundle) });
  }
  return out.sort((a, b) => String(a.슬롯).localeCompare(String(b.슬롯)) || a.편.localeCompare(b.편));
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 제작 회차가 먼저 고칠 편 — 최종 확인이 「미흡」이고 그 뒤 새 판이 없는 편. 슬롯이 오늘보다 FIX_LOOKBACK_DAYS일 넘게 지난 편은 뺀다.
// 슬롯이 지난 편은 「지남」 — 고친 뒤 목표 칸으로 슬롯과 판 시각을 옮긴다(11-15 Fable 검수 P2: 저녁에 미흡이 난 오늘 칸 편이 다음 날 어느 목록에도 없었다)
function needsFix(root, brand, today) {
  const from = today ? addDays(today, -FIX_LOOKBACK_DAYS) : '';
  return scan(root).filter((x) => x.차례 === '고칠 차례' && (!brand || x.브랜드 === brand) && (!from || x.슬롯 >= from))
    .map((x) => ({ ...x, 지남: Boolean(today && x.슬롯 < today) }));
}

// 맡음 표시 — 저장소 밖 한 곳(회차 사본마다 따로가 아니라 이 PC에 하나)에 편마다 파일 하나.
//   진행 중: { 누가, 시각 } — LOCK_HOURS가 지나면 없는 것으로 본다.
//   판정 끝: { 누가, 시각, 끝남: 결과, 지문 } — 올린 뒤 finish()가 남긴다. 영상 지문이 같으면 나이와 상관없이 다시 맡지 않는다.
function lockDir() { return process.env.SYNK_FINAL_LOCK_DIR || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'synk', '최종확인', '맡음'); }
function lockFile(bundle) { return path.join(lockDir(), `${bundle.name}.json`); }
function readLock(bundle) { try { return JSON.parse(fs.readFileSync(lockFile(bundle), 'utf8')); } catch { return null; } }
function lockOf(bundle, now = Date.now()) {
  const l = readLock(bundle);
  if (!l || l.끝남) return null;
  return now - Date.parse(l.시각) < LOCK_HOURS * 3600e3 ? l : null;
}

// 맡기 — 지금도 「다시 볼 차례」이고, 같은 영상의 판정 끝 표시가 없고, 다른 회차의 진행 중 표시가 없을 때만.
// 같은 회차가 자기 맡음이 살아 있을 때 다시 부르면 차례와 상관없이 시각만 새로 찍는다 — 판정을 쓴 뒤(차례가 「열림」 · 「고칠 차례」)에도
// 올리기 전까지 맡음을 잇는다(11-15 Fable 재검수 P1: 판정 뒤 다시 맡기가 「건너뛴다」로 나와 올리기를 건너뛸 뻔했다).
function take(bundle, 누가, now = Date.now()) {
  if (!String(누가 || '').trim()) throw new Error('맡기에는 --누가 "<회차 이름>"이 있어야 한다');
  const own = lockOf(bundle, now);
  if (own && own.누가 === 누가) {
    const mine = { 누가, 시각: new Date(now).toISOString() };
    fs.writeFileSync(lockFile(bundle), JSON.stringify(mine) + '\n');
    return { ok: true, 맡음: mine, 이음: true };
  }
  const s = stage(bundle);
  if (s.차례 !== '다시 볼 차례') return { ok: false, 까닭: `지금 차례가 「${s.차례}」다 — 다시 볼 편이 아니다` };
  const raw = readLock(bundle);
  if (raw?.끝남 && raw.지문 === fingerprint(bundle)) return { ok: false, 까닭: `${raw.누가}가 이 영상을 「${raw.끝남}」으로 판정했다 — 따라가기 뒤 다시 본다` };
  const l = lockOf(bundle, now);
  if (l) return { ok: false, 맡음: l, 까닭: `${l.누가}가 맡았다(${l.시각})` };
  fs.mkdirSync(lockDir(), { recursive: true });
  const mine = { 누가, 시각: new Date(now).toISOString() };
  // 낡은 맡음 · 옛 영상의 판정 끝 표시는 지우고, 새 파일을 만들 때만 성공한다 — 두 회차가 동시에 불러도 하나만 맡는다(11-15 Fable 검수 P2)
  if (raw) release(bundle);
  try { fs.writeFileSync(lockFile(bundle), JSON.stringify(mine) + '\n', { flag: 'wx' }); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const other = readLock(bundle);
    return { ok: false, 맡음: other, 까닭: `${other?.누가 || '다른 회차'}가 방금 맡았다` };
  }
  return { ok: true, 맡음: mine };
}

// 이 기록이 origin/master에 올라갔나 — 올린 뒤의 회차 작업본에서 부른다(push가 origin/master 참조를 옮긴다)
function originHas(bundle, r) {
  const rel = path.relative(bundle.repo, recordFile(bundle)).split(path.sep).join('/');
  const out = spawnSync('git', ['-C', bundle.repo, 'show', `origin/master:${rel}`], { encoding: 'utf8' });
  if (out.status !== 0) return false;
  try { const o = JSON.parse(out.stdout); return o.시각 === r.시각 && o.결과 === r.결과; } catch { return false; }
}

// 놓기 — 올린 뒤 부른다. 이 작업본의 기록이 지금 영상과 맞고 그 기록이 origin에 올라갔으면 「판정 끝」 표시로 바꾸고
// (다른 작업본이 따라오기 전에 또 맡지 않게), 아니면 맡음만 지운다 — 못 올린 판정에 표시가 남으면 그 편이 영영 다시 안 보인다(11-15 Fable 재검수 P1)
function finish(bundle, 누가 = '', { onOrigin = originHas } = {}) {
  const r = read(bundle);
  let done = false;
  try { done = Boolean(r && !changed(bundle, r)); } catch { done = false; }
  if (!done) { release(bundle); return { 끝남: null, 까닭: '지금 영상에 맞는 판정 기록이 없다' }; }
  if (!onOrigin(bundle, r)) { release(bundle); return { 끝남: null, 까닭: '판정 기록이 아직 origin에 없다(못 올림) — 맡음만 지웠다. 다음 회차가 다시 본다' }; }
  fs.mkdirSync(lockDir(), { recursive: true });
  const mark = { 누가: 누가 || readLock(bundle)?.누가 || '', 시각: new Date().toISOString(), 끝남: r.결과, 지문: fingerprint(bundle) };
  fs.writeFileSync(lockFile(bundle), JSON.stringify(mark) + '\n');
  return mark;
}
function release(bundle) { try { fs.rmSync(lockFile(bundle), { force: true }); } catch { /* 없으면 그만 */ } }

module.exports = { required, problem, changed, write, read, videos, recordFile, FINAL_FROM, BRANDS, FILE, OPEN, KINDS, HISTORY, historyFile,
  ready, allBooked, registrationBlocked, fingerprint, stage, mainVideo, scan, needsFix, lockDir, readLock, lockOf, take, originHas, finish, release, LOCK_HOURS, FIX_LOOKBACK_DAYS };
